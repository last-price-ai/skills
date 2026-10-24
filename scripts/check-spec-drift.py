#!/usr/bin/env python3
"""Check the Last Price OpenAPI spec for drift and verify skill paths.

1. Fetches the live OpenAPI JSON and diffs its "METHOD /path" operations
   against the committed snapshot (spec/paths.snapshot.txt).
2. Extracts every API path mentioned in skills/*/SKILL.md and reports any
   that no longer exist in the live spec.

Exit code: 0 = no drift, 1 = drift or missing skill paths, 2 = fetch error.
Use --update to rewrite the snapshot after the skills have been re-verified.
Standard library only.
"""
import argparse, json, pathlib, re, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / "spec" / "paths.snapshot.txt"
DEFAULT_URL = "https://api.last-price.ai/api/openapi.json"
METHODS = ("get", "post", "put", "patch", "delete")
# Served but not listed in the spec, or used as a prefix in prose.
KNOWN_OK = {"/api/openapi.json", "/api/commerce"}
PATH_RE = re.compile(r"(/(?:api|\.well-known)/[A-Za-z0-9_\-./{}]*[A-Za-z0-9_}\-])")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "last-price-skills/drift-check"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def operations(spec):
    return sorted(f"{m.upper()} {p}" for p, ops in spec.get("paths", {}).items() for m in ops if m in METHODS)


def to_regex(path):
    # treat any {param} in the spec as a single path segment
    return re.compile("^" + re.sub(r"\\\{[^}]+\\\}", r"[^/]+", re.escape(path)) + "$")


def skill_paths():
    found = {}
    for f in sorted((ROOT / "skills").glob("*/SKILL.md")):
        for m in PATH_RE.finditer(f.read_text()):
            p = m.group(1).rstrip(".")
            found.setdefault(p, set()).add(f.parent.name)
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--update", action="store_true", help="rewrite the snapshot from the live spec")
    a = ap.parse_args()
    try:
        spec = fetch(a.url)
    except Exception as e:  # noqa: BLE001
        print(f"error: could not fetch {a.url}: {e}", file=sys.stderr)
        return 2
    live = operations(spec)
    if a.update:
        SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
        SNAPSHOT.write_text("\n".join(live) + "\n")
        print(f"snapshot updated: {len(live)} operations (spec version {spec.get('info', {}).get('version')})")
        return 0

    status = 0
    snap = SNAPSHOT.read_text().split("\n") if SNAPSHOT.exists() else []
    snap = [s for s in snap if s.strip()]
    added, removed = sorted(set(live) - set(snap)), sorted(set(snap) - set(live))
    print(f"live operations: {len(live)}, snapshot: {len(snap)}")
    if added or removed:
        status = 1
        print(f"\n## Added in live spec ({len(added)})")
        print("\n".join(f"+ {x}" for x in added) or "(none)")
        print(f"\n## Removed from live spec ({len(removed)})")
        print("\n".join(f"- {x}" for x in removed) or "(none)")
    else:
        print("no operation drift against snapshot")

    regs = [to_regex(p) for p in spec.get("paths", {})]
    missing = {}
    for p, skills in skill_paths().items():
        base = p.split("?")[0]
        if base in KNOWN_OK:
            continue
        if not any(r.match(base) for r in regs):
            missing[p] = skills
    if missing:
        status = 1
        print(f"\n## Paths mentioned in skills but not in live spec ({len(missing)})")
        for p, s in sorted(missing.items()):
            print(f"! {p}  ({', '.join(sorted(s))})")
    else:
        print("all skill-referenced paths exist in the live spec")
    return status


if __name__ == "__main__":
    sys.exit(main())
