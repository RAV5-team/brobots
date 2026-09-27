// Command api serves the location, catalog and matching API of RAV5.
//
// Usage:
//
//	api            start the HTTP server (default: serve)
//	api migrate    apply database migrations and exit
//	api seed       apply migrations, load demo data and exit
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/brobots/api/internal/auth"
	"github.com/brobots/api/internal/calc"
	"github.com/brobots/api/internal/calc/economics"
	"github.com/brobots/api/internal/calc/mock"
	"github.com/brobots/api/internal/config"
	"github.com/brobots/api/internal/handlers"
	"github.com/brobots/api/internal/seed"
	"github.com/brobots/api/internal/service"
	"github.com/brobots/api/internal/store"
	"github.com/brobots/api/migrations"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

var version = "dev"

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "api:", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel}))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	cmd := "serve"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}
	calculator := newCalculator(cfg, log)
	switch cmd {
	case "migrate":
		if err := migrate(ctx, pool); err != nil {
			return err
		}
		return service.New(store.New(pool), log, calculator).EnsureNorms(ctx)
	case "seed":
		if err := migrate(ctx, pool); err != nil {
			return err
		}
		return seed.Load(ctx, store.New(pool), calculator, log)
	case "serve":
	default:
		return fmt.Errorf("unknown command %q (serve, migrate, seed)", cmd)
	}

	if cfg.MigrateOnStart {
		if err := migrate(ctx, pool); err != nil {
			return err
		}
	}
	st := store.New(pool)
	svc := service.New(st, log, calculator)
	if err := svc.EnsureNorms(ctx); err != nil {
		return fmt.Errorf("norms: %w", err)
	}
	if cfg.SeedDemo {
		if err := seed.Load(ctx, st, calculator, log); err != nil {
			return fmt.Errorf("seed: %w", err)
		}
	}
	mw, ready, err := authMiddleware(ctx, cfg, log)
	if err != nil {
		return err
	}
	opts := handlers.Options{Version: version, SwaggerEnabled: cfg.SwaggerEnabled, Auth: mw, AuthReady: ready}
	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           handlers.NewRouter(svc, log, opts),
		ReadHeaderTimeout: 10 * time.Second,
	}
	errCh := make(chan error, 1)
	go func() {
		log.Info("listening", slog.String("addr", cfg.HTTPAddr), slog.String("version", version))
		errCh <- srv.ListenAndServe()
	}()
	select {
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
	}
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdown)
}

// newCalculator is the economics service when ECONOMICS_URL is set, otherwise the mock model.
func newCalculator(cfg config.Config, log *slog.Logger) calc.Calculator {
	if cfg.EconomicsURL == "" {
		log.Warn("ECONOMICS_URL is not set: calculation uses the mock model", slog.String("model", mock.Version))
		return mock.New()
	}
	log.Info("calculation by the economics service", slog.String("url", cfg.EconomicsURL),
		slog.Duration("timeout", cfg.EconomicsTimeout))
	return economics.New(cfg.EconomicsURL, cfg.EconomicsTimeout)
}

// authMiddleware verifies Keycloak tokens; ready reports whether the keys are loaded (nil: always).
func authMiddleware(ctx context.Context, cfg config.Config, log *slog.Logger) (*auth.Middleware, func() bool, error) {
	var verifier *auth.Verifier
	var ready func() bool
	if cfg.OIDCEnabled() {
		keys := auth.NewKeySet(cfg.OIDCJWKSURL)
		// Until the first successful fetch /readyz answers 503; Keycloak may start after the api.
		go keys.RefreshUntilReady(ctx, 2*time.Second, func(err error) {
			log.Warn("keycloak keys are not loaded yet", slog.Any("error", err))
		})
		verifier, ready = auth.NewVerifier(cfg.OIDCIssuer, cfg.OIDCAudience, keys), keys.Ready
	}
	if !cfg.AuthDevMode {
		return auth.NewMiddleware(verifier), ready, nil
	}
	// TODO(dev-auth): удалить вместе с dev-режимом.
	dev, err := auth.NewDevIdentity(cfg.AuthDevSub, cfg.AuthDevRoles)
	if err != nil {
		return nil, nil, err
	}
	log.Warn("AUTH DEV MODE: requests without a token act as the dev user — never enable outside local",
		slog.String("sub", dev.Subject), slog.Any("roles", dev.Roles), slog.Bool("keycloak", cfg.OIDCEnabled()))
	return auth.NewDevMiddleware(verifier, dev), ready, nil
}

func connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	var lastErr error
	for attempt := 0; attempt < 30; attempt++ {
		pool, err := pgxpool.New(ctx, url)
		if err == nil {
			if err = pool.Ping(ctx); err == nil {
				return pool, nil
			}
			pool.Close()
		}
		lastErr = err
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(time.Second):
		}
	}
	return nil, fmt.Errorf("connect to database: %w", lastErr)
}

func migrate(ctx context.Context, pool *pgxpool.Pool) error {
	db := stdlib.OpenDBFromPool(pool)
	defer db.Close() //nolint:errcheck // closes the sql.DB wrapper only; the pool stays open
	goose.SetBaseFS(migrations.FS)
	goose.SetLogger(goose.NopLogger())
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	if err := goose.UpContext(ctx, db, "."); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}
