---
name: last-price-agents
description: Use when managing last-price.ai workspace agents - create, list, draft from a prompt, revoke, mint agent-bound keys, read capabilities, agent inbox, value receipts, behaviour tests, claiming a self-registered sandbox, or estimating human-labor cost for a task.
---
# Last Price: agent lifecycle

First-time self-registration and key storage are in `last-price-auth`. Public discovery: `GET /.well-known/agents.json` (access options, scopes, attribution rules).

## Credential matrix

| Surface | Credential |
|---|---|
| `GET/POST /api/agents`, `GET/DELETE /api/agents/{id}`, `/api/agents/{id}/inbox`, `POST /api/agents/{id}/keys` | **Person credential only** (dashboard session or a person JWT). API keys answer 401; agent-bound JWTs 403. |
| `POST /api/agents/generate`, `GET /api/agents/{id}/capabilities`, `POST /api/agents/estimate-task` | Bearer JWT or `x-api-key`. |
| `POST /api/agents/register` | Public. |
| `POST /api/agents/claim` | Dashboard session or `x-api-key` holding exactly `workspace:claim`. |

## Surfaces

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/agents` | List non-revoked agents / create (`name` required) |
| POST | `/api/agents/generate` | LLM draft (not saved): name, description, value signals |
| GET / DELETE | `/api/agents/{id}` | Fetch / revoke (keys may keep working until revoked separately) |
| GET / POST | `/api/agents/{id}/inbox` | List / send email from that agent's inbox |
| POST | `/api/agents/{id}/keys` | Mint an agent-bound key (shown once) |
| GET | `/api/agents/{id}/capabilities` | Effective scopes, pending approvals, rate limits, idempotency rules |
| GET | `/api/agents/{id}/value-receipt` | Measured value signals vs cost over a period |
| GET / POST | `/api/agents/{id}/behaviour-tests` | Scenario pack / run graded behaviour tests (uses the workspace's model key; early access) |
| POST | `/api/agents/claim` | Claim a sandbox into a person-owned workspace |
| POST | `/api/agents/estimate-task` | LLM estimate of human-labor cost by country |

## Create, generate, keys

- `POST /api/agents`: `name` (max 100), optional `description` (max 500), `scopes` (max 32; named scopes, wildcards like `commerce:*`, or `*`), `parent_agent_id`, `metadata`.
- `POST /api/agents/generate` `{"prompt":"..."}` returns a draft to edit, then create. Metered; 501 `llm_not_configured` without a model key.
- `POST /api/agents/{id}/keys` `{name, expires_in_days?: 1-3650, scopes?}`; the `lp_...` key is shown once: store it in a secret store. An agent cannot mint its own keys; it can rotate its key with `POST /api/api-keys/rotate` or revoke it with `DELETE /api/me/key`.
- Attribution: prefer agent-bound keys when several agents share a workspace; otherwise distinguish with `User-Agent`.

## Inbox

- GET `?cursor=&limit=` (1-100). POST requires `to` (1-50 addresses) and `subject`; optional `cc`, `bcc`, `text`, `html`, `reply_to_message_id`. Confirm with the user before sending mail.

## Claim

- `POST /api/agents/claim` `{"token":"lpc_...", "workspace_id"?, "dry_run": true, "keep_agent_key": false}`. Run `dry_run: true` first. `keep_agent_key: false` (default) revokes the agent key: confirm before a real claim.

## Estimate task

`POST /api/agents/estimate-task` with `task_description` (1-4000) and `countries` (1-50); optional `currency` (default EUR), `complexity` (`low|medium|high`), `estimated_time_minutes`, `hourly_wage`. Results are estimates, not invoices.

## Steps

1. Person credential for list/create/keys/inbox/revoke; workspace or agent key for generate/capabilities/estimate.
2. List before create.
3. Mint keys only on explicit intent; store once.
4. Confirm before revoke, inbox send, or a real claim.

Tips: agents read their own record via capabilities, not `GET /api/agents/{id}`. Revoking an agent does not revoke its keys. LLM features meter under `/api/usage/llm`, not PCN usage.
