"""Structured logging setup for the economic service."""

import json
import logging
import sys
from typing import Any


class JsonFormatter(logging.Formatter):
    """Formats log records as compact JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        """Formats a log record with stable fields for log collectors."""

        payload: dict[str, Any] = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(log_level: str) -> None:
    """Configures process logging for the HTTP service."""

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level.upper())
