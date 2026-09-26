"""JSON-кодек адаптеров: хранение в PostgreSQL и ответы API.

PostgreSQL jsonb не принимает NaN и ±Infinity, а JSON-ответ с ними невалиден,
поэтому перед записью и отдачей значения проходят json_safe. Трассы хранятся
сжатыми gzip: они большие и внутри никогда не запрашиваются.
"""

from __future__ import annotations

import gzip
import json
import math
from typing import Any

_GZIP_LEVEL = 6


def json_safe(value: Any) -> Any:
    """Возвращает копию значения, пригодную для JSON и jsonb.

    NaN и ±Infinity становятся None, кортежи — списками.

    Args:
        value: Значение из словарей, списков, кортежей и скаляров.

    Returns:
        Значение без NaN и бесконечностей.
    """
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {k: json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(v) for v in value]
    return value


def dumps(value: Any) -> str:
    """Компактный UTF-8 JSON; NaN и бесконечности — ошибка.

    Raises:
        ValueError: В значении есть NaN или бесконечность (не прошло
            json_safe).
    """
    return json.dumps(
        value, ensure_ascii=False, allow_nan=False, separators=(",", ":")
    )


def pack_traces(traces: list[dict]) -> tuple[bytes, int]:
    """Сжимает трассы для хранения.

    Args:
        traces: Трассы прогона (1–2).

    Returns:
        (gzip компактного JSON, размер JSON до сжатия в байтах).
    """
    raw = dumps(json_safe(traces)).encode("utf-8")
    return gzip.compress(raw, compresslevel=_GZIP_LEVEL), len(raw)
