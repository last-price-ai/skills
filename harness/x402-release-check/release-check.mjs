#!/usr/bin/env node
// Capped x402 release check for Last Price pay-per-call compute.
//
// Steps: discovery cross-check -> unpaid 402 probe -> N paid calls -> replay refusal
//        -> underpay refusal -> on-chain balance delta.
// Dry run by default: only the unpaid 402 probe and the plan run; nothing is signed.
// --execute signs real payments, bounded by --cap-usdc. Never prints wallet addresses or keys.
import { x402Client, x402HTTPClient, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { createPublicClient, http, parseAbi, getAddress } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const NETWORK = "eip155:8453";

// ---------- args ----------
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
if (flag("help")) {
  console.log(`usage: node release-check.mjs [--execute] [--paid-calls N] [--cap-usdc X]
  --execute            sign real payments (default: dry run, nothing signed)
  --paid-calls N       paid compute calls (default 3)
  --cap-usdc X         hard cap on everything signed, in USDC (default 0.10)
  --skip-replay        skip the replay refusal check
  --skip-underpay      skip the underpay refusal check
  --base-url URL       API base (default https://api.last-price.ai)
  --rpc URL            Base RPC for balance reads (default https://mainnet.base.org)
  --pause-ms MS        pause between calls (default 4000)
  --out FILE           write the JSON summary here (default results/<timestamp>.json)
env: AGENT_WALLET_KEY (required for --execute), LP_X402_PAY_TO (required), USER_AGENT (optional)`);
  process.exit(0);
}
const EXECUTE = flag("execute");
const N = Number(opt("paid-calls", "3"));
const CAP_ATOMIC = BigInt(Math.round(Number(opt("cap-usdc", "0.10")) * 1e6));
const BASE_URL = opt("base-url", "https://api.last-price.ai");
const RPC = opt("rpc", "https://mainnet.base.org");
const PAUSE = Number(opt("pause-ms", "4000"));
const UA = process.env.USER_AGENT || "x402-release-check/1.0";
const URL_ = `${BASE_URL}/api/compute/price`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const summary = { started_at: new Date().toISOString(), mode: EXECUTE ? "execute" : "dry-run", params: { paid_calls: N, cap_atomic: CAP_ATOMIC.toString(), base_url: BASE_URL }, checks: {}, calls: [], verdict: "pending" };
const fail = (why, code = 1) => { summary.verdict = "FAIL"; summary.reason = why; finish(code); };
function finish(code) {
  summary.finished_at = new Date().toISOString();
  const out = opt("out", `results/${summary.started_at.replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(out.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ verdict: summary.verdict, reason: summary.reason, checks: summary.checks, out }, null, 2));
  process.exit(code);
}

if (!Number.isInteger(N) || N < 0 || N > 50) { summary.verdict = "REFUSED"; summary.reason = "--paid-calls must be 0..50"; finish(2); }
if (!(CAP_ATOMIC > 0n)) { summary.verdict = "REFUSED"; summary.reason = "--cap-usdc must be > 0"; finish(2); }
let EXPECTED_PAY_TO;
try { EXPECTED_PAY_TO = getAddress(process.env.LP_X402_PAY_TO || ""); } catch { summary.verdict = "REFUSED"; summary.reason = "LP_X402_PAY_TO missing or invalid (copy the docs 'Paid to' address)"; finish(2); }

// ---------- helpers ----------
const baseHeaders = () => ({ "content-type": "application/json", "user-agent": UA });
async function post(body, extra = {}) {
  const t0 = Date.now();
  const r = await fetch(URL_, { method: "POST", headers: { ...baseHeaders(), ...extra }, body: JSON.stringify(body) });
  const ms = Date.now() - t0; const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  return { r, ms, json };
}
const codeOf = (j) => (j && typeof j === "object" ? j.code ?? j.error?.code : undefined);
const amountOf = (a) => String(a.amount ?? a.maxAmountRequired);
function validate(pr, expectAmount) {
  const p = [];
  const a = (pr.accepts || []).find((x) => x.network === NETWORK);
  if (!a) return { problems: [`no ${NETWORK} option`] };
  if (a.scheme !== "exact") p.push(`scheme ${a.scheme}`);
  if (getAddress(a.asset) !== getAddress(USDC)) p.push("asset is not USDC on Base");
  if (expectAmount && amountOf(a) !== expectAmount) p.push(`amount ${amountOf(a)} != ${expectAmount}`);
  if (getAddress(a.payTo) !== EXPECTED_PAY_TO) p.push("payTo != configured address");
  return { a, problems: p };
}
const bodies = [
  { context: { product_id: "rc-saas", product_type: "saas", current_price: 49, currency: "USD" } },
  { context: { product_id: "rc-mug", product_type: "ecommerce", current_price: 24.99, currency: "USD", metadata: { unit_cost: 9, elasticity: -1.6 } } },
  { context: { product_id: "rc-headphones", product_type: "ecommerce", current_price: 129, currency: "USD", metadata: { competitor_price: 119, competitor_currency: "USD", competitive_action: "match", unit_cost: 70, target_margin_pct: 20 } } },
];

// ---------- 0. discovery cross-check ----------
try {
  const d = await (await fetch(`${BASE_URL}/.well-known/agents.json`, { headers: { "user-agent": UA } })).json();
  const x = d?.payments?.x402;
  summary.checks.discovery = {
    pay_to_matches_config: !!x?.pay_to && getAddress(x.pay_to) === EXPECTED_PAY_TO,
    network: x?.network_caip2, asset_is_usdc: !!x?.asset?.address && getAddress(x.asset.address) === getAddress(USDC),
    price_atomic: x?.price_per_call?.atomic,
  };
  if (!summary.checks.discovery.pay_to_matches_config) fail("discovery pay_to differs from configured address", 2);
} catch (e) { summary.checks.discovery = { error: String(e) }; }

// ---------- 1. unpaid 402 probe ----------
const httpProbe = new x402HTTPClient(new x402Client());
const u = await post(bodies[0]);
const probe = { status: u.r.status, latency_ms: u.ms, code: codeOf(u.json), retryable: u.json?.retryable, v2_header: !!u.r.headers.get("payment-required") };
if (u.r.status === 402) {
  const pr = httpProbe.getPaymentRequiredResponse((n) => u.r.headers.get(n), u.json);
  const v = validate(pr);
  probe.x402Version = pr.x402Version; probe.amount_atomic = v.a ? amountOf(v.a) : null; probe.problems = v.problems;
  probe.ok = probe.code === "payment_required" && probe.retryable === false && v.problems.length === 0;
} else probe.ok = false;
summary.checks.unpaid_402 = probe;
if (!probe.ok) fail("unpaid 402 probe did not match expectations");
const PRICE = BigInt(probe.amount_atomic);
const UNDER = PRICE / 2n;

// ---------- plan ----------
const doReplay = !flag("skip-replay") && N > 0;
const doUnder = !flag("skip-underpay");
const exposure = PRICE * BigInt(N) + (doUnder ? UNDER : 0n);
summary.plan = { price_atomic: PRICE.toString(), paid_calls: N, replay: doReplay, underpay_atomic: doUnder ? UNDER.toString() : null, worst_case_exposure_atomic: exposure.toString(), expected_balance_delta_atomic: (PRICE * BigInt(N)).toString() };
if (exposure > CAP_ATOMIC) { summary.verdict = "REFUSED"; summary.reason = `worst-case exposure ${exposure} exceeds cap ${CAP_ATOMIC}`; finish(2); }
if (!EXECUTE) { summary.verdict = "DRY-RUN OK"; summary.reason = "nothing signed; pass --execute to spend up to the plan's worst-case exposure"; finish(0); }

// ---------- execute ----------
let key = (process.env.AGENT_WALLET_KEY || "").trim();
if (!key) { summary.verdict = "REFUSED"; summary.reason = "AGENT_WALLET_KEY not set"; finish(2); }
if (!key.startsWith("0x")) key = "0x" + key;
const acct = privateKeyToAccount(key);
const pub = createPublicClient({ chain: base, transport: http(RPC) });
const bal = () => pub.readContract({ address: USDC, abi: parseAbi(["function balanceOf(address) view returns (uint256)"]), functionName: "balanceOf", args: [acct.address] });
const client = new x402HTTPClient(new x402Client().register(NETWORK, new ExactEvmScheme(acct)));
let signed = 0n; let halt = null;

const b0 = await bal();
summary.checks.balance_before_atomic = b0.toString();
if (b0 < exposure) fail("wallet balance below worst-case exposure", 2);

async function payAndSend(body, amountAtomic) {
  const step1 = await post(body);
  if (step1.r.status !== 402) return { error: `expected 402, got ${step1.r.status}` };
  const pr = client.getPaymentRequiredResponse((n) => step1.r.headers.get(n), step1.json);
  const v = validate(pr, PRICE.toString());
  if (v.problems.length) { halt = "requirements changed: " + v.problems.join(", "); return { error: halt }; }
  if (signed + amountAtomic > CAP_ATOMIC) { halt = "cap reached"; return { error: halt }; }
  const reqs = { ...pr, accepts: [{ ...v.a, amount: amountAtomic.toString() }] };
  const payload = await client.createPaymentPayload(reqs);
  const au = payload?.payload?.authorization;
  if (!au || String(au.value) !== amountAtomic.toString() || getAddress(au.to) !== EXPECTED_PAY_TO || getAddress(au.from) !== getAddress(acct.address)) { halt = "signed payload check failed"; return { error: halt }; }
  const hdr = client.encodePaymentSignatureHeader(payload);
  signed += amountAtomic;
  const s = await post(body, hdr);
  const rec = { status: s.r.status, latency_ms: s.ms, code: codeOf(s.json), signed_atomic: amountAtomic.toString() };
  const raw = s.r.headers.get("PAYMENT-RESPONSE") || s.r.headers.get("X-PAYMENT-RESPONSE");
  if (raw) { try { const d = decodePaymentResponseHeader(raw); rec.settled = d.success; rec.tx = d.transaction; } catch { rec.settlement_decode_error = true; } }
  if (s.json && typeof s.json === "object") { rec.computed_price = s.json.computed_price; rec.function_name = s.json.function_name; }
  if (rec.code === "payment_settlement_unknown") { halt = `payment_settlement_unknown (payment_id ${s.json?.payment_id ?? s.json?.error?.payment_id}); do not resend, contact support`; }
  return { rec, hdr };
}

let firstPaid = null; let paidOk = 0;
for (let i = 0; i < N && !halt; i++) {
  const body = bodies[i % bodies.length];
  const out = await payAndSend(body, PRICE);
  const rec = { step: `paid-${i + 1}`, ...(out.rec || {}), error: out.error };
  summary.calls.push(rec);
  if (out.rec?.status === 200 && out.rec.settled) { paidOk++; if (!firstPaid) firstPaid = { body, hdr: out.hdr }; }
  await sleep(PAUSE);
}
summary.checks.paid = { attempted: summary.calls.length, settled_200: paidOk, ok: paidOk === N };

if (doReplay && firstPaid && !halt) {
  const rp = await post(firstPaid.body, firstPaid.hdr);
  summary.checks.replay = { status: rp.r.status, code: codeOf(rp.json), price_returned: rp.json?.computed_price ?? null, ok: rp.r.status === 402 && codeOf(rp.json) === "payment_replayed" && rp.json?.computed_price === undefined };
  await sleep(PAUSE);
}
if (doUnder && !halt) {
  const out = await payAndSend(bodies[0], UNDER);
  summary.checks.underpay = { status: out.rec?.status, code: out.rec?.code, settled: out.rec?.settled ?? false, ok: out.rec?.status === 402 && out.rec?.code === "payment_invalid" && !out.rec?.settled, error: out.error };
}

await sleep(8000); // let the last settlement land
const b1 = await bal();
const delta = b0 - b1;
summary.checks.balance = { before_atomic: b0.toString(), after_atomic: b1.toString(), delta_atomic: delta.toString(), expected_atomic: (PRICE * BigInt(paidOk)).toString(), ok: delta === PRICE * BigInt(paidOk) };
summary.checks.signed_exposure_atomic = signed.toString();
if (halt) summary.halt = halt;

const all = [summary.checks.paid.ok, summary.checks.replay?.ok ?? true, summary.checks.underpay?.ok ?? true, summary.checks.balance.ok, !halt];
summary.verdict = all.every(Boolean) ? "PASS" : "FAIL";
finish(summary.verdict === "PASS" ? 0 : 1);
