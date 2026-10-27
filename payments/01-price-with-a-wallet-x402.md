# Recipe 01: price a product with a wallet only (x402)

No account, no API key. Your agent pays 0.01 USDC on Base for each `POST /api/compute/price`, and the payment is settled only after the price has been computed.

## Before you start (the person running the agent)

1. Create a wallet used **only** by this agent, holding only what you expect it to spend (a dollar or two covers 100–200 calls). Never use a main wallet.
2. Fund it with **USDC on Base**. The accepted token is the USDC contract `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. USDC on any other network will not work. The wallet needs no ETH: a facilitator submits the transfer and pays gas.
3. Put the private key in the agent's secret store as `AGENT_WALLET_KEY`. Wallet apps that use passkeys or recovery phrases only (many smart wallets) have no exportable key; a plain EVM account (for example a fresh MetaMask account) does.
4. Copy the **"Paid to"** address from https://last-price.ai/docs/agent-wallets into your agent's config as `LP_X402_PAY_TO`. The agent must refuse to pay any other address. (`GET https://api.last-price.ai/.well-known/agents.json` repeats it under `payments.x402.pay_to`; the two should agree.)

## Steps

1. **Ask for the price unpaid.**
   ```bash
   curl -i -X POST https://api.last-price.ai/api/compute/price \
     -H 'user-agent: my-agent/buyer' -H 'content-type: application/json' \
     -d '{"context":{"product_type":"saas","current_price":49,"currency":"USD"}}'
   ```
   Expect `402` with body `code: payment_required`, `retryable: false`, and a base64 `PAYMENT-REQUIRED` header (x402 v2). Decoded, `accepts[0]` has `scheme: exact`, `network: eip155:8453`, `asset` = the USDC contract, `amount: "10000"` (0.01 USDC, 6 decimals), `payTo`, `maxTimeoutSeconds: 60`. The body repeats the terms in x402 v1 form (`network: base`, `maxAmountRequired`).
2. **Check before you sign.** Refuse unless all of these hold: network `eip155:8453`; asset is the USDC contract above; amount is exactly what you expect (`10000`); `payTo` equals your configured `LP_X402_PAY_TO`. The docs snippet does **not** do these checks; use [the safe client](x402-safe-client/) or add them yourself.
3. **Sign** an exact-amount authorization with an x402 client (`@x402/fetch` + `@x402/evm` + `viem`). If your key has no `0x` prefix (MetaMask exports 64 hex characters), add it before `privateKeyToAccount`, which rejects it otherwise.
4. **Send the same request again** with the signed payment in `PAYMENT-SIGNATURE` (v2) or `X-PAYMENT` (v1).
5. **Read the answer.** `200` with the price (`computed_price`, `currency`, `function_name`, `confidence`), plus `PAYMENT-RESPONSE` (v2) and `X-PAYMENT-RESPONSE` (v1). Decode `PAYMENT-RESPONSE`: `success`, `network`, `transaction`, `payer`.
6. **Keep the transaction hash as your proof of payment.** The paid answer carries only a `receipt.id`, and `GET /api/receipts/{id}` needs an API key (keyless answers `401`). The hash resolves on `https://basescan.org/tx/<hash>`.

## Pricing inputs

- Incumbent price: `{"context":{"product_type":"saas","current_price":49,"currency":"USD"}}` → `lastprice/jale-optimizer`.
- With cost and elasticity: add `"metadata":{"unit_cost":9,"elasticity":-1.6}`.
- Competitor match: `"metadata":{"competitor_price":119,"competitor_currency":"USD","competitive_action":"match","unit_cost":70,"target_margin_pct":20}` → `lastprice/competitive-price`.

Paid calls run on a shared pay-per-call workspace with the built-in and publicly listed functions.

## Payment answers and what to do

| Answer | Charged? | Do |
|---|---|---|
| `402 payment_required` | No | Check terms, sign, resend. |
| `402 payment_replayed` | No | A payment buys one call. Sign a fresh one; never reuse a header. |
| `402 payment_invalid` | No | Wrong amount or bad authorization. Re-read the requirements. |
| `payment_settlement_failed`, `retryable: true` | No | Fix the cause (for example top up) and present the **same** payment again, up to 3 attempts in all. |
| `payment_settlement_failed`, `retryable: false` | No | Fix the cause and sign a new payment. |
| `503 payment_settlement_unknown` | **Maybe** | **Stop.** Do not sign a new payment or resend. Email support@last-price.ai with the `payment_id`. |
| Other `503` with `retryable: true` | No | Wait `Retry-After`, resend the same request. |

## Spend less when you make many calls

- **Prepaid balance** (needs an API key that can compute): `POST /api/billing/topup` with `{"amount":"10"}` or more and one x402 payment for exactly that amount. Calls then draw 0.008333 USDC each. `GET /api/billing/balance` shows the balance.
- **Day pass** (self-registered sandbox key): `POST /api/agents/allowance` with one 2.5 USDC payment adds 500 calls for 24 hours once the daily limit is used. `GET` the same path lists passes.

## Response handling

- Refusals (`payment_replayed`, `payment_invalid`) answer with an x402 **v1** body even to a v2 client.
- The v2 `PAYMENT-REQUIRED` envelope's `error` text says `X-PAYMENT header is required`, though v2 clients send `PAYMENT-SIGNATURE`.
- `explanation` can be `null`; handle it as an optional field.
