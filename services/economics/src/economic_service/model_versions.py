"""Calculation model versions served by this deployment."""

from economic_service.application.ranking import RankingModelRegistry

# Callers pin this version in their projects. Bump it whenever formulas,
# assumptions or rounding change; keep an old version here only while the
# code can still reproduce it.
CALCULATION_MODEL_VERSION = "economic-v1.2"
SUPPORTED_CALCULATION_MODEL_VERSIONS = frozenset({CALCULATION_MODEL_VERSION})
RANKING_MODEL_VERSION = RankingModelRegistry.ranking_v1().default_version


def is_supported_calculation_version(model_version: str) -> bool:
    """Returns whether this deployment calculates the requested version."""

    return model_version in SUPPORTED_CALCULATION_MODEL_VERSIONS
