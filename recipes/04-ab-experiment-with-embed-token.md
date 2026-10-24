# Recipe 04: run an A/B price experiment with an embed token

Server side uses your API key. The storefront (browser) uses a **publishable embed token** so no secret ever ships in page source.

## Steps

1. **Find your workspace id.** `GET /api/me` with `x-api-key` → `tenant_id`.
2. **Create the experiment.** `POST /api/tenants/{tenant_id}/experiments` (the path id must be your own workspace, otherwise `403`):
   ```json
   {
     "key": "pro_plan_price_q4",
     "name": "Pro plan: 49 vs 59",
     "targetSampleSize": 2000,
     "variants": [
       { "name": "control",    "price": 49, "weight": 50, "metadata": { "features": ["Unlimited projects", "Email support"] } },
       { "name": "experiment", "price": 59, "weight": 50, "metadata": { "features": ["Unlimited projects", "Priority support"] } }
     ]
   }
   ```
   - `key` matches `^[a-z0-9_]+$`. In the per-experiment routes, `{experimentId}` is the experiment's key (or, in early access, its id).
   - The API takes 2 to 10 variants, one named `control` (the release of 2026-10-23 added multi-arm). Builds before that required exactly two arms, `control` and `experiment`; if you get a 400 about the variant count, fall back to those two.
   - `weight` is relative; set it on both arms or neither (neither = even split). Splits more uneven than 1:99 are refused.
   - Variant `metadata` is spread over the served `pricing` object. Put real feature copy in `metadata.features`, or placeholders are served.
   - Status moves `draft → active → paused → completed`; activate it before sending traffic: `PATCH /api/experiments/{experimentId}` with `{"status":"active"}` (the PATCH body takes only `status`: `active`, `paused` or `completed`).
3. **Create an embed token** for the storefront. `POST /api/embed-tokens` with
   ```json
   { "name": "storefront", "allowed_origins": ["https://shop.example.com", "https://www.shop.example.com"], "expires_in_days": 90, "experiment_keys": ["pro_plan_price_q4"] }
   ```
   This route takes a **person's** credential (dashboard session or a person's JWT); an API key is refused on purpose. Origins are scheme + host only (no path, query or wildcard); list the `www` variant too. The token (`lpe_…`) is shown once. Rotate by creating a new one, then `DELETE /api/embed-tokens/{tokenId}`.
4. **Assign and show the price in the browser.**
   ```js
   const r = await fetch(`https://api.last-price.ai/api/experiments/${EXPERIMENT_ID}/pricing?userId=${encodeURIComponent(visitorId)}`,
     { headers: { "X-Embed-Token": EMBED_TOKEN } });
   const { variant, pricing } = await r.json();
   ```
   `userId` is required (1–200 characters) and assignment is deterministic per user. CORS allows only `Content-Type` and `X-Embed-Token`; a call from an origin not on the token's list is refused.
5. **Record the conversion.** `POST /api/experiments/{experimentId}/convert` with `{"userId":"<same id>","revenue":59}` (embed token from the browser, or better an API key from your server when revenue must be authoritative). Omitted `revenue` records the variant's list price; `0` records a zero-revenue conversion. `404` means that user was never assigned. An `Idempotency-Key` header is supported.
6. **Read results.** `GET /api/experiments/{experimentId}/results` (API key): per arm `views`, `conversions`, `revenue`, `conversionRate`, `arpu`, plus a `summary`. Numbers arrive as **strings**; parse them before doing math.
7. **Decide.** `POST /api/compute/significance` with
   ```json
   { "variants": [ { "id": "control", "trials": 1040, "conversions": 52 }, { "id": "experiment", "trials": 1012, "conversions": 61 } ] }
   ```
   (views as trials). It returns posterior means, credible intervals, `probability_best`, `expected_loss` and a `verdict`: `winner`, `equivalent` or `continue`. Only call a winner on `winner`. For an adaptive split instead of a hard stop, `POST /api/compute/allocation` returns Thompson-sampling shares. Both need `price:compute` and are not available to a self-registered sandbox.

## Errors

- `401` on every route above without a credential.
- `400` on bad variant names, three arms, weights on only one arm, or a reused metadata key with a different type.
- `403` from an origin not on the embed token's list; `429` and fail-closed `503` on embed traffic budgets (retry later).

## Checked

Live, keyless, 2026-10-24: `401` without a credential on experiment create, `pricing`, `convert`, `results`, `POST /api/embed-tokens` and `POST /api/compute/significance`. Request bodies follow the live OpenAPI document (`CreateExperiment`, embed token `name`/`allowed_origins`/`expires_in_days`/`experiment_keys`, convert `userId`/`revenue`). Keyed steps not re-run here.
