# Last Price public extras (DRAFT, not yet released)

Ready-made pieces for outside agents and teams using Last Price. Companion to the product skill pack.

| Folder | What it is |
|---|---|
| [recipes/](recipes/) | Five short end-to-end recipes: pay per call with a wallet, compute with a key (incumbent, cost-plus, competitor match), list a function and read earnings, run an A/B price test with an embed token, and Rosetta ingest → translate → freeze. |
| [clients/x402-safe-client/](clients/x402-safe-client/) | A TypeScript x402 buyer that checks network, asset, exact amount and pay-to address before signing, keeps the transaction hash as proof of payment, and never resends after an unknown settlement. Offline tests included. |
| [persona-templates/](persona-templates/) | Thirteen persona definitions (8 external, 5 workspace roles) for testing your own Last Price setup. |
| [report-format/](report-format/) | A friction-report template for coding agents, with a clearly labelled made-up example. |
| [harness/x402-release-check/](harness/x402-release-check/) | A capped release check for pay-per-call: unpaid 402 probe, N paid calls, replay and underpay refusals, balance delta. Dry run by default. |

## Ground rules

- Everything here uses only public docs and public endpoints. The contract is https://api.last-price.ai/api/openapi; when it and these files disagree, it wins.
- No secrets are shipped. Wallet keys, API keys and the pay-to address are read from your environment.
- Nothing here spends money unless you pass an explicit flag and a cap.

Status: draft for review. Checked against the live API on 2026-10-24 (see each recipe's "Checked" section).
