import assert from "node:assert/strict";
import { TOPICS, sourceFor } from "../src/engine.js";
const base = (process.argv[2] || process.env.LIVE_SITE_URL || "").replace(
  /\/?$/,
  "/",
);
if (!base.startsWith("https://"))
  throw Error("A public HTTPS Pages URL is required");
async function get(path, json = false) {
  const response = await fetch(
    new URL(path + "?verification=" + Date.now(), base),
    { signal: AbortSignal.timeout(30000), cache: "no-store" },
  );
  assert.equal(
    response.status,
    200,
    `${path} returned HTTP ${response.status}`,
  );
  return json ? response.json() : response.text();
}
let evidence, error;
for (let attempt = 0; attempt < 6; attempt++) {
  try {
    const html = await get("index.html");
    assert.ok(html.includes("tradebot"));
    const metadata = await get("data/deployment.json", true);
    if (process.env.GITHUB_SHA)
      assert.equal(
        metadata.commit,
        process.env.GITHUB_SHA,
        "CDN has not reached the deployed commit",
      );
    for (const path of [
      "src/app.js",
      "src/engine.js",
      "src/research.js",
      "src/style.css",
      "docs/EXECUTIVE_SUMMARY.md",
    ])
      assert.ok((await get(path)).length > 0);
    const snapshot = await get("data/snapshot.json", true);
    assert.equal(snapshot.schemaVersion, 1);
    const counts = {};
    let total = 0;
    for (const topic of TOPICS) {
      const shard = await get(
        "data/topics/" + topic.toLowerCase().replaceAll(" ", "-") + ".json",
        true,
      );
      assert.ok(Array.isArray(shard.markets));
      for (const m of shard.markets) {
        assert.equal(m.topic, topic);
        assert.equal(m.source, sourceFor(m.ticker));
      }
      counts[topic] = shard.markets.length;
      total += shard.markets.length;
    }
    assert.equal(total, metadata.marketCount);
    assert.ok(total > 0, "No official demo records published");
    evidence = {
      site: base,
      verifiedAt: new Date().toISOString(),
      commit: metadata.commit,
      marketCount: total,
      topicCounts: counts,
      snapshotObservedAt: snapshot.observedAt,
      coverage: snapshot.coverage,
    };
    error = null;
    break;
  } catch (e) {
    error = e;
    if (attempt < 5) await new Promise((r) => setTimeout(r, 10000));
  }
}
if (error) throw error;
console.log(JSON.stringify(evidence, null, 2));
if (
  process.env.GITHUB_TOKEN &&
  process.env.GITHUB_REPOSITORY &&
  process.env.GITHUB_SHA
) {
  const r = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/check-runs`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Published Pages verification",
        head_sha: process.env.GITHUB_SHA,
        status: "completed",
        conclusion: "success",
        output: {
          title: `Live site verified: ${evidence.marketCount} source-linked market records`,
          summary: `Verified the public HTTPS homepage, modules, stylesheet, executive brief, snapshot, deployment commit and every topic shard. Official source URLs checked on every published contract.\n\n\`\`\`json\n${JSON.stringify(evidence, null, 2)}\n\`\`\``,
        },
      }),
    },
  );
  if (!r.ok) throw Error(`Cannot publish live-site evidence: HTTP ${r.status}`);
}
