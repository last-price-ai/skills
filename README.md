# Last Price Agent Skills

Agent skills for [Last Price](https://last-price.ai), the Pricing Compute Network: compute, verify, route, experiment on, and learn from prices through the Last Price API or MCP connector.

Each skill is a folder with a `SKILL.md` in the open [Agent Skills](https://agentskills.io) format: YAML frontmatter (`name`, `description` saying when to use it) and a concise body of instructions. These skills work in Cursor, Claude Code, Codex, and other agents that support Agent Skills, or as plain reference docs for any agent.

> Status: **draft for review** by the Last Price team. Every endpoint path mentioned was checked against the live OpenAPI spec (`https://api.last-price.ai/api/openapi.json`, 334 paths / 456 operations on 2026-10-24).

## Skills

| Skill | Use it for |
|---|---|
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
| [`last-price-x402`](skills/last-price-x402/SKILL.md) | HTTP 402 pay-per-call with USDC on Base, day passes, top-ups |
| [`last-price-spend-and-offers`](skills/last-price-spend-and-offers/SKILL.md) | Buyer-agent spend policy checks, negotiated offers and counters |

## Install

Copy the skill folders you want (or all of `skills/`) into your agent's skills directory.

**Cursor**

```bash
git clone <this-repo-url> last-price-agent-skills
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

## Authentication

1. Get a key, one of:
   - Self-register an agent (no human): `POST https://api.last-price.ai/api/agents/register` returns a sandbox key once, plus a claim link for a person.
   - Have a person create a scoped key at `https://app.last-price.ai` (Settings), or an agent-bound key.
   - No key at all: the public demo (`POST /api/public/compute/demo`) or x402 pay-per-call.
2. Store it as an environment variable, never in chat or source:
   - HTTP / scripts: `LP_API_KEY`, sent as `x-api-key: $LP_API_KEY` (never as `Authorization: Bearer`).
   - MCP connector: `LASTPRICE_API_KEY` in the connector configuration.
3. Verify with `GET https://api.last-price.ai/api/me`.

Details: [`last-price-auth`](skills/last-price-auth/SKILL.md).

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

## Safety principles built into every skill

- Never invent prices, ids, verdicts, or schema fields; report what the API returned.
- Read state before writing; confirm with the user before changing live prices, money, access, or deleting data.
- Keep API keys, claim tokens, webhook secrets, embed tokens, and payment headers out of chat and logs.

## Extras

`recipes/` (five tested walk-throughs), `clients/x402-safe-client/` (a paid-call client that checks network, token, amount, recipient and a spend cap before it signs), `harness/x402-release-check/` (a capped, dry-run-by-default paid-call check), `persona-templates/` and `report-format/`. See [EXTRAS.md](EXTRAS.md).

## License

MIT; see [LICENSE](LICENSE). The copyright holder is a placeholder ("Last Price") and is **TBD**: the Last Price team should confirm the legal entity name before publishing.
