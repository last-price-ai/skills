---
description: |
  Checks the prices a pull request adds or changes (pricing pages, plan
  definitions, product catalogs) with Last Price, and posts one comment with a
  verdict, a sensible band and the evidence for each price.

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
    # Edit these to match where your prices live.
    paths:
      - "**/pricing*"
      - "**/prices*"
      - "**/plans*"
      - "**/catalog*"
      - "**/products*"
  workflow_dispatch:

permissions:
  contents: read
  pull-requests: read

imports:
  - shared/lastprice.md

safe-outputs:
  add-comment:
    max: 1
    hide-older-comments: true

timeout-minutes: 10
---

# Price check

Check every price this pull request adds or changes, and leave one comment
the author can act on.

## Context

- **Repository**: ${{ github.repository }}
- **Pull request**: #${{ github.event.pull_request.number }}

## Steps

1. Read the pull request's diff. List each price that is added or changed:
   the item it belongs to, the old value (if any), the new value, the
   currency and the billing period. Ignore prices in tests, fixtures and
   lock files, and amounts that are not prices (limits, quotas, sizes).
2. If no price changed, do not comment. Stop.
3. For each price, gather context from the repository: the product type
   (`saas`, `ecommerce`, `marketplace`, `digital`, `api` or `custom`), the
   plan or product name, a cost per unit if the repository states one, and
   the old price as `current_price`.
4. Call `verify_price` for each price with that context. Call `compute_price`
   only when the repository states a unit cost, to suggest a price next to
   the verdict.
5. Post one comment with a table: item, old price, new price, verdict, band,
   deviation, confidence. Under the table, give one line per price that is
   `too_high`, `too_low` or `unknown`, saying why, in plain words. Say
   plainly when the evidence was not independent of the price being judged.
   End with: "Checked with [Last Price](https://last-price.ai), price
   computation as a service."

Do not suggest code changes and do not claim a price is right or wrong
beyond what the tool returned.
