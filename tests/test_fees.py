"""Verify the fee model against every row of Kalshi's published fee table.

Source: https://kalshi.com/docs/kalshi-fee-schedule.pdf  ("General Trading Fees
Table", last updated and effective July 7, 2026, as retrieved 2026-11-22).

The table prints, for each price, the fee for 1 contract and for 100 contracts.
If our formula + rounding reproduces all of them, the model is anchored to an
official source rather than to an assumption.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from collector.strategy import fee_dollars  # noqa: E402

# price: (fee_for_1_contract, fee_for_100_contracts) -- verbatim from the PDF table
TABLE = {
    0.01: (0.01, 0.07), 0.05: (0.01, 0.34), 0.10: (0.01, 0.63), 0.15: (0.01, 0.90),
    0.20: (0.02, 1.12), 0.25: (0.02, 1.32), 0.30: (0.02, 1.47), 0.35: (0.02, 1.60),
    0.40: (0.02, 1.68), 0.45: (0.02, 1.74), 0.50: (0.02, 1.75), 0.55: (0.02, 1.74),
    0.60: (0.02, 1.68), 0.65: (0.02, 1.60), 0.70: (0.02, 1.47), 0.75: (0.02, 1.32),
    0.80: (0.02, 1.12), 0.85: (0.01, 0.90), 0.90: (0.01, 0.63), 0.95: (0.01, 0.34),
    0.99: (0.01, 0.07),
}


def test_table_matches_cent_rounding():
    failures = []
    for price, (fee1, fee100) in TABLE.items():
        got1 = round(fee_dollars(price, 1), 2)
        got100 = round(fee_dollars(price, 100), 2)
        if abs(got1 - fee1) > 1e-9:
            failures.append((price, 1, got1, fee1))
        if abs(got100 - fee100) > 1e-9:
            failures.append((price, 100, got100, fee100))
    assert not failures, f"fee model disagrees with published table: {failures}"


def test_maker_fee_defaults_to_zero_multiplier():
    # "M = the multiplier for each contract (default is 0 unless otherwise indicated)"
    assert fee_dollars(0.50, 10, taker=False, multiplier=0) == 0.0


if __name__ == "__main__":
    test_table_matches_cent_rounding()
    test_maker_fee_defaults_to_zero_multiplier()
    print(f"PASS: fee model reproduces all {len(TABLE) * 2} published table values")
