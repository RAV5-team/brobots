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
	switch cmd {
	case "migrate":
		return migrate(ctx, pool)
	case "seed":
		if err := migrate(ctx, pool); err != nil {
			return err
		}
		return seed.Load(ctx, store.New(pool), log)
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
	if cfg.SeedDemo {
		if err := seed.Load(ctx, st, log); err != nil {
			return fmt.Errorf("seed: %w", err)
		}
	}
	keys := auth.NewKeySet(cfg.OIDCJWKSURL)
	// Until the first successful fetch /readyz answers 503; Keycloak may start after the api.
	go keys.RefreshUntilReady(ctx, 2*time.Second, func(err error) {
		log.Warn("keycloak keys are not loaded yet", slog.Any("error", err))
	})
	opts := handlers.Options{
		Version:        version,
		SwaggerEnabled: cfg.SwaggerEnabled,
		Auth:           auth.NewMiddleware(auth.NewVerifier(cfg.OIDCIssuer, cfg.OIDCAudience, keys)),
		AuthReady:      keys.Ready,
	}
	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           handlers.NewRouter(service.New(st, log), log, opts),
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
