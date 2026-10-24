---
name: last-price-workspace-admin
description: Use when administering a last-price.ai workspace - workspaces and settings, team members and roles (RBAC), invitations, API keys (create, revoke, self-rotate, team:admin keys), embed tokens, the approval queue (202 needs_approval), audit log, notifications feed and read marks, email alert preferences and unsubscribe links, model keys and inference providers.
---
# Last Price: workspace administration

Covers the admin surface behind `https://app.last-price.ai`. Re-check OpenAPI (tags `Workspace`, `Team`, `API Keys`, `Embed Tokens`, `Approvals`, `Audit`) before relying on a field. `GET /api/workspaces/roles` lists what each role may do. Never print secrets (keys, embed tokens, provider keys, unsubscribe tokens).

## Which credential reaches what

| Surface | Dashboard session | Person JWT | API key | Agent token |
|---|---|---|---|---|
| Workspace create/get/patch/delete, `/settings`, `/llm-key`, `/inference-providers` | yes (owner/admin to change; owner only to delete) | no | no | no |
| Team `/team`, `/invitations` | yes | 403 `team_admin_requires_api_key` | only with exact `team:admin` | 403 |
| `/api/api-keys` list/create/revoke | yes | yes | no | no |
| `/api/api-keys/rotate`, `DELETE /api/me/key` | n/a | n/a | the calling key itself | via its key |
| `/api/embed-tokens` | yes | yes | refused | no |
| `/api/approvals` list/get | yes | yes | yes | yes |
| `/api/approvals/{id}/approve|reject` | yes | yes (not agent-bound) | no | no |
| `/api/audit` | yes | yes | needs `audit:read` | needs `audit:read` |
| `/api/workspaces/{id}/notifications` (+`/read`), `/alert-preferences` | member | yes | `notifications:read` / `write` | same |
| `/api/alerts/unsubscribe` | public, signed token only | | | |

`GET /api/me` tells a key which workspace it belongs to. Session-only surfaces are a browser job for a signed-in person, not something to force with a key.

## Roles

`owner`, `admin`, `member`, `viewer`, `billing`.
- Only an owner grants `owner`, changes another owner, or changes/removes another admin.
- Invitations never carry `owner`.
- Nobody demotes or removes the owner of record (403 `workspace_owner_protected`); ownership transfer goes through support.
- No change may leave zero active owners (409 `last_owner`).

## Team and invitations

- `GET /api/workspaces/{workspaceId}/team`; `POST` `{userId, role}`; `PATCH /team/{userId}` `{role}`; `DELETE /team/{userId}`.
- `GET|POST /api/workspaces/{workspaceId}/invitations` (`{email, role}`); `DELETE /invitations/{invitationId}`; `POST /invitations/{invitationId}/resend`; invitee accepts via `POST /api/invitations/accept` (session).
- **team:admin keys** are minted in the dashboard by an owner/admin. They act for their creator, only in their own workspace, never grant owner or a role above the creator, never touch an owner or the creator, and stop working if the creator loses admin rights. Every key-driven team call is audited.

## Credentials

- **API keys:** `POST /api/api-keys` `{name, expires_in_days?, scopes?}`; `lp_...` shown once. Empty scopes = full access (minus `workspace:claim`/`team:admin`): prefer least privilege. Revoke: `DELETE /api/api-keys/{keyId}` (permanent).
- **Self-rotation:** `POST /api/api-keys/rotate` (no body, `x-api-key` only) returns a new key with the same scopes and expiry; the old key dies at once, so save the new one before anything else. 409 means another rotation won. Sandbox keys rotate a limited number of times per day (429).
- **Embed tokens** (browser-safe, for storefront experiments): `POST /api/embed-tokens` `{name, allowed_origins:["https://store.example.com"], expires_in_days?}` (scheme+host only; add the `www` variant). Rotate by create-new then `DELETE /api/embed-tokens/{tokenId}`.
- **Model keys / inference providers:** `PUT /api/workspaces/{id}/llm-key`; `GET|PUT|DELETE /api/workspaces/{id}/inference-providers/{providerId}` (openai, anthropic, openrouter, together-ai, huggingface, replicate, baseten, apify, aitune). Saved only if the provider accepts the key; keys are never returned. The user supplies provider keys.

## Approval queue

- A guarded call answers **202** with `error.code=needs_approval` and `error.approval_id`: waiting, not success.
- `GET /api/approvals?status=pending|approved|rejected|expired&limit=`, `GET /api/approvals/{id}`.
- A person decides in the dashboard or via `POST /api/approvals/{id}/approve|reject` with a person credential. Agents and API keys never approve, and a requester never approves itself. Pricing-analyst proposals are applied with `POST /api/approvals/{id}/apply` by the person.
- Approval does not replay: resend the same request from the same credential once approved (one approval = one run). Undecided rows expire.

## Audit log

`GET /api/audit` with filters `action`, `subject_kind`, `subject_id`, `agent_id`, `since`, `limit` (<= 200), cursor `page.cursor`. Use it to confirm a write landed.

## Notifications and alert emails

- `GET /api/workspaces/{id}/notifications?limit=&cursor=`: approvals, failed webhook deliveries, agent-inbox mail, disputes, commerce proposals; `unread_count`.
- `POST /api/workspaces/{id}/notifications/read` `{read_through?}` moves the caller's own read mark forward only. Pass the `created_at` of the newest item actually handled.
- `GET|PATCH /api/workspaces/{id}/alert-preferences` changes only the caller's own settings.
- Unsubscribe links (`/api/alerts/unsubscribe`): `GET` only redirects to a confirm page and changes nothing; the RFC 8058 one-click `POST` turns alerts off. Turning them back on goes through alert preferences.

## Workspace lifecycle and settings

- `POST /api/workspaces` (session) creates a production workspace plus a paired sandbox.
- `GET /api/workspaces/{id}`; `PATCH` `{name?, slug?}` (owner/admin); `DELETE` (owner only) removes the workspace **and** its sandbox: irreversible.
- `GET|PATCH /api/workspaces/{id}/settings` (company, address, tax, invoice fields); `POST /settings/enrich` fills company info from a domain.

## Rules

Read state first; make reversible changes; verify with a re-read and `GET /api/audit`. Stop and ask before deleting a workspace, removing a real member, revoking or rotating a key other systems use, or anything that spends money.
