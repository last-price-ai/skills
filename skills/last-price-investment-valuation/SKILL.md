---
name: last-price-investment-valuation
description: Use when an investor, VC, angel or founder agent needs a fair price for a startup round on last-price.ai - a post-money range from the stage, traction, team, market and comparable rounds, the pre-money and ownership a round implies, and whether an offer on the table is cheap, fair or rich (POST /api/public/investment-valuation, MCP value_investment). Keyless, nothing stored.
---
# Last Price: value a venture round

Use when the user wants a defensible valuation for a startup investment: a seed or Series A they are about to price, a term sheet to judge, or a round to model. Re-check the OpenAPI (`https://api.last-price.ai/api/openapi`) when a field differs from this skill.

## Defaults

- `POST https://api.last-price.ai/api/public/investment-valuation`, no credential; any key sent is ignored. Sixty valuations per address per hour (`X-RateLimit-*` headers; 429 with `Retry-After` past the limit).
- MCP equivalent: `value_investment` on `https://api.last-price.ai/api/mcp/rpc`, or the narrow capability server `https://api.last-price.ai/api/mcp/investment-valuation` (one tool). Keyless.
- Deterministic rules of thumb for US and European rounds in 2025 and 2026, stated in US dollars and applied as they are to `EUR` and `GBP`; in another currency the dollar benchmarks are skipped and the answer says so. No model call, nothing stored.
- People can run the same valuation at `https://last-price.ai/investment-valuation`.

## Request shape

Only `stage` is required: `pre_seed`, `seed`, `series_a`, `series_b`, `series_c` or `growth`. Every amount is in `currency` (default `USD`); percentages are whole percents (150 means 150% a year). Unknown fields are 400 `validation_failed` with `issues` and an `example`.

| Field | What to send |
|---|---|
| `sector` | `saas`, `ai`, `fintech`, `marketplace`, `consumer`, `healthtech`, `biotech`, `deeptech`, `hardware`, `climate` or `other`. Sets sector heat and the exit multiple. |
| `round_size` | How much the round raises. Unlocks pre-money, ownership and the dilution method. |
| `traction` | `arr` (or `mrr`, used as ARR times 12), `revenue_growth_yoy_pct`, `gross_margin_pct`, `net_revenue_retention_pct`, `customers`, `monthly_active_users`, `monthly_burn`, `months_of_runway`. |
| `team` | `founders`, `repeat_founder`, `prior_exit`, `domain_experts`. |
| `market` | `tam` (same currency), `competition` (`few`, `some`, `many`). |
| `comps` | Up to 25 comparable rounds, each with `post_money` (or `pre_money` plus `round_size`) and, for a revenue multiple, `arr`; `name`, `stage`, `date` optional. |
| `offer` | The deal on the table: `post_money`, or `pre_money` with `investment`. |
| `years_to_exit`, `exit_multiple`, `target_return_multiple` | Overrides for the VC method; defaults by stage and sector. |

## Reading the answer

- `fair_value.post_money` is the blended `low`, `mid`, `high`; `fair_value.pre_money` and `implied_ownership_pct` follow from `round_size` (null without it).
- `methods` lists each method that had inputs, with its own range, `weight`, `inputs_used` (request fields by path) and a one-line `note`. `methods_skipped` says why the rest did not run. The methods: `stage_benchmark` (stage norm with a scorecard), `revenue_multiple`, `comparable_rounds` (heaviest weight), `vc_method`, `round_dilution`.
- `offer.verdict`: `cheap` (below the range), `fair` (inside it) or `rich` (above it), with `vs_fair_pct` against the midpoint and `ownership_pct` the investment buys.
- `confidence.level`: `low` on stage norms alone, `medium` with revenue or comps, `high` when three or more methods agree within 3x. `reasons` says why.
- `signals` are what stood out (burn, retention, runway, an oversized round); `assumptions` are every default filled in. Quote both when you report.

## Steps

1. Collect the stage and whatever the user knows. Ask for ARR and growth first (they unlock three methods), then comparable rounds they have seen, then the offer. Never invent a comp.
2. Call the valuation. On 400, fix the field `issues` names; `incomplete_offer` means the offer needs `post_money` or `pre_money` plus `investment`; `nothing_to_value` means no revenue, no comps and a currency without benchmarks.
3. Report the fair range, the pre-money and ownership for the round, the offer verdict, then each method's range and note, the signals and the assumptions. Say the answer is an estimate from the inputs, not investment advice, as `disclaimer` does.
4. To test a term sheet, resend with a different `offer` or `round_size`; the engine is deterministic, so the fair range stays the same and only the verdict moves.

## Rules

- Report what the API returned; never adjust a range by hand or quote a method the answer skipped.
- Comparable rounds come from the user or their own research. The tool does not look them up.
- Keep the company's figures out of logs and prompts you share; the API stores nothing, so nothing has to be deleted afterwards.
