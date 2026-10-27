# Security

## Reporting a vulnerability

Please don't open a public issue or pull request for a security problem.

- **In this repository** (the skills, plugin manifests, scripts or the payments client): use GitHub's private reporting. Open the **Security** tab and choose **Report a vulnerability**.
- **In the Last Price service** (`api.last-price.ai`, the MCP server, the dashboard): email `support@last-price.ai` with "Security" in the subject.

Tell us what you found, how to reproduce it, and what an attacker could do with it. You'll get an answer within a few days. Please give us reasonable time to fix it before you disclose it publicly. Reporters are credited in the advisory unless they ask not to be.

## What is in scope

This repository holds instructions and manifests, not a server. The plugins run no code on install. They point the assistant at one remote MCP server and load the `SKILL.md` files. Reports we especially want:

- A skill or manifest that tells an assistant to leak a key, skip a confirmation, or act outside what the user asked for.
- A manifest that connects to anything other than `https://api.last-price.ai/api/mcp/rpc`, or that installs payment tools (the plugins use the directory tool set, which has none).
- A problem in the TypeScript x402 client under `payments/x402-safe-client/`.
- Anything in the published ClawHub package (`@last-price/lastprice`) that isn't in this repository.

## Supported versions

Only the latest release on `main` gets fixes. The version is in `.claude-plugin/plugin.json` and the other manifests, which are always kept equal.
