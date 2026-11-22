import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify, constants } from "node:crypto";
import {
  authHeaders,
  validateDemoOrder,
  DemoAccount,
} from "../../scripts/demo-account.mjs";
import { API } from "../../src/engine.js";
for (const type of ["ed25519", "rsa"])
  test(`${type} signatures include full path, exclude query`, () => {
    const { privateKey, publicKey } = generateKeyPairSync(
      type,
      type === "rsa" ? { modulusLength: 2048 } : {},
    );
    const pem = privateKey.export({ type: "pkcs8", format: "pem" });
    const h = authHeaders(
      "fixture",
      pem,
      "GET",
      "/portfolio/fills?limit=100",
      "123",
    );
    const data = Buffer.from("123GET/trade-api/v2/portfolio/fills");
    assert.ok(
      verify(
        type === "rsa" ? "sha256" : null,
        data,
        type === "rsa"
          ? {
              key: publicKey,
              padding: constants.RSA_PKCS1_PSS_PADDING,
              saltLength: 32,
            }
          : publicKey,
        Buffer.from(h["KALSHI-ACCESS-SIGNATURE"], "base64"),
      ),
    );
  });
test("no credentials fail closed", () =>
  assert.throws(() => authHeaders("", null, "GET", "/portfolio/balance")));
test("hard order limits, fresh official topic data required", () => {
  const n = Date.now(),
    m = {
      ticker: "TEST",
      topic: "Golf",
      status: "active",
      bid: 0.49,
      ask: 0.5,
      askSize: 20,
      volume24h: 200,
      observedAt: new Date(n).toISOString(),
      source: API + "/markets/TEST",
    };
  assert.ok(validateDemoOrder(m, 10, n));
  for (const [change, q] of [
    [{}, 11],
    [{}, 0],
    [{}, 1.5],
    [{ topic: "Sports" }, 1],
    [{ observedAt: new Date(n - 20000).toISOString() }, 1],
    [{ source: "https://production.invalid" }, 1],
  ])
    assert.throws(() => validateDemoOrder({ ...m, ...change }, q, n));
});
test("demo execution disabled by default", async () => {
  delete process.env.KALSHI_DEMO_EXECUTION;
  await assert.rejects(new DemoAccount("", "").placeYes({}, 1), /disabled/);
});
