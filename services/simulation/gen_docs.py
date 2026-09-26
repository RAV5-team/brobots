"""Перегенерирует контракт сервиса docs/openapi.json из кода.

    python gen_docs.py

Схема запроса и параметров шага входит в него (components.schemas). Тест
сверяет файл с кодом, поэтому после изменения контракта команду нужно
запустить.
"""

from __future__ import annotations

import json
import pathlib

from adapters.web import openapi

_DOCS = pathlib.Path(__file__).resolve().parent / "docs"
_FILES = {"openapi.json": openapi.spec}


def main() -> None:
    """Записывает контракт и печатает, изменился ли он."""
    for name, build in _FILES.items():
        path = _DOCS / name
        text = json.dumps(build(), ensure_ascii=False, indent=2) + "\n"
        old = path.read_text(encoding="utf-8") if path.exists() else ""
        path.write_text(text, encoding="utf-8")
        print(
            f"{path.relative_to(_DOCS.parent)}: "
            f"{"обновлён" if text != old else "без изменений"}"
        )


if __name__ == "__main__":
    main()
