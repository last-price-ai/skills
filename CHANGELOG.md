# Changelog

## 0.1.0 - 2026-10-24 (draft)

- `scripts/sync.mjs`: checks every MCP connector tool is named in a skill and regenerates `references/mcp-tools.md` per skill from the live tool list.
- Claude Code plugin and marketplace files, with the Last Price MCP server.
- Recipes, the x402 safe client, the capped release check, persona templates and the report format.

- First draft of 18 skills: overview, auth, MCP, compute, functions and routing, experiments, learning loop, Rosetta, marketplace, webhooks, agents, commerce pipeline, workspace admin, order to cash, usage and billing, UCP, x402, spend and offers.
- Endpoint paths verified against the live OpenAPI spec (334 paths, 456 operations); snapshot committed at `spec/paths.snapshot.txt`.
- MCP tool map covers the connector's ~280 tools.
- x402 skill includes results from a live funded pay-per-call test (0.01 USDC per call on Base, replay and underpay refusals).
- Added `scripts/check-spec-drift.py` and a weekly GitHub Actions workflow.
