---
name: last-price-order-to-cash
description: Use when working with last-price.ai workspace sales records - customers, contacts, orders and order lines (including activation, payment links, and tying lines to quotes for learned elasticity), recorded payments and refunds, or disputes.
---
# Last Price: order to cash

These are the workspace's own records; recording them **moves no money** (except a Stripe payment link a buyer pays). Every path needs a credential and a claimed workspace (sandbox keys get 403). MCP equivalents exist for every operation (`create_customer`, `add_order_line`, `activate_order`, `create_payment`, `refund_payment`, `create_dispute`, ...).

All ids are UUIDs. PATCH is partial (only sent fields change; an empty body is 400). Another workspace's record answers **404, not 403**.

## Customers

| Op | Path |
|---|---|
| List / create | `GET` / `POST /api/customers` |
| Get / update / delete | `GET` / `PATCH` / `DELETE /api/customers/{customerId}` |
| By your id | `GET /api/customers/external/{externalId}` |

Create: `name` required; optional `phone`, `website`, `employeeCount`, `annualRevenue`, `taxExemptStatus` (`none|exempt|reverse`), `creationSource`, `externalId`, `billingAddress`. PATCH accepts `name`, `email` (null or `""` clears), `metadata`.

## Contacts

| Op | Path |
|---|---|
| List | `GET /api/contacts?customer_id=&limit=&offset=` |
| Create | `POST /api/contacts` |
| Get / update / delete | `/api/contacts/{contactId}` |
| By your id | `GET /api/contacts/external/{externalId}?customerId=<uuid>` (customerId required) |

- Create needs `customerId`, `name`, `email`; optional `externalId` (unique per customer; repeat is 409), `phone`, `address`, `metadata`.
- A contact cannot move to another customer. Deleting a contact clears it as billing contact on orders.
- Lists page with `limit` (default 100, max 1000; clamped) and `offset`; `pagination.total` counts this page only, so treat a full page as "maybe more".

## Orders and lines

| Op | Path |
|---|---|
| List | `GET /api/orders?customer_id=&limit=&offset=` |
| Create | `POST /api/orders` |
| Get / update / delete | `/api/orders/{orderId}` |
| Lines | `GET` / `POST /api/orders/{orderId}/lines` |
| Activate | `POST /api/orders/{orderId}/activate` |
| Payment link | `POST /api/orders/{orderId}/payment-link` (Stripe Checkout for the order total into the workspace's own Stripe account; repeat calls reuse the open link) |

- Create: `customerId` required; optional `agentId`, `billingContactId` (must belong to the same customer), `status` (`draft|pending|active|completed|cancelled`), `totalAmount`, `currency`, `metadata`. Lines are added separately.
- Lines: `description` and `unitPrice` (exactly 0 or >= 0.0001) required; optional `quantity`, `metadata`.
- **Feed learned elasticity:** put the compute call's `request_id` in line `metadata.quote_request_id` (or the priced `product_id` in `metadata.product_id`). Once the order is `active` or `completed`, that quote counts as accepted (see `last-price-learning-loop`).
- An order cannot return to `draft`. Only `draft` or `cancelled` orders can be deleted: PATCH `status: "cancelled"` first.

## Payments (ledger)

| Op | Path | Scope |
|---|---|---|
| List | `GET /api/payments?status=pending|completed|refunded&customerId=` | `billing:read` |
| Record | `POST /api/payments` | `billing:write` |
| Get | `GET /api/payments/{paymentId}` | `billing:read` |
| Refund | `POST /api/payments/{paymentId}/refund` | `billing:write`, role owner/admin/billing |

Record: `customerId`, `amount` required; optional `invoiceId`, `currency`, `status`, `paymentMethod`, `metadata`. Amounts come back as decimal strings. Refund `{amount?, reason?}`; omit `amount` for a full refund.

## Disputes

| Op | Path |
|---|---|
| List | `GET /api/disputes?status=open|under_review|resolved|rejected` |
| Create | `POST /api/disputes` |
| Get / update | `GET` / `PATCH /api/disputes/{disputeId}` |

Create: `paymentId` and `amount` (> 0) required; optional `customerId`, `currency`, `reason`, `status`, `metadata`. PATCH `status`, `reason`, `metadata`. No delete. Opening a dispute alerts owners/admins.

Webhooks: `order.created`, `payment.received`, `dispute.opened`, `invoice.generated` (see `last-price-webhooks`).

## Guardrails

Deleting records, refunding, sending payment links, and opening disputes are consequential on a live workspace: confirm first unless the record is clearly test data. Never invent ids, totals, or results.
