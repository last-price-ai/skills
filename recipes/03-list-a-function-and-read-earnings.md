# Recipe 03: list a pricing function on the marketplace and read earnings

Selling needs a **claimed (non-sandbox) workspace**. A self-registered sandbox key gets `403 sandbox_restricted` on `POST /api/functions`, so it can never sell. Check first: `GET /api/me` must show a non-sandbox workspace.

Scopes used: `pcn:function:publish` (register, update), `pcn:function:test` (test), `pcn:function:read` (list), marketplace listing rights, and `billing:read` (earnings and payouts).

## Steps

1. **Register the function.** `POST /api/functions`
   ```json
   {
     "name": "acme-margin-guard",
     "display_name": "Margin Guard",
     "description": "Cost-plus with a margin floor. Inputs: unit_cost, target_margin_pct.",
     "execution_type": "rule_based",
     "input_schema": { "type": "object", "properties": { "unit_cost": {"type":"number"}, "target_margin_pct": {"type":"number"} }, "required": ["unit_cost"] },
     "output_schema": { "type": "object", "properties": { "price": {"type":"number"} } },
     "tags": ["cost-plus", "margin"]
   }
   ```
   Required: `name`, `display_name`, `execution_type` (`rule_based`, `ml_model`, `llm_prompt`, `external_api`, `composite`), `input_schema`, `output_schema`. Status defaults to `draft`. `201` returns the function id.
2. **Activate it.** `PATCH /api/functions/{id}` with `{"status":"active"}`.
3. **Test it.** `POST /api/functions/{id}/test` with a compute-shaped body (`context`, `constraints`, `options`). Compare the output with what your stated approach should give: a rule-based function that ignores its declared inputs will return a generic price. Fix it before you list.
4. **Check for an existing listing.** `GET /api/marketplace/listings?scope=owned` (needs your key). Avoid duplicates.
5. **Create the listing.** `POST /api/marketplace/listings`
   ```json
   { "function_id": "<your function id>", "is_public": false, "commission_rate": 0.3 }
   ```
   Only `function_id` is required. `is_public` defaults to `false`. `commission_rate` defaults to 0.30: the platform keeps 30%, you earn 70%. Answers `201 { listing }`.
6. **Publish when ready.** `PATCH /api/marketplace/listings/{listingId}` with `{"is_public": true}`. PATCH needs at least one of `is_public`, `commission_rate` (0..1), `min_payout_threshold`, `stripe_connect_account_id`. `function_id` cannot change; retire and relist instead. Put buyer-facing copy in the function's `description` and change tags with `PATCH /api/functions/{id}`.
7. **Confirm buyers can see it.** `GET /api/marketplace/listings` and `GET /api/functions/catalog` (both public, no key). Public entries are `{ function, listing, stats }`; `function.input_schema` is what buyers will send.
8. **Read earnings.** `GET /api/marketplace/earnings?limit=50&offset=0` returns `{ earnings: [...], pagination }`: rows per billing period with `total_invocations`, `total_revenue`, `platform_commission`, `owner_earnings`, `payout_status` (`pending`, `processing`, `paid`, `failed`). Sum rows yourself. An empty array is normal before paid outside traffic.
9. **Read payouts.** `GET /api/marketplace/payouts`. The docs describe `{ payouts, total }` with `gross_revenue`, `platform_fee`, `net_payout`; keep each endpoint's field names when reporting and do not mix the two vocabularies. Re-check the live shape against the OpenAPI document.

## Where you rank

`GET /api/public/leaderboard` (no key) gives the Elo Index. Rank is not score order: `measured` sorts above `partial` above `unmeasured` before score. Adoption counts distinct outside consumers only: your own calls, the keyless demo, x402 pay-per-call and sandbox workspaces do not count, and there is a minimum number of distinct consumers. Results are cached for about a minute.

## Errors

- `401` no or bad key on any keyed route above (the public catalog ignores a sent key, so a `200` there proves nothing about your key; use `?scope=owned` to check it).
- `403 sandbox_restricted` on function create from a sandbox key.
- `403` on PATCH/DELETE of a listing whose function you do not own, and always for first-party built-in listings.
- `403 insufficient_scope` on earnings/payouts without `billing:read`.
