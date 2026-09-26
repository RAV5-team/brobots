// Package migrations embeds the goose SQL migrations of the api service.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
