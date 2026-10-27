---
name: last-price-auth
description: Use when a last-price.ai call needs a credential, returns 401/402/403, or before the first authenticated call. Covers getting an API key (self-registration, OAuth client credentials, dashboard, person-minted agent key), verifying it, request headers, and the x-api-key vs Bearer rule.
---
# Last Price: credentials and request headers

## Request headers (every HTTP call)

- `User-Agent: <system>/<role>` (lowercase, hyphenated, for example `acme-bot/repricer`). Last Price uses it for attribution when several agents share a workspace.
- API keys (`lp_...`) go in `x-api-key: $LP_API_KEY`. **Never** put an API key in `Authorization: Bearer`: that answers 401 `api_key_in_bearer` and emails the workspace owner a misuse alert.
- `Authorization: Bearer <token>` is only for a session JWT or an OAuth access token the product issued.
- A 401 on a key check is not proof the key is dead; read the error `code` in the body.

## Get a workspace credential

The live list is in `/llms.txt` and `/.well-known/agents.json` (`access_options`, `pay_or_auth`). Re-read them; they change.

1. **Self-register an agent (no human):** `POST /api/agents/register` with `{"name":"your-system/role"}` (optional `contact_email`, `intended_use`). Returns a sandbox key once plus a claim link for a person. Store the key immediately as `LP_API_KEY` in a secret store. Over MCP the same sign-up is the `register_agent` tool; a key you already hold can be attached to a keyless MCP session with `use_api_key`. Both appear in the tool list only where self-registration is switched on.
2. **OAuth client credentials:** `POST /api/oauth/register` (RFC 7591) then `client_credentials` at `POST /api/oauth/token`. Same sandbox as self-registration.
3. **Person-owned workspace:** a person signs up at `https://app.last-price.ai/sign-up` and creates a scoped API key (Settings) or an agent-bound key (`POST /api/agents/{id}/keys`) for the agent.

## Verify before real work

1. `GET /api/me` shows which workspace and scopes the credential has.
2. A tiny authenticated compute (`POST /api/compute/price` with `{"context":{"current_price":10,"currency":"USD"}}`) proves `price:compute`. A key that passes `/api/me` but fails compute with 403 lacks `price:compute`; that is a scope problem, not a dead key.

## Sandbox (self-registered) limits

- Unclaimed sandbox: compute and reads work within a daily cap; many surfaces answer 403 `sandbox_restricted` (Rosetta, order-to-cash, team, publishing, batch). A person claims it via the claim link (`POST /api/agents/claim`) to lift limits.
- Past the daily cap: 429 with `next` steps. Offer the claim link so a person lifts the limit.

## Scopes (least privilege)

Common named scopes: `price:compute`, `price:compute:batch`, `pcn:function:read|test|publish`, `pcn:routing:read|write`, `experiments:read|write`, `webhooks:read|write`, `billing:read|write`, `commerce:*` (or the granular commerce scopes), `notifications:read|write`, `audit:read`. `team:admin` and `workspace:claim` must be granted by name. Each operation lists its scopes in OpenAPI under `x-lastprice-scopes`.

## Lifecycle

- Rotate the calling key: `POST /api/api-keys/rotate` (old key dies at once; save the new one first).
- Revoke the calling key when done: `DELETE /api/me/key`.

## Secret handling

- Environment variable `LP_API_KEY` for HTTP; the MCP connector reads `LASTPRICE_API_KEY`. Same secret class.
- Never ask a user to paste a key into chat; use the host's secret store or connector auth.
- Never log keys, claim tokens (`lpc_...`), or payment headers. Do not pretend auth succeeded when the API refuses.

## Example

```bash
curl -sS https://api.last-price.ai/api/me \
  -H "User-Agent: acme-bot/setup" \
  -H "x-api-key: $LP_API_KEY"
```
