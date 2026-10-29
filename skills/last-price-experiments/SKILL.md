---
name: last-price-experiments
description: Use for last-price.ai A/B (or multi-arm) price experiments - create, start/pause/complete, assign visitors, record or void conversions, read results - plus stopping verdicts, Bayesian significance, Thompson-sampling traffic allocation and bandit mode, and browser storefront wiring with embed tokens.
---
# Last Price: price experiments

Every route needs `x-api-key` or a Bearer token (keyless is 401); scopes `experiments:read` / `experiments:write`. MCP equivalents: `create_experiment`, `list_experiments`, `get_experiment_definition`, `get_experiment_results`, `get_experiment_stopping`, `set_experiment_bandit`, `propose_experiment_variant`, `check_variant_significance`, `allocate_variant_traffic`, `promote_experiment_winner`, `list_experiment_calls`, `list_hosted_demos`, `set_experiment_status`, `delete_experiment`, `remove_experiment_conversions`. Some routes are early access and answer 404 `not_enabled` until switched on for the workspace.

## Lifecycle

- **Create:** `POST /api/tenants/{tenantId}/experiments` (path tenant must be the caller's, from `GET /api/me`). Body: `key` (`^[a-z0-9_]+$`), `name`, optional `description`, `targetSampleSize`, and `variants`.
  - **2 to 10 variants, exactly one named `control`.** Names: 1-40 lowercase letters/digits/underscores starting with a letter; unique; `comparison` and `summary` are reserved.
  - Each variant: `name`, `price` (>= 0), optional `weight`, optional `metadata`.
  - Weights on every variant or none (none = even split). Two arms: relative weights (70/30 = 0.7/0.3), at most 1:99. Three or more arms: whole-number percentages summing to 100.
  - Variant `metadata` is spread over the served `pricing` object; put real copy in `metadata.features` or the API serves placeholder features.
- **List:** `GET /api/experiments?status=` (or `GET /api/tenants/{tenantId}/experiments`). **Get:** `GET /api/experiments/{experimentId}`; **definition:** `GET /api/experiments/{experimentId}/definition`.
- **Start / pause / complete:** `PATCH /api/experiments/{experimentId}` `{"status":"active|paused|completed"}`. Completed is final. Paused or completed experiments serve the control price to everyone, record nothing, and answer conversions with 409 `experiment_not_running`.
- **Assign + price:** `GET /api/experiments/{experimentId}/pricing?userId=...` (1-200 chars). Deterministic per user, honours weights. Returns `variant` and `pricing`.
- **Convert:** `POST /api/experiments/{experimentId}/convert` with `userId`, optional `revenue` (omitted = the variant's list price; explicit `0` = zero-revenue conversion). 404 means the user was never assigned.
- **Start, pause, resume, complete:** `set_experiment_status` (`experiment_key`, `status`: `active`, `paused` or `completed`). Paused serves every buyer the control price and records nothing; completed is final and keeps the results, so confirm before completing.
- **Void conversions:** `DELETE /api/experiments/{experimentId}/conversions` with exactly one of `userId` or `variant` (MCP `remove_experiment_conversions`: `user_id` or `variant`). Views and assignments stay; the removal is audited and cannot be undone.
- **Results:** `GET /api/experiments/{experimentId}/results`: per-arm `views`, `conversions`, `revenue`, `conversionRate`, `arpu`, and a comparison against control. Numbers may arrive as strings; parse before math.
- **Add an arm:** `POST /api/jale/propose-variant` `{experimentId, price, label?, metadata?}`. Only on evenly split (unweighted) experiments, max 10 arms; already-assigned users keep their arm.
- **Promote the winner:** `POST /api/experiments/{experimentId}/promote` (`promote_experiment_winner`, with `experiment_key` and `variant`) ends the experiment and serves that arm's price to everyone; results are kept. Early access (404 `not_released`).
- **Calls behind assignments:** `GET /api/experiments/{experimentId}/calls` (`list_experiment_calls`) lists, newest first, the user, variant, compute request id and usage event id of each recorded assignment, to tie an arm to `get_receipt`.
- **Delete:** `DELETE /api/experiments/{experimentId}` (`delete_experiment`) removes all data permanently; prefer complete.

## Deciding

- **Stopping verdict (stored experiments):** `GET /api/experiments/{experimentId}/sequential` returns `stopping.verdict` (`stop`, `keep_running`, `no_winner_yet`) from an always-valid sequential test against control (each arm needs 100 views), plus current split, bandit settings, and weight history. Act on the first `stop`.
- **Bandit mode:** `PUT /api/experiments/{experimentId}/sequential` `{"bandit_enabled":true, "min_weight_pct"?:1-50 (default 5), "control_min_weight_pct"?:1-90 (default 20)}` recomputes weights daily by Thompson sampling.
- **Ad-hoc significance:** `POST /api/compute/significance` with `variants: [{id, trials, conversions}]` (2-10), optional `prior {alpha, beta}`, `win_probability` (default 0.95), `loss_threshold`. Returns posterior mean, 95% credible interval, `probability_best`, `expected_loss`, and `verdict` `winner|equivalent|continue`. Needs `price:compute`; billed as usage.
- **Ad-hoc allocation:** `POST /api/compute/allocation` with the same `variants`; returns Thompson-sampling shares summing to 1, floored at `min_weight`. `mode: exact` (default) or `monte_carlo` with `draws` and `seed`.
- Feed `views` as trials and `conversions` from `/results`.
- For a recommended price (not just a winner), use JALE optimize (`POST /api/jale/optimize`, see `last-price-learning-loop`).

## Storefront (browser) wiring

Only the per-experiment `pricing` and `convert` routes accept browser calls, using a publishable embed token in `x-embed-token` (`lpe_...`, created in workspace admin) from an allowlisted origin. Never put an API key or JWT in page source. Report conversions from a server with an API key when revenue must be authoritative.

To see experiments from the shopper's side before building one, `list_hosted_demos` (`GET /api/public/demos`, no credential) lists the demo apps Last Price runs under /demos and the experiment each runs, with per-arm visitors and conversions.

## Steps

1. Clarify the job: set up, assign, track, read, decide, re-split, or stop.
2. Read the definition and results before changing anything.
3. Creating: validate arms (one `control`, names, weights rule) and real `metadata.features` copy.
4. Deciding: prefer `/sequential` on stored experiments; only call a winner on `stop` or `winner`, and promote only after the user agrees. Never present `continue`, `keep_running`, or `no_winner_yet` as a result.
5. Confirm before completing or deleting an experiment, or voiding conversions.
6. Report the numbers the API returned; never fabricate counts, rates, or significance.

Legacy routes `GET /api/pricing` and `POST /api/convert` still exist; prefer per-experiment routes. `GET /api/debug/assignments` is development-only.
