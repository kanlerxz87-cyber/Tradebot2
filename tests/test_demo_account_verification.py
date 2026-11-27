"""No real credentials/network: test privacy and fail-closed account evidence."""
import json
import importlib.util
from pathlib import Path

FILE = Path(__file__).resolve().parents[1] / "tools/verify_demo_account.py"
spec = importlib.util.spec_from_file_location("verify_demo_account", FILE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_absent_credentials_do_not_call_the_account():
    def forbidden(_):
        raise AssertionError("no network without credentials")
    doc = module.verify(credentials_available=False, sync=forbidden, now="2026-11-27T20:00:00Z")
    assert doc["configured"] is False
    assert doc["verified_account_read"] is False
    assert doc["status"] == "no_credentials_available_to_this_job"
    assert all(doc[key] is None for key in module.PUBLIC_FIELDS)
    assert doc["orders_submitted"] == 0


def test_signed_demo_success_preserves_reported_units_and_allowlists():
    def signed_gets(_):
        return {"configured": True, "environment": "demo", "balance": 12345,
                "balance_dollars": "123.4500", "portfolio_value": 900,
                "market_positions": [{"ticker": "TEST-FIXTURE", "position_fp": "1.00"}],
                "unexpected_private_field": "must-not-be-exported"}
    doc = module.verify(credentials_available=True, sync=signed_gets, run_url="https://github.com/example/example/actions/runs/1")
    assert doc["configured"] is True and doc["verified_account_read"] is True
    assert doc["balance"] == 12345 and doc["portfolio_value"] == 900  # cents, NOT inferred dollars
    assert doc["balance_dollars"] == "123.4500"
    assert doc["updated_ts"] is None  # do not invent a missing exchange timestamp
    assert "unexpected_private_field" not in doc
    assert doc["orders_submitted"] == 0 and doc["read_only"] is True
    assert doc["balance_source_url"] == module.BASE + "/portfolio/balance"


def test_authentication_error_does_not_disclose_secret_or_infer_absence():
    def bad(_):
        raise RuntimeError("TEST PRIVATE KEY OR SENSITIVE RESPONSE")
    doc = module.verify(credentials_available=True, sync=bad)
    assert doc["configured"] is None  # present keys + failed read is NOT absent keys
    assert not doc["verified_account_read"]
    assert doc["credentials_available_to_job"] is True
    assert "TEST PRIVATE" not in json.dumps(doc)
    assert all(doc[key] is None for key in module.PUBLIC_FIELDS)


def test_non_demo_capture_never_published_as_authenticated_demo():
    doc = module.verify(credentials_available=True, sync=lambda _: {"configured": True, "environment": "production", "balance": 999})
    assert doc["configured"] is None and doc["balance"] is None
    assert doc["status"] == "authenticated_read_unverified"
