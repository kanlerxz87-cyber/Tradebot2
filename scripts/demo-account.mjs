// PRIVATE HOST ONLY. Never imported by browser or Pages build. No production host option.
import { createPrivateKey, sign, constants, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { API, candidate, TOPICS } from "../src/engine.js";
export function authHeaders(
  keyId,
  pem,
  method,
  path,
  timestamp = Date.now().toString(),
) {
  if (!keyId || !pem)
    throw new Error(
      "Demo API credentials are not configured on the private host",
    );
  const key = createPrivateKey(pem),
    message = Buffer.from(
      timestamp + method.toUpperCase() + "/trade-api/v2" + path.split("?")[0],
    );
  let signature;
  if (key.asymmetricKeyType === "ed25519") signature = sign(null, message, key);
  else if (["rsa", "rsa-pss"].includes(key.asymmetricKeyType))
    signature = sign("sha256", message, {
      key,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: 32,
    });
  else throw new Error("Unsupported Kalshi key type");
  return {
    "KALSHI-ACCESS-KEY": keyId,
    "KALSHI-ACCESS-TIMESTAMP": timestamp,
    "KALSHI-ACCESS-SIGNATURE": signature.toString("base64"),
    "Content-Type": "application/json",
  };
}
export function validateDemoOrder(m, quantity, now = Date.now()) {
  if (!m || !TOPICS.includes(m.topic) || !candidate(m))
    throw new Error("Order fails topic / liquidity safety screen");
  const age = now - Date.parse(m.observedAt);
  if (!Number.isFinite(age) || age < 0 || age > 15000)
    throw new Error("Order requires a fresh official observation (≤15s)");
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 10 ||
    quantity * m.ask > 10 ||
    quantity > m.askSize
  )
    throw new Error(
      "Order exceeds hard demo quantity / $10 / visible-size limit",
    );
  if (m.source !== `${API}/markets/${encodeURIComponent(m.ticker)}`)
    throw new Error("Only official demo market observations accepted");
  return true;
}
export class DemoAccount {
  constructor(keyId, pem) {
    this.keyId = keyId;
    this.pem = pem;
  }
  async request(method, path, body) {
    if (!path.startsWith("/") || path.includes("://") || path.includes(".."))
      throw new Error("Invalid API path");
    const response = await fetch(API + path, {
      method,
      headers: authHeaders(this.keyId, this.pem, method, path),
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    // Never retry order writes automatically: a timeout is an ambiguous execution state.
    if (!response.ok)
      throw new Error(
        `Demo API returned HTTP ${response.status}; inspect private journal before retrying`,
      );
    return response.json();
  }
  async pages(path, key) {
    let cursor = "",
      seen = new Set(),
      out = [];
    do {
      const p = await this.request(
        "GET",
        path +
          (path.includes("?") ? "&" : "?") +
          "limit=100" +
          (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
      );
      if (!Array.isArray(p[key]))
        throw new Error("Unexpected account response schema");
      out.push(...p[key]);
      cursor = p.cursor || "";
      if (cursor && seen.has(cursor))
        throw new Error("Repeated account cursor");
      seen.add(cursor);
    } while (cursor);
    return out;
  }
  async snapshot() {
    return {
      observedAt: new Date().toISOString(),
      environment: "demo",
      balance: await this.request("GET", "/portfolio/balance"),
      fills: await this.pages("/portfolio/fills", "fills"),
      positions: await this.pages("/portfolio/positions", "market_positions"),
      settlements: await this.pages("/portfolio/settlements", "settlements"),
      limitation:
        "Live account dataset only; historical archives and cash flows must be reconciled before claiming net returns.",
    };
  }
  async placeYes(m, quantity) {
    if (process.env.KALSHI_DEMO_EXECUTION !== "enabled")
      throw new Error("Demo execution is disabled");
    validateDemoOrder(m, quantity);
    // File creation is an exclusive session budget lock. Even a network failure requires manual/private reconciliation.
    await mkdir("private", { recursive: true, mode: 0o700 });
    const order = {
      ticker: m.ticker,
      side: "bid",
      count: String(quantity),
      price: m.ask.toFixed(4),
      time_in_force: "immediate_or_cancel",
      self_trade_prevention_type: "taker_at_cross",
      client_order_id: randomUUID(),
    };
    const record = {
      state: "submission_pending",
      submittedAt: new Date().toISOString(),
      order,
      source: m.source,
    };
    await writeFile("private/demo-order-lock.json", JSON.stringify(record), {
      flag: "wx",
      mode: 0o600,
    });
    try {
      const result = await this.request(
        "POST",
        "/portfolio/events/orders",
        order,
      );
      await writeFile(
        "private/demo-order-lock.json",
        JSON.stringify({
          ...record,
          state: "accepted_reconcile_fills",
          result,
        }),
        { mode: 0o600 },
      );
      return result;
    } catch (e) {
      await writeFile(
        "private/demo-order-lock.json",
        JSON.stringify({
          ...record,
          state: "ambiguous_or_rejected_do_not_retry",
          error: e.message,
        }),
        { mode: 0o600 },
      );
      throw e;
    }
  }
}
async function main() {
  if (
    !process.env.KALSHI_DEMO_KEY_ID ||
    !process.env.KALSHI_DEMO_PRIVATE_KEY_FILE
  )
    throw Error(
      "No private-host demo credentials configured. No account request or trade made.",
    );
  const account = new DemoAccount(
    process.env.KALSHI_DEMO_KEY_ID,
    await readFile(process.env.KALSHI_DEMO_PRIVATE_KEY_FILE, "utf8"),
  );
  const data = await account.snapshot();
  await mkdir("private", { recursive: true, mode: 0o700 });
  await writeFile("private/demo-account.json", JSON.stringify(data, null, 2), {
    mode: 0o600,
  });
  console.log(
    "Private demo-account snapshot saved to ignored private/demo-account.json. No orders submitted.",
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
