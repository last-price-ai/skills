# x402 safe client for Last Price

A small TypeScript client for paying Last Price compute per call with x402 (USDC on Base). It uses the open-source x402 packages (`@x402/fetch`, `@x402/evm`, `viem`) but drives the two-request flow itself, so it can **refuse to sign** anything you did not expect.

## What it checks

Before signing, on the `402` terms:
- network is Base mainnet, `eip155:8453`;
- asset is USDC on Base, `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`;
- amount equals the exact amount you expect (default `10000` = 0.01 USDC);
- `payTo` equals the address you configured;
- the cumulative signed amount stays within your spend cap (default 0.10 USDC per client instance).

After signing, before sending: the signed authorization's `value`, `to` and `from` are re-checked.

It also:
- adds a missing `0x` prefix to the private key (MetaMask exports 64 hex characters without it);
- returns the settlement **transaction hash** from `PAYMENT-RESPONSE` (falls back to `X-PAYMENT-RESPONSE`). Keep it as proof of payment: the paid answer carries only a receipt id, and reading a receipt needs an API key;
- on `payment_settlement_unknown` throws `SettlementUnknownError`, and **halts every later payment** until a person calls `acknowledgeSettlementUnknown()`. It never resends or re-signs after that answer;
- never retries on its own. On `payment_settlement_failed` it returns the `code` so your code can decide (the docs allow presenting the same payment again up to 3 attempts when `retryable: true`).

## Install

```bash
npm install
npm test        # offline tests: mocked fetch, throwaway keys, no network, no payment
```

## Configure

| Variable | Meaning |
|---|---|
| `AGENT_WALLET_KEY` | Private key of a wallet used only by this agent. From a secret store, never from code. |
| `LP_X402_PAY_TO` | The **"Paid to"** address shown on https://last-price.ai/docs/agent-wallets. Copy it yourself; this repo does not ship it. |
| `LP_X402_SPEND_CAP_ATOMIC` | Optional cap for one client instance, atomic USDC units (default `100000` = 0.10 USDC). |

## Use

```ts
import { fromEnv, SettlementUnknownError, PaymentRefusedError } from "lastprice-x402-safe-client";

const client = fromEnv();
try {
  const r = await client.fetch("https://api.last-price.ai/api/compute/price", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "my-agent/buyer" },
    body: JSON.stringify({ context: { product_type: "saas", current_price: 49, currency: "USD" } }),
  });
  if (r.response.ok) console.log((r.body as any).computed_price, "paid tx", r.txHash);
  else console.log("not priced:", r.response.status, r.code);
} catch (e) {
  if (e instanceof PaymentRefusedError) console.error("refused to sign:", e.reasons);
  else if (e instanceof SettlementUnknownError) console.error(e.message); // tell a person; do not retry
  else throw e;
}
```

`init.body` must be a string so the identical request can be resent with the payment.

## Answers you will see

| Status / code | Charged | Client behaviour |
|---|---|---|
| `200` + `PAYMENT-RESPONSE` | Yes, 0.01 USDC | Returns `paid: true`, `txHash`. |
| `402 payment_replayed` | No | Returns `code`. Each payment buys one call. |
| `402 payment_invalid` | No | Returns `code`. |
| `payment_settlement_failed` | No | Returns `code`; your decision. |
| `503 payment_settlement_unknown` | Maybe | Throws, halts. Email support@last-price.ai with the `payment_id`. |

The client reads refusal codes from both x402 v1 and v2 response bodies.
