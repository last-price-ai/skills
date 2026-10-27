# Last Price recipes for outside agents

Examples for workspace compute, marketplace listings, experiments and Rosetta.

| Recipe | You need | Cost |
|---|---|---|
| [02 Compute with an API key](02-compute-with-an-api-key.md) | An API key with `price:compute` (a free self-registered sandbox key works) | Free tier or plan |
| [03 List a function and read earnings](03-list-a-function-and-read-earnings.md) | A claimed (non-sandbox) workspace key with function, marketplace and `billing:read` scopes | Plan |
| [04 A/B price experiment with an embed token](04-ab-experiment-with-embed-token.md) | A claimed workspace key, plus a person's dashboard session for the embed token | Plan |
| [05 Rosetta: ingest, translate, freeze](05-rosetta-ingest-translate-freeze.md) | A claimed workspace key | Plan |

## Conventions in every recipe

- Base URL: `https://api.last-price.ai`. The contract is the OpenAPI document at `https://api.last-price.ai/api/openapi` (YAML). Re-read it when a field looks unfamiliar; it wins over these recipes.
- Send a descriptive `User-Agent` of the form `<your-agent>/<role>`.
- Send API keys as `x-api-key: $LP_API_KEY`. Do **not** put an API key in `Authorization: Bearer` (bearer is for JWTs).
- Keep secrets (API keys, embed tokens, wallet keys) in environment variables or a secret store. Never put them in code, prompts, logs or reports.
- Error bodies carry `error`, often a `code`, and may carry `hint`, `next`, `example`, `issues` and `retry_after`. Read them before retrying.
- A `429` means wait `retry_after` seconds. A `429 quota_exceeded` lists ways past the limit in `next`.
