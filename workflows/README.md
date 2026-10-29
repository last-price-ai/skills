# Last Price in GitHub Agentic Workflows

[GitHub Agentic Workflows](https://github.github.com/gh-aw/) run a coding
agent (Copilot, Claude Code, Codex and others) inside GitHub Actions from a
Markdown file. These files give such an agent the Last Price tools.

| File | What it does |
| --- | --- |
| [`price-check.md`](price-check.md) | On a pull request that changes prices, checks each one with `verify_price` and posts one comment with a verdict and band. |
| [`shared/lastprice.md`](shared/lastprice.md) | The Last Price MCP server and firewall rule, to import into your own workflow. |

No Last Price account or key is needed. The server is the directory tool
set (`?profile=directory`), which cannot move money.

## Install the price check

```bash
gh extension install github/gh-aw
gh aw add last-price-ai/skills/price-check
git add .github/   # the workflow, its lock file and shared/lastprice.md
git commit -m "Add Last Price price check" && git push
```

Edit the `paths:` list in `price-check.md` to where your prices live, then run
`gh aw compile` again. The agent's own model is billed by its engine as
usual (a Copilot licence by default; set `engine: claude` with
`ANTHROPIC_API_KEY`, or `engine: codex` with `OPENAI_API_KEY`). Last Price
calls are free.

## Use Last Price in your own workflow

```yaml
imports:
  - last-price-ai/skills/workflows/shared/lastprice.md@main
```

The import adds the `lastprice` MCP server, allows `api.last-price.ai` through
the workflow firewall, and tells the agent how to read a verdict.
