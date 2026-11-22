"""Runtime configuration for the Kalshi demo dashboard.

All values come from environment variables so that no credential or account
identifier is ever committed to the repository.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"

DEMO_REST = "https://external-api.demo.kalshi.co/trade-api/v2"
DEMO_REST_ALT = "https://demo-api.kalshi.co/trade-api/v2"
PROD_REST = "https://external-api.kalshi.com/trade-api/v2"
DEMO_WS = "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2"
PROD_WS = "wss://external-api-ws.kalshi.com/trade-api/ws/v2"

#: Threshold from the project brief: alert on a move of at least $0.10.
DEFAULT_SWING_THRESHOLD = 0.10

TOPIC_KEYS = ("gas_prices", "elections", "culture", "crypto", "golf")


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    environment: str = field(default_factory=lambda: os.getenv("KALSHI_ENV", "demo").lower())
    api_key_id: str | None = field(default_factory=lambda: os.getenv("KALSHI_API_KEY_ID") or None)
    private_key_path: str | None = field(
        default_factory=lambda: os.getenv("KALSHI_PRIVATE_KEY_PATH") or None
    )
    private_key_pem: str | None = field(
        default_factory=lambda: os.getenv("KALSHI_PRIVATE_KEY_PEM") or None
    )
    database: str = field(
        default_factory=lambda: os.getenv("TRADEBOT_DB", str(DATA_DIR / "tradebot.sqlite3"))
    )
    poll_seconds: float = field(
        default_factory=lambda: float(os.getenv("TRADEBOT_POLL_SECONDS", "5"))
    )
    starting_cash: float = field(
        default_factory=lambda: float(os.getenv("TRADEBOT_STARTING_CASH", "10000"))
    )
    enable_trading: bool = field(default_factory=lambda: _env_bool("TRADEBOT_ENABLE_TRADING"))
    paper_only: bool = field(default_factory=lambda: _env_bool("TRADEBOT_PAPER_ONLY", True))
    swing_threshold: float = field(
        default_factory=lambda: float(
            os.getenv("TRADEBOT_SWING_THRESHOLD", str(DEFAULT_SWING_THRESHOLD))
        )
    )

    @property
    def rest_base(self) -> str:
        return DEMO_REST if self.environment == "demo" else PROD_REST

    @property
    def ws_url(self) -> str:
        return DEMO_WS if self.environment == "demo" else PROD_WS

    @property
    def has_credentials(self) -> bool:
        return bool(self.api_key_id and (self.private_key_pem or self.private_key_path))

    @property
    def trading_active(self) -> bool:
        """Real (demo-account) order placement is opt-in and requires credentials."""
        return self.enable_trading and not self.paper_only and self.has_credentials


def load_settings() -> Settings:
    return Settings()
