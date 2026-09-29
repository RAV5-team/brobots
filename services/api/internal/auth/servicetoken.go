package auth

import (
	"context"
	"net/http"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/clientcredentials"
)

// ServiceTransport adds the service token of api (client credentials of rav5-api-internal, role service) to the calls
// of the wrapped transport: api calls services/economics and the internal paths of services/simulation as itself
// (docs/keycloak/middleware.md §4.5). The token is cached and renewed before it expires; the user's token is not sent.
func ServiceTransport(ctx context.Context, tokenURL, clientID, clientSecret string) func(http.RoundTripper) http.RoundTripper {
	cc := clientcredentials.Config{ClientID: clientID, ClientSecret: clientSecret, TokenURL: tokenURL}
	tokenHTTP := &http.Client{Timeout: 10 * time.Second}
	source := oauth2.ReuseTokenSource(nil, cc.TokenSource(context.WithValue(ctx, oauth2.HTTPClient, tokenHTTP)))
	return func(base http.RoundTripper) http.RoundTripper {
		return &oauth2.Transport{Source: source, Base: base}
	}
}
