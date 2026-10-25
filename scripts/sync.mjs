#!/usr/bin/env node
// Keeps the skill pack in step with the live Last Price API.
//
//   node scripts/sync.mjs            rebuild every skills/*/references/mcp-tools*.md
//   node scripts/sync.mjs --check    change nothing; exit 1 on any drift
//
// It reads the connector's live tool list (MCP tools/list, no key needed) and
// the live OpenAPI spec, then checks that:
//   - every tool the connector offers is named in at least one SKILL.md,
//   - every tool a skill names still exists, with the same required arguments,
//   - every API path in tool-paths.json is still in the OpenAPI spec,
//   - every `tool_name` written in a SKILL.md is a real tool.
// Point it elsewhere with --tools <file.json> and --openapi <file.json>, or
// LASTPRICE_MCP_URL and LASTPRICE_OPENAPI_URL. Node 18 or later, no dependencies.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const CHECK = args.includes('--check');
const MCP_URL = process.env.LASTPRICE_MCP_URL ?? 'https://api.last-price.ai/api/mcp/rpc';
const OPENAPI_URL = process.env.LASTPRICE_OPENAPI_URL ?? 'https://api.last-price.ai/api/openapi.json';

// Tools only Last Price staff can call. They never go in a public skill.
const STAFF_ONLY = new Set(['list_feature_launches', 'get_feature_launch_plan']);

// Tools that answer with no credential (the server's KEYLESS_TOOL_NAMES).
const KEYLESS = new Set(JSON.parse(readFileSync(join(ROOT, 'keyless-tools.json'), 'utf8')));

// snake_case words a SKILL.md may use that are arguments or fields, not tools.
const KNOWN_NON_TOOLS = new Set(JSON.parse(readFileSync(join(ROOT, 'non-tool-words.json'), 'utf8')));

async function rpc(method, params, sessionId) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: method, method, params }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} failed (${res.status}): ${text.slice(0, 300)}`);
  const json = text.startsWith('{') ? text : text.split('\n').find((l) => l.startsWith('data:'))?.slice(5);
  return { body: JSON.parse(json), sessionId: res.headers.get('mcp-session-id') ?? sessionId };
}

async function liveTools() {
  const init = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'lastprice-skill-pack-sync', version: '1' },
  });
  const tools = [];
  let cursor;
  do {
    const { body } = await rpc('tools/list', cursor ? { cursor } : {}, init.sessionId);
    tools.push(...body.result.tools);
    cursor = body.result.nextCursor;
  } while (cursor);
  return tools;
}

async function loadTools() {
  const file = flag('--tools');
  if (file) return JSON.parse(readFileSync(file, 'utf8'));
  return liveTools();
}

async function loadOpenApi() {
  const file = flag('--openapi');
  if (file) return JSON.parse(readFileSync(file, 'utf8'));
  const res = await fetch(OPENAPI_URL, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`OpenAPI fetch failed (${res.status})`);
  return res.json();
}

// The sentences of a description that say when a call is refused or fails.
const ERROR_HINT = /refus|answers \d{3}|\(\d{3}\)|\b40[0-9]\b|\b42[29]\b|not_released|not released|not enabled|not switched on|only where|an error|limited per|cannot be undone|needs a claimed/i;
function errorNotes(description) {
  return description
    .split(/(?<=\.)\s+/)
    .filter((s) => ERROR_HINT.test(s))
    .filter((s) => !/^Needs a claimed workspace: a sandbox key/.test(s));
}

function claimedOnly(description) {
  return /sandbox key from self-registration is refused \(403\)/.test(description);
}

function access(tool) {
  const d = tool.description;
  if (KEYLESS.has(tool.name)) return 'no key needed (answers from a public demo without one; a key gives your own workspace)';
  if (/Public: needs no|Needs no credential|Public and limited/.test(d)) return 'no key';
  const scope = d.match(/credential with (?:the )?([a-z: ]+?) scope/i)?.[1];
  return scope ? `key, ${scope} scope` : 'key';
}

function hints(tool) {
  const a = tool.annotations ?? {};
  const out = [];
  if (a.readOnlyHint) out.push('read-only');
  if (a.destructiveHint) out.push('**destructive**');
  if (a.openWorldHint) out.push('reaches outside Last Price');
  return out.join(', ') || 'changes data';
}

function argsTable(tool) {
  const schema = tool.inputSchema ?? {};
  const required = new Set(schema.required ?? []);
  const props = Object.entries(schema.properties ?? {});
  if (props.length === 0) return '_No arguments._\n';
  const rows = props.map(([name, p]) => {
    const type = p.enum ? p.enum.map((v) => `\`${v}\``).join(' / ') : (p.type ?? (p.oneOf || p.anyOf ? 'one of several' : 'any'));
    const desc = (p.description ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|');
    return `| \`${name}\`${required.has(name) ? ' **(required)**' : ''} | ${Array.isArray(type) ? type.join(' / ') : type} | ${desc} |`;
  });
  return ['| Argument | Type | Meaning |', '| :-- | :-- | :-- |', ...rows].join('\n') + '\n';
}

function referenceFor(skill, names, byName, paths) {
  const lines = [
    `# ${skill}: tool reference`,
    '',
    '<!-- Generated by scripts/sync.mjs from the live tools/list. Do not edit by hand. -->',
    '',
    'Every tool below is on the Last Price MCP server (`https://api.last-price.ai/api/mcp/rpc`).',
    'A tool missing from your own `tools/list` is not switched on for your connection yet.',
    '',
  ];
  for (const name of names) {
    const tool = byName.get(name);
    lines.push(`## \`${name}\``, '');
    lines.push(tool.description.replace(/\s+/g, ' '), '');
    lines.push(`- **Access:** ${access(tool)}${claimedOnly(tool.description) ? ' (claimed workspace only: a self-registered sandbox key gets 403)' : ''}`);
    lines.push(`- **Behaviour:** ${hints(tool)}`);
    if (paths[name]) lines.push(`- **REST:** ${paths[name].map((p) => `\`${p}\``).join(', ')}`);
    const errs = errorNotes(tool.description);
    if (errs.length) lines.push(`- **Errors and cautions:** ${errs.join(' ')}`);
    lines.push('', argsTable(tool));
  }
  return lines.join('\n');
}

// The Claude plugin directory scans files only up to 256 KiB, so a reference
// over PART_BYTES becomes an index (mcp-tools.md) plus mcp-tools-<n>.md parts.
const PART_BYTES = 200_000;
function referenceFiles(skill, names, byName, paths) {
  const whole = referenceFor(skill, names, byName, paths);
  if (Buffer.byteLength(whole) <= PART_BYTES) return { 'mcp-tools.md': whole };
  const parts = [];
  for (const name of names) {
    const section = referenceFor(skill, [name], byName, paths).split('\n').slice(7).join('\n');
    const last = parts[parts.length - 1];
    if (last && Buffer.byteLength(last.text) + Buffer.byteLength(section) < PART_BYTES) {
      last.text += '\n' + section;
      last.names.push(name);
    } else parts.push({ names: [name], text: section });
  }
  const files = {};
  const index = [
    `# ${skill}: tool reference`,
    '',
    '<!-- Generated by scripts/sync.mjs from the live tools/list. Do not edit by hand. -->',
    '',
    'Every tool below is on the Last Price MCP server (`https://api.last-price.ai/api/mcp/rpc`).',
    'A tool missing from your own `tools/list` is not switched on for your connection yet.',
    `The reference is split into ${parts.length} files; this index says which file holds each tool.`,
    '',
  ];
  parts.forEach((part, i) => {
    const file = `mcp-tools-${i + 1}.md`;
    files[file] = [`# ${skill}: tool reference, part ${i + 1} of ${parts.length}`, '', '<!-- Generated by scripts/sync.mjs from the live tools/list. Do not edit by hand. -->', '', 'Index: [mcp-tools.md](mcp-tools.md).', '', part.text].join('\n');
    index.push(`- [${file}](${file}): ${part.names.map((n) => `\`${n}\``).join(', ')}`);
  });
  files['mcp-tools.md'] = index.join('\n') + '\n';
  return files;
}

const problems = [];
const drift = [];

const [tools, openapi] = await Promise.all([loadTools(), loadOpenApi()]);
const byName = new Map(tools.map((t) => [t.name, t]));
// Which skill covers which tool: every tool written as `tool_name` in a
// skill's SKILL.md. A tool may appear in several skills.
const skillDir = join(ROOT, 'skills');
const skills = {};
for (const dir of readdirSync(skillDir).sort()) {
  const file = join(skillDir, dir, 'SKILL.md');
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  skills[dir] = [...new Set([...text.matchAll(/`([a-z][a-z0-9_]*)`/g)].map((m) => m[1]).filter((w) => byName.has(w)))];
}
const paths = JSON.parse(readFileSync(join(ROOT, 'tool-paths.json'), 'utf8'));
const required = existsSync(join(ROOT, 'required-args.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'required-args.json'), 'utf8'))
  : {};

// 1. Every tool the connector offers is named by at least one skill, and
//    every tool the last review knew about still exists.
const owner = new Map();
for (const [skill, names] of Object.entries(skills)) for (const name of names) if (!owner.has(name)) owner.set(name, skill);
for (const name of byName.keys()) {
  if (!owner.has(name) && !STAFF_ONLY.has(name)) problems.push(`new tool ${name} is not named in any skill`);
}
for (const name of Object.keys(required)) {
  if (!byName.has(name)) problems.push(`${name} is gone from the connector; remove it from the skills that name it`);
}

// 2. Required arguments unchanged since the skills were last reviewed.
for (const [name, was] of Object.entries(required)) {
  const now = byName.get(name)?.inputSchema?.required ?? [];
  if (byName.has(name) && [...now].sort().join(',') !== [...was].sort().join(',')) {
    problems.push(`${name} required arguments changed: was [${was}], now [${now}]`);
  }
}

// 3. API paths still in the OpenAPI spec.
const specPaths = Object.keys(openapi.paths ?? {});
for (const [name, list] of Object.entries(paths)) {
  for (const p of list) if (!specPaths.includes(p)) problems.push(`${name} calls ${p}, which the OpenAPI spec no longer has`);
}

// 4. Tool names written in the SKILL.md files are real.
// A snake_case word is fine when it is a tool, an argument of one, or a word
// the tool descriptions or the OpenAPI spec use (a field or code in an answer).
const knownWords = new Set(KNOWN_NON_TOOLS);
for (const t of tools) {
  for (const k of Object.keys(t.inputSchema?.properties ?? {})) knownWords.add(k);
  for (const [w] of t.description.matchAll(/[a-z][a-z0-9]*(?:_[a-z0-9]+)+/g)) knownWords.add(w);
}
for (const [w] of JSON.stringify(openapi).matchAll(/[a-z][a-z0-9]*(?:_[a-z0-9]+)+/g)) knownWords.add(w);
for (const dir of readdirSync(skillDir)) {
  const file = join(skillDir, dir, 'SKILL.md');
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const [, word] of text.matchAll(/`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/g)) {
    if (/^[a-z]+_[a-z_]+$/.test(word) && !byName.has(word) && !knownWords.has(word)) {
      problems.push(`${dir}/SKILL.md mentions \`${word}\`, which no tool takes or returns`);
    }
  }
}

// 5. Regenerate (or compare) the references.
for (const [skill, names] of Object.entries(skills)) {
  if (names.length === 0) continue;
  const refDir = join(skillDir, skill, 'references');
  const files = referenceFiles(skill, names, byName, paths);
  const stale = existsSync(refDir) ? readdirSync(refDir).filter((f) => /^mcp-tools-\d+\.md$/.test(f) && !(f in files)) : [];
  for (const f of stale) {
    drift.push(join(refDir, f).slice(ROOT.length + 1));
    if (!CHECK) rmSync(join(refDir, f));
  }
  for (const [name, next] of Object.entries(files)) {
    const file = join(refDir, name);
    const prev = existsSync(file) ? readFileSync(file, 'utf8') : '';
    if (prev !== next) {
      drift.push(file.slice(ROOT.length + 1));
      if (!CHECK) { mkdirSync(refDir, { recursive: true }); writeFileSync(file, next); }
    }
  }
}

if (!CHECK && !args.includes('--keep-required')) {
  const snapshot = Object.fromEntries([...owner.keys()].filter((n) => byName.has(n)).sort().map((n) => [n, byName.get(n).inputSchema?.required ?? []]));
  writeFileSync(join(ROOT, 'required-args.json'), JSON.stringify(snapshot, null, 1) + '\n');
}

console.log(`${byName.size} tools, ${specPaths.length} API paths, ${Object.keys(skills).length} skills`);
for (const p of problems) console.log(`PROBLEM ${p}`);
for (const d of drift) console.log(`${CHECK ? 'STALE' : 'UPDATED'} ${d}`);
process.exit(problems.length > 0 || (CHECK && drift.length > 0) ? 1 : 0);
