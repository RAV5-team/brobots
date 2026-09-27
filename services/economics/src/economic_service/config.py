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
        )
