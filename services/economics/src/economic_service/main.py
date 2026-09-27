"""Uvicorn entry point for the RAV5 economic service."""

from economic_service.http_app import create_app

app = create_app()
