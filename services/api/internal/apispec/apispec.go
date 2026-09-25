// Package apispec embeds the OpenAPI contract of the service.
// The contract is generated from Go types into packages/contracts/openapi/api.yaml
// and copied here for embedding; run `go generate ./...` after changing the API.
package apispec

import _ "embed"

//go:generate go run ../../tools/openapi -out ../../../../packages/contracts/openapi/api.yaml -copy openapi.yaml

// Spec is the OpenAPI 3 document served at /api/v1/openapi.yaml.
//
//go:embed openapi.yaml
var Spec []byte
