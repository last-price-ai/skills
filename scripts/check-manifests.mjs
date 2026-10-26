#!/usr/bin/env node
// Checks that the plugin manifests for each assistant agree: same name,
// same version, same MCP server URL, and every path they name exists.
// Node 18+, no dependencies. Exit 1 on any mismatch.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const SERVER_URL = "https://api.last-price.ai/api/mcp/rpc";
// Every plugin uses the directory tool set: no wallet, top-up, spend-session or payout tools.

const claude = read(".claude-plugin/plugin.json");
const cursor = read(".cursor-plugin/plugin.json");
const cursorMcp = read(".cursor-plugin/mcp.json");
const openai = read("plugin.json");
const openaiMcp = read("mcp.json");
const openaiMarket = read(".agents/plugins/marketplace.json");
const gemini = read("gemini-extension.json");
const openclaw = read("openclaw.plugin.json");
const npmPackage = read("package.json");

const errors = [];
const expect = (ok, message) => {
  if (!ok) errors.push(message);
};

const manifests = { claude, cursor, openai, gemini };
for (const [label, m] of Object.entries(manifests)) {
  expect(m.name === "lastprice", `${label}: name is ${m.name}, expected lastprice`);
  expect(m.version === claude.version, `${label}: version ${m.version} differs from Claude's ${claude.version}`);
}

// Each assistant calls the same server with its own listing tag, so Last
// Price can tell which install a call came from. The tag never changes an
// answer; an unknown tag is ignored by the server.
const urls = [
  ["claude plugin.json", claude.mcpServers?.lastprice?.url, "claude-plugin"],
  ["cursor mcp.json", cursorMcp.mcpServers?.lastprice?.url, "cursor-plugin"],
  ["openai mcp.json", openaiMcp.mcpServers?.lastprice?.url, "openai-plugin"],
  ["gemini-extension.json", gemini.mcpServers?.lastprice?.httpUrl, "gemini-cli"],
  ["openclaw.plugin.json", openclaw.mcpServers?.lastprice?.url, "openclaw"],
];
for (const [label, url, via] of urls) {
  const expected = `${SERVER_URL}?profile=directory&via=${via}`;
  expect(url === expected, `${label}: server URL is ${url}, expected ${expected}`);
}

expect(openclaw.id === "lastprice", `openclaw.plugin.json: id is ${openclaw.id}, expected lastprice`);
expect(openclaw.version === claude.version, `openclaw.plugin.json: version ${openclaw.version} differs from Claude's ${claude.version}`);

// ClawHub names the plugin after the publisher scope and packs only `files`,
// so payments/ never ships.
expect(npmPackage.name === "@last-price/lastprice", `package.json: name is ${npmPackage.name}, expected @last-price/lastprice`);
expect(npmPackage.version === claude.version, `package.json: version ${npmPackage.version} differs from Claude's ${claude.version}`);
expect(
  Array.isArray(npmPackage.files) && !npmPackage.files.some((f) => f.startsWith("payments")),
  "package.json: files must list what ships and leave out payments/",
);
expect(
  JSON.stringify(openclaw.skills) === JSON.stringify(["skills"]),
  "openclaw.plugin.json: skills must be [\"skills\"] (never payments/)",
);

const keyRef = claude.mcpServers?.lastprice?.headers?.["x-api-key"];
expect(keyRef === "${user_config.api_key}", "claude plugin.json: x-api-key must read ${user_config.api_key}");
expect(claude.userConfig?.api_key?.sensitive === true, "claude plugin.json: userConfig.api_key must be sensitive");
const geminiKey = gemini.mcpServers?.lastprice?.headers?.["x-api-key"];
expect(geminiKey === "${LASTPRICE_API_KEY:-}", "gemini-extension.json: x-api-key must default to empty when no key is set");
expect(
  gemini.settings?.some((s) => s.envVar === "LASTPRICE_API_KEY" && s.sensitive === true),
  "gemini-extension.json: LASTPRICE_API_KEY must be a sensitive setting",
);
expect(
  openaiMarket.plugins?.some((p) => p.name === "lastprice" && p.source?.path === "./"),
  ".agents/plugins/marketplace.json: lastprice entry must point at ./",
);

const paths = [
  claude.icon,
  cursor.logo,
  cursor.mcpServers,
  openai.extensions?.["com.openai"]?.interface?.logo,
  openai.extensions?.["com.openai"]?.interface?.composerIcon,
  gemini.contextFileName,
  ...(npmPackage.files ?? []),
].filter(Boolean);
for (const p of paths) {
  expect(existsSync(join(root, p)), `missing file named by a manifest: ${p}`);
}

if (errors.length) {
  console.error(errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}
console.log(`Manifests agree: lastprice ${claude.version}, ${SERVER_URL}`);
