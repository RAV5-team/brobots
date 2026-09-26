"""Стражи архитектуры: гексагональные слои и отсутствие экономики.

Слои и направление зависимостей:

    simcore      — домен: модель имитации; только stdlib без ввода-вывода,
                   simpy и networkx;
    application  — сценарии и порты: домен и stdlib без ввода-вывода;
    adapters     — веб, воркер, PostgreSQL, процессы: реализуют порты и
                   вызывают сценарии; друг о друге не знают;
    app          — корень сборки: единственное место, где известны
                   конкретные адаптеры.

Экономики в сервисе нет: ни модулей, ни импортов, ни денежных имён, ни рублей в
интерфейсе.
"""

from __future__ import annotations

import ast
import dataclasses
import pathlib
import re
import sys

import pytest

from simcore import scenario as scenario_lib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SIMCORE = ROOT / "simcore"
ECONOMICS_MODULES = ("economics", "econ_bridge")
MONEY_NAMES = frozenset(
    {
        "Prices",
        "price_rub",
        "charger_price_rub",
        "robot_price_rub",
        "BASE_OPEX",
        "economics_basis",
        "economics_preview",
        "norms_version",
        "charger_break_even_robots",
        "capex_total",
        "payback_years",
        "rub",
    }
)
UI_PAGES = ("adapters/web/static/index.html",)
# Стандартные модули с вводом-выводом, процессами, потоками и случайными
# номерами: домену они не нужны.
IO_STDLIB = frozenset(
    {
        "gzip",
        "http",
        "io",
        "json",
        "logging",
        "multiprocessing",
        "os",
        "pathlib",
        "socket",
        "sqlite3",
        "subprocess",
        "sys",
        "threading",
        "urllib",
        "uuid",
    }
)
DOMAIN_THIRD_PARTY = frozenset({"simpy", "networkx"})
APPLICATION_ALLOWED = frozenset(
    {
        "__future__",
        "application",
        "collections",
        "dataclasses",
        "logging",
        "simcore",
        "threading",
        "typing",
    }
)
# Адаптер → модули адаптеров, которые ему запрещены.
ADAPTER_BOUNDARIES = {
    "web": ("adapters.postgres", "adapters.processes", "adapters.worker"),
    "worker": ("adapters.postgres", "adapters.processes", "adapters.web"),
    "postgres": ("adapters.processes", "adapters.web", "adapters.worker"),
    "processes": ("adapters.postgres", "adapters.web", "adapters.worker"),
}
# Внешние библиотеки, которые адаптеру запрещены.
ADAPTER_FORBIDDEN_LIBS = {
    "web": ("psycopg", "psycopg_pool", "multiprocessing"),
    "worker": ("psycopg", "psycopg_pool", "multiprocessing"),
    "processes": ("psycopg", "psycopg_pool"),
}
CONCRETE_ADAPTERS = (
    "adapters.postgres",
    "adapters.processes",
    "adapters.worker",
)
TEST_DOUBLE_CLASS = re.compile(r"InMemory|Fake|Stub")


def _py(package: str) -> list[pathlib.Path]:
    return sorted(
        p
        for p in (ROOT / package).rglob("*.py")
        if "__pycache__" not in p.parts
    )


def runtime_modules() -> list[pathlib.Path]:
    """Модули, которые попадают в сервис (без тестов и миграций)."""
    return [
        *_py("simcore"),
        *_py("application"),
        *_py("adapters"),
        *_py("app"),
    ]


def service_modules() -> list[pathlib.Path]:
    """Все Python-файлы сервиса, которые проверяет страж экономики."""
    paths = [*runtime_modules(), *_py("migrations"), ROOT / "gen_docs.py"]
    return sorted(p for p in paths if p.name != "__init__.py")


def _rel(path: pathlib.Path) -> str:
    return str(path.relative_to(ROOT))


def imported_modules(path: pathlib.Path) -> set[str]:
    """Полные имена модулей, которые тянет файл, в любой форме импорта.

    Для `from a.b import c` возвращает и a.b, и a.b.c: во второй форме имя
    модуля лежит в alias, а не в module.
    """
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            names.add(node.module)
            names.update(f"{node.module}.{a.name}" for a in node.names)
        elif isinstance(node, ast.Import):
            names.update(a.name for a in node.names)
    return names


def imported_roots(path: pathlib.Path) -> set[str]:
    """Корневые пакеты импортов файла."""
    return {name.split(".")[0] for name in imported_modules(path)}


def relative_imports(path: pathlib.Path) -> list[int]:
    """Строки с относительными импортами — их быть не должно."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    return [
        node.lineno
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom) and node.level
    ]


def _imports_any(path: pathlib.Path, prefixes: tuple[str, ...]) -> set[str]:
    return {
        name
        for name in imported_modules(path)
        for prefix in prefixes
        if name == prefix or name.startswith(f"{prefix}.")
    }


def used_identifiers(path: pathlib.Path) -> set[str]:
    """Возвращает имена, атрибуты и ключевые аргументы из файла."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    used = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            used.add(node.id)
        elif isinstance(node, ast.Attribute):
            used.add(node.attr)
        elif isinstance(node, ast.alias):
            used.add(node.asname or node.name.split(".")[-1])
        elif isinstance(node, ast.keyword) and node.arg:
            used.add(node.arg)
        elif isinstance(node, (ast.FunctionDef, ast.ClassDef)):
            used.add(node.name)
    return used


# --- слои ----------------------------------------------------------------
@pytest.mark.parametrize("path", _py("simcore"), ids=_rel)
def test_domain_uses_only_pure_stdlib_and_simulation_libraries(path):
    allowed_stdlib = set(sys.stdlib_module_names) - IO_STDLIB
    roots = imported_roots(path) - {"simcore", "__future__"}

    assert roots <= allowed_stdlib | DOMAIN_THIRD_PARTY, (
        roots - allowed_stdlib - DOMAIN_THIRD_PARTY
    )


@pytest.mark.parametrize("path", _py("application"), ids=_rel)
def test_application_depends_only_on_domain_and_pure_stdlib(path):
    roots = imported_roots(path)

    assert roots <= APPLICATION_ALLOWED, roots - APPLICATION_ALLOWED


@pytest.mark.parametrize(
    "path", [*_py("simcore"), *_py("application"), *_py("adapters")], ids=_rel
)
def test_nothing_imports_the_composition_root(path):
    assert "app" not in imported_roots(path)


@pytest.mark.parametrize("adapter", sorted(ADAPTER_BOUNDARIES))
def test_adapters_do_not_know_each_other(adapter):
    for path in _py(f"adapters/{adapter}"):
        found = _imports_any(path, ADAPTER_BOUNDARIES[adapter])
        assert not found, f"{_rel(path)}: {sorted(found)}"


@pytest.mark.parametrize("adapter", sorted(ADAPTER_FORBIDDEN_LIBS))
def test_adapters_do_not_reach_for_foreign_infrastructure(adapter):
    for path in _py(f"adapters/{adapter}"):
        found = imported_roots(path) & set(ADAPTER_FORBIDDEN_LIBS[adapter])
        assert not found, f"{_rel(path)}: {sorted(found)}"


@pytest.mark.parametrize(
    "path",
    [p for p in runtime_modules() if p.parts[-2] != "app"],
    ids=_rel,
)
def test_only_the_composition_root_wires_concrete_adapters(path):
    own = ".".join(path.relative_to(ROOT).with_suffix("").parts[:2])
    found = {
        name
        for name in _imports_any(path, CONCRETE_ADAPTERS)
        if not name.startswith(own)
    }
    assert not found, sorted(found)


@pytest.mark.parametrize("path", service_modules(), ids=_rel)
def test_imports_are_absolute(path):
    assert not relative_imports(path)


@pytest.mark.parametrize("path", runtime_modules(), ids=_rel)
def test_no_in_memory_runtime_mode(path):
    tree = ast.parse(path.read_text(encoding="utf-8"))
    doubles = [
        node.name
        for node in ast.walk(tree)
        if isinstance(node, ast.ClassDef)
        and TEST_DOUBLE_CLASS.search(node.name)
    ]
    assert not doubles
    assert "fakes" not in imported_roots(path)


# --- экономики нет ---------------------------------------------------------
def test_no_economics_modules():
    for name in ECONOMICS_MODULES:
        assert not (SIMCORE / f"{name}.py").exists(), name


@pytest.mark.parametrize("path", service_modules(), ids=_rel)
def test_nothing_imports_economics(path):
    imported = {part for n in imported_modules(path) for part in n.split(".")}
    for name in ECONOMICS_MODULES:
        assert name not in imported, f"{path.name} импортирует {name}"


@pytest.mark.parametrize("path", service_modules(), ids=_rel)
def test_service_module_has_no_money_identifiers(path):
    found = used_identifiers(path) & MONEY_NAMES
    assert not found, f"{path.name}: {sorted(found)}"


def test_built_has_calc_and_no_money():
    names = {f.name for f in dataclasses.fields(scenario_lib.Built)}
    assert "calc" in names
    assert not names & {"prices", "econ", "k_repl", "norms", "baseline"}


@pytest.mark.parametrize("page", UI_PAGES)
def test_ui_has_no_economics(page):
    html = (ROOT / page).read_text(encoding="utf-8")
    assert "economics" not in html
    assert "₽" not in html
