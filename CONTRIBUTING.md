# Contributing

Thanks for helping. This repository is the Last Price agent skills and the plugins that ship them to Claude Code, Codex, ChatGPT, Cursor, Gemini CLI and OpenClaw.

## Reporting a problem

- A skill gives wrong instructions, names a tool or endpoint that doesn't exist, or a plugin doesn't install: open an issue with the assistant, the skill and what happened.
- A security problem: see [SECURITY.md](SECURITY.md), not the issue tracker.
- A problem with the Last Price API itself: email `support@last-price.ai`.

## Making a change

1. Fork the repository and branch from `main`.
2. Edit the skill under `skills/<name>/SKILL.md`. Keep the frontmatter `name` and a `description` that says when to use the skill. Keep the body short and practical.
3. Never invent tools, endpoints, fields or prices. Each one must exist in the live API (`https://api.last-price.ai/api/openapi`) or the connector's directory tool set.
4. Don't edit `references/mcp-tools*.md` by hand. `node scripts/sync.mjs` regenerates them from the live server.
5. Run the checks:

   ```bash
   node scripts/check-manifests.mjs   # manifests agree on name, version, server URL and files
   node scripts/sync.mjs --check      # every live tool is named in a skill
   python3 scripts/check-spec-drift.py  # API paths in skills still exist
   ```

6. Add a line under "Unreleased" in `CHANGELOG.md` and open a pull request.

## Rules that keep the plugins safe

- **No payments in the plugins.** Every manifest points at `?profile=directory`, which has no wallet, top-up, spend-session or payout tools. Payment material lives in `payments/`, which no plugin loads. Don't move it into `skills/`.
- **One server.** Manifests connect only to `https://api.last-price.ai/api/mcp/rpc`, with a `via` tag for the host.
- **Keep the versions equal.** A release bumps the version in all six manifests (`.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `plugin.json`, `gemini-extension.json`, `openclaw.plugin.json`, `package.json`). `check-manifests.mjs` fails if they differ.
- **Keys stay out of files.** Never commit an API key, even in an example. Use `LP_API_KEY` or `LASTPRICE_API_KEY` from the environment.

## Releases

Maintainers publish to ClawHub by running the **Package Publish** workflow on `main` with "dry run" unticked, after a version bump. The other directories pick up `main` on their own.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
