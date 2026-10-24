# Friction report for coding agents: TEMPLATE

One report, one ticket series, written from the outside: only public docs, live HTTP answers and what a user sees on screen. A coding agent should be able to fix each ticket from its text alone.

## Header

```
Report:        <product> friction report v<MAJOR>.<N>   (bump N for each folded run that changes a status or adds a ticket)
Run date:      YYYY-MM-DD (time zone: <zone>)
Completion:    COMPLETE | PARTIAL (<which personas/lanes are missing and why>)
Counts:        FIXED <n> · PARTIAL <n> · OPEN <n> · ALIAS <n>   (aliases are not counted in the others)
Open by severity: P0 <n> · P1 <n> · P2 <n> · P3 <n>
Spend this run: <amount and asset, or 0>   402s inspected <n> / paid <n>
Previous:      v<MAJOR>.<N-1>
```

## Severity

| Level | Meaning |
|---|---|
| P0 | An advertised path is broken end to end. |
| P1 | Docs, discovery or UI contradict live behaviour, a marketed surface fails, or a security or permission boundary is wrong. |
| P2 | Real friction with a known workaround. |
| P3 | Polish. |

## Surface

`API` · `UI` · `Both` (the same underlying bug seen in both places is **one** ticket with `Both`).

## Status

| Status | Use when |
|---|---|
| OPEN | Still broken or not improved. |
| PARTIAL | The core failure is fixed; a residual remains (docs lag, one path still fails, a second role still sees it). Say what remains. |
| FIXED | A live re-check passes for the **original** failure mode. Write `FIXED (live verified YYYY-MM-DD)`. |
| ALIAS | A duplicate folded into a canonical ticket: `ALIAS → <ID>`. Never counted twice. |

IDs never change and are never reused. A ticket that breaks again after FIXED reopens under the same ID with a `regressed YYYY-MM-DD` note.

## Ticket

```markdown
### <PREFIX>-<NNN> · <one-line title stating the wrong behaviour>

| Field | Value |
|---|---|
| Severity | P0 / P1 / P2 / P3 |
| Surface | API / UI / Both |
| Status | OPEN / PARTIAL / FIXED (live verified YYYY-MM-DD) / ALIAS → <ID> |
| Seen by | <personas or roles> |
| First seen / last checked | YYYY-MM-DD / YYYY-MM-DD |

**Repro**
1. <exact request or click path, with the role and credential type, never the secret>
2. ...

**Expected** <what the docs or the obvious contract say should happen, with a link>

**Actual** <status, content type, a short body or header quote, or the exact on-screen text>

**Evidence** <file names or screenshot names in your evidence store; timestamps with zone>

**Expected fix** <the code, docs or UI change that would close it>

**Verify** <a re-runnable check: a curl with placeholders for secrets, or UI steps, and the answer that means FIXED>

**History** <date: status change and why>
```

## Re-check rules

1. Changelog or release notes are **leads, not evidence**. Only a live re-check moves a status.
2. Re-check the original failure mode exactly. A different path working does not make the ticket FIXED; it may make it PARTIAL.
3. When two honest measurements disagree (different roles, different paths, different times), keep the ticket OPEN (or PARTIAL if the core path works), record both with evidence, and plan a controlled settle test.
4. A workaround that needed a human (a one-time code, a personal password, a person clicking) never closes a ticket about autonomy.
5. Re-check every open P0 and P1 before each fold, and say when one was not re-checked.
6. Keep fold re-checks small (about ten calls, a few seconds apart) unless the run is a full sweep.
7. Never put live secrets, signing secrets, claim links, tokens or wallet keys in a ticket or a verify command.

## Untestable items

List each item that could not be tested with exactly one blocker class and the unlock that was tried:

| Class | Meaning |
|---|---|
| needs-claimed-workspace | Only a sandbox was available. |
| needs-session-write | The role's write was not performed or the role was not granted. |
| needs-payment | Behind a 402, day pass or top-up. |
| staff-only | Only staff can ever reach it. |
| no-observable-signal | Nothing public shows the behaviour. |

Report counts by class and the trend against the previous run.

## Short summary (one page)

Completion line · counts · open by severity and surface · what changed since the previous version · one line per new ticket · top ten priority queue · spend line · leftover access (keys, workspaces, invites created and whether removed, with expiry).
