from app.topics import classify


def topic_of(**kwargs):
    return classify(**kwargs).topic


def test_gas_prices_series_ticker():
    assert topic_of(market_ticker="KXAAAGASW-26NOV23-3.9400", series_ticker="KXAAAGASW") == "gas_prices"


def test_gas_prices_title():
    assert (
        topic_of(title="Will average gas prices be above $3.94?", category="Economics")
        == "gas_prices"
    )


def test_elections():
    assert (
        topic_of(
            title="Will the Democratic candidate win the 2028 presidential election?",
            category="Politics",
        )
        == "elections"
    )


def test_culture_official_category():
    assert topic_of(title="Will Grok be banned this year", category="Culture") == "culture"


def test_culture_official_entertainment_category():
    assert topic_of(title="Box office winner this weekend", category="Entertainment") == "culture"


def test_culture_keyword():
    assert (
        topic_of(title="Will Taylor Swift win album of the year at the Grammys?", category="Entertainment")
        == "culture"
    )


def test_crypto_official_category():
    assert topic_of(title="BTC price on Friday", category="Crypto") == "crypto"


def test_crypto_keyword():
    assert topic_of(title="Will Bitcoin close above $120,000?", category="Financials") == "crypto"


def test_golf_keyword():
    assert (
        topic_of(
            title="Will Scottie Scheffler win the Masters tournament?",
            category="Sports",
        )
        == "golf"
    )


def test_golf_ticker():
    assert topic_of(market_ticker="KXPGATOUR-MASTERS-SCHEFFLER") == "golf"


def test_netherlands_is_not_crypto():
    assert (
        topic_of(title="Will the Netherlands win the 2026 World Cup?", category="Sports")
        is None
    )


def test_liga_mx_is_not_golf():
    assert topic_of(title="Liga MX: Will Club America beat Cruz Azul?", category="Sports") is None


def test_las_vegas_is_not_gas_prices():
    assert topic_of(title="Will Las Vegas host the 2027 Super Bowl?", category="Sports") is None


def test_unrelated_market_is_none():
    assert topic_of(title="Will it rain in New York tomorrow?", category="Climate and Weather") is None


def test_gas_in_rules_only():
    rules = "If average regular gas prices for United States are strictly greater than $3.9 on Nov 23, 2026 according to AAA, then the market resolves to Yes."
    assert topic_of(title="Will average be above $3.9000?", rules=rules) == "gas_prices"


def test_category_is_case_insensitive():
    assert topic_of(title="Some coin", category="crypto") == "crypto"


def test_discovered_demo_series_tickers():
    assert topic_of(market_ticker="KXAAAGASM-26NOV30-4.70", series_ticker="KXAAAGASM") == "gas_prices"
    assert topic_of(market_ticker="KXSENMAJ-27-CSCH", series_ticker="KXSENMAJ") == "elections"
    assert topic_of(market_ticker="KXPRESPERSON-28-VRAM", series_ticker="KXPRESPERSON") == "elections"
    assert topic_of(market_ticker="KXOSCARPIC-27-DIG", series_ticker="KXOSCARPIC") == "culture"
    assert topic_of(market_ticker="KXGTAONLINE-GTA6ONLINE-28", series_ticker="KXGTAONLINE") == "culture"
    assert topic_of(market_ticker="KXNETFLIXRANKSHOWGLOBAL-26NOV23-THEB", series_ticker="KXNETFLIXRANKSHOWGLOBAL") == "culture"
    assert topic_of(market_ticker="KXBTCY-27JAN0100-B47500", series_ticker="KXBTCY") == "crypto"
    assert topic_of(market_ticker="KXBTCMAXY-26DEC31-119999.99", series_ticker="KXBTCMAXY") == "crypto"
    assert topic_of(market_ticker="KXLPGATOUR-CMEGTC26-YURYOS", series_ticker="KXLPGATOUR") == "golf"
    assert topic_of(market_ticker="KXPRESCUP-26-USA", series_ticker="KXPRESCUP") == "golf"

