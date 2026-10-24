---
name: last-price-webhooks
description: Use when subscribing to last-price.ai events with outbound webhooks (create, list, update, pause, delete, rotate secret, ping test events, read delivery logs, debug webhooks.failing) or verifying a Last Price webhook signature on a receiver.
---
# Last Price: outbound webhooks and signature verification

MCP equivalents: `list_webhooks`, `create_webhook`, `update_webhook`, `delete_webhook`, `ping_webhook`, `list_webhook_deliveries`, `verify_webhook_signature`. Re-check OpenAPI when the event list matters; it grows.

## Who can call what

| Operation | Path | Rule |
|---|---|---|
| List endpoints | `GET /api/webhooks` | owner/admin. Full secret only to a dashboard session; keys see it masked (`secret_masked: true`). |
| Create | `POST /api/webhooks` | owner/admin; `webhooks:write` |
| Update / pause | `PATCH /api/webhooks/{webhookId}` | owner/admin; `webhooks:write` |
| Rotate secret | `POST /api/webhooks/{webhookId}/rotate-secret` | owner/admin; returns the new secret once |
| Delete (also wipes delivery history) | `DELETE /api/webhooks/{webhookId}` | destructive, confirm first |
| Test event | `POST /api/webhooks/{webhookId}/ping` | no body |
| Delivery log | `GET /api/webhooks/deliveries?limit=1..200` | newest first, includes pings |

A key limited to specific scopes may be refused on operations that name no scope; a wrong role answers 403 `role_forbidden`.

## Create an endpoint

```bash
curl -sS -X POST https://api.last-price.ai/api/webhooks \
  -H "User-Agent: acme-bot/integrator" -H "x-api-key: $LP_API_KEY" -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/lp-hooks","events":["price_proposal.created","approval.requested","balance.low"]}'
```

- `url` must be `https://` and should be a public receiver you control. `events`: at least one, at most one per type. `secret` optional (8-256 chars); omitted means a generated `whsec_...`.
- The 201 response carries the secret: store it in a secret store immediately; never print it.
- PATCH needs at least one of `url`, `events` (replaces the list), `status` (`active|inactive`; inactive pauses).
- Rotate with `rotate-secret` and update the receiver straight away; every later delivery uses the new secret.

## Event types

- Experiments and money: `experiment.created`, `experiment.completed`, `conversion.recorded`, `payment.received`, `order.created`, `invoice.generated`
- Rosetta: `rosetta.adapter.frozen`, `rosetta.adapter.review_required`, `rosetta.adapter.review_resolved`, `rosetta.adapter.drift_detected`
- Billing and outcomes: `balance.low`, `usage.outcome_recorded`, `outcome.settled`
- Human action needed: `approval.requested`, `dispute.opened`, `price_proposal.created` (read details from the source API, e.g. `GET /api/approvals/{id}`)
- Learning and analyst: `learned_elasticity.changed`, `analyst.brief_ready`
- Payouts: `payout.approval_requested`, `payout.paid`, `payout.failed`
- `platform.changelog`: only to endpoints listing it by name; dedupe on `data.entries[].id`
- `webhooks.failing`: an endpoint keeps failing; sent only to the workspace's other healthy endpoints (else email and the notifications feed)
- Pings send `webhook.test`.

The type is in header `x-webhook-event` and body `type`. Notification-style events are not retried: receivers must answer 2xx fast (ping waits 10 s) and back-fill from the source API when they miss one.

## Signature verification (receiver side)

Every delivery carries:
- `x-lastprice-signature`: hex HMAC-SHA256 of the **raw body** with the endpoint secret (legacy duplicate `x-paid-signature`)
- `x-lastprice-timestamp`: Unix seconds (legacy `x-paid-timestamp`)
- `x-webhook-event`

```bash
printf '%s' "$RAW_BODY" | openssl dgst -sha256 -hmac "$WHSEC" | awk '{print $2}'   # compare to x-lastprice-signature in constant time
```

Verify against the exact raw bytes (never re-serialized JSON). Reject stale timestamps if you need replay protection.

Interactive check with no key: `POST /api/public/webhook-verify` `{payload, signature, secret, encoding?: hex|base64, prefix?}` returns `{"valid": true|false}`. Public and rate-limited; only send throwaway test secrets, never a live one.

## Smoke test

1. Create an endpoint on a public HTTPS receiver you control; keep the secret in a secret store.
2. `POST /api/webhooks/{id}/ping`: always 200; read `delivery.success`, `status_code`, `error`, `duration_ms`. 409 means inactive (PATCH `status: active`).
3. `GET /api/webhooks/deliveries?limit=20` to confirm the attempt.
4. Delete throwaway endpoints when done.

Do not create endpoints pointing at private, loopback, or cloud-metadata addresses, and never trigger deliveries to them.

## Related

`last-price-workspace-admin` (approvals, notifications), `last-price-commerce-pipeline` (`price_proposal.created`), `last-price-usage-and-billing` (`balance.low`), `last-price-rosetta` (adapter events).
