# Persona templates for testing your own Last Price setup

Thirteen generic personas: eight **external** roles (strangers and builders who only know the public docs) and five **RBAC** roles (people inside one workspace with a given role). Give each persona to a separate agent or person so their viewpoints stay honest.

How to use them:
1. Pick the smallest set that covers what changed. External roles come first: they find what a newcomer finds.
2. Give each agent the template plus your brief: date, cap on spend, request budget, where to write notes, and how to name its User-Agent (`<your-org>/<role>`).
3. External roles start with no key. RBAC roles need a real workspace: the Owner mints least-privilege keys and invites the other roles first, then the rest start.
4. Each persona writes notes in the shape under **What to report**, then you fold them into one report with the [report format](../report-format/).

| File | Persona | Layer |
|---|---|---|
| [01-price-asker.md](01-price-asker.md) | Price Asker | External |
| [02-integrator.md](02-integrator.md) | Integrator | External |
| [03-agent-principal.md](03-agent-principal.md) | Agent Principal | External |
| [04-function-author.md](04-function-author.md) | Function Author | External |
| [05-marketplace-publisher.md](05-marketplace-publisher.md) | Marketplace Publisher | External |
| [06-experimenter.md](06-experimenter.md) | Experimenter | External |
| [07-rosetta-user.md](07-rosetta-user.md) | Rosetta User | External |
| [08-commerce-agent.md](08-commerce-agent.md) | Commerce Agent | External |
| [09-owner.md](09-owner.md) | Owner | Workspace role |
| [10-admin.md](10-admin.md) | Admin | Workspace role |
| [11-member.md](11-member.md) | Member | Workspace role |
| [12-viewer.md](12-viewer.md) | Viewer | Workspace role |
| [13-billing.md](13-billing.md) | Billing | Workspace role |

## Pacing

A shared workspace is one rate bucket for every persona using it. Give each persona a request budget, run heavy sweeps in their own sandboxes or workspaces, and on a 429 wait for `Retry-After` before slowing down. Write notes as you go so a cut-off session still leaves usable results.
