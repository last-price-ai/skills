# Last Price

This extension connects Gemini CLI to Last Price, the Pricing Compute Network, through its hosted MCP server (`lastprice`) and adds the Last Price skills from `skills/`.

- To price something, call the `compute_price` tool. To judge a price you already have, call `verify_price`. Both work without an API key on a rate limited demo tenant; say so when a result came from the demo.
- With a workspace key (set it with `gemini extensions config lastprice`), every other Last Price tool works on that workspace.
- Start with the `last-price-overview` skill when a task needs more than one call. It says which skill covers which job.
- Report the prices, ids and verdicts the tools return. Never invent them.
- Ask the user before changing live prices, moving money, changing access or deleting data.
