"""Tests that the domain package remains framework independent."""

import subprocess
import sys


def test_domain_import_does_not_import_frameworks() -> None:
    """Importing domain models does not load adapter dependencies."""

    script = (
        "import sys; "
        "import economic_service.domain.models; "
        "assert 'fastapi' not in sys.modules; "
        "assert 'pydantic' not in sys.modules; "
        "assert 'sqlalchemy' not in sys.modules"
    )
    subprocess.run([sys.executable, "-c", script], check=True)
