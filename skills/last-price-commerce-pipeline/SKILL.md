---
name: last-price-commerce-pipeline
description: Use when running the last-price.ai commerce control plane - store connectors and catalog/order sync, competitor observations, commerce pricing policies and dry-run evaluate, pipeline cycles, price proposals (approve/reject), executing approved prices back to the store, the commerce audit trail, or the seed-sample demo.
---
# Last Price: commerce pipeline (`/api/commerce/*`)

Turns a synced store catalog plus competitor prices into **price proposals**, gates them through approval, and pushes approved prices back to the store: **connector -> catalog sync -> observations -> policy -> cycle -> proposal -> approve/reject -> execution -> audit**. Distinct from UCP (`last-price-ucp`) and from the workspace approval queue (`last-price-workspace-admin`). MCP covers every step (`run_commerce_cycle`, `test_commerce_policy`, `approve_commerce_proposal`, `execute_commerce_proposals`, ...).

Every op needs a credential and a claimed workspace; each op names its scope in OpenAPI (`x-lastprice-scopes`, tag `Commerce`).

## Scopes (least privilege)

| Step | Scope |
|---|---|
| All reads (connectors, catalog, observations, policies, proposals, audit) | `commerce:catalog:read` |
| Connectors, sync, manual observations, policy writes, seed-sample | `commerce:configure` (connector create/pause also needs owner/admin) |
| Policy evaluate (dry run), run cycle | `commerce:proposal:draft` |
| Approve / reject proposal | `commerce:proposal:approve` / `commerce:proposal:reject` |
| Execute (push prices), or cycle with `execute: true` | `commerce:execute` |

`commerce:*` grants all.

## Endpoints

**Connectors**
- `GET /api/commerce/connectors` -> `{accounts[], available_platforms[]}` (e.g. `memory`, `shopify`, `amazon-sp`). Credentials come back masked.
- `POST /api/commerce/connectors` `{platform, display_name, credentials?, metadata?}` -> 201. Credentials are encrypted and never readable again. `metadata.observation_sources[]` names competitor price sources the cycle pulls (source-specific `query`; source API keys go in `credentials`, never in metadata).
- `PATCH /api/commerce/connectors/{id}` `{active: boolean}`: pause/resume (prefer over deleting).
- `POST /api/commerce/connectors/{id}/check` (`check_commerce_connector`): try a linked store without changing anything; reports reach, catalog and (where sales can be pulled) orders, each ok or the store's own error. Run it after linking a site an AI site builder made, before the first sync.
- `POST /api/commerce/connectors/{id}/sync` -> `{items_synced, pages, duration_ms}`.
- `POST /api/commerce/connectors/{id}/orders/sync` `{since?}`: pull store orders into the workspace (feeds learned elasticity).

**Catalog and observations**
- `GET /api/commerce/catalog?limit=` -> items (`external_id, sku, gtin, title, brand, current_price, currency, floor_price, ceiling_price, ...`). GTIN is the main match signal.
- `GET /api/commerce/observations?limit=`; `POST /api/commerce/observations` `{source, competitor, observed_price, currency, marketplace?, gtin?, external_id?, title?, source_confidence?, observed_at?, raw?}`; `DELETE /api/commerce/observations/{id}` removes a stored row (e.g. test data).

**Policies**
- `GET /api/commerce/policies`, `GET /api/commerce/policies/{id}`.
- `POST /api/commerce/policies` `{name, rules[], description?, scope?, floor_price?, ceiling_price?, approval_mode?, auto_approve_max_delta_pct?, is_active?}`.
  - `scope`: `{skus[], brands[], marketplaces[]}`; empty matches everything.
  - `rules` tried in order, then clamped to floor/ceiling. Kinds: `undercut_competitor` (`by_pct`, `min_competitors?`), `match_competitor`, `beat_lowest_by_abs` (`by_abs`), `percent_off_msrp` (`off_pct`), `router` (`routing_preference?`, `function_id?`; priced by the compute network), `fixed` (`price`). Rules are validated only at evaluate time.
  - `approval_mode`: `manual` (default), `auto` (approves when |change| <= `auto_approve_max_delta_pct`, a **fraction**, e.g. 0.05), `shadow` (records, never acts; use for trials).
- `PATCH /api/commerce/policies/{id}` merges fields without validating approval settings: when switching to `auto`, send `auto_approve_max_delta_pct` in the same patch.
- `DELETE /api/commerce/policies/{id}`: only when asked; prefer `is_active: false`.
- `POST /api/commerce/policies/{id}/evaluate` `{item, observations?, marketplace?}` -> decision (`proposed_price`, `delta_pct`, `rule_kind`, `clamped`, `auto_approved`, `rationale`). Nothing stored: always dry-run a new or edited policy here.

**Cycle, proposals, execution**
- `POST /api/commerce/cycle` `{execute?: false, expires_in_seconds?}` -> counts, proposals, matches, executions, `source_errors[]` (a failing source does not fail the cycle).
- `GET /api/commerce/proposals?status=proposed|approved|rejected|executed|failed|expired&limit=`.
- `POST /api/commerce/proposals/{id}/approve` `{reason?}`; `POST /api/commerce/proposals/{id}/reject` `{reason}` (required). 409 wrong state.
- `POST /api/commerce/execution` (no body): pushes **every** approved proposal to its store, with retries.

**Audit and demo**
- `GET /api/commerce/audit?subject_kind=&subject_id=&limit=`: commerce-only trail (workspace-wide audit is `GET /api/audit`).
- `POST /api/commerce/seed-sample`: idempotent in-memory connector, two items, competitor observations, and a manual undercut policy.

## Recipes

**Safe end-to-end smoke (no real store):** seed-sample -> catalog + observations -> evaluate the seeded policy on one item -> cycle `{}` -> approve one proposal and reject another with reasons -> execution (safe: in-memory platform) -> audit for the proposal.

**Onboarding a real store:** connector (owner/admin) -> sync -> observation sources -> policy in `shadow` -> evaluate several items -> cycle -> review proposals -> switch to `manual`, later `auto` with a tight delta.

## Guardrails

- `POST /api/commerce/execution` and `cycle {execute:true}` change **live store prices** on any non-`memory` connector. Run only when the user explicitly asked to push prices to that store; otherwise stop at approved proposals.
- Never put credentials in metadata, logs, or chat.
- Pause or deactivate instead of deleting.
- Check currency: observations in another currency than the item need verification before trusting a proposal.
- Label seed data as demo.
