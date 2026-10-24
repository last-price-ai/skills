---
name: last-price-ucp
description: Use when discovering or integrating last-price.ai Universal Commerce Protocol (UCP) agent shopping - the public UCP profile, cart quotes priced through the compute network, and checkout-session create/update/complete/cancel.
---
# Last Price: UCP (Universal Commerce Protocol)

For plain compute use `last-price-compute`; for the store-repricing pipeline use `last-price-commerce-pipeline`. MCP equivalents: `get_ucp_profile`, `get_ucp_quote`, `create_ucp_checkout`, `get_ucp_checkout`, `list_ucp_checkouts`, `update_ucp_checkout`, `complete_ucp_checkout`, `cancel_ucp_checkout`.

## Surfaces

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/ucp`, `/api/ucp/discovery`, `/.well-known/ucp` | public | UCP discovery profile |
| POST | `/api/ucp/quote` | key or Bearer, `price:compute` | Cart quote via compute + metering (records a usage event) |
| POST / GET | `/api/ucp/checkout-sessions` | key or Bearer | Create (`Idempotency-Key` recommended) / list |
| GET / PUT | `/api/ucp/checkout-sessions/{id}` | key or Bearer | Read / update an open session |
| POST | `/api/ucp/checkout-sessions/{id}/complete` | key or Bearer | Complete with `payment_data` |
| POST | `/api/ucp/checkout-sessions/{id}/cancel` | key or Bearer | Cancel |

Self-registered sandbox keys may get 403 until claimed.

## Discovery

```bash
curl -sS https://api.last-price.ai/api/ucp -H "User-Agent: acme-bot/shopper"
```

Returns `ucp.version` (seen: `2026-01-23`), service `dev.ucp.shopping` with `rest.endpoint`, and capabilities including `dev.ucp.shopping.checkout` and `dev.ucp.pricing.compute`.

## Quote

`POST /api/ucp/quote` requires `cart` with `line_items` (each `id`, `quantity`, `unit_price`, `currency`; optional `sku`/`gtin`) and optional `cart.currency`. Optional top-level `request_id`, `tenant_id` (from `GET /api/me`; never invent it), and `context` (product type, segment, geo, constraints, metadata). The MCP `get_ucp_quote` tool accepts extra options (routing, stage); check its live schema. Response: `quote.computed_total`, `currency`, `confidence`, function, `metering`, `diagnostics`, `stage`.

A quote is not an order or a session.

## Checkout lifecycle

Statuses: `incomplete` -> `requires_escalation` | `ready_for_complete` -> `complete_in_progress` -> `completed`, or `canceled`.

- **Create:** `line_items` (>= 1; each `product_id` + `quantity`); optional `buyer`, `context`, `payment`, `signals`, `cart_id`, `fulfillment`, `discounts`, `currency`.
- **Update:** any of those fields while open.
- **Complete:** `payment_data` (`handler_id`, `type`, `credential`). No payment provider is wired yet: a session that passes the lifecycle checks answers 501 `payment_not_configured`. Never invent payment credentials; confirm before any real charge.
- **Cancel** rather than forcing a complete when stuck.

Responses may include `totals`, `messages`, `continue_url`, `expires_at`, and after completion `order.id`.

## Steps

1. Read discovery to confirm version and capabilities.
2. "What would this cart cost?": quote with real line prices; report `quote` and `metering`, not invented totals.
3. Checkout: create with real product ids -> update until `ready_for_complete` -> complete only with real payment data, or cancel.
4. 409 = idempotency or state conflict; 404 = session missing (do not fabricate ids).
