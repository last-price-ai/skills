/**
 * x402 safe client for Last Price compute.
 *
 * Wraps the open-source x402 packages (@x402/fetch re-exports the x402 client
 * classes) and refuses to sign unless every check passes:
 *   - network is Base mainnet (eip155:8453)
 *   - asset is the USDC contract on Base
 *   - amount equals the exact amount you expect (default 10000 = 0.01 USDC)
 *   - payTo equals the address you configured (copy it from the docs "Paid to")
 *   - the cumulative signed amount stays under your spend cap
 * After signing it re-checks the signed authorization (value, to, from).
 *
 * It never resends after `payment_settlement_unknown`: the client halts all
 * payments until a person calls `acknowledgeSettlementUnknown()`.
 */
import { x402Client, x402HTTPClient, decodePaymentResponseHeader } from "@x402/fetch";
import type { PaymentRequired, PaymentRequirements, PaymentPayload } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { getAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const BASE_MAINNET = "eip155:8453" as const;
export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const DEFAULT_PRICE_ATOMIC = 10000n; // 0.01 USDC, 6 decimals

export interface SafeX402Config {
  /** Wallet private key. Read it from a secret store / env. A missing 0x prefix is added. */
  privateKey: string;
  /** The only address you are willing to pay. Copy the "Paid to" address from the docs. */
  expectedPayTo: string;
  /** Exact amount you expect per call, in atomic USDC units. Default 10000 (0.01 USDC). */
  expectedAmountAtomic?: bigint;
  /** Maximum total amount this client instance may sign, in atomic units. Default 100000 (0.10 USDC). */
  spendCapAtomic?: bigint;
  /** Fetch implementation (for tests or a custom agent). Default globalThis.fetch. */
  fetchImpl?: typeof fetch;
}

export interface SafeX402Result {
  response: Response;
  /** Parsed JSON body when the answer was JSON, else the text. */
  body: unknown;
  /** True when a payment was signed and sent for this call. */
  paid: boolean;
  /** Settlement transaction hash from PAYMENT-RESPONSE (or X-PAYMENT-RESPONSE). Keep it as proof of payment. */
  txHash?: string;
  network?: string;
  payer?: string;
  /** Amount signed for this call, atomic units. */
  amountAtomic?: string;
  /** Error code from the body, when present (payment_replayed, payment_invalid, payment_settlement_failed, ...). */
  code?: string;
}

export class PaymentRefusedError extends Error {
  constructor(public readonly reasons: string[]) {
    super("x402 payment refused before signing: " + reasons.join("; "));
    this.name = "PaymentRefusedError";
  }
}

export class SettlementUnknownError extends Error {
  constructor(public readonly paymentId: string | undefined) {
    super(
      "payment_settlement_unknown: the payment may have been charged. Do not sign or resend. " +
        "Email support@last-price.ai with the payment_id." + (paymentId ? ` payment_id=${paymentId}` : ""),
    );
    this.name = "SettlementUnknownError";
  }
}

/** Adds a missing 0x prefix (MetaMask exports 64 hex characters without it) and validates the shape. */
export function normalizePrivateKey(raw: string): Hex {
  let k = (raw ?? "").trim();
  if (!k) throw new Error("wallet private key is empty");
  if (!k.startsWith("0x") && !k.startsWith("0X")) k = "0x" + k;
  k = "0x" + k.slice(2);
  if (!/^0x[0-9a-fA-F]{64}$/.test(k)) throw new Error("wallet private key must be 32 bytes of hex");
  return k as Hex;
}

function readBodyCode(body: unknown): { code?: string; paymentId?: string } {
  if (!body || typeof body !== "object") return {};
  const b = body as Record<string, any>;
  const code = typeof b.code === "string" ? b.code : typeof b.error?.code === "string" ? b.error.code : undefined;
  const paymentId = b.payment_id ?? b.error?.payment_id;
  return { code, paymentId: typeof paymentId === "string" ? paymentId : undefined };
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function amountOf(a: PaymentRequirements): string | undefined {
  const r = a as unknown as Record<string, unknown>;
  const v = r.amount ?? r.maxAmountRequired;
  return v === undefined ? undefined : String(v);
}

export class SafeX402Client {
  private readonly http: x402HTTPClient;
  private readonly fetchImpl: typeof fetch;
  private readonly payTo: string;
  private readonly from: string;
  private readonly amount: bigint;
  private readonly cap: bigint;
  private signed = 0n;
  private haltedPaymentId: string | null | undefined = undefined; // undefined = not halted

  constructor(cfg: SafeX402Config) {
    const account = privateKeyToAccount(normalizePrivateKey(cfg.privateKey));
    this.from = getAddress(account.address);
    if (!cfg.expectedPayTo) throw new Error("expectedPayTo is required");
    this.payTo = getAddress(cfg.expectedPayTo);
    this.amount = cfg.expectedAmountAtomic ?? DEFAULT_PRICE_ATOMIC;
    this.cap = cfg.spendCapAtomic ?? 100000n;
    this.fetchImpl = cfg.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.http = new x402HTTPClient(new x402Client().register(BASE_MAINNET, new ExactEvmScheme(account)));
  }

  /** Total amount signed and sent so far (worst-case exposure), atomic units. */
  get signedAtomic(): bigint {
    return this.signed;
  }

  /** True after payment_settlement_unknown until acknowledged. */
  get halted(): boolean {
    return this.haltedPaymentId !== undefined;
  }

  /** Call only after a person has resolved the unknown settlement with support. */
  acknowledgeSettlementUnknown(): void {
    this.haltedPaymentId = undefined;
  }

  /** Validates requirements. Returns the single acceptable entry or the reasons for refusing. */
  checkRequirements(pr: PaymentRequired): { ok: PaymentRequirements } | { reasons: string[] } {
    const reasons: string[] = [];
    const candidates = (pr.accepts ?? []).filter((a) => a.network === BASE_MAINNET);
    if (candidates.length === 0) return { reasons: [`no ${BASE_MAINNET} option offered`] };
    for (const a of candidates) {
      const r: string[] = [];
      if (a.scheme !== "exact") r.push(`scheme ${a.scheme}`);
      let assetOk = false;
      try { assetOk = getAddress(a.asset) === getAddress(USDC_BASE); } catch { /* invalid */ }
      if (!assetOk) r.push("asset is not USDC on Base");
      if (amountOf(a) !== this.amount.toString()) r.push(`amount ${amountOf(a)} != expected ${this.amount}`);
      let payToOk = false;
      try { payToOk = getAddress(a.payTo) === this.payTo; } catch { /* invalid */ }
      if (!payToOk) r.push("payTo does not match the configured address");
      if (r.length === 0) return { ok: a };
      reasons.push(...r);
    }
    return { reasons };
  }

  /** Re-checks the signed authorization before it leaves the process. */
  checkPayload(p: PaymentPayload): string[] {
    const au = (p as any)?.payload?.authorization;
    if (!au) return ["signed payload has no authorization"];
    const r: string[] = [];
    if (String(au.value) !== this.amount.toString()) r.push(`signed value ${au.value}`);
    try { if (getAddress(au.to) !== this.payTo) r.push("signed 'to' differs from configured payTo"); } catch { r.push("signed 'to' invalid"); }
    try { if (getAddress(au.from) !== this.from) r.push("signed 'from' is not this wallet"); } catch { r.push("signed 'from' invalid"); }
    return r;
  }

  /**
   * Sends the request; on a 402 checks the terms, signs, and sends the same request once more with the payment.
   * `init.body` must be a string (or absent) so the identical body can be resent.
   */
  async fetch(url: string, init: RequestInit = {}): Promise<SafeX402Result> {
    if (this.halted) {
      throw new SettlementUnknownError(this.haltedPaymentId ?? undefined);
    }
    if (init.body !== undefined && init.body !== null && typeof init.body !== "string") {
      throw new Error("init.body must be a string so the identical request can be resent");
    }
    const first = await this.fetchImpl(url, init);
    if (first.status !== 402) {
      const body = await readBody(first);
      return { response: first, body, paid: false, ...readBodyCode(body) };
    }
    const firstBody = await readBody(first);
    const pr = this.http.getPaymentRequiredResponse((n) => first.headers.get(n), firstBody);
    const check = this.checkRequirements(pr);
    if ("reasons" in check) throw new PaymentRefusedError(check.reasons);

    if (this.signed + this.amount > this.cap) {
      throw new PaymentRefusedError([`spend cap ${this.cap} would be exceeded (signed so far ${this.signed})`]);
    }
    const payload = await this.http.createPaymentPayload({ ...pr, accepts: [check.ok] });
    const post = this.checkPayload(payload);
    if (post.length) throw new PaymentRefusedError(post);

    const payHeaders = this.http.encodePaymentSignatureHeader(payload);
    this.signed += this.amount; // count exposure before sending
    const headers = new Headers(init.headers);
    for (const [k, v] of Object.entries(payHeaders)) headers.set(k, v);
    const second = await this.fetchImpl(url, { ...init, headers });
    const body = await readBody(second);
    const { code, paymentId } = readBodyCode(body);

    if (code === "payment_settlement_unknown") {
      this.haltedPaymentId = paymentId ?? null;
      throw new SettlementUnknownError(paymentId);
    }

    const result: SafeX402Result = { response: second, body, paid: true, amountAtomic: this.amount.toString(), code };
    const raw = second.headers.get("PAYMENT-RESPONSE") ?? second.headers.get("X-PAYMENT-RESPONSE");
    if (raw) {
      try {
        const s = decodePaymentResponseHeader(raw) as Record<string, any>;
        result.txHash = s.transaction;
        result.network = s.network;
        result.payer = s.payer;
      } catch {
        /* leave txHash undefined */
      }
    }
    return result;
  }
}

/** Convenience: build a client from environment variables. */
export function fromEnv(env: NodeJS.ProcessEnv = process.env): SafeX402Client {
  const key = env.AGENT_WALLET_KEY;
  const payTo = env.LP_X402_PAY_TO;
  if (!key) throw new Error("AGENT_WALLET_KEY is not set");
  if (!payTo) throw new Error("LP_X402_PAY_TO is not set (copy the docs 'Paid to' address)");
  const cap = env.LP_X402_SPEND_CAP_ATOMIC ? BigInt(env.LP_X402_SPEND_CAP_ATOMIC) : undefined;
  return new SafeX402Client({ privateKey: key, expectedPayTo: payTo, spendCapAtomic: cap });
}
