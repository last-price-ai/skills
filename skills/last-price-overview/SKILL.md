---
name: last-price-overview
description: Start here for any last-price.ai task. Explains what Last Price (the Pricing Compute Network) does, the two ways to call it (MCP connector or HTTP API), where the live spec lives, and which other last-price-* skill handles which job.
---
# Last Price: overview and skill router

Last Price is price computation as a service. A caller sends a pricing context (currency, current price or unit cost, product type, optional competitor offer and constraints); the network routes it to a pricing function, runs it, applies workspace guardrails, meters the call, and returns a price with explanation, confidence, alternatives, a `trace`, and a `receipt`. The returned price is advice; it never changes a store by itself.

## Ground truth

- API base: `https://api.last-price.ai`. Dashboard: `https://app.last-price.ai`.
- OpenAPI (source of truth): `https://api.last-price.ai/api/openapi` (YAML) and `/api/openapi.json`. Re-read it whenever a field, enum, or status looks different from a skill. Never invent fields.
- Agent discovery: `/.well-known/agents.json`, `/llms.txt`, `/.well-known/mcp.json`, `/.well-known/ucp`.
- What changed: `GET /api/public/changelog` (public), or the `platform.changelog` webhook.

## Pay per call

A wallet-only caller pays for compute through `POST /api/compute/price` using x402 and USDC on Base. No account or API key is required. Validate the payment requirements and obtain spending authorization before signing. Use `last-price-x402` for this flow.

The free demo at `/api/public/compute/demo` has narrower inputs and routing. Paid compute uses `/api/compute/price`.

## MCP or HTTP

- **MCP connector** (`https://api.last-price.ai/api/mcp/rpc`): structured tools, now covering most of the API (compute, functions, routing, guardrails, experiments, learning, Rosetta, commerce, order-to-cash, webhooks, billing, team). Prefer it when the connector is installed. See `last-price-mcp`.
- **HTTP API**: everything, including surfaces without a tool. Use it from scripts, CI, or agents without the connector.
- Both are first class and hit the same backend. Without a credential the MCP compute tools fall back to the public demo; label those results as demo.

## Credentials in one line

HTTP: `x-api-key: $LP_API_KEY`. MCP connector: `LASTPRICE_API_KEY`. Never paste keys into chat or logs. See `last-price-auth`.

## Which skill

| Job | Skill |
|---|---|
| HTTP 402, x402 pay-per-call, day passes, top-ups | `last-price-x402` |
| Get or verify a key, headers, self-register an agent | `last-price-auth` |
| Call through the MCP connector | `last-price-mcp` |
| Quote a price (single, batch, demo, clarifier) | `last-price-compute` |
| Register/test functions, routing policies, router, verify, guardrails, chains | `last-price-functions-and-routing` |
| A/B price experiments, significance, bandit allocation | `last-price-experiments` |
| Outcomes, learned elasticity, analyst findings, JALE optimize, data exchange | `last-price-learning-loop` |
| Map merchant payloads to canonical records | `last-price-rosetta` |
| Marketplace listings, earnings, payouts, leaderboard | `last-price-marketplace` |
| Outbound webhooks and signature checks | `last-price-webhooks` |
| Workspace agents, agent keys, day passes, claim | `last-price-agents` |
| Store connectors, competitor observations, price proposals | `last-price-commerce-pipeline` |
| Team, roles, API keys, embed tokens, approvals, audit, notifications | `last-price-workspace-admin` |
| Customers, contacts, orders, payments, disputes | `last-price-order-to-cash` |
| Usage, costs, prepaid balance, credits, invoices | `last-price-usage-and-billing` |
| Agent shopping: UCP quote and checkout sessions | `last-price-ucp` |
| Buyer-agent spend policy, offers and counter-offers | `last-price-spend-and-offers` |
| Value a startup round for an investor (fair post-money, offer verdict) | `last-price-investment-valuation` |

## Rules for every skill

- Never invent prices, verdicts, ids, counts, or schema fields; report what the API returned.
- Read current state before a write; confirm with the user before anything that changes live prices, money, access, or deletes data.
- Keep secrets (API keys, claim tokens, webhook secrets, embed tokens, payment headers) out of chat, logs, and reports.
