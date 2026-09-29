"""Ошибки прикладного слоя: их понимают и сценарии, и адаптеры."""

from __future__ import annotations

from collections.abc import Mapping, Sequence


class StorageUnavailableError(Exception):
    """Хранилище недоступно: соединения нет или пул исчерпан."""


class ScenarioFailedError(Exception):
    """Расчёт сценария упал; задание завершается ошибкой.

    Attributes:
        detail: Трассировка стека для хранилища; None, если её нет.
    """

    def __init__(self, message: str, detail: str | None) -> None:
        super().__init__(message)
        self.detail = detail


class InvalidSubmissionError(ValueError):
    """Задание не принято: вход не прошёл проверку.

    Attributes:
        errors: Ошибки вида {"field": путь, "message": текст}.
    """

    def __init__(
        self, message: str, errors: Sequence[Mapping[str, str]]
    ) -> None:
        super().__init__(message)
        self.errors = [dict(e) for e in errors]


class InvalidTokenError(Exception):
    """Токен доступа невалиден, просрочен или не является access token."""


class GuestLimitError(Exception):
    """Гостевых заданий в работе столько, сколько сервис допускает."""
