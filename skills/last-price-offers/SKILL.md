---
name: last-price-offers
description: Use when buying or selling through Last Price offers and counter-offers (negotiation handles, make an offer, accept a counter, seller offer settings and floors, previewing an offer).
---
# Last Price: negotiated offers

Several parts are early access (404 `not_released` until enabled). Re-read OpenAPI before relying on a field. MCP equivalents: `get_offer_terms`, `make_offer`, `get_negotiation`, `accept_counter`, `get_offer_settings`, `set_offer_settings`, `set_offer_product`, `remove_offer_product`, `preview_offer`, `list_negotiations`, `get_sales_playbook`, `update_sales_playbook`, `negotiate_stop`.

Seller side (`pcn:routing:read|write`): `GET/PUT /api/negotiation/settings` (turn offers on, public handle, rounds, concession and expiry), `PUT/DELETE /api/negotiation/products` (list price, hidden floor, optional unit cost, currency), `POST /api/negotiation/preview` (dry run an offer), `GET /api/negotiation/negotiations`.

Sales playbook (claimed workspace, routing scopes): `GET` / `PATCH /api/sales-playbook` (`get_sales_playbook`, `update_sales_playbook`). Fields are plain text such as "15%" or "Net 30"; a sent field replaces the saved one, an empty string clears it, and the answer says field by field what was read. While its release is on, the maximum discount is a floor under every price and counter-offers carry the playbook's terms; read `released` before relying on it.

Whether to play another round: `POST /api/negotiate/stop` (`negotiate_stop`) takes `context` with your role, currency and at least two offers in `history`, and answers stop or continue, the expected value and cost of one more round, and an action (continue, accept, walk away). One metered compute call; early access.

Buyer side (public, no credential):
- `GET /api/negotiation/public/{handle}`: products open to offers, list prices, `min_offer`, rounds, how long a counter stands. Never the floor.
- `POST /api/negotiation/public/{handle}/offers`: name a price; answer is `accept`, `counter`, or `reject`. The first offer returns `buyer_token` once (send it later in `x-negotiation-token` with `negotiation_id`). An offer at or above the asking price is accepted at the asking price.
- `GET /api/negotiation/public/{handle}/offers/{negotiationId}` reads it; `POST .../accept` takes the standing counter and **commits the buyer to that price**.

## Rules

- Accepting a counter commits the buyer to that price: only within the user's explicit instruction and budget. Offers never pay; payment happens outside Last Price.
- Keep `buyer_token` values secret.
