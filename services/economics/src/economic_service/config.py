"""Application configuration for the economic service."""

import os
from dataclasses import dataclass

_DEFAULT_APP_NAME = "economic-service"
_DEFAULT_ENVIRONMENT = "development"
_DEFAULT_LOG_LEVEL = "INFO"
_DEFAULT_DATABASE_URL = (
    "postgresql+psycopg://economic:economic@localhost:5432/economic"
)


@dataclass(frozen=True, slots=True)
class AppSettings:
    """Represents configuration required to run the HTTP application."""

    app_name: str = _DEFAULT_APP_NAME
    environment: str = _DEFAULT_ENVIRONMENT
    log_level: str = _DEFAULT_LOG_LEVEL
    database_url: str = _DEFAULT_DATABASE_URL
    # Keycloak token check (docs/keycloak/middleware.md); empty issuer turns the
    # check off, which is allowed only in development and test.
    oidc_issuer: str = ""
    oidc_jwks_url: str = ""
    oidc_audience: str = "rav5-economics"
    internal_caller_azp: str = "rav5-api-internal"

    @property
    def auth_enabled(self) -> bool:
        """Whether the API accepts only the service token of api."""

        return bool(self.oidc_issuer)

    @classmethod
    def from_environment(cls) -> "AppSettings":
        """Creates settings from environment variables with safe defaults."""

        return cls(
            app_name=os.getenv("ECONOMIC_SERVICE_NAME", _DEFAULT_APP_NAME),
            environment=os.getenv("ECONOMIC_SERVICE_ENV", _DEFAULT_ENVIRONMENT),
            log_level=os.getenv(
                "ECONOMIC_SERVICE_LOG_LEVEL", _DEFAULT_LOG_LEVEL
            ),
            database_url=os.getenv("DATABASE_URL", _DEFAULT_DATABASE_URL),
            oidc_issuer=os.getenv("OIDC_ISSUER", ""),
            oidc_jwks_url=os.getenv("OIDC_JWKS_URL", ""),
            oidc_audience=os.getenv("OIDC_AUDIENCE", "rav5-economics"),
            internal_caller_azp=os.getenv(
                "INTERNAL_CALLER_AZP", "rav5-api-internal"
            ),
        )
