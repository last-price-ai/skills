---
name: last-price-marketplace
description: Use when listing, updating, reviewing, or retiring last-price.ai marketplace listings for pricing functions, browsing the public catalogue, checking publisher earnings and payout history, or reading the public Elo Index leaderboard.
---
# Last Price: marketplace, earnings, and the Elo Index

Registering and testing functions is in `last-price-functions-and-routing`. MCP equivalents: `browse_catalog`, `list_marketplace_listings`, `list_my_marketplace_listings`, `create_/update_/delete_marketplace_listing`, `run_function_review`, `get_function_review`, `get_public_leaderboard`, `get_marketplace_earnings`. Payout runs and schedules are managed by a person in the dashboard.

## Surfaces

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/public/leaderboard?window=7d|30d|90d|all` | none (per-IP limit) | Elo Index ranking of public functions |
| GET | `/api/marketplace/listings` (or `scope=public`) | none (per-IP limit) | Public catalogue |
| GET | `/api/marketplace/listings?scope=owned` | key or JWT | Your listings, private included |
| POST | `/api/marketplace/listings` | key or JWT | Create a listing (201) |
| PATCH | `/api/marketplace/listings/{listingId}` | owner of the function | Update a listing |
| DELETE | `/api/marketplace/listings/{listingId}` | same | Remove the listing (function untouched) |
| GET/POST | `/api/functions/{id}/review` | `pcn:function:read` / `pcn:function:test` | Read or run (dry run) the marketplace review |
| GET | `/api/marketplace/earnings` | `billing:read` | Payout ledger rows (paged) |
| GET | `/api/marketplace/payouts` | `billing:read` | Payout history |

## Browsing the catalogue

- Public scope is keyless; a credential sent with it is ignored, so a 200 proves nothing about your key. Use `scope=owned` to test a key.
- `limit` clamps to 1..100 (bad values mean 50); `offset` defaults to 0; responses carry `pagination`. Honour `Retry-After` on 429.
- Public entries are `{function, listing, stats}` with only public fields; `function.input_schema` tells you how to call it. Owned entries are raw listing rows (commission, payout threshold, payout currency, Stripe account id, approval fields).
- First-party listings have `is_builtin: true` functions and `commission_rate` 0.

## Create and update

```json
{ "function_id": "<uuid of a function you own>", "is_public": false, "commission_rate": 0.3, "listing_description": "optional", "pricing_info": {} }
```

- Only `function_id` is required. `is_public` defaults to `false`. `commission_rate` defaults to 0.30 (platform keeps 30%, provider earns 70%); say so if the user did not pick a rate.
- Check `scope=owned` first to avoid duplicates; test the function first.
- PATCH needs at least one of `is_public`, `commission_rate` (0..1), `min_payout_threshold`, `stripe_connect_account_id` (`null` clears). Omitting `is_public` does not unpublish. `function_id` cannot change.
- Turning a listing public runs the marketplace review first (sample call: usable answer, price within 0.1x-10x current, latency budget); a failure answers 422 `review_failed` and applies nothing. Run `POST /api/functions/{id}/review` beforehand to see the report.
- 403 when you do not own the function, and always for first-party listings; 404 unknown listing.

## Money reads

- `GET /api/marketplace/earnings` returns `{earnings: [...], pagination}` ledger rows (`total_invocations`, `total_revenue`, `platform_commission`, `owner_earnings`, `payout_status` `pending|processing|paid|failed`). Sum rows yourself; empty is normal before paid traffic.
- `GET /api/marketplace/payouts` returns `{payouts, total}` with different names (`gross_revenue`, `platform_fee`, `net_payout`, status `completed`). Do not mix vocabularies.
- Requesting, approving and scheduling payouts is a person's job in the dashboard (`https://app.last-price.ai`); this skill only reads earnings and payout history.

## Elo Index leaderboard

- Top level: `generated_at`, `method_version`, `weights` (read them; do not hardcode), `window`, `min_distinct_consumers`, `min_reported_outcomes`, `head_to_head_enabled`, `overall[]`, `by_category[]`.
- Entry: `rank`, `function_id`, `function_name`, `category`, `index_score` (0-100), `data_status`, `components` (adoption, confidence, speed, cost efficiency, and in v4 outcome and head-to-head), `first_party`, `stats`.
- **Rank is not score order:** `measured` ranks above `partial` above `unmeasured` before score is compared.
- Components without data are left out and weights renormalised.
- Adoption counts distinct outside consumers only: the owner's own calls, the keyless demo, paid pay-per-call, and sandboxes are excluded, so publishers cannot climb by self-calling.
- Cached about 60 seconds at the CDN.

## Steps

1. Confirm the function exists, is yours, and passes a test and the review.
2. Check `scope=owned` for an existing listing.
3. Create with an explicit `is_public` choice; call out the default commission.
4. Delete only after a clear yes.
5. "Who's winning": leaderboard, explaining `data_status` ordering and the consumer threshold.
