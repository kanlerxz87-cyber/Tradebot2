"""RSA / Ed25519 request signing for the Kalshi Trade API.

Implements exactly the documented scheme:
  pre-sign text = timestamp_ms + HTTP_METHOD + path-without-query
  RSA keys      -> RSA-PSS with SHA-256, salt length = digest length
  Ed25519 keys  -> sign the message directly
  signature     -> base64
Source: https://docs.kalshi.com/getting_started/quick_start_authenticated_requests
"""
from __future__ import annotations

import base64
import datetime
import json
import time
from urllib.parse import urlencode

import requests

try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
except ImportError:  # pragma: no cover
    raise SystemExit("cryptography is required for signed requests: pip install cryptography")

DEMO_BASE = "https://external-api.demo.kalshi.co/trade-api/v2"
PROD_BASE = "https://external-api.kalshi.com/trade-api/v2"


def load_key(pem: str):
    data = pem.encode("utf-8") if isinstance(pem, str) else pem
    return serialization.load_pem_private_key(data, password=None)


def sign(private_key, timestamp: str, method: str, path: str) -> str:
    path_no_query = path.split("?")[0]
    message = f"{timestamp}{method}{path_no_query}".encode("utf-8")
    if isinstance(private_key, Ed25519PrivateKey):
        sig = private_key.sign(message)
    else:
        sig = private_key.sign(
            message,
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.DIGEST_LENGTH),
            hashes.SHA256(),
        )
    return base64.b64encode(sig).decode("utf-8")


def headers(key_id: str, pem: str, method: str, path: str) -> dict[str, str]:
    private_key = load_key(pem)
    ts = str(int(time.time() * 1000))
    return {
        "KALSHI-ACCESS-KEY": key_id,
        "KALSHI-ACCESS-SIGNATURE": sign(private_key, ts, method, path),
        "KALSHI-ACCESS-TIMESTAMP": ts,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def signed_request(key_id: str, pem: str, method: str, path: str, body: dict | None = None,
                   params: dict | None = None, base: str = DEMO_BASE,
                   timeout: int = 25) -> dict:
    url = base + path
    if params:
        url += "?" + urlencode({k: v for k, v in params.items() if v is not None})
    sign_path = url.split("?")[0]
    from urllib.parse import urlparse
    sign_path = urlparse(sign_path).path
    hdrs = headers(key_id, pem, method, sign_path)
    resp = requests.request(method, url, headers=hdrs,
                            data=json.dumps(body) if body is not None else None, timeout=timeout)
    if resp.status_code >= 400:
        raise RuntimeError(f"{resp.status_code} {resp.text[:500]} ({method} {path})")
    try:
        return resp.json()
    except ValueError:
        return {}


def signed_get(key_id: str, pem: str, path: str, params: dict | None = None, base: str = DEMO_BASE) -> dict:
    return signed_request(key_id, pem, "GET", path, params=params, base=base)


def ws_headers(key_id: str, pem: str) -> dict[str, str]:
    private_key = load_key(pem)
    ts = str(int(time.time() * 1000))
    return {
        "KALSHI-ACCESS-KEY": key_id,
        "KALSHI-ACCESS-SIGNATURE": sign(private_key, ts, "GET", "/trade-api/ws/v2"),
        "KALSHI-ACCESS-TIMESTAMP": ts,
    }
