---
name: last-price-compute
description: Use when computing, quoting, or smoke-testing a price on last-price.ai - POST /api/compute/price, batch compute, the input clarifier (compute/conversation), or the keyless public demo - including cost-plus with no incumbent price, competitor match/undercut, and reading compute 4xx errors.
---
# Last Price: compute a price

Use when the user wants a price decision: quote a SKU, plan, or task; match or undercut a competitor; compare alternatives; or smoke-test compute. Re-check the OpenAPI (`https://api.last-price.ai/api/openapi`) when behavior differs from this skill.

## Defaults

- `POST https://api.last-price.ai/api/compute/price` with `x-api-key: $LP_API_KEY` and `User-Agent: <system>/<role>` (see `last-price-auth`). Scoped and agent keys need `price:compute` (batch: `price:compute:batch`).
- MCP equivalent: `compute_price` / `compute_prices_batch` (see `last-price-mcp`). Without a credential the MCP tool runs the demo.
- The returned price is advice; it never updates a store.

## Request shape

- `context` (required) with `currency` (required, 3 letters). Optional: `product_id`, `product_type` (`saas|ecommerce|marketplace|digital|api|custom`, default `custom`), `current_price` (>= 0), `customer_segment`, `geo`, `timestamp`, `metadata`. Omit optional fields instead of sending `null`.
- `context.metadata`: `unit_cost`, `target_margin_pct` (margin on price, 0 to <100, default 30), `elasticity` (negative, e.g. -1.5), `competitor_price`, `competitor_currency`, `competitive_action` (`match|undercut`), `undercut_pct` (0-100), `inference_cost` + `inference_payer` (`vendor` default, or `customer`), `customer_id` (opaque buyer id, never a name or email; ties later orders back for learned elasticity), `control`/`experiment` for jale-elasticity.
- `constraints`: `min_price`, `max_price`, `preferred_functions`, `excluded_functions`.
- `options`: `include_explanation`, `include_confidence`, `include_alternatives`.
- `function_id` must be a UUID (from `GET /api/functions/catalog` or `list_functions`). Sending `function` or `function_name` here is 400; to route by name use `POST /api/price-router` (see `last-price-functions-and-routing`).
- `routing_preference`: `cheapest|fastest|explicit|round_robin|weighted|policy|default` (`explicit` needs `function_id`).

## Which function prices what

Read `builtins` from `GET /api/price-router` (public) for the live list; check `computes_price` and `prices_without_incumbent`.

| Situation | What runs | Inputs that matter |
|---|---|---|
| Incumbent price exists | `lastprice/jale-optimizer` (default) | positive `current_price`; `metadata.elasticity` and `metadata.unit_cost` to price for profit. Without them it assumes elasticity -1.2 and no cost, says so, confidence ~0.5. Search band 0.5x-2x current unless min/max or guardrails set it. |
| No incumbent (task, API call, new SKU) | `lastprice/cost-plus` (auto-routed when `current_price` is 0/absent and `unit_cost` present) | `unit_cost` (+ `target_margin_pct`) or a full `min_price`+`max_price` band. Price = cost / (1 - margin). |
| Bring-your-own-AI tier | `lastprice/cost-plus` | `inference_cost` is added to cost only when `inference_payer` is `vendor`. |
| Competitor offer | `lastprice/competitive-price` (default routing + `competitor_price`) | `competitor_price`, `competitor_currency`, `competitive_action`, `undercut_pct`, plus a floor (`min_price` or `unit_cost`+`target_margin_pct`). It never verifies the offer: confirm same product and currency first. |
| Measured A/B elasticity | `lastprice/jale-elasticity` | `metadata.control`/`experiment`; confidence capped at 0.5 if control price is >5% off `current_price`. |

Rules for every function: whole cents; floors round up; if no cent fits between floor and ceiling the floor wins; never below `unit_cost` by default; a `.99` ending only if it moves the price <=3% and stays in range. Saved workspace guardrails (`/api/price-guardrails`) apply after the function and show in the `constrain` step of `trace`. Learned elasticity, when switched on, replaces the -1.2 assumption (see `last-price-learning-loop`).

## Steps

1. Collect currency, incumbent price or unit cost, product type, and any competitor offer or band. If inputs are unclear, call `POST /api/compute/conversation` with `action: prepare` (free, never charges), ask the returned `questions`, then `action: compute` with the continuation.
2. Pick routing: default unless the user named a function (pin its UUID) or a strategy.
3. Turn on explanation, confidence, and alternatives for reviews.
4. Call compute. On 4xx, fix inputs per the table below; never invent a price.
5. Report `computed_price` + currency, `function_name`, `confidence`, explanation (including stated assumptions), `alternatives`, `metering.cost`, `trace` (route reason, fallback, cache, constrain), and `savings` when present.
6. Act on `next_actions`: usually record the outcome later via `PATCH /api/usage/events/{id}/outcome` with `receipt.id`. `remaining` shows calls, day pass, balance, and rate limit left.
7. Many SKUs: `POST /api/compute/batch` (<= 100 items, positional; an item can fail without failing the call). Not available on self-registered sandboxes (403 `sandbox_restricted`); with balance billing on it is drawn all-or-nothing (402 `insufficient_balance`).
8. Multi-step pricing (cost-plus, then clamp, then psychological ending): `POST /api/price-router/chain` (see `last-price-functions-and-routing`).

## Reading errors

| Status / code | Meaning and fix |
|---|---|
| 400 `validation_failed` | Schema issue; body lists `issues` and a minimal passing `example`. |
| 400 `missing_pricing_inputs` | `missing_inputs` names each field to add. |
| 400 `missing_incumbent_price` | Send a positive `current_price`, or `unit_cost` for cost-plus. |
| 400 `missing_pricing_basis` | Cost-plus with no `unit_cost` and no full band. |
| 400 `conflicting_pricing_inputs` | Currency mismatch, min > max, max below floor: correct inputs, don't add more. |
| 401 | Invalid credential; read the error code before replacing it. |
| 402 `payment_required` | Pay per call with x402 (see `last-price-x402`). |
| 403 | Missing `price:compute`. |
| 404 | `function_id` unknown or not reachable by this workspace (deliberately indistinguishable). |
| 422 `not_a_pricing_function` | The UUID is a non-pricing built-in (Rosetta, significance, allocator). Nothing metered. |
| 429 | `rate_limited` (wait `Retry-After`) or `quota_exceeded`; `next` offers pay per call, day pass, claim. |
| 503 | Function inactive or circuit open; retry after `Retry-After`. `payment_settlement_unknown` is never retryable. |

## Pay per call

Use `/api/compute/price` with an x402 payment authorization instead of an API key. Read `last-price-x402` for payment validation and settlement handling. Paid calls can use metadata, constraints and available pricing functions.

## Free demo

`POST /api/public/compute/demo` pins `lastprice/jale-optimizer` on a demo workspace, ignores `function_id`/`routing_preference`, strips `constraints` and `metadata`, caps the body at 4 KB and about 30 calls per IP per hour (`X-Demo-Remaining`). A missing or zero `current_price` is a 400 pointing at cost-plus on `/api/compute/price`, using an API key or x402 payment. Label demo results as demo.

```bash
curl -sS -X POST https://api.last-price.ai/api/public/compute/demo \
  -H "User-Agent: acme-bot/demo" -H "Content-Type: application/json" \
  -d '{"context":{"product_id":"plan_pro","product_type":"saas","current_price":49,"currency":"USD"},"options":{"include_explanation":true}}'
```

## Example (authenticated)

```bash
curl -sS -X POST https://api.last-price.ai/api/compute/price \
  -H "User-Agent: acme-bot/pricing" \
  -H "x-api-key: $LP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "product_id": "plan_pro_monthly", "product_type": "saas",
      "current_price": 49, "currency": "USD",
      "metadata": { "unit_cost": 12, "elasticity": -1.5 }
    },
    "constraints": { "min_price": 39, "max_price": 79 },
    "options": { "include_explanation": true, "include_confidence": true, "include_alternatives": true }
  }'
```

No incumbent: drop `current_price`, keep `metadata.unit_cost` (+ `target_margin_pct`). Competitor: add `competitor_price`, `competitor_currency`, `competitive_action` (and `undercut_pct`) to `metadata` plus a floor.
