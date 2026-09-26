"""Проверка access token Keycloak: docs/keycloak/middleware.md, раздел 3.

Ключ RSA генерируется в тесте, JWKS отдаёт двойник с get_signing_keys.
"""

from __future__ import annotations

import base64
import json
import threading
import time
from typing import Any

from cryptography.hazmat.primitives.asymmetric import rsa
import fakes
import jwt
from jwt import algorithms
import pytest

from adapters.auth import jwks
from application import errors

ISSUER = "http://localhost/auth/realms/rav5"
AUDIENCE = "rav5-sim"
KID = "k1"


def _key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


KEY = _key()
OTHER_KEY = _key()


class FakeJwks:
    """JWKS Keycloak с кэшем, как PyJWKClient: загрузка — при первом
    обращении и при refresh=True."""

    def __init__(self, *keys: tuple[str, rsa.RSAPrivateKey]) -> None:
        self.keys = list(keys) or [(KID, KEY)]
        self.fetches = 0
        self.fail = False
        self._cached: list[jwt.PyJWK] | None = None

    def get_signing_keys(self, refresh: bool = False) -> list[jwt.PyJWK]:
        """Ключи use=sig из кэша; refresh или пустой кэш — загрузка."""
        if refresh or self._cached is None:
            self.fetches += 1
            if self.fail:
                raise jwt.PyJWKClientError("Keycloak недоступен")
            self._cached = [self._jwk(kid, key) for kid, key in self.keys]
        return self._cached

    @staticmethod
    def _jwk(kid: str, key: rsa.RSAPrivateKey) -> jwt.PyJWK:
        data = algorithms.RSAAlgorithm.to_jwk(key.public_key(), as_dict=True)
        return jwt.PyJWK({**data, "kid": kid, "use": "sig"})


def claims(**over: Any) -> dict:
    """Claims валидного пользовательского access token; None — убрать."""
    now = int(time.time())
    base = {
        "iss": ISSUER,
        "aud": [AUDIENCE, "account"],
        "sub": "alice",
        "typ": "Bearer",
        "azp": "rav5-web",
        "iat": now,
        "exp": now + 300,
        "email": "alice@example.com",
        "realm_access": {"roles": ["user"]},
    }
    base.update(over)
    return {k: v for k, v in base.items() if v is not None}


def sign(body: dict, key: rsa.RSAPrivateKey = KEY, kid: str = KID) -> str:
    return jwt.encode(body, key, algorithm="RS256", headers={"kid": kid})


def _b64(value: dict) -> str:
    raw = json.dumps(value).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def verifier(keys: FakeJwks | None = None, **kw: Any) -> jwks.JwksTokenVerifier:
    return jwks.JwksTokenVerifier(ISSUER, AUDIENCE, keys or FakeJwks(), **kw)


def test_valid_access_token_gives_principal():
    principal = verifier().verify(
        sign(claims(realm_access={"roles": ["user", "admin"]}))
    )

    assert principal.sub == "alice"
    assert principal.email == "alice@example.com"
    assert principal.azp == "rav5-web"
    assert principal.has_role("admin")
    assert not principal.is_service


def test_service_token_is_marked():
    token = sign(
        claims(azp="rav5-api-internal", realm_access={"roles": ["service"]})
    )

    principal = verifier().verify(token)

    assert principal.is_service
    assert principal.azp == "rav5-api-internal"


def test_token_expired_10s_ago_is_accepted():
    now = int(time.time())

    assert verifier().verify(sign(claims(exp=now - 10))).sub == "alice"


_VALID = sign(claims())
_HEAD, _BODY, _SIG = _VALID.split(".")
_NOW = int(time.time())
_ALG_NONE = _b64({"alg": "none", "kid": KID})
_ZERO_SIG = "A" * len(_SIG)
_MALLORY = _b64(claims(sub="mallory"))


@pytest.mark.parametrize(
    "token",
    [
        pytest.param(f"{_ALG_NONE}.{_BODY}.", id="alg none"),
        pytest.param(
            jwt.encode(
                claims(), "secret" * 6, algorithm="HS256", headers={"kid": KID}
            ),
            id="alg HS256",
        ),
        pytest.param(f"{_HEAD}.{_BODY}.{_ZERO_SIG}", id="tampered signature"),
        pytest.param(
            f"{_HEAD}.{_MALLORY}.{_SIG}",
            id="tampered payload",
        ),
        pytest.param(sign(claims(), key=OTHER_KEY), id="foreign key"),
        pytest.param(sign(claims(exp=_NOW - 40)), id="expired 40s ago"),
        pytest.param(
            sign(claims(iss="http://evil/auth/realms/rav5")), id="other iss"
        ),
        pytest.param(sign(claims(iss=ISSUER + "/")), id="iss with slash"),
        pytest.param(
            sign(claims(aud=["rav5-api", "account"])), id="no sim audience"
        ),
        pytest.param(sign(claims(typ="ID")), id="ID token"),
        pytest.param(sign(claims(typ="Refresh")), id="refresh token"),
        pytest.param(sign(claims(sub=None)), id="no sub"),
        pytest.param(sign(claims(sub="")), id="empty sub"),
        pytest.param(sign(claims(exp=None)), id="no exp"),
        pytest.param(sign(claims(nbf=_NOW + 120)), id="not yet valid"),
        pytest.param("garbage", id="not a JWT"),
        pytest.param(jwt.encode(claims(), KEY, algorithm="RS256"), id="no kid"),
    ],
)
def test_invalid_tokens_are_rejected(token):
    with pytest.raises(errors.InvalidTokenError):
        verifier().verify(token)


def test_unknown_kid_reloads_jwks_at_most_every_30s():
    keys = FakeJwks()
    clock = fakes.ManualClock(1000.0)
    check = verifier(keys, clock=clock)
    unknown = sign(claims(), kid="rotated")

    check.preload()  # загрузка при старте
    for _ in range(5):
        with pytest.raises(errors.InvalidTokenError):
            check.verify(unknown)
    assert keys.fetches == 2  # старт + одна перезагрузка за 30 с

    clock.advance(jwks.MIN_REFRESH_SECONDS)
    for _ in range(5):
        with pytest.raises(errors.InvalidTokenError):
            check.verify(unknown)
    assert keys.fetches == 3


def test_rotated_key_is_picked_up_after_reload():
    keys = FakeJwks()
    check = verifier(keys)
    check.preload()
    keys.keys = [("rotated", OTHER_KEY)]

    principal = check.verify(sign(claims(), key=OTHER_KEY, kid="rotated"))

    assert principal.sub == "alice"
    assert keys.fetches == 2


def test_readiness_follows_the_first_successful_load():
    keys = FakeJwks()
    keys.fail = True
    check = verifier(keys)
    stop = threading.Event()
    worker = threading.Thread(
        target=check.preload_until_ready, args=(stop,), kwargs={"retry_s": 0.01}
    )

    worker.start()
    deadline = time.monotonic() + 5
    while keys.fetches < 3:
        assert time.monotonic() < deadline
        time.sleep(0.01)
    assert not check.is_ready()
    keys.fail = False
    worker.join(timeout=5)

    assert not worker.is_alive()
    assert check.is_ready()


def test_preload_stops_on_request():
    keys = FakeJwks()
    keys.fail = True
    stop = threading.Event()
    stop.set()

    verifier(keys).preload_until_ready(stop, retry_s=0.01)

    assert keys.fetches == 0


def test_from_url_does_not_fetch_until_used():
    check = jwks.JwksTokenVerifier.from_url(
        ISSUER, AUDIENCE, "http://127.0.0.1:1/certs"
    )

    assert not check.is_ready()
