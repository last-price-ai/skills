---
name: last-price-learning-loop
description: Use when closing the last-price.ai pricing feedback loop - reporting quote outcomes, outcome pricing refunds, reading or switching on learned elasticity (auto or approve mode), approving learned price changes, price exploration, pricing-analyst findings and briefs, JALE optimize from experiment data, pricing models, or the JALE price-data exchange.
---
# Last Price: the learning loop

Last Price gets smarter per workspace only when quotes get outcomes: **quote -> outcome -> nightly elasticity fit -> analyst findings -> learned pricing on -> re-quote**. Every endpoint here is 401 without a credential. MCP equivalents include `report_outcome`, `get_pricing_analysis`, `get_analyst_brief`, `ask_pricing_analyst`, `get_learned_pricing`, `set_learned_pricing`, `list_learned_price_changes`, `decide_learned_price_change`, `get_price_exploration`, `set_price_exploration`, `recommend_jale_price`, `get_price_foundation_report`, `get_forge_status`, `promote_forge_candidate`, `retire_forge_candidate` (see `last-price-mcp`).

## Endpoints

| Method | Path | Scope | What it does |
|---|---|---|---|
| PATCH | `/api/usage/events/{id}/outcome` | `price:compute` | Report `outcome` (`accepted`/`rejected`) and/or `quality_score` (0-1), optional `evidence`. `{id}` = `receipt.id` from compute. |
| PATCH | `/api/usage/llm/events/{id}/outcome` | same | Same for LLM-backed usage events. |
| GET | `/api/outcomes` | `price:compute` | Outcome pricing on/off, terms, open/accepted/rejected counts, refunds, windows. |
| GET | `/api/learned-elasticity` | `pcn:routing:read` | `enabled`, `apply_mode`, `estimates[]` (elasticity, CI, sample size, `usable`, `reason`), `requirements`. |
| PUT | `/api/learned-elasticity` | `pcn:routing:write` | `{enabled?, apply_mode?: auto|approve, email_notifications?}`. |
| GET | `/api/learned-elasticity/changes` | `pcn:routing:read` | Recorded learned changes (before/after elasticity and example price, status). |
| POST | `/api/learned-elasticity/changes/{id}/approve` or `/reject` | `pcn:routing:write` | Decide a change waiting in approve mode. |
| GET | `/api/learned-elasticity/curve` | `pcn:routing:read` | Outcome counts by quoted/current price bin plus the fitted curve. |
| GET/PUT | `/api/learned-elasticity/exploration` | read / write | Small randomized price variation so the fit can learn (`rate` 0.005-0.1). |
| GET/PUT | `/api/learned-elasticity/buyer-models`, `/feature-contract` | read / write | Buyer-aware pricing (off, shadow, live) and the request fields it learns from. |
| GET | `/api/price-foundation` | `pcn:routing:read` | Shadow ML pricing mix report (`get_price_foundation_report`); read only, never changes a price. |
| GET | `/api/forge` | `pcn:routing:read` | Forge models and which are promotable (`get_forge_status`). |
| POST | `/api/forge/candidates/{id}/promote`, `/retire`, `/reject` | `pcn:routing:write` | Put a passed model on live learned prices, stop a promoted one, or reject one (`promote_forge_candidate`, `retire_forge_candidate`, `reject_forge_candidate`). Promote changes live prices. |
| GET | `/api/pricing-analyst/findings` | `pcn:routing:read` | Free, no-AI findings, most urgent first, each with a `next_step`. |
| GET | `/api/pricing-analyst/brief` | `pcn:routing:read` | Latest written brief; every claim cites findings and is number-checked. |
| POST | `/api/pricing-analyst/ask` | `pcn:routing:read` | One plain-language question, answered in cited claims. |
| GET/PUT | `/api/pricing-analyst/settings` | read / write | Brief cadence and whether it may be paid from balance (cap required). |
| POST | `/api/jale/optimize` | key or bearer | `{experimentId, objective?: revenue|conversion|profit, candidates?, lookbackDays?}` -> `recommendedPrice`, `confidence`, `data_status`, `simulation[]`. |
| GET/POST | `/api/pricing-models` | key or bearer | List or create pricing model records. |
| POST | `/api/jale/contribute`, `/api/jale/contribute/batch` | Bearer | Contribute public price points; earns tokens; 409 duplicate. |
| GET | `/api/jale/contributions`, `/api/jale/token-balance` | Bearer | Your contributions and token balance. |
| GET | `/api/jale/pool` | Bearer | Shared validated pool; each query spends tokens. |

## How learning works

- Estimates are fitted nightly from recent quotes with an outcome: one per product plus a pooled workspace estimate.
- Reported outcomes win. Unreported quotes get an **inferred** outcome from the workspace's own orders: accepted when an `active`/`completed` order line carries the quote's `request_id` in `metadata.quote_request_id` (or the product in `metadata.product_id`, same buyer if the quote sent `metadata.customer_id`); rejected on a quick re-quote or no order. See `last-price-order-to-cash`.
- An estimate is `usable` only with enough outcomes of both kinds, varied prices, and a 95% interval wholly below zero; otherwise `reason` says what is missing.
- With learning on, `lastprice/jale-optimizer` uses the usable estimate instead of the assumed -1.2 when a call sends no `metadata.elasticity`. A caller's own elasticity still wins.
- `apply_mode`: `auto` applies new estimates at once (recorded and announced, webhook `learned_elasticity.changed`); `approve` keeps the last approved estimate until each change is approved. A workspace that never chose runs in preview.

## Outcome pricing money rules

- Enabled via `PATCH /api/billing/balance {"outcome_pricing": true}` (see `last-price-usage-and-billing`). Prepaid-paid compute calls then open an outcome window.
- `rejected` inside an open window refunds part of the call price; `accepted` closes it; silence closes as accepted.
- High rejection shares trigger guards (evidence required, then no refund). Same outcome again is a harmless retry; a different outcome on a decided window is 409 `outcome_already_decided`.

## Recipes

1. **Loop health check:** findings -> learned-elasticity -> outcomes. Summarize usable estimates, the top blocking `reason`, outcome coverage, and whether learning is on.
2. **Close the loop on a quote:** keep the receipt id; PATCH its outcome with the real result. Never fabricate outcomes to unlock estimates or refunds.
3. **Turn learning on:** only when findings say an estimate is ready. Prefer `{"enabled":true,"apply_mode":"approve"}` first; then review `/changes` and approve. Re-quote one product without `metadata.elasticity` and confirm the explanation names the learned estimate. Revert with `{"enabled":false}`.
4. **Experiment optimize:** POST optimize with the user's objective; report `recommendedPrice`, `confidence`, `data_status`, and the simulation table as a recommendation, not an applied price.
5. **Data exchange:** contribute only public prices with a real `sourceUrl`; check token balance before pool reads.
6. **Shadow models:** `get_price_foundation_report` (`GET /api/price-foundation`) shows what the shadow ML pricing mix learned last night; it only logs and never changes a price. A Forge model that passed shadow pricing shows as promotable in `get_forge_status`; `promote_forge_candidate` puts it on live learned prices (inside the charged range widened by 10%, never below unit cost) and `retire_forge_candidate` stops it, which works even while promotion is off. Promote only after the user agrees.

## Guardrails

- Rejections move money and learning changes live prices: state the effect before writing.
- Data-exchange routes need a Bearer session token, not an API key.
- Don't invent elasticity numbers; quote only what `estimates[]` returns.
