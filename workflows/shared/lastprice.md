---
# Last Price for GitHub Agentic Workflows.
#
# Import this into any agentic workflow to give its agent the Last Price
# tools (price computation as a service) without an account:
#
#   imports:
#     - last-price-ai/skills/workflows/shared/lastprice.md@main
#
# It connects the directory tool set, which has no wallet, top-up, spend or
# payout tools, and lets the agent reach api.last-price.ai through the
# workflow firewall. Every tool listed below works without a key.
mcp-servers:
  lastprice:
    type: http
    url: "https://api.last-price.ai/api/mcp/rpc?profile=directory&via=gh-aw"
    allowed:
      - pricing_conversation
      - compute_price
      - verify_price
      - verify_signed_quote
      - list_pricing_pipelines
      - get_changelog

network:
  allowed:
    - defaults
    - "api.last-price.ai"
---

## Last Price tools

You can call the `lastprice` MCP server. Use it for any question about what
something should cost or whether a price makes sense.

- `verify_price` judges a price you already have. Send `proposed_price`,
  `currency` and whatever context you know (`product_type`, `product_id`,
  `current_price`, `customer_segment`, `geo`). The verdict is `fair`,
  `too_high`, `too_low` or `unknown`. `unknown` means it could not be judged,
  which is not the same as fair. Report the `band`, `deviation_pct` and
  `confidence` with the verdict, and say when `independent_evidence` is false.
- `compute_price` suggests a price. Send `currency` and either `unit_cost`
  (what it costs to provide) or `current_price`. If inputs are missing it
  returns an error naming them.
- `pricing_conversation` with `action: "prepare"` is free and tells you which
  inputs are still missing. Use it when you are unsure what to send.

Never invent costs, prices or answers to the questions these tools ask. If
an input is not in the repository or the event you were given, say it is
missing.
