# Choose a starting point

Use the role that matches the person or business the agent represents.

| You want to… | Start with |
|---|---|
| Pay for a price computation with a wallet, without an account | [Pay per call](../../last-price-x402/SKILL.md) |
| Add pricing to an application or service | [Compute](../../last-price-compute/SKILL.md), then [authentication](../../last-price-auth/SKILL.md) for workspace access |
| Connect an assistant through MCP | [MCP connector](../../last-price-mcp/SKILL.md) |
| Build or route a pricing function | [Functions and routing](../../last-price-functions-and-routing/SKILL.md) |
| Publish a function and track earnings | [Marketplace](../../last-price-marketplace/SKILL.md) |
| Manage store pricing and review proposed changes | [Commerce pipeline](../../last-price-commerce-pipeline/SKILL.md) |
| Compare pricing strategies and learn from sales outcomes | [Experiments](../../last-price-experiments/SKILL.md) and [learning loop](../../last-price-learning-loop/SKILL.md) |
| Manage team access or workspace settings | [Workspace administration](../../last-price-workspace-admin/SKILL.md) |
| Track usage, receipts, balance or invoices | [Usage and billing](../../last-price-usage-and-billing/SKILL.md) |

## Workspace roles

Workspaces have `owner`, `admin`, `member`, `viewer` and `billing` roles. These are access permissions, not personas to simulate. An agent uses the permissions its user grants; a task description does not grant a role or scope.

Read the current role permissions with `GET /api/workspaces/roles`. Use [workspace administration](../../last-price-workspace-admin/SKILL.md) for the differences between dashboard sessions, API keys and agent credentials.
