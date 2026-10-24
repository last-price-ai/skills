---
name: last-price-usage-and-billing
description: Use when checking last-price.ai usage metering, receipts, LLM usage, cost analytics, prepaid balance, top-ups (x402 or card), balance billing, outcome pricing settings, credit bundles, or invoices for a workspace.
---
# Last Price: usage, receipts, and billing

Not for computing a product price (`last-price-compute`). Publisher earnings are in `last-price-marketplace`. MCP equivalents: `get_usage`, `get_usage_breakdown`, `list_usage_events`, `get_llm_usage`, `get_receipt`, `list_receipts`, `get_billing_settings`, `update_billing_settings`, `list_outcomes`, `top_up_balance`, `create_card_topup`, `list_costs`, `get_cost_analytics`, invoice and credit tools.

Keyless demo calls meter into the platform demo workspace, not yours. Use a real key and a descriptive `User-Agent` for attribution.

## Surfaces

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/usage` | Aggregated usage (`start_date` / `end_date`) |
| GET | `/api/usage/events` | Raw priced calls, paged; who sent each (agent, channel, credential kind, User-Agent) |
| PATCH | `/api/usage/events/{id}/outcome` | Record `outcome` and/or `quality_score` |
| GET | `/api/usage/breakdown?group_by=function` | Usage by function |
| GET | `/api/usage/llm`, `/api/usage/llm/events` | Model-call usage (agent generate, estimate, capture pricing, analyst), separate from function metering |
| POST | `/api/usage/signals` | Record an agent usage signal |
| GET | `/api/receipts/{id}`, `/api/receipts?ids=...` or a period | On-demand receipts (`?format=csv|html` available) |
| GET | `/api/costs` | Recorded cost rows (`startDate`, `endDate`, camelCase) |
| GET | `/api/costs/analytics` | Grouped cost analytics (`groupBy`) |
| GET | `/api/billing/balance` | Prepaid USDC balance, recent ledger, top-up terms, balance billing and outcome pricing flags |
| PATCH | `/api/billing/balance` | `balance_billing`, `outcome_pricing`, auto top-up offer (confirm first) |
| POST | `/api/billing/topup` | Fund the balance via x402 for an exact amount (402 without payment) |
| POST | `/api/billing/topup/card` | Hosted card checkout link for an amount; nothing charged until the person pays |
| GET | `/api/billing/topup/card/{topupId}` | Card top-up status |
| GET | `/api/credits`, `/api/credits/balance`, `/api/credits/{creditId}` | Customer credit bundles (`billing:read`) |
| GET | `/api/invoices`, `/api/invoices/{invoiceId}` | Invoices (`billing:read`) |
| POST | `/api/invoices/{invoiceId}/send` | Email an invoice (`billing:write`; sends a real email, confirm first) |

Query names differ by family: usage uses `start_date`/`end_date`; costs uses `startDate`/`endDate`. Copy from OpenAPI.

## Read path

1. Summary: `GET /api/usage`. Report total vs billable cost honestly; prepaid, x402, and day-pass calls count in totals but not billable period cost.
2. Drill down: breakdown by function; `usage/events` filtered by agent or User-Agent for attribution.
3. Budget: `GET /api/billing/balance`.
4. Model spend: check `/api/usage/llm` too; it never appears in `/api/usage`.
5. Costs, credits, invoices only when asked.

## Money rules

- `balance_billing: true` means calls not covered by balance are refused. `outcome_pricing: true` opens refund windows on prepaid calls (see `last-price-learning-loop`). Confirm both before changing.
- Auto top-up is an offer/hint, not an automatic charge.
- Top-ups move money: confirm the amount; never invent an x402 signature (see `last-price-x402`).
- Keep keys and payment headers out of chat and logs.

```bash
curl -sS 'https://api.last-price.ai/api/usage' -H "User-Agent: acme-bot/billing" -H "x-api-key: $LP_API_KEY"
```
