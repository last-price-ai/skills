---
name: last-price-spend-policy
description: Use when a buyer agent must check a purchase against its owner's last-price.ai spend policy before paying (check, reserve, confirm, consume, release, spend sessions), or when an owner sets spend policies.
---
# Last Price: buyer-agent spend policy

Not part of the directory plugin bundle (it lives under `payments/`). Several parts are early access (404 `not_released` until enabled). Re-read OpenAPI before relying on a field. MCP equivalents (full connector only): `get_spend_policy`, `set_spend_policy`, `check_purchase`, `confirm_purchase`, `settle_purchase`, `reconcile_purchase`, `open_spend_session`, `draw_session_spend`, `settle_session_draw`, `close_spend_session`.

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

## Rules

- A buyer agent runs `check_purchase` / `/api/spend-policy/check` before every purchase when its owner uses spend policy, and settles every reservation.
- Paying is a purchase decision: only within the user's explicit instruction and budget.
