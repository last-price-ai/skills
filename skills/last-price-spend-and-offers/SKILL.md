---
name: last-price-spend-and-offers
description: Use when a buyer agent must check a purchase against its owner's last-price.ai spend policy before paying (check, reserve, confirm, consume, release, spend sessions), when an owner sets spend policies, or when buying or selling through Last Price offers and counter-offers (negotiation handles, make an offer, accept a counter, seller offer settings).
---
# Last Price: spend policy and negotiated offers

Two buyer-agent safety and commerce surfaces. Several parts are early access (404 `not_released` until enabled). Re-read OpenAPI before relying on a field. MCP equivalents: `get_spend_policy`, `set_spend_policy`, `check_purchase`, `confirm_purchase`, `settle_purchase`, `reconcile_purchase`, `open_spend_session`, `draw_session_spend`, `settle_session_draw`, `close_spend_session`; `get_offer_terms`, `make_offer`, `get_negotiation`, `accept_counter`, `get_offer_settings`, `set_offer_settings`, `set_offer_product`, `remove_offer_product`, `preview_offer`, `list_negotiations`.

## Spend policy (owner sets, buyer agent asks)

| Method | Path | Scope | Purpose |
|---|---|---|---|
| GET / PUT / DELETE | `/api/spend-policy` | `pcn:routing:read` / `write` | Policies (workspace default has `agent_id: null`), today's spend vs cap. PUT saves one policy whole; an agent's own credential cannot save one. |
| POST | `/api/spend-policy/check` | `price:compute` | "May I pay this amount to this seller?" -> `allow` (with a reservation), `ask` (a person approves first), or `deny` with `reason_code`. |
| GET | `/api/spend-policy/reservations` | `price:compute` | Reservations and their state |
| POST | `/api/spend-policy/reservations/{id}/confirm` | `price:compute` | Right before paying: re-checks under the current policy version; 409 `policy_changed` means do not pay. |
| POST | `/api/spend-policy/reservations/{id}/consume` | `price:compute` | Paid: settle at the amount paid (never more than reserved). |
| POST | `/api/spend-policy/reservations/{id}/release` | `price:compute` | Payment failed or abandoned: return the hold. |
| POST | `/api/spend-policy/reservations/{id}/unknown`, `/reconcile` | `price:compute` | Payment outcome unclear: hold stays; reconcile later from the processor/wallet record. |
| GET | `/api/spend-policy/intents/{id}` | | Every check made under one buyer intent |
| GET | `/api/spend-policy/sessions/{id}` | `price:compute` | Read a spend session (a budget for a run of small paid calls to one seller; open one with the MCP `open_spend_session` tool) |
| POST | `/api/spend-policy/sessions/{id}/draw`, `/close`, `/draws/{drawId}/settle` | `price:compute` | Draw before each paid call, settle each draw, close when done |

Buyer flow: check -> (on `ask`, wait for the person's approval, then send the identical check again) -> confirm -> pay -> consume (or release / unknown + reconcile). Holds never expire by time, so always settle. Deny codes include `no_policy`, `currency_mismatch`, `seller_blocked`, `seller_not_allowed`, `category_not_allowed`, `over_max_per_purchase`, `over_daily_cap`, `price_too_high`. An agent never approves its own `ask`.

## Offers and counter-offers

Seller side (`pcn:routing:read|write`): `GET/PUT /api/negotiation/settings` (turn offers on, public handle, rounds, concession and expiry), `PUT/DELETE /api/negotiation/products` (list price, hidden floor, optional unit cost, currency), `POST /api/negotiation/preview` (dry run an offer), `GET /api/negotiation/negotiations`.

Buyer side (public, no credential):
- `GET /api/negotiation/public/{handle}`: products open to offers, list prices, `min_offer`, rounds, how long a counter stands. Never the floor.
- `POST /api/negotiation/public/{handle}/offers`: name a price; answer is `accept`, `counter`, or `reject`. The first offer returns `buyer_token` once (send it later in `x-negotiation-token` with `negotiation_id`). An offer at or above the asking price is accepted at the asking price.
- `GET /api/negotiation/public/{handle}/offers/{negotiationId}` reads it; `POST .../accept` takes the standing counter and **commits the buyer to that price**.

## Rules

- A buyer agent runs `check_purchase` / `/api/spend-policy/check` before every purchase when its owner uses spend policy, and settles every reservation.
- Accepting a counter or paying is a purchase decision: only within the user's explicit instruction and budget.
- Keep `buyer_token` values secret.
