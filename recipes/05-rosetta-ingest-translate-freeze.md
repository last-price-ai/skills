# Recipe 05: Rosetta ingest → translate → freeze

Rosetta maps your merchant or vendor payloads into Last Price canonical records. A planner proposes mappings with confidence, a deterministic compiler applies them, and validation runs before anything is trusted. Non-public Rosetta routes need a **claimed workspace** key; a self-registered sandbox gets `403 sandbox_restricted`.

## 0. Look before you map (no key)

- `GET /api/rosetta/health` → `{"status":"ok","service":"rosetta","canonical_schemas":["product","offer","observation","match","action"]}`.
- `GET /api/rosetta/canonical-schemas` → field lists. Canonical fields are **camelCase**. For example `offer` needs `sku`, `channel`, `price` (number), `currency`; `observation` needs `sku`, `source`, `competitorPrice`, `currency`, `observedAt`.

## 1. Ingest a record (the production path)

`POST /api/rosetta/ingest`
```json
{
  "canonical_target": "offer",
  "merchant_id": "shop-eu",
  "payload": { "item_code": "MUG-01", "storefront": "web", "amount_cents": 2499, "ccy": "EUR" },
  "samples": [
    { "item_code": "MUG-02", "storefront": "web", "amount_cents": 1999, "ccy": "EUR" },
    { "item_code": "TEE-01", "storefront": "app", "amount_cents": 3500, "ccy": "EUR" }
  ]
}
```
Send a few same-shape `samples` the first time (only the first 25 are read). The payload's **shape** is fingerprinted against your frozen adapters for that target:

| Status | Meaning |
|---|---|
| `stable` | A frozen adapter matched; mapping replayed, no model cost. The goal. |
| `auto_provisioned` | Confidence above `thresholds.auto_freeze`: planned, frozen and translated in one call. |
| `drift_detected` | Like auto-provisioned, but it replaced an adapter for a changed shape. Diff before relying on it. |
| `provisional` | Above `thresholds.review`: a best-effort record plus a `review_id`. Not production truth. |
| `needs_review` (HTTP `202`) | Below review threshold: `canonical_record: null`, `review_id` set. |

Values changing never causes drift; keys or types changing does. `canonical_record` is also `null` when validation failed: read `ready`, `validation.issues[]` and `skipped[]`.

## 2. Inspect and translate (when you want control first)

- `POST /api/rosetta/plan` with `source_schema` `{id, fields:[{path,type,examples?}]}` and `canonical_schema` (a key like `"offer"` or a full schema) → a `plan` plus `review_queued`.
- `POST /api/rosetta/translate` with `source_schema`, `source_record`, `canonical_schema` and `vendor_contract` → `ready`, `plan`, `payload`, `skipped[]`, `validation`. Only trust `ready: true`.
- Mappings look like `{source, target, transform, confidence, origin}`. Transforms are deterministic, for example `{"kind":"multiply","factor":0.01}` for cents to units, or `{"kind":"toNumber"}`.

## 3. Decide uncertain mappings

`GET /api/rosetta/review?status=pending`, then `POST /api/rosetta/review` with `{"id":"<review_id>","action":"approve","reviewer":"pricing-ops"}`. `409` means it was already decided; re-read it instead of retrying.

## 4. Freeze

**Case trap:** `plan` and `translate` return the plan in snake_case (`source_schema_id`, `target_schema_id`), but `freeze` and `normalize` take the camelCase plan (`sourceSchemaId`, `targetSchemaId`, `mappings`, ...). Rename before passing it on:

```bash
jq '{plan: (.plan | {sourceSchemaId: .source_schema_id, targetSchemaId: .target_schema_id, mappings, confidence, notes, tier})}' translate.json > freeze-body.json
```

`POST /api/rosetta/freeze` with that body → `adapter {sourceSchemaId, targetSchemaId, mappings, frozenAt, fingerprint}`; every mapping is stamped `origin: frozen`. Keep the `fingerprint`. `options.allow_incomplete: true` freezes a plan that leaves required fields unmapped (avoid unless you mean it).

## 5. Prove it

Ingest the same shape again and expect `status: stable`. To go the other way (vendor response back to canonical) use `POST /api/rosetta/normalize` with the camelCase `plan` and `vendor_response`; `lossy[]` lists values that cannot be inverted exactly.

## Hand-off to pricing

A canonical `offer` gives compute `context.current_price` (from `price`) and `context.currency`. A canonical `observation` gives `metadata.competitor_price` and `competitor_currency`. Rosetta fields are camelCase; compute fields are snake_case.

Prefer webhooks over polling: `rosetta.adapter.frozen`, `rosetta.adapter.review_required`, `rosetta.adapter.review_resolved`, `rosetta.adapter.drift_detected`.

## Errors

`400` names the missing or invalid key (for freeze/normalize this is usually a snake_case plan or no `mappings`); `401` no credential; `403 sandbox_restricted` unclaimed sandbox; `404` review id from another workspace; `409` review already decided.

## Checked

Live, keyless, 2026-10-24: `GET /api/rosetta/health` and `GET /api/rosetta/canonical-schemas` (`200`, five targets, camelCase fields), and `401` without a key on `ingest`, `plan`, `translate` and `freeze`. Bodies follow the live OpenAPI document (`ingest` requires `canonical_target` + `payload`, `samples` capped at 25; `freeze` requires a camelCase `plan` with `mappings`). Keyed steps not re-run here.
