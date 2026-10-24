# Last Price Agent Skills

Agent skills for [Last Price](https://last-price.ai), the Pricing Compute Network: compute, verify, route, experiment on, and learn from prices through the Last Price API or MCP connector.

Each skill is a folder with a `SKILL.md` in the open [Agent Skills](https://agentskills.io) format: YAML frontmatter (`name`, `description` saying when to use it) and a concise body of instructions. These skills work in Cursor, Claude Code, Codex, and other agents that support Agent Skills, or as plain reference docs for any agent.

## Pay per call

Pay for a computation with a wallet, without an account or API key. Send a request to `POST /api/compute/price`, read the HTTP 402 payment requirements, then submit the same request with an x402 payment authorization. Payment uses USDC on Base.

- [Pay-per-call skill](skills/last-price-x402/SKILL.md): payment terms, signing, settlement and errors.
- [Wallet recipe](recipes/01-price-with-a-wallet-x402.md): request and payment flow.
- [TypeScript client](clients/x402-safe-client/): validates the recipient, token, amount and spending cap before signing.

Pay-per-call uses the paid compute endpoint. The free demo is a separate, limited endpoint at `/api/public/compute/demo`.

## Skills

| Skill | Use it for |
|---|---|
| [`last-price-x402`](skills/last-price-x402/SKILL.md) | HTTP 402 pay-per-call with USDC on Base, day passes, top-ups |
| [`last-price-overview`](skills/last-price-overview/SKILL.md) | Start here: what Last Price is, MCP vs HTTP, which skill does what |
| [`last-price-auth`](skills/last-price-auth/SKILL.md) | Getting and verifying a key, request headers, sandbox limits, scopes |
| [`last-price-mcp`](skills/last-price-mcp/SKILL.md) | Using the MCP connector: ~280 tools mapped by job |
| [`last-price-compute`](skills/last-price-compute/SKILL.md) | Quoting prices: single, batch, demo, input clarifier, errors |
| [`last-price-functions-and-routing`](skills/last-price-functions-and-routing/SKILL.md) | Pricing functions, routing policies, router, chains, verify, guardrails |
| [`last-price-experiments`](skills/last-price-experiments/SKILL.md) | A/B and multi-arm price experiments, stopping, significance, bandits |
| [`last-price-learning-loop`](skills/last-price-learning-loop/SKILL.md) | Outcomes, learned elasticity, analyst findings, JALE optimize, data exchange |
| [`last-price-rosetta`](skills/last-price-rosetta/SKILL.md) | Mapping merchant payloads onto canonical records |
| [`last-price-marketplace`](skills/last-price-marketplace/SKILL.md) | Listings, reviews, earnings, payout runs, Elo Index leaderboard |
| [`last-price-webhooks`](skills/last-price-webhooks/SKILL.md) | Outbound webhooks and signature verification |
| [`last-price-agents`](skills/last-price-agents/SKILL.md) | Workspace agents, agent keys, capabilities, day passes, claim |
| [`last-price-commerce-pipeline`](skills/last-price-commerce-pipeline/SKILL.md) | Store connectors, competitor observations, price proposals, execution |
| [`last-price-workspace-admin`](skills/last-price-workspace-admin/SKILL.md) | Team, roles, API keys, embed tokens, approvals, audit, notifications |
| [`last-price-order-to-cash`](skills/last-price-order-to-cash/SKILL.md) | Customers, contacts, orders, payments, disputes |
| [`last-price-usage-and-billing`](skills/last-price-usage-and-billing/SKILL.md) | Usage, receipts, costs, prepaid balance, top-ups, credits, invoices |
| [`last-price-ucp`](skills/last-price-ucp/SKILL.md) | Universal Commerce Protocol quotes and checkout sessions |
| [`last-price-spend-and-offers`](skills/last-price-spend-and-offers/SKILL.md) | Buyer-agent spend policy checks, negotiated offers and counters |

## Install

Copy the skill folders you want (or all of `skills/`) into your agent's skills directory.

**Cursor**

```bash
git clone https://github.com/last-price-ai/skills.git last-price-agent-skills
mkdir -p .cursor/skills            # project-level; or ~/.cursor/skills for all projects
cp -R last-price-agent-skills/skills/* .cursor/skills/
```

**Claude Code**

As a plugin (skills plus the Last Price MCP server):

```
/plugin marketplace add last-price-ai/skills
/plugin install lastprice@last-price
```

Or copy the folders:

```bash
mkdir -p ~/.claude/skills          # or .claude/skills inside a project
cp -R last-price-agent-skills/skills/* ~/.claude/skills/
```

**Codex and other Agent Skills-compatible agents**

Copy the folders into the agent's skills directory (for example `~/.codex/skills/` or `.agents/skills/`, depending on the agent). Agents without skill support can be pointed at `skills/last-price-overview/SKILL.md` as a starting document.

Skill directory locations differ between agents and versions; check your agent's documentation.

## API keys

For workspace access, create a scoped key in [Settings](https://app.last-price.ai), or self-register with `POST /api/agents/register` for a sandbox key and claim link.

Store the key in your environment or secret store:

- HTTP: `LP_API_KEY`, sent as `x-api-key: $LP_API_KEY`.
- MCP: `LASTPRICE_API_KEY` in the connector configuration.

Verify a key with `GET https://api.last-price.ai/api/me`. See [authentication](skills/last-price-auth/SKILL.md) for scopes, sandbox limits and OAuth. Pay-per-call needs a wallet instead of an API key.

## MCP vs HTTP

Both are first class and reach the same backend.

- **MCP connector** (`https://api.last-price.ai/api/mcp/rpc`, discovery at `/.well-known/mcp.json`): structured tools for nearly every surface. Best inside agents that support MCP. Without a key, compute and verify tools fall back to the rate-limited public demo, which pins one function and drops metadata and constraints, so label those results as demo.
- **HTTP API** (`https://api.last-price.ai`, OpenAPI at `/api/openapi`): covers everything, including the few surfaces without a tool. Best for scripts, CI, and agents without MCP.

## Keeping skills current

`scripts/check-spec-drift.py` (Python 3, standard library only):

- diffs the live OpenAPI operations against the committed snapshot `spec/paths.snapshot.txt`, and
- checks that every API path mentioned in `skills/*/SKILL.md` still exists in the live spec.

```bash
python3 scripts/check-spec-drift.py           # exit 1 on drift or missing paths
python3 scripts/check-spec-drift.py --update  # refresh the snapshot after re-verifying skills
```

`scripts/sync.mjs` (Node 18+, no dependencies) does the same for the MCP connector: it reads the live `tools/list`, fails when a tool is named in no skill or a known tool disappears or changes its required arguments, and regenerates each skill's `references/mcp-tools.md` (every argument, access level and documented refusal of the tools that skill names).

```bash
node scripts/sync.mjs --check   # exit 1 on drift
node scripts/sync.mjs           # regenerate references/mcp-tools.md
```

`.github/workflows/spec-drift.yml` runs both every weekday, on demand, and on a `repository_dispatch` (`api-changed`) that Last Price can send after each release, and opens a pull request when anything drifted. When it reports drift, re-read the changed operations, update the affected skills, add a `CHANGELOG.md` entry, and refresh the snapshot.

## Credentials and payments

- Never invent prices, ids, verdicts, or schema fields; report what the API returned.
- Read state before writing; confirm with the user before changing live prices, money, access, or deleting data.
- Keep API keys, claim tokens, webhook secrets, embed tokens, and payment headers out of chat and logs.

## Recipes and client

[Recipes](recipes/) cover wallet payments, keyed compute, marketplace publishing, experiments and Rosetta. The [TypeScript x402 client](clients/x402-safe-client/) provides payment validation and settlement handling.

## License

[MIT](LICENSE).
