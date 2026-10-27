# Changelog

## Unreleased

- Caught up with production again: the skills name the 25 tools prod gained (experiment promotion and calls, hosted demos, routing experiments, the sales playbook and the stopping rule, customer overview and intel, payable invoices, child and admin workspaces, account sessions and the security log, notification archive, Salesforce and Datadog, usage signal filters, instrumentation setup), and the OpenAPI snapshot has the 53 new operations.
- The drift check no longer fails when the repository will not let Actions open pull requests: it writes the report to an open issue instead. Run by hand on a branch, it commits the references regenerated from the live API to that branch.
- README: a "See it work" section with the agent demo video, linking to all demo videos at last-price.ai/videos.
- Publishes to ClawHub as `@last-price/lastprice`: `openclaw.plugin.json` gives OpenClaw the skills in `skills/` and the connector (directory tool set, tagged `via=openclaw`), `package.json` carries the scoped name, and `assets/icon.png` is the catalog icon. Keep their versions in step with `.claude-plugin/plugin.json`. Passes `clawhub package validate` with no findings.
- `Package Publish` workflow (run by hand) packs the repo with `npm pack` and publishes it to ClawHub with the `clawhub` CLI, using trusted publishing instead of a stored token. It previews by default.
- `SECURITY.md` (private reporting, scope) and `CONTRIBUTING.md` (checks, the no-payments and one-server rules, releases).

## 0.3.0

- No payments in the plugins: every manifest now points at the connector's directory tool set (`?profile=directory`, 258 tools), the same one listed in the Claude connector directory, so wallet balance, top-ups, day passes, spend sessions, purchase settlement, payouts and the x402 price index are no longer installed. The skills match it: `scripts/sync.mjs` and the drift check read the directory tool set, `last-price-x402` and the spend policy half of `last-price-spend-and-offers` moved to `payments/` (with the wallet recipe and the x402 client), which no plugin loads, and the offers half is now `last-price-offers`. Workspace settings, team, notifications and agent inbox tools are left out too, since a directory sign-in cannot call them.
- Caught up with production: `last-price-mcp` now names the 26 tools prod gained since the pack was written (price checks from a photo or link, quote replies, reference pipelines, hosted price scraping, credit bundles, tax preview, Stripe invoices, monetization code), and every tool reference is regenerated.
- The drift check now fails when it should: its steps ran under `bash -e` without pipefail, so `| tee` hid every failure and no drift pull request was ever opened. It also runs every three hours instead of once a weekday.
- Removed the root `.mcp.json`: the Claude Code plugin's server lives in `.claude-plugin/plugin.json` (with the optional key), and the duplicate showed as a shadowed second server in the Claude plugin directory.
- `scripts/sync.mjs` splits a tool reference over 200 kB into an index and parts, so the directory's 256 KiB scan reads every file in full (`last-price-mcp` now has `mcp-tools-1.md` and `mcp-tools-2.md`).

## 0.2.0

- Installs as a Cursor plugin, a Codex and ChatGPT plugin, and a Gemini CLI extension, from the same skills and MCP server.
- The Claude Code plugin asks for an optional API key and sends it as `x-api-key`.
- Logo and directory listing fields (documentation, support, privacy and terms links).
- `scripts/check-manifests.mjs` keeps the manifests in step.
- README setup for Google Antigravity, Grok, Zed, Warp, Kiro, JetBrains, Goose, Windsurf, v0, Microsoft Copilot Studio and stdio-only clients (`mcp-remote`), each with its own `via` tag, and `npx skills add last-price-ai/skills`.

## 0.1.0

- Skills for pricing, wallet payments, workspace administration and commerce over HTTP and MCP.
- Claude Code plugin with the Last Price MCP server.
- Recipes and a TypeScript x402 client with payment validation and settlement handling.
- OpenAPI and MCP synchronization scripts.
