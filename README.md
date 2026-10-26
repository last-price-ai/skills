# Last Price Agent Skills

Agent skills for [Last Price](https://last-price.ai), the Pricing Compute Network: compute, verify, route, experiment on, and learn from prices through the Last Price API or MCP connector.

Each skill is a folder with a `SKILL.md` in the open [Agent Skills](https://agentskills.io) format: YAML frontmatter (`name`, `description` saying when to use it) and a concise body of instructions. These skills work in Cursor, Claude Code, Codex, and other agents that support Agent Skills, or as plain reference docs for any agent.

## Skills

| Skill | Use it for |
|---|---|
| [`last-price-overview`](skills/last-price-overview/SKILL.md) | Start here: what Last Price is, MCP vs HTTP, which skill does what |
| [`last-price-auth`](skills/last-price-auth/SKILL.md) | Getting and verifying a key, request headers, sandbox limits, scopes |
| [`last-price-mcp`](skills/last-price-mcp/SKILL.md) | Using the MCP connector: ~260 tools mapped by job |
| [`last-price-compute`](skills/last-price-compute/SKILL.md) | Quoting prices: single, batch, demo, input clarifier, errors |
| [`last-price-functions-and-routing`](skills/last-price-functions-and-routing/SKILL.md) | Pricing functions, routing policies, router, chains, verify, guardrails |
| [`last-price-experiments`](skills/last-price-experiments/SKILL.md) | A/B and multi-arm price experiments, stopping, significance, bandits |
| [`last-price-learning-loop`](skills/last-price-learning-loop/SKILL.md) | Outcomes, learned elasticity, analyst findings, JALE optimize, data exchange |
| [`last-price-rosetta`](skills/last-price-rosetta/SKILL.md) | Mapping merchant payloads onto canonical records |
| [`last-price-marketplace`](skills/last-price-marketplace/SKILL.md) | Listings, reviews, earnings and payout history, Elo Index leaderboard |
| [`last-price-webhooks`](skills/last-price-webhooks/SKILL.md) | Outbound webhooks and signature verification |
| [`last-price-agents`](skills/last-price-agents/SKILL.md) | Workspace agents, agent keys, capabilities, claim |
| [`last-price-commerce-pipeline`](skills/last-price-commerce-pipeline/SKILL.md) | Store connectors, competitor observations, price proposals, execution |
| [`last-price-workspace-admin`](skills/last-price-workspace-admin/SKILL.md) | Team, roles, API keys, embed tokens, approvals, audit, notifications |
| [`last-price-order-to-cash`](skills/last-price-order-to-cash/SKILL.md) | Customers, contacts, orders, payments, disputes |
| [`last-price-usage-and-billing`](skills/last-price-usage-and-billing/SKILL.md) | Usage, receipts, costs, credits, invoices |
| [`last-price-ucp`](skills/last-price-ucp/SKILL.md) | Universal Commerce Protocol quotes and checkout sessions |
| [`last-price-offers`](skills/last-price-offers/SKILL.md) | Negotiated offers and counters |

## Install

This repository is a plugin for Claude Code, Cursor, Codex and ChatGPT, and an extension for Gemini CLI. Each one installs the skills and the Last Price MCP server (`https://api.last-price.ai/api/mcp/rpc?profile=directory`, the directory tool set with no payment tools) together. Without an API key, `compute_price` and `verify_price` answer from a rate limited demo; add a key for everything else.

**Claude Code**

```
/plugin marketplace add last-price-ai/skills
/plugin install lastprice@last-price
```

Claude Code asks for an optional API key when the plugin is enabled and keeps it in your system's secure storage.

**Codex**

```bash
codex plugin marketplace add last-price-ai/skills
codex plugin add lastprice@last-price
```

**Gemini CLI**

```bash
gemini extensions install https://github.com/last-price-ai/skills
```

Gemini CLI asks for an optional API key at install time (stored in your keychain); change it later with `gemini extensions config lastprice`.

**Cursor**

The plugin manifest is in `.cursor-plugin/`. Until it is listed in the Cursor Marketplace, add the server with this link and copy the skills:

```
cursor://anysphere.cursor-deeplink/mcp/install?name=lastprice&config=eyJ1cmwiOiJodHRwczovL2FwaS5sYXN0LXByaWNlLmFpL2FwaS9tY3AvcnBjIn0=
```

```bash
git clone https://github.com/last-price-ai/skills.git last-price-agent-skills
mkdir -p .cursor/skills            # project-level; or ~/.cursor/skills for all projects
cp -R last-price-agent-skills/skills/* .cursor/skills/
```

**VS Code (GitHub Copilot agent mode)**

```bash
code --add-mcp '{"name":"lastprice","type":"http","url":"https://api.last-price.ai/api/mcp/rpc?profile=directory&via=vscode"}'
```

**Google Antigravity**

Open the Agent panel's menu, MCP Servers, Manage MCP Servers, View raw config, and add this to `mcp_config.json`:

```json
{
  "mcpServers": {
    "lastprice": {
      "serverUrl": "https://api.last-price.ai/api/mcp/rpc?profile=directory&via=antigravity"
    }
  }
}
```

For your workspace, add `"headers": { "x-api-key": "<your key>" }` beside `serverUrl`.

The Antigravity CLI reads the same block from `.agents/mcp_config.json` in a project. Copy `skills/` into `.agents/skills/` for the skills.

**Grok**

At grok.com/connectors choose New Connector, Custom, and enter `https://api.last-price.ai/api/mcp/rpc?profile=directory&via=grok`. The demo tools work with no key.

**Zed, Warp, Kiro, JetBrains (Junie and AI Assistant), Goose, Windsurf**

Add a remote (HTTP) MCP server named `lastprice` with the URL `https://api.last-price.ai/api/mcp/rpc?profile=directory&via=<tag>`, where the tag is `zed`, `warp`, `kiro`, `jetbrains`, `goose` or `windsurf`, and an optional `x-api-key` header.

**v0 and Microsoft Copilot Studio**

Add `https://api.last-price.ai/api/mcp/rpc?profile=directory&via=v0` or `https://api.last-price.ai/api/mcp/rpc?profile=directory&via=copilot-studio` as a custom MCP server (Streamable HTTP), with an optional `x-api-key` header.

**Clients that only run local (stdio) servers**

```bash
npx -y mcp-remote https://api.last-price.ai/api/mcp/rpc?profile=directory&via=mcp-remote
```

**ChatGPT, Claude.ai, Perplexity and other MCP clients**

Add `https://api.last-price.ai/api/mcp/rpc?profile=directory` as a custom connector or remote MCP server. For an API key, send it as the `x-api-key` header where the client allows headers.

**Other Agent Skills-compatible agents**

```bash
npx skills add last-price-ai/skills
```

The [skills CLI](https://skills.sh) installs the skills into Claude Code, Cursor, Codex and the other agents it supports (`-a <agent>` picks one, `-g` installs for all projects). Or copy the folders from `skills/` into the agent's skills directory (for example `.agents/skills/`). Agents without skill support can be pointed at `skills/last-price-overview/SKILL.md` as a starting document.

## What the plugin connects to

The plugin, extension and manifests in this repository contain no code that runs on install. They point the assistant at one remote server, `https://api.last-price.ai/api/mcp/rpc`, run by Last Price. Each manifest asks for the directory tool set (`profile=directory`) and adds a `via` tag (`via=claude-plugin`, `cursor-plugin`, `openai-plugin`, `gemini-cli`) so Last Price can count installs by assistant; the tag changes nothing about the answers. Tool calls send the arguments the assistant chooses (pricing context such as currency, cost and product type) and, if you set one, your API key in the `x-api-key` header. Nothing else is read from your machine. Privacy policy: https://last-price.ai/privacy.

## Plugin files

| File | Read by |
|---|---|
| `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | Claude Code |
| `.cursor-plugin/plugin.json`, `.cursor-plugin/mcp.json`, `.cursor-plugin/marketplace.json` | Cursor |
| `plugin.json`, `mcp.json`, `.agents/plugins/marketplace.json` | Codex and ChatGPT |
| `gemini-extension.json`, `GEMINI.md` | Gemini CLI |
| `skills/` | all of them |

Keep the version in all four manifests equal; `scripts/check-manifests.mjs` fails when they differ.

## API keys

For workspace access, create a scoped key in [Settings](https://app.last-price.ai), or self-register with `POST /api/agents/register` for a sandbox key and claim link.

Store the key in your environment or secret store:

- HTTP: `LP_API_KEY`, sent as `x-api-key: $LP_API_KEY`.
- MCP: `LASTPRICE_API_KEY` in the connector configuration.

Verify a key with `GET https://api.last-price.ai/api/me`. See [authentication](skills/last-price-auth/SKILL.md) for scopes, sandbox limits and OAuth.

## MCP vs HTTP

Both are first class and reach the same backend.

- **MCP connector** (`https://api.last-price.ai/api/mcp/rpc?profile=directory`, discovery at `/.well-known/mcp.json`): structured tools for nearly every surface. Best inside agents that support MCP. Without a key, compute and verify tools fall back to the rate-limited public demo, which pins one function and drops metadata and constraints, so label those results as demo.
- **HTTP API** (`https://api.last-price.ai`, OpenAPI at `/api/openapi`): covers everything, including the few surfaces without a tool. Best for scripts, CI, and agents without MCP.

## Keeping skills current

`scripts/check-spec-drift.py` (Python 3, standard library only):

- diffs the live OpenAPI operations against the committed snapshot `spec/paths.snapshot.txt`, and
- checks that every API path mentioned in `skills/*/SKILL.md` still exists in the live spec.

```bash
python3 scripts/check-spec-drift.py           # exit 1 on drift or missing paths
python3 scripts/check-spec-drift.py --update  # refresh the snapshot after re-verifying skills
```

`scripts/sync.mjs` (Node 18+, no dependencies) does the same for the MCP connector: it reads the live `tools/list`, fails when a tool is named in no skill or a known tool disappears or changes its required arguments, and regenerates each skill's `references/mcp-tools.md` (split into an index and `mcp-tools-<n>.md` parts when it would pass 200 kB; every argument, access level and documented refusal of the tools that skill names).

```bash
node scripts/sync.mjs --check   # exit 1 on drift
node scripts/sync.mjs           # regenerate references/mcp-tools.md
```

`.github/workflows/spec-drift.yml` runs both every weekday, on demand, and on a `repository_dispatch` (`api-changed`) that Last Price can send after each release, and opens a pull request when anything drifted. When it reports drift, re-read the changed operations, update the affected skills, add a `CHANGELOG.md` entry, and refresh the snapshot.

## Credentials and payments

- Never invent prices, ids, verdicts, or schema fields; report what the API returned.
- Read state before writing; confirm with the user before changing live prices, money, access, or deleting data.
- Keep API keys, claim tokens, webhook secrets, embed tokens, and payment headers out of chat and logs.

## Recipes

[Recipes](recipes/) cover keyed compute, marketplace publishing, experiments and Rosetta.

## Payments (not in the plugins)

The plugins and the `skills/` folder leave out payments: they use the connector's directory tool set (`?profile=directory`), which has no wallet, top-up, day-pass, spend-session or payout tools. Integrators who pay per call with x402 (USDC on Base) can read [`payments/`](payments/): the [pay-per-call skill](payments/last-price-x402/SKILL.md), the [spend policy skill](payments/last-price-spend-policy/SKILL.md), the [wallet recipe](payments/01-price-with-a-wallet-x402.md) and the [TypeScript x402 client](payments/x402-safe-client/). No plugin loads them.

## License

[MIT](LICENSE).
