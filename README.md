# Tooling for last-price-ai/skills

This orphan branch holds what the Claude plugin directory does not allow inside a
plugin from an unverified organisation: scripts, programs and package-manager
files. The plugin itself is the `main` branch, and nothing here is part of it.

| Path | What it is |
| :-- | :-- |
| `scripts/check-manifests.mjs` | Manifests on `main` agree on name, version, server URL and files. Reads `package.json` from this branch. |
| `scripts/sync.mjs` | Regenerates `skills/*/references/mcp-tools*.md` on `main` from the live MCP `tools/list`. |
| `scripts/check-spec-drift.py` | Diffs the live OpenAPI operations against `spec/paths.snapshot.txt` on `main`. |
| `scripts/agent-labels.mjs` | Labels issues and PRs by the agent that signed them (workflow `agent-labels.yml`). |
| `package.json` | The npm / ClawHub package manifest. `package-publish.yml` copies it onto a `main` checkout before `npm pack`. |
| `payments/x402-safe-client/` | TypeScript x402 buyer for pay-per-call compute. Never shipped in a plugin. |

Every script treats the current directory as the plugin checkout, or `SKILLS_ROOT`
when set. Run them from a `main` checkout:

```bash
git worktree add ../skills-tooling tooling
node ../skills-tooling/scripts/check-manifests.mjs
node ../skills-tooling/scripts/sync.mjs --check
python3 ../skills-tooling/scripts/check-spec-drift.py
```

The workflows on `main` check this branch out under `tooling/` and run the same
commands. Version bumps touch `package.json` here and the manifests on `main`.
