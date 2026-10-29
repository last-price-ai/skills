---
name: last-price-functions-and-routing
description: Use when managing last-price.ai pricing functions (register, patch, test, external/LLM functions, endpoint credentials), routing policies (cheapest, fastest, weighted, policy rules, fallback chains, ceilings), calling POST /api/price-router or /api/price-router/chain, verifying a proposed price, or setting workspace price guardrails.
---
# Last Price: functions, routing, verify, and guardrails

Single-call compute payloads live in `last-price-compute`; marketplace listings and the leaderboard in `last-price-marketplace`. MCP covers most of this surface (`create_function`, `test_function`, `create_routing_policy`, `run_pricing_chain`, `verify_price`, `set_price_guardrails`, ...; see `last-price-mcp`).

## Surfaces and scopes

| Call | Auth / scope | Notes |
|---|---|---|
| `GET /api/price-router` | public | Capability descriptor: `strategies` (exact semantics), `providers`, `builtins` (`cost_multiplier`, `computes_price`, `prices_without_incumbent`), `metering`. Read it first. |
| `GET /api/functions/catalog` | public, per-IP limit | Active built-ins plus publicly listed marketplace functions (response key `listings`). Never returns endpoints or credentials. Filters `execution_type`, `tags`, `limit` 1-100, `offset`. |
| `GET /api/functions` | `pcn:function:read` | Workspace-owned plus built-ins. Filters `status`, `execution_type`, `is_builtin` (`true`/`false`), `limit`, `offset`. |
| `POST /api/functions` | `pcn:function:publish` | Register (201). |
| `GET/PATCH/DELETE /api/functions/{id}` | read / publish / publish | PATCH/DELETE only owned functions. |
| `POST /api/functions/{id}/test` | `pcn:function:test` | Built-in, owned, or publicly listed only. |
| `GET /api/functions/{id}/health` | read | Endpoint probe history for external functions. |
| `GET/POST /api/routing-policies`, `GET/PATCH/DELETE /api/routing-policies/{id}` | `pcn:routing:read` / `pcn:routing:write` | |
| `GET /api/routing-policies/{id}/learned` | `pcn:routing:read` | What learned routing has observed per function. |
| `POST /api/price-router` | `price:compute` | Route + execute + meter one request. |
| `POST /api/price-router/chain` | `price:compute` | Run stages in sequence (see Chains). |
| `GET /api/price-router/verify` | public | Verdicts and evidence strategies. |
| `POST /api/price-router/verify` | `price:compute` | Judge a price you already have. |
| `POST /api/public/price-router/verify` | public, per-IP limit | Same verdict, pinned demo function, caller `metadata` dropped, 4 KB body cap. |
| `GET/PUT/DELETE /api/price-guardrails` | `pcn:routing:read` / `pcn:routing:write` | Workspace-wide price holds. |
| `GET /api/price-router/pipelines` | public | Reference pipeline designs and stage catalog. |
| `POST /api/price-router/pipelines` | `price:compute` | Capture pricing: price one item from photos, PDFs, links, or text (one model call, metered as LLM usage). |

`POST /api/public/pipelines` is deprecated and always answers 501; never use it.

## Built-ins

Read `builtins` from `GET /api/price-router` each time. Only functions with `computes_price: true` produce a price; only those with `prices_without_incumbent: true` (for example `cost-plus`, `competitive-price`) work without a positive `context.current_price`. Rosetta, `elo-significance`, `elo-allocator`, `jale-bundle`, `jale-tier-optimizer` do not compute a single price: naming one answers 422 `not_a_pricing_function` (nothing metered). Metering is `(input_units * cost_per_unit * input_factor + output_units * cost_per_unit * output_factor) * cost_multiplier`.

Before changing what your own functions charge, `preview_price_change` (`GET|POST /api/pricing/preview`) replays a proposed `change_pct`, or a new `cost_per_unit` / `cost_multiplier` for one `function_id`, over the calls they served in a window: totals, the change per function, and how many customers would pay more, less or the same. It changes nothing.

## Registering a function

`POST /api/functions` requires `name`, `display_name`, `execution_type` (`rule_based`, `ml_model`, `llm_prompt`, `external_api`, `composite`), `input_schema`, `output_schema`. Optional: `description`, `endpoint_url`, `auth_config`, `inference_config`, `cost_per_unit`, `status` (default `draft`; also `review`, `active`, `inactive`, `deprecated`), `tags`.

- `auth_config` is the credential sent to `endpoint_url` (e.g. `{"type":"bearer","token":"..."}` or `{"type":"api_key","header":"x-key","key":"..."}`). Write-only: responses show only whether one is saved. On PATCH omit to keep, object to replace, `null` to remove. 503 `credential_encryption_unavailable` means nothing was saved.
- `inference_config` (only `llm_prompt` and `ml_model`): `provider` required (`openai`, `anthropic`, `openrouter`, `together-ai`, `huggingface`, `replicate`, `baseten`, `aitune`), optional `model` and `prompt` (no secrets in prompts). Calls run on the owner's connected provider (see `last-price-workspace-admin`); if it is not connected, calls answer 503 and never fall back. Such functions need a positive `context.current_price`.
- New functions start `draft`; routing and the catalog only use `active` ones. PATCH `status: active` only after a passing test.

## Testing

`POST /api/functions/{id}/test` takes optional `context`, `constraints`, `options`; routing is pinned to that function and explanation/confidence/alternatives default on. A partial context is passed through unvalidated, so send a full `PricingContext` to mirror production.

## Routing policies

Create needs `name` and `strategy`; optional `config`, `fallback_function_id`, `is_default`. The default policy is used when a request sends `routing_preference` `default` (the API's default) or `policy`.

Resolution inside a policy: `config.rules` (first match wins), then the `strategy`, then `config.fallback_chain`, then `fallback_function_id`, then default selection (a built-in, else the cheapest).

- `weighted` needs at least one positive weight in `config.weights` (`function_id` to weight); `policy` needs `config.rules`. Missing config is 400.
- `config.max_cost_per_unit` and `config.max_latency_ms` are ceilings for stored `cheapest`/`fastest`/`round_robin`; if nothing qualifies it defers to `fallback_chain`.
- The rule object shape is not fully documented: GET existing policies and copy a shape the API stored, or create a minimal rule and read it back. Rules read `context.metadata` keys.
- A policy can run an experiment across functions: `GET /api/routing-policies/{id}/experiment` (`get_routing_experiment`, read only; leave `policy_id` out for the default policy) shows each arm's function and recorded calls, the status (not released, not configured, waiting, running or promoted) and the promoted winner. Only the default policy routes calls.
- Request overrides: `function_id` or `explicit` pins one function; `cheapest`, `fastest`, `round_robin` override the policy and ignore its ceilings; `weighted` still reads the default policy's weights.

## The router call

`POST /api/price-router` requires `tenant_id` (uuid, from `GET /api/me`) and `context`; optional `function_id`, `function_name` (e.g. `lastprice/jale-elasticity`), `routing_preference`, `constraints`. A function that is not built-in, owned, or publicly listed is 404. 200 may carry `savings` (only when the router chose among several functions), `next_actions`, `remaining`, `receipt`. Other statuses: 402 (pay per call or `insufficient_balance`), 403 missing price scope, 422 `not_a_pricing_function`, 429, 503 circuit open.

## Chains

`POST /api/price-router/chain` with `context` and `pipeline.stages[]` (max 10). Stage `kind`: `function` (default; exactly one of `function_id`/`function_name`, optional `fallback_function_*`, `constraints`, `metadata`, `on_error: skip|fail`), `clamp` (`min_price`, `max_price`, `max_over_competitor_pct`), and `llm`/`vision` (early access; 422 `stage_kind_unavailable` until enabled). Each stage's price becomes the next stage's `current_price`; workspace guardrails apply once at the end. Example: cost-plus, then a competitor clamp, then `lastprice/jale-psychological`.

## Verifying a price

`proposed_price` (alias `price`) and `context` required; `context.current_price` optional. Optional `function_id`, `routing_preference`, `constraints.min_price/max_price` (binding), `options.evidence`. Response: `verdict` (`fair|too_high|too_low|unknown`), `reference_price`, `band`, `deviation_pct`, `confidence`, `evidence[]` (with `independent_of_proposal`), `reasons[]`. `unknown` is a 200 meaning nothing could judge it, not "fair". Send `metadata.unit_cost` and `metadata.elasticity` for a sharper verdict.

## Workspace price guardrails

`GET` returns `guardrails` (or `null` with `saved: false`) plus `defaults`. `PUT` saves the whole set (omitted fields reset to defaults): always GET, merge, PUT everything, GET again.

- `band_lower_ratio` (default 0.5) and `band_upper_ratio` (default 2): only the optimizer's search range around `current_price` when the caller sends no min/max.
- `max_change_pct`: most a price may move from `current_price`, either way.
- `min_margin_pct`: least margin over `metadata.unit_cost`, as percent of price.
- `never_below_cost` (default true).

They apply after the function to every compute, router, batch, chain, pay-per-call, and MCP call, and show in `trace` as `constrain` with `detail: guardrails=<rules>`. They are live-money settings: tell the user what will tighten before saving.

## Steps

1. Read `GET /api/price-router` and the catalog; with a key, `GET /api/functions`, `/api/routing-policies`, `/api/price-guardrails`.
2. Pick by need: no incumbent means `cost-plus` or `competitive-price`; elasticity-driven needs `current_price`.
3. New function: `POST /api/functions` as `draft`, test with a full context, then PATCH to `active`.
4. Routing: show the current default policy, propose strategy plus config (weights, ceilings, fallback chain), create or PATCH, then run one router call with `routing_preference: default` and read `trace` and `savings`.
5. Confirm before deleting a function or policy, changing `is_default`, or changing guardrails on a live workspace.

## Tips

- Never put a paid third-party marketplace function on the hot path without a `fallback_chain`; circuit breakers are per function.
- Pin (`function_id` + `explicit`) for reproducibility; use the default policy in production so you can re-route without client changes.
- Weighted routing is a cheap function A/B; for tracked experiments with conversions use `last-price-experiments`.
