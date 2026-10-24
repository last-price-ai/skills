---
name: last-price-x402
description: Use when last-price.ai answers HTTP 402 or an agent wants to pay per call with no account (x402, USDC on Base), buy a day pass, top up a prepaid balance, or handle payment_required, payment_replayed, payment_invalid, or payment_settlement_unknown errors.
---
# Last Price: x402 pay-per-call, day passes, and top-ups

**402 is a real product path**, not an auth failure: unauthenticated `POST /api/compute/price` answers 402 with x402 payment requirements. A wallet-only agent can buy one priced computation with no account. This was verified end to end with a funded wallet (October 2026).

## Live terms (re-read before paying; they can change)

From `/.well-known/agents.json` -> `payments.x402`, the live 402, and `https://last-price.ai/docs/agent-wallets`:

| Field | Value seen live |
|---|---|
| Network | Base, `eip155:8453` (v1 name `base`) |
| Asset | USDC, contract `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals) |
| Price per call | 0.01 USDC = `10000` atomic units |
| Scheme | `exact`; the facilitator pays gas |
| Headers v2 | response `PAYMENT-REQUIRED`, request `PAYMENT-SIGNATURE`, response `PAYMENT-RESPONSE` |
| Headers v1 | body `accepts[]` (`maxAmountRequired`), request `X-PAYMENT`, response `X-PAYMENT-RESPONSE` |
| Recipient | `payTo`; must equal the "Paid to" address published on the agent-wallets docs page |

## Paying per call

1. Send the compute request without a credential. Expect 402 `payment_required` (`retryable: false`) with both a v2 `PAYMENT-REQUIRED` header (base64 JSON) and a v1 JSON body.
2. **Check before signing**, in code: network `eip155:8453`, asset is the USDC contract above, amount `10000`, and `payTo` equals the docs "Paid to" address. Refuse anything else. (A bare fetch wrapper pays whatever a 402 asks; add a policy/before-payment hook that enforces these checks.)
3. Sign and resend the identical request with `PAYMENT-SIGNATURE` (v2) or `X-PAYMENT` (v1). The `@x402/fetch` + `@x402/evm` + `viem` client stack works.
4. A paid 200 returns the price plus `PAYMENT-RESPONSE` (v2: success, network, transaction hash, payer) and `X-PAYMENT-RESPONSE` (v1). Exactly 0.01 USDC moves per call.

Notes:
- **Keep the transaction hash** from `PAYMENT-RESPONSE` as proof of payment. The 200 body carries only `receipt.id`, and `GET /api/receipts/{id}` needs an API key, so a wallet-only buyer cannot fetch the receipt.
- **Latency:** settlement happens inside the request: about 1.7-3.4 s per paid call versus 0.25-0.43 s of compute. The unpaid 402 round trip adds 0.6-1.2 s; a client that already knows the terms can pre-sign and skip it (still verify the terms periodically).
- The v2 402 text says "X-PAYMENT header is required" (the v1 name); v2 clients still send `PAYMENT-SIGNATURE`.
- Body `remaining.rate_limit.limit` and the `X-RateLimit-Limit` header may disagree; trust the headers and `Retry-After`. `explanation` may be null on paid calls.
- Private keys exported from some wallets (e.g. MetaMask) lack the `0x` prefix; `viem`'s `privateKeyToAccount` needs it. Load keys from a secret store, never log them.

## Payment errors

| Code (HTTP 402 unless noted) | Meaning | Action |
|---|---|---|
| `payment_required` | No payment sent | Verify terms, sign, resend. |
| `payment_replayed` | A settled payment header was reused | Nothing charged. Sign a fresh payment; never reuse headers. |
| `payment_invalid` | Authorization wrong, e.g. underpaid (`invalid_exact_evm_payload_authorization_value`) | Nothing charged. Fix the amount/fields from the requirements. |
| `payment_settlement_unknown` (503 per docs; rare) | Settlement outcome unclear | **Never re-sign or resend.** Contact support@last-price.ai with the `payment_id`. |

All are `retryable: false`. Refusals use the v1 body shape even for v2 clients, so a v2-only client must parse both.

## Other paid paths

- **Sandbox agent key** (`POST /api/agents/register`): free compute within a daily cap; past it, 429 with `next` steps (pay per call, day pass, claim). The same key plus a payment header is pay-per-call and does not count against the cap.
- **Day pass:** `POST /api/agents/allowance` without payment -> 402 requirements; with payment -> a pass (live terms in `agents.json` under `self_registration`). `GET /api/agents/allowance` lists passes. Self-registered workspaces only; claiming forfeits unused calls.
- **Prepaid balance:** `GET/PATCH /api/billing/balance`, `POST /api/billing/topup` (x402), or `POST /api/billing/topup/card` (hosted card checkout, nothing charged until the person pays). See `last-price-usage-and-billing`.
- **Wallet check:** `GET /api/agents/wallet` reads a wallet's USDC on Base and what it covers.
- Keyed or session requests are not asked to pay for ordinary compute.
- The keyless demo (`/api/public/compute/demo`) is free and not x402.

## Spend rules

- Pay only with the user's explicit authorization, a funded wallet the user controls, and a budget. Prefer one 0.01 call over a day pass; never top up "for later".
- Never invent or reuse payment signatures. One settle per attempt; never loop payments on a failing endpoint.
- If the owner uses a spend policy, run `check_purchase` (`POST /api/spend-policy/check`) first (see `last-price-spend-and-offers`).
- Record the amount, path, status, and a shortened transaction hash; never paste payment payloads, private keys, or seeds.
