import base64

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.kalshi import KalshiClient


def test_ed25519_signature_verifies_over_timestamp_method_path():
    key = Ed25519PrivateKey.generate()
    client = KalshiClient(base_url="https://example.invalid", api_key_id="key-id", private_key=key)
    signature = client.sign("1700000000000", "GET", "/trade-api/v2/portfolio/balance")
    key.public_key().verify(
        base64.b64decode(signature), b"1700000000000GET/trade-api/v2/portfolio/balance"
    )


def test_rsa_pss_signature_verifies():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    client = KalshiClient(base_url="https://example.invalid", api_key_id="key-id", private_key=key)
    signature = client.sign("1700000000000", "POST", "/trade-api/v2/portfolio/events/orders")
    key.public_key().verify(
        base64.b64decode(signature),
        b"1700000000000POST/trade-api/v2/portfolio/events/orders",
        padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.DIGEST_LENGTH),
        hashes.SHA256(),
    )


def test_query_string_is_stripped_before_signing():
    key = Ed25519PrivateKey.generate()
    client = KalshiClient(base_url="https://example.invalid", api_key_id="key-id", private_key=key)
    with_query = client.sign("123", "GET", "/trade-api/v2/markets?limit=5")
    without = client.sign("123", "GET", "/trade-api/v2/markets")
    assert with_query == without


def test_auth_headers_contain_all_three_fields():
    key = Ed25519PrivateKey.generate()
    client = KalshiClient(base_url="https://example.invalid", api_key_id="key-id", private_key=key)
    headers = client.auth_headers("GET", "/trade-api/v2/portfolio/balance")
    assert set(headers) == {
        "KALSHI-ACCESS-KEY",
        "KALSHI-ACCESS-TIMESTAMP",
        "KALSHI-ACCESS-SIGNATURE",
    }
    assert headers["KALSHI-ACCESS-KEY"] == "key-id"
    assert headers["KALSHI-ACCESS-TIMESTAMP"].isdigit()
    assert len(headers["KALSHI-ACCESS-TIMESTAMP"]) == 13


def test_pem_loading_from_settings():
    from app.config import Settings

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    settings = Settings(environment="demo", api_key_id="abc", private_key_pem=pem)
    client = KalshiClient.from_settings(settings)
    assert client.authenticated


def test_missing_credentials_are_rejected():
    client = KalshiClient(base_url="https://example.invalid")
    with pytest.raises(Exception):
        client.sign("123", "GET", "/trade-api/v2/portfolio/balance")
