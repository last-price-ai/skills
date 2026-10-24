# x402 release check (capped)

A release check for Last Price pay-per-call compute. Run it after a deploy to confirm a wallet-only buyer can still pay, that used and short payments are refused without a charge, and that the wallet moved by exactly what was paid.

**Dry run by default.** Without `--execute` it only reads discovery and sends one unpaid request (which returns `402`); nothing is signed.

## Steps it runs

| # | Step | Pass when |
|---|---|---|
| 0 | `GET /.well-known/agents.json` | `payments.x402.pay_to` equals your configured `LP_X402_PAY_TO`; network and USDC asset match |
| 1 | Unpaid `POST /api/compute/price` | `402`, `code: payment_required`, `retryable: false`, v2 terms: `eip155:8453`, USDC, `payTo` = configured |
| 2 | Plan | worst-case exposure (N × price + underpay amount) ≤ `--cap-usdc`, else refused |
| 3 | N paid calls (`--execute`) | each `200` with a settled `PAYMENT-RESPONSE`; tx hash recorded |
| 4 | Replay of the first paid header | `402 payment_replayed`, no price returned |
| 5 | Underpay (half price) | `402 payment_invalid`, nothing settled |
| 6 | USDC balance before/after on Base | delta equals N × price exactly |

Every payment is checked before signing (network, asset, exact amount, `payTo`) and the signed authorization is re-checked (`value`, `to`, `from`). On `payment_settlement_unknown` the run halts and never resends.

## Run

```bash
npm install
export LP_X402_PAY_TO=<the "Paid to" address from https://last-price.ai/docs/agent-wallets>
node release-check.mjs                                  # dry run
AGENT_WALLET_KEY=... node release-check.mjs --execute --paid-calls 3 --cap-usdc 0.10
```

Options: `--paid-calls N` (0–50, default 3), `--cap-usdc X` (default 0.10), `--skip-replay`, `--skip-underpay`, `--base-url`, `--rpc`, `--pause-ms`, `--out`. Set `USER_AGENT` to label your traffic.

Exit codes: `0` pass (or dry-run OK), `1` a check failed, `2` refused (bad config, cap, low balance, discovery mismatch).

A summary JSON goes to `results/` (git-ignored). It holds statuses, codes, latencies, amounts and transaction hashes. It never holds the key, the wallet address or signed payment headers.

## Wallet hygiene

- Use a wallet only this check uses, funded with a little more than the cap. The wallet needs no ETH.
- Keep `AGENT_WALLET_KEY` in a secret store. A key without a `0x` prefix is accepted.
- Default cost of an `--execute` run: 3 × 0.01 = 0.03 USDC, worst case 0.035 including the refused underpay.
