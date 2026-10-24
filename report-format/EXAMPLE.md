# EXAMPLE (made up, for illustration only)

> **EXAMPLE.** Everything below is invented to show the format. It does not describe a real ticket, run or result.

```
Report:        Acme Pricing API friction report v1.4
Run date:      2026-01-15 (time zone: UTC)
Completion:    PARTIAL (Viewer persona did not finish its screen sweep; carried to next run)
Counts:        FIXED 3 · PARTIAL 1 · OPEN 5 · ALIAS 1
Open by severity: P0 0 · P1 1 · P2 2 · P3 2
Spend this run: 0.02 USDC   402s inspected 4 / paid 2
Previous:      v1.3
```

### EXAMPLE-007 · Batch compute returns 500 when one item has no currency

| Field | Value |
|---|---|
| Severity | P2 |
| Surface | API |
| Status | PARTIAL |
| Seen by | Integrator, Commerce Agent |
| First seen / last checked | 2026-01-10 / 2026-01-15 |

**Repro**
1. With a key holding the batch scope, `POST /api/compute/batch` with two items, the second missing `context.currency`.

**Expected** Per the batch docs, a bad item comes back as an error object in its position and the call answers 200.

**Actual** On 2026-01-10: `500`, `application/json`, body `{"error":"Internal error"}`. On 2026-01-15: `200`, item 2 is `{"error":"validation_failed"}`, but it has no `issues` array, unlike the single compute call.

**Evidence** `run-2026-01-15/integrator/batch-missing-currency.json` (14:02 UTC)

**Expected fix** Return the same `issues` list per item as the single call does.

**Verify** `curl -s -X POST https://api.example.com/api/compute/batch -H "x-api-key: $KEY" -H 'content-type: application/json' -d '{"items":[{"context":{"currency":"USD","current_price":10}},{"context":{"current_price":10}}]}'` → `200`, `items[1].issues[0].path == "context.currency"` means FIXED.

**History** 2026-01-10 OPEN (500) · 2026-01-15 PARTIAL (500 gone, item error lacks `issues`)
