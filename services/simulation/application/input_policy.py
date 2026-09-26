"""Правило приёма входа: строки, которые хранилище не примет.

PostgreSQL не хранит в тексте и jsonb символ NUL и одиночные суррогаты; такие
поля отклоняются при приёме задания, а не падают при записи.
"""

from __future__ import annotations

from typing import Any


def _storable(text: str) -> bool:
    """Примет ли PostgreSQL строку: без NUL и одиночных суррогатов."""
    if "\x00" in text:
        return False
    try:
        text.encode("utf-8")
    except UnicodeEncodeError:
        return False
    return True


def unstorable_fields(value: Any, path: str = "") -> list[str]:
    """Находит строки, которые PostgreSQL не примет, — с путями до полей.

    Args:
        value: Разобранное тело запроса.
        path: Путь до value (для рекурсии).

    Returns:
        Отсортированные пути полей с NUL или одиночными суррогатами в ключе
        или значении.
    """
    found: list[str] = []
    if isinstance(value, str):
        return [] if _storable(value) else [path]
    if isinstance(value, dict):
        for key, item in value.items():
            child = f"{path}.{key}" if path else str(key)
            if isinstance(key, str) and not _storable(key):
                found.append(child)
            else:
                found += unstorable_fields(item, child)
    elif isinstance(value, list):
        for i, item in enumerate(value):
            found += unstorable_fields(item, f"{path}[{i}]")
    return sorted(found)
