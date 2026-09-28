"""2D-трассы для моков (плеер 07a, кадр отчёта 09): `npm run gen:traces` (Docker, Python 3.12).

Трассы пишет настоящий движок services/simulation (simcore) — формат ровно тот, что отдаёт
GET /api/simulations/{id}/traces (simcore.viz.export_trace). Код сервиса только импортируется, не меняется.
Вход — демо-вход сервиса (adapters/web/demo_input.json: РЦ Химки — 1 000 + 1 000 паллет, пик 1,5,
две смены по 11 ч с 07:00), состав — как в фикстурах проекта: из подбора 18/6, рекомендация 16/5.
Робот — первая конфигурация демо-входа (Ronavi H1500): ТТХ AMR 800 в демо-входе нет. Seed — сервиса
(verify._TRACE_SEED), поэтому повторный запуск даёт тот же файл. Числа трасс синтетические, не из PRD.
"""

from __future__ import annotations

import json
import pathlib
import sys

WEB = pathlib.Path(__file__).resolve().parents[1]
SIMULATION = WEB.parents[1] / "services" / "simulation"
sys.path.insert(0, str(SIMULATION))

from adapters.web import demo_input  # noqa: E402
from simcore import engine, evaluate, inputs, metrics, viz  # noqa: E402
from simcore import verify  # noqa: E402

OUTPUT = WEB / "src" / "mocks" / "fixtures" / "traces"
STEP_S = 15.0
FLEETS = (
    ("demo-18-6", "Из подбора: 18/6", 18, 6),
    ("demo-16-5", "Рекомендация: 16/5", 16, 5),
)


# Поля демо-входа для экрана сервиса, которых нет в схеме запроса (см. adapters/web/demo_input.py).
SCREEN_ONLY = {"robot": ("note", "robot_id"), "calc": ("robots_per_charger",)}


def request() -> dict:
    """Запрос шага «Симуляция»: демо-вход сервиса с первой конфигурацией, без полей экрана."""
    config = demo_input.demo_configurations()[0]
    for block, keys in SCREEN_ONLY.items():
        config[block] = {k: v for k, v in config[block].items() if k not in keys}
    return {"configuration": config, "location": demo_input.location(), "task": demo_input.task()}


def scenario() -> dict:
    """Сценарий «как в расчёте»: условия по умолчанию."""
    return {"name": "РЦ Химки · перемещение паллет", "simulation_params": {}}


def trace(ev: evaluate.CaseEvaluator, name: str, robots: int, chargers: int) -> dict:
    """Одна трасса — тем же циклом, что verify._traces в сервисе."""
    b = ev.b
    res = engine.Simulation(
        b.site, b.robot, b.a, ev.lay, robots, chargers,
        seed=verify._TRACE_SEED, trace=True, profile=b.profile, in_share=b.in_share,
    ).run()
    kpis = metrics.compute_kpis(res, b.site, b.a)
    tr = viz.export_trace(res, kpis, name, step_s=STEP_S)
    tr["clock_offset_h"] = b.schedule.start_h
    return tr


def main() -> None:
    b = inputs.build(request(), scenario())
    ev = evaluate.CaseEvaluator(b, lambda _message: None)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for key, name, robots, chargers in FLEETS:
        path = OUTPUT / f"{key}.json"
        path.write_text(json.dumps(trace(ev, name, robots, chargers), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"→ {path.relative_to(WEB)} ({path.stat().st_size // 1024} КБ)")


if __name__ == "__main__":
    main()
