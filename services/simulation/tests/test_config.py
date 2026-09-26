"""Настройки сервиса из переменных окружения."""

from __future__ import annotations

import io
import logging

import pytest

from app import config

_URL = "postgresql://sim:secret@db:5432/simulation"


def test_database_url_is_required():
    with pytest.raises(config.ConfigError, match="DATABASE_URL"):
        config.Settings.from_env({})


def test_defaults():
    settings = config.Settings.from_env({"DATABASE_URL": _URL})

    assert settings.database_url == _URL
    assert settings.port == 8765
    assert settings.workers == 1
    assert settings.stale_after_s > 3 * settings.heartbeat_s


def test_values_are_read_and_typed():
    settings = config.Settings.from_env(
        {
            "DATABASE_URL": _URL,
            "PORT": "9000",
            "SIM_WORKERS": "0",
            "SIM_DB_POOL_MAX": "4",
            "SIM_HEARTBEAT_S": "2.5",
        }
    )

    assert (settings.port, settings.workers, settings.db_pool_max) == (
        9000,
        0,
        4,
    )
    assert settings.heartbeat_s == 2.5


@pytest.mark.parametrize(
    "name, value",
    [("PORT", "abc"), ("SIM_WORKERS", "-1"), ("SIM_DB_POOL_MAX", "0")],
)
def test_bad_values_are_rejected_with_the_variable_name(name, value):
    with pytest.raises(config.ConfigError, match=name):
        config.Settings.from_env({"DATABASE_URL": _URL, name: value})


def test_stale_timeout_must_exceed_three_heartbeats():
    with pytest.raises(config.ConfigError, match="SIM_STALE_AFTER_S"):
        config.Settings.from_env(
            {
                "DATABASE_URL": _URL,
                "SIM_HEARTBEAT_S": "10",
                "SIM_STALE_AFTER_S": "20",
            }
        )


def test_masked_url_hides_the_password():
    settings = config.Settings.from_env({"DATABASE_URL": _URL})

    assert "secret" not in settings.masked_database_url()
    assert "db:5432/simulation" in settings.masked_database_url()


def test_settings_filter_masks_the_database_password():
    settings = config.Settings.from_env({"DATABASE_URL": _URL})
    record = logging.LogRecord(
        "x", logging.ERROR, "", 0, "ошибка: %s", ("secret",), None
    )

    settings.secret_filter().filter(record)

    assert record.getMessage() == "ошибка: ***"


def test_log_filter_redacts_password_in_message_args_and_traceback():
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.addFilter(config.SecretFilter("secret"))
    log = logging.getLogger("test-secret-filter")
    log.addHandler(handler)
    log.propagate = False
    try:
        try:
            raise ValueError("DSN postgresql://sim:secret@db/x")
        except ValueError:
            log.exception("база %s недоступна", "sim:secret@db")
    finally:
        log.removeHandler(handler)

    text = stream.getvalue()
    assert "secret" not in text
    assert "***" in text
    assert "ValueError" in text


_OIDC = {
    "OIDC_ISSUER": "http://localhost/auth/realms/rav5",
    "OIDC_JWKS_URL": "http://keycloak:8080/auth/realms/rav5/protocol/"
    "openid-connect/certs",
    "OIDC_AUDIENCE": "rav5-sim",
}


def test_oidc_settings_are_read():
    settings = config.Settings.from_env({"DATABASE_URL": _URL, **_OIDC})

    settings.require_oidc()
    assert settings.oidc_audience == "rav5-sim"
    assert settings.internal_caller_azp == "rav5-api-internal"


def test_worker_does_not_need_oidc():
    settings = config.Settings.from_env({"DATABASE_URL": _URL})

    assert settings.oidc_issuer == ""


@pytest.mark.parametrize("missing", sorted(_OIDC))
def test_server_requires_every_oidc_setting(missing):
    env = {"DATABASE_URL": _URL, **_OIDC}
    del env[missing]

    with pytest.raises(config.ConfigError, match=missing):
        config.Settings.from_env(env).require_oidc()


def test_issuer_with_trailing_slash_is_rejected():
    env = {"DATABASE_URL": _URL, **_OIDC}
    env["OIDC_ISSUER"] += "/"

    with pytest.raises(config.ConfigError, match="OIDC_ISSUER"):
        config.Settings.from_env(env)
