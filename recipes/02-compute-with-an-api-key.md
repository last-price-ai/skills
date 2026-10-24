# Recipe 02: compute with an API key (incumbent, cost-plus, competitor match)

## Get a key

Pick one:
- **No human, free sandbox:** `POST /api/agents/register` with `{"name":"my-system/pricing-agent"}` (optional `contact_email`, `intended_use`). Answers `201` with a sandbox workspace, an API key shown once in `api_key.key`, and `claim.claim_url` for a person. Free: 25 compute calls a day on built-in functions; the key lasts 30 days. Features that need a claimed workspace answer `403 sandbox_restricted`.
- **Person-owned workspace:** a person signs up at https://app.last-price.ai/sign-up and creates a key with the `price:compute` scope in Settings.

Store the key as `LP_API_KEY`. Check it: `GET /api/me` with `x-api-key` returns `tenant_id`, `auth_method`, `scopes`. A key that reaches `/api/me` but lacks `price:compute` gets `403 insufficient_scope` on compute.

Not sure which inputs you have? `POST /api/compute/conversation` with `{}` (no credential needed for preparation) answers `needs_input` with `questions` and a `continuation`. Ask your caller those questions; never guess costs or bounds.

## The request

`POST /api/compute/price`, header `x-api-key: $LP_API_KEY`. `context.currency` is required. Omit optional fields rather than sending `null`. Turn on `options.include_explanation`, `include_confidence`, `include_alternatives` while you learn the API.

### A. You have an incumbent price

```json
{
  "context": {
    "product_id": "plan_pro_monthly", "product_type": "saas",
    "current_price": 49, "currency": "USD",
    "metadata": { "unit_cost": 12, "elasticity": -1.5 }
  },
  "constraints": { "min_price": 39, "max_price": 79 },
  "options": { "include_explanation": true, "include_confidence": true, "include_alternatives": true }
}
```
Runs `lastprice/jale-optimizer`. Without `elasticity` and `unit_cost` it assumes -1.2 and no cost (revenue maximising) and says so in `explanation`; confidence drops to about 0.5.

### B. Cost-plus (no incumbent: a new SKU, a task, an API call)

```json
{
  "context": {
    "product_id": "report_generation", "product_type": "api", "currency": "USD",
    "metadata": { "unit_cost": 0.42, "target_margin_pct": 40 }
  },
  "options": { "include_explanation": true }
}
```
With `current_price` absent and `unit_cost` present, routing picks `lastprice/cost-plus`. Price = cost / (1 − margin), so 0.42 at 40% gives 0.70. `target_margin_pct` is margin on price (0 to under 100, default 30). Alternatively give a full `min_price` + `max_price` band.

### C. Match or undercut a competitor

```json
{
  "context": {
    "product_id": "headphones_x1", "product_type": "ecommerce",
    "current_price": 129, "currency": "USD",
    "metadata": {
      "competitor_price": 119, "competitor_currency": "USD",
      "competitive_action": "match",
      "unit_cost": 70, "target_margin_pct": 20
    }
  }
}
```
Runs `lastprice/competitive-price`. For an undercut use `"competitive_action":"undercut","undercut_pct":5`. Always give a floor (`unit_cost` + `target_margin_pct`, or `constraints.min_price`). The function does not verify the competitor offer: confirm it is the same product and currency first.

## Read the answer

Report `computed_price` and `currency`, `function_name`, `confidence`, `explanation`, `alternatives` (labelled conservative/aggressive), `metering.cost`, and `trace`. Then act on `next_actions`, usually recording the outcome once the quote wins or loses: `PATCH /api/usage/events/{receipt.id}/outcome`. `remaining` shows calls, day pass, balance and rate limit left.

Prices are whole cents; floors round up; the result never goes below `unit_cost` by default. The returned price is advice; nothing changes in your store.

## Pin a function or route by name

- `function_id` must be a UUID: take it from `GET /api/functions/catalog` (public). Sending `function` or `function_name` to compute is `400 validation_failed`.
- To route by name, use `POST /api/price-router`. `GET /api/price-router` (public) describes strategies and which built-ins compute a price.

## Errors you will meet

| Answer | Fix |
|---|---|
| `400 validation_failed` | Read `issues` and the `example` body. Usually a missing `context.currency`. |
| `400 missing_incumbent_price` | Send a positive `current_price`, or `unit_cost` for cost-plus. |
| `400 missing_pricing_basis` | Cost-plus needs `unit_cost` or a full band. |
| `400 conflicting_pricing_inputs` | Currency mismatch, min > max, max below floor. Correct inputs; don't add more. |
| `403 insufficient_scope` | Key lacks `price:compute`; `required_scopes` says what's missing. |
| `404` | `function_id` unknown or not reachable by your workspace. |
| `422 not_a_pricing_function` | That built-in (for example a Rosetta one) does not price. Nothing was metered. |
| `429 quota_exceeded` | Daily limit. `next` lists `pay_per_call`, `day_pass` and `claim`. |

## Many SKUs

`POST /api/compute/batch` takes up to 100 items, answered by position; one bad item does not fail the call. Needs `price:compute:batch`; not available on a self-registered sandbox.

## Try it with no key first

`POST /api/public/compute/demo` with body A minus `metadata` and `constraints` (the demo strips them) prices on a demo workspace, about 30 calls per IP per hour. Label demo results as demo. It refuses a missing or zero `current_price`; cost-plus needs a key.
