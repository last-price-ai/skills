---
name: last-price-rosetta
description: Use when translating merchant or vendor payloads with last-price.ai Rosetta - ingest, plan, translate, normalize, freeze adapters, the review queue, canonical schemas - wiring Rosetta webhooks, or reading a Rosetta 4xx.
---
# Last Price: Rosetta (schema translation)

Rosetta maps merchant or vendor payloads onto Last Price canonical records. A planner (heuristics plus a model) proposes field mappings with confidence, a deterministic compiler applies them, validation runs before anything is trusted, and people decide uncertain cases. MCP equivalents: `ingest_with_rosetta`, `plan_rosetta_mapping`, `translate_with_rosetta`, `freeze_rosetta_adapter`, `normalize_with_rosetta`, `list_rosetta_review`, `decide_rosetta_review`, `list_canonical_schemas`.

## Access

- Public, no key: `GET /api/rosetta/health`, `GET /api/rosetta/canonical-schemas`.
- Everything else needs `x-api-key` or Bearer. A self-registered sandbox key gets 403 `sandbox_restricted` on every non-public Rosetta route until a person claims the workspace; that is not a bad key.

## Canonical targets (verify live; field names are camelCase)

| Key | Required | Optional |
|---|---|---|
| `product` | `sku`, `title` | `gtin`, `brand`, `category` |
| `offer` | `sku`, `channel`, `price` (number, **minor units** of currency), `currency` | `availability` |
| `observation` | `sku`, `source`, `competitorPrice` (number), `currency`, `observedAt` (date) | `confidence`, `buyBox` |
| `match` | `sku`, `candidateId`, `score` | `threshold`, `reviewed` |
| `action` | `sku`, `channel`, `kind` | `price`, `currency`, `reason` |

Wherever a target is taken you can pass the key or a full schema `{id, fields:[{path, type, required?, description?, enum?}]}`; `type` is `string|number|integer|boolean|date|object|array`.

## Endpoints

| Method | Path | Body (required in bold) | Returns |
|---|---|---|---|
| POST | `/api/rosetta/ingest` | **`canonical_target`**, **`payload`**, `merchant_id`, `samples[]` | ingest result (200, or 202 when queued for review) |
| POST | `/api/rosetta/plan` | **`source_schema`**, **`canonical_schema`** | `plan` (snake_case) + `review_queued` |
| POST | `/api/rosetta/translate` | **`source_schema`**, **`source_record`**, **`canonical_schema`**, **`vendor_contract`**, `options` | `ready`, `plan`, `payload`, `skipped[]`, `validation` |
| POST | `/api/rosetta/freeze` | **`plan`** (camelCase, needs `mappings`) | `adapter {sourceSchemaId, targetSchemaId, mappings, frozenAt, fingerprint}` |
| POST | `/api/rosetta/normalize` | **`plan`** (camelCase), **`vendor_response`** | `canonical`, `missing[]`, `lossy[]`, `passthrough` |
| GET | `/api/rosetta/review?status=pending|approved|rejected` | | `items[]`, newest first |
| POST | `/api/rosetta/review` | **`id`**, **`action`** `approve|reject`, `reviewer` | `item`; 404 other workspace, 409 already decided |
| GET | `/api/rosetta/adapters` | | Frozen adapters (early access; 404 `not_released` until enabled) |
| DELETE | `/api/rosetta/adapters/{id}` | | Retire an adapter; the next payload of that shape re-plans |

## Ingest statuses

The payload's structural shape is fingerprinted and looked up against this workspace's frozen adapters for that target. Changing values never causes drift; changing keys or types does.

- `stable`: frozen mapping replayed, no model cost. The production goal.
- On a miss Rosetta infers a schema, plans, and compares plan `confidence` to the returned `thresholds`: at or above `auto_freeze` -> frozen and translated (`auto_provisioned`, or `drift_detected` when it replaced an adapter); at or above `review` -> best-effort record plus `review_id` (`provisional`); below -> HTTP 202 `needs_review`, `canonical_record: null`.
- `canonical_record` is also null when validation failed; read `ready`, `validation.issues[]`, `skipped[]`.
- Send a few same-shape `samples` on the first ingest of a new feed so required fields can be inferred.

## The case trap

`plan` and `translate` return snake_case plan keys (`source_schema_id`, `target_schema_id`); `freeze`, `normalize`, and review items use camelCase (`sourceSchemaId`, `targetSchemaId`). Rename before passing a plan on:

```bash
jq '.plan | {sourceSchemaId: .source_schema_id, targetSchemaId: .target_schema_id, mappings, confidence, notes, tier}'
```

## Mappings

Each mapping is `{source?, target, transform?, confidence, origin, reason?}`; `origin` is `heuristic|llm|human|frozen`. Transforms are deterministic objects such as `{"kind":"toNumber"}` or `{"kind":"multiply","factor":100}`. On normalize, `lossy` lists mappings that cannot be inverted exactly.

## Steps

1. `GET /api/rosetta/canonical-schemas` so target and field names are real; confirm the key is from a claimed workspace.
2. Recurring feed: `POST /api/rosetta/ingest` with the same target every call. Inspect-first work: `plan`, then `translate` against the downstream contract; only trust `ready: true`.
3. On `provisional` or 202 `needs_review`: surface the `review_id` and low-confidence mappings; decide with `POST /api/rosetta/review` only when the user decides.
4. Lock a reviewed plan: rename keys, `POST /api/rosetta/freeze`, keep the `fingerprint`, re-ingest and expect `stable`.
5. On `drift_detected`: diff new mappings against the old adapter and confirm with the owner before relying on them.
6. Prefer events over polling: webhooks `rosetta.adapter.frozen`, `rosetta.adapter.review_required`, `rosetta.adapter.review_resolved`, `rosetta.adapter.drift_detected` (see `last-price-webhooks`).

## Handing off to pricing

- A canonical `offer` gives compute `context.currency` and the current price, but `offer.price` is in minor units: divide by the currency's minor-unit factor (100 for USD/EUR) before sending `context.current_price`.
- A canonical `observation` maps to `context.metadata.competitor_price` / `competitor_currency`, or to commerce observations (see `last-price-commerce-pipeline`).
- Rosetta canonical fields are camelCase; compute context fields are snake_case.

## Errors

400 missing/invalid body key (for freeze/normalize usually a snake_case plan or no `mappings`); 401 no credential; 403 `sandbox_restricted`; 404 review id from another workspace; 409 review already decided (re-read instead of retrying).
