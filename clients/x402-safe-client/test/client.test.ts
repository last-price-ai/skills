// Offline tests: fetch is mocked, signing happens locally with a throwaway key. No network, no payment.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { SafeX402Client, PaymentRefusedError, SettlementUnknownError, normalizePrivateKey, USDC_BASE, BASE_MAINNET } from "../src/index.js";

const payTo = privateKeyToAccount(generatePrivateKey()).address; // throwaway recipient
const other = privateKeyToAccount(generatePrivateKey()).address;
const fakeTx = "0x" + "ab".repeat(32);
const URL_ = "https://api.last-price.ai/api/compute/price";
const BODY = JSON.stringify({ context: { product_type: "saas", current_price: 49, currency: "USD" } });

function b64(o: unknown) { return Buffer.from(JSON.stringify(o)).toString("base64"); }
function required(over: Record<string, unknown> = {}) {
  return {
    x402Version: 2,
    error: "payment required",
    resource: { url: URL_, description: "compute", mimeType: "application/json" },
    accepts: [{ scheme: "exact", network: BASE_MAINNET, asset: USDC_BASE, amount: "10000", payTo, maxTimeoutSeconds: 60, extra: { name: "USD Coin", version: "2" }, ...over }],
  };
}
function mockFetch(pr: unknown, paid: () => Response) {
  const calls: { headers: Headers }[] = [];
  const f = (async (_u: unknown, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    calls.push({ headers: h });
    if (!h.get("PAYMENT-SIGNATURE") && !h.get("X-PAYMENT")) {
      return new Response(JSON.stringify({ x402Version: 1, code: "payment_required", retryable: false }), { status: 402, headers: { "PAYMENT-REQUIRED": b64(pr), "content-type": "application/json" } });
    }
    return paid();
  }) as typeof fetch;
  return { f, calls };
}
const ok = () => new Response(JSON.stringify({ computed_price: 44.99, currency: "USD" }), { status: 200, headers: { "PAYMENT-RESPONSE": b64({ success: true, transaction: fakeTx, network: BASE_MAINNET, payer: "x" }) } });

test("adds a missing 0x prefix", () => {
  const k = generatePrivateKey();
  assert.equal(normalizePrivateKey(k.slice(2)), k);
  assert.throws(() => normalizePrivateKey("1234"));
});

test("pays when terms match and returns the tx hash", async () => {
  const { f, calls } = mockFetch(required(), ok);
  const c = new SafeX402Client({ privateKey: generatePrivateKey().slice(2), expectedPayTo: payTo, fetchImpl: f });
  const r = await c.fetch(URL_, { method: "POST", headers: { "content-type": "application/json" }, body: BODY });
  assert.equal(r.paid, true);
  assert.equal(r.txHash, fakeTx);
  assert.equal(calls.length, 2);
  assert.equal(c.signedAtomic, 10000n);
});

for (const [name, over] of [
  ["wrong payTo", { payTo: other }],
  ["wrong amount", { amount: "20000" }],
  ["wrong asset", { asset: other }],
  ["wrong network", { network: "eip155:1" }],
] as const) {
  test(`refuses to sign on ${name}`, async () => {
    const { f, calls } = mockFetch(required(over as Record<string, unknown>), ok);
    const c = new SafeX402Client({ privateKey: generatePrivateKey(), expectedPayTo: payTo, fetchImpl: f });
    await assert.rejects(c.fetch(URL_, { method: "POST", body: BODY }), PaymentRefusedError);
    assert.equal(calls.length, 1, "no paid request sent");
    assert.equal(c.signedAtomic, 0n);
  });
}

test("enforces the spend cap", async () => {
  const { f } = mockFetch(required(), ok);
  const c = new SafeX402Client({ privateKey: generatePrivateKey(), expectedPayTo: payTo, fetchImpl: f, spendCapAtomic: 15000n });
  await c.fetch(URL_, { method: "POST", body: BODY });
  await assert.rejects(c.fetch(URL_, { method: "POST", body: BODY }), PaymentRefusedError);
  assert.equal(c.signedAtomic, 10000n);
});

test("halts after payment_settlement_unknown and never resends", async () => {
  const unknown = () => new Response(JSON.stringify({ code: "payment_settlement_unknown", retryable: false, payment_id: "pay_123" }), { status: 503 });
  const { f, calls } = mockFetch(required(), unknown);
  const c = new SafeX402Client({ privateKey: generatePrivateKey(), expectedPayTo: payTo, fetchImpl: f });
  await assert.rejects(c.fetch(URL_, { method: "POST", body: BODY }), SettlementUnknownError);
  assert.equal(calls.length, 2);
  assert.equal(c.halted, true);
  await assert.rejects(c.fetch(URL_, { method: "POST", body: BODY }), SettlementUnknownError);
  assert.equal(calls.length, 2, "nothing sent while halted");
});
