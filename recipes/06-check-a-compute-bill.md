# Recipe 06: check a compute bill (was $5.75 for a 4K render a good price?)

An agent rents compute, does the job and reports what it cost. This recipe checks that number against the market, before the agent spends it or after.

The example is a real one: an agent wrote a Blender scene, rented 10 GPUs on RunPod for 52 minutes, rendered the film in 4K and reported **$5.75 total**. Every call below was run against the live connector without a key (the public demo), and the outputs are trimmed from the real answers.

You need nothing for steps 1 to 3: all three ran keyless, step 3 included (the demo routed it to `lastprice/cost-plus`). Without a key the answers come from the public demo, which is rate limited per IP. Read `_lastprice_notice` on each answer and say "demo" when you report it.

## 1. Don't ask with the price alone

The tempting call is to pass only the bill:

```json
verify_price {
  "proposed_price": 5.75, "currency": "USD", "buyer_type": "agent",
  "metadata": { "market_query": "rent 10 GPUs for 52 minutes on RunPod to render a 4K Blender animation" }
}
```

```json
{
  "verdict": "within_band", "band": { "lower": 4.48, "upper": 6.06 },
  "confidence": 0.25, "independent_evidence": false,
  "next_step": "check_more"
}
```

"Within band" sounds like a yes, but it isn't one. With no reference, the band is built from the price being judged, so the check goes in a circle. `independent_evidence: false` and `next_step: check_more` say so. Act on `next_step`, not on `verdict`.

## 2. Give it a reference you can show

Turn the job into units and multiply by a posted rate:

- Units: 10 GPUs × 52 minutes = **8.67 GPU-hours**.
- Rate: use the GPU model and cloud tier on your own receipt, look its rate up on the provider's pricing page, and keep the link. The post this example comes from didn't name the GPU or the tier, so here we assume an RTX 4090, a common choice for Blender renders. On 10 Nov 2026 RunPod's [RTX 4090 page](https://www.runpod.io/gpu/4090) listed $0.89 per GPU-hour on Secure Cloud and $0.34 on Community Cloud.
- References: 8.67 × $0.89 = **$7.72** (Secure Cloud) and 8.67 × $0.34 = **$2.95** (Community Cloud).

The tier isn't known, so check against both. Send each reference as `current_price`:

```json
verify_price {
  "proposed_price": 5.75, "currency": "USD", "current_price": 7.72, "buyer_type": "agent",
  "metadata": { "job": "10 GPUs x 52 min = 8.67 GPU-hours",
                "reference": "RunPod Secure Cloud RTX 4090 $0.89/GPU-hour x 8.67 (GPU model assumed)",
                "reference_url": "https://www.runpod.io/gpu/4090" }
}
```

| `current_price` sent | `reference_price` back | `verdict` | `band` | `deviation_pct` | `next_step` |
|---|---|---|---|---|---|
| Secure Cloud, $7.72 | 6.99 | `too_low` | 5.94 to 8.04 | −17.74 | `check_more` |
| Community Cloud, $2.95 | 2.70 | `too_high` | 2.30 to 3.11 | +112.96 | `walk_away` |

`deviation_pct` is measured against `reference_price`, not against what you sent: 5.75 / 6.99 − 1 = −17.7%. The demo turns `current_price` into a profit-maximising reference with an assumed elasticity of −1.2, and the evidence `note` says so.

Both answers rest on independent evidence (`independent_evidence: true`, confidence 0.5), and they disagree. $5.75 works out to about $0.66 per GPU-hour. That is too cheap for a Secure Cloud 4090 and about twice the Community Cloud rate, so the bill doesn't match an RTX 4090 on either tier. Most likely it was a different GPU, or a mix of tiers.

So the honest report is not "fair" or "unfair". It is: "the bill doesn't match a posted rate for the GPU I assumed. Show me the GPU model and tier on the receipt." With that line in hand, run the single check again. If the job ran on Community Cloud 4090s, `walk_away` means the next render can be done for about half.

## 3. Reselling the render: price it from cost

Say the agent sells the finished render to a client. Price it from what the work cost, with no incumbent price:

```json
compute_price {
  "currency": "USD", "unit_cost": 5.75, "target_margin_pct": 30,
  "buyer_type": "agent", "include_explanation": true
}
```

```json
{
  "function_name": "lastprice/cost-plus", "computed_price": 8.21, "confidence": 0.75,
  "alternatives": [ { "price": 7.19, "label": "20% margin" }, { "price": 9.58, "label": "40% margin" } ],
  "valid_until": "…15 minutes after the call…"
}
```

`target_margin_pct` is the margin on the price, not a markup on cost: 5.75 / (1 − 0.30) = 8.21. The quote holds until `valid_until`. With a claimed workspace key the result carries `receipt.id`: keep it, and once you know whether the client paid, pass it as `usage_event_id` to `report_outcome`. Demo results have no receipt and can't be reported.

## Rules

- Never make up the rate. If you can't find a posted rate, say so and leave `current_price` out. The answer is then `check_more`, and that is the honest result.
- Put the rate's source in `metadata` and in your report, so a person can check it.
- Rates change often. Look them up again for every job and don't reuse an old reference.
