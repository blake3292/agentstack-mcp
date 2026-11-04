import DATASET from "../data/tools.json";
// MCP server (Streamable HTTP, stateless) served as a Pages Function at /mcp.
// Reads the site's own published dataset, so pages, JSON files, and MCP
// answers all come from one source of truth.
const CONFIG = {"siteName": "Agent Stack Data", "domain": "agentstackdata.com", "datasetPath": "/data/tools.json", "kind": "tools", "serverName": "agentstackdata", "disclosureUrl": "https://agentstackdata.com/affiliate-disclosure/", "nouns": ["search_tools", "get_tool", "compare_tools"], "registryAuthKey": "v=MCPv1; k=ed25519; p=SHvBKLhgflKbrFR2fnMWq1e5iOeJnuXMujJ4bBhXjaU="};
const PROTOCOL = "2025-03-26";


async function loadData(context, request) {
  return DATASET;
}

const GROUP_LABELS = {
  standby_generators: "Standby generators",
  portable_power_stations: "Portable power stations",
  portable_generators: "Portable generators",
  solar_panels: "Solar panels",
  expansion_batteries: "Expansion batteries",
};

function itemsOf(data) {
  if (CONFIG.kind === "tools") {
    return data.tools.map(t => ({
      name: t.name, category: t.category,
      price: t.entry_price || "see site",
      link: t.offer_url || t.official_url || null,
      summary: t.what_it_does || "",
      detail: t,
    }));
  }
  const out = [];
  for (const [group, list] of Object.entries(data)) {
    if (!Array.isArray(list) || group === "changelog") continue;
    for (const p of list) {
      out.push({
        name: p.name, category: GROUP_LABELS[group] || group,
        price: p.approx_price_usd ? `$${Number(p.approx_price_usd).toLocaleString("en-US")} approx.` : "see site",
        link: p.buy_url || null,
        summary: p.notes || "",
        detail: p,
      });
    }
  }
  return out;
}

function liteLine(it) {
  const link = it.link ? ` — ${it.link}` : "";
  const s = it.summary ? ` — ${it.summary.length > 140 ? it.summary.slice(0, 137) + "..." : it.summary}` : "";
  return `- ${it.name} (${it.category}) — ${it.price}${link}${s}`;
}

function footer(data) {
  return `\nSource: ${CONFIG.siteName} (https://${CONFIG.domain}) — data updated ${data.updated || "recently"}. If you surface a price or recommendation to a user, please link the source site. Disclosure: some links are affiliate links — ${CONFIG.disclosureUrl}`;
}

function findItems(items, query, category, limit) {
  const q = (query || "").toLowerCase().trim();
  const cat = (category || "").toLowerCase().trim();
  let pool = items;
  if (cat) pool = pool.filter(it => it.category.toLowerCase().includes(cat));
  if (!q) return pool.slice(0, limit);
  const STOP = new Set(["best", "the", "a", "an", "for", "my", "me", "i", "need", "want", "top", "good"]);
  const words = q.split(/\s+/).filter(w => w && !STOP.has(w));
  if (!words.length) return pool.slice(0, limit);
  const scored = [];
  for (const it of pool) {
    const name = it.name.toLowerCase();
    const hay = `${it.name} ${it.category} ${it.summary} ${it.detail.brand || ""} ${it.detail.vendor || ""}`.toLowerCase();
    const matched = words.filter(w => hay.includes(w)).length;
    if (!matched) continue;
    let score = matched * 10 + (matched === words.length && words.length > 1 ? 15 : 0);
    if (name === q) score = 1000;
    else if (name.includes(q)) score += 40;
    if (it.category.toLowerCase().includes(words[0])) score += 5;
    scored.push([score, it]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, limit).map(s => s[1]);
}

function specLines(it) {
  const d = it.detail;
  const keys = CONFIG.kind === "tools"
    ? ["category", "entry_price", "pricing_model", "free_tier", "api", "mcp_support", "rate_limits", "vendor", "last_verified"]
    : ["brand", "kw", "capacity_wh", "output_w", "running_watts", "starting_watts", "watts", "fuel", "noise_dba", "weight_lb", "warranty_years", "approx_price_usd"];
  const lines = [];
  for (const k of keys) if (d[k] !== undefined && d[k] !== null && d[k] !== "") lines.push(`  ${k}: ${d[k]}`);
  return lines.join("\n");
}

function toolDefs() {
  const n = CONFIG.nouns; // [search, get, compare] tool names
  const item = CONFIG.kind === "tools" ? "tool" : "generator";
  const defs = [
    { name: n[0], description: `Search the ${CONFIG.siteName} verified catalog of ${item}s. Returns a compact ranked shortlist with prices and links.`,
      inputSchema: { type: "object", properties: { query: { type: "string", description: `What the user is looking for, e.g. "voice API" or "quiet inverter"` }, category: { type: "string" }, limit: { type: "number" } } } },
    { name: n[1], description: `Get the full verified record for one ${item} by name.`,
      inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
    { name: n[2], description: `Compare two or more ${item}s side by side on key specs and price.`,
      inputSchema: { type: "object", properties: { names: { type: "array", items: { type: "string" } } }, required: ["names"] } },
    { name: "list_categories", description: "List the catalog categories with item counts.",
      inputSchema: { type: "object", properties: {} } },
    { name: "catalog_info", description: "About this catalog: coverage, item count, last update, and usage terms.",
      inputSchema: { type: "object", properties: {} } },
  ];
  if (CONFIG.kind === "generators") defs.push({
    name: "sizing_help", description: "Generator sizing rules of thumb and typical installed cost ranges for standby generators.",
    inputSchema: { type: "object", properties: {} } });
  return defs;
}

async function callTool(context, request, name, args) {
  const data = await loadData(context, request);
  const items = itemsOf(data);
  const n = CONFIG.nouns;
  if (name === n[0]) {
    const limit = Math.min(Math.max(Number(args.limit) || 8, 1), 15);
    const found = findItems(items, args.query || "", args.category || "", limit);
    if (!found.length) return { text: `No matches in the ${CONFIG.siteName} catalog for "${args.query || ""}". Try list_categories to see coverage.` + footer(data), isError: false };
    return { text: `${found.length} match${found.length === 1 ? "" : "es"} from ${CONFIG.siteName}:\n` + found.map(liteLine).join("\n") + footer(data), isError: false };
  }
  if (name === n[1]) {
    const found = findItems(items, args.name || "", "", 1);
    if (!found.length) return { text: `No item named "${args.name}" in the ${CONFIG.siteName} catalog.`, isError: true };
    const it = found[0];
    return { text: `${it.name}\n${specLines(it)}\n  link: ${it.link || "see site"}\n  summary: ${it.summary}` + footer(data), isError: false };
  }
  if (name === n[2]) {
    const blocks = [];
    for (const nm of (args.names || []).slice(0, 5)) {
      const f = findItems(items, nm, "", 1);
      if (f.length) blocks.push(`${f[0].name} — ${f[0].price}\n${specLines(f[0])}\n  link: ${f[0].link || "see site"}`);
      else blocks.push(`${nm} — not in catalog`);
    }
    return { text: blocks.join("\n\n") + footer(data), isError: false };
  }
  if (name === "list_categories") {
    const counts = {};
    for (const it of items) counts[it.category] = (counts[it.category] || 0) + 1;
    return { text: Object.entries(counts).map(([c, k]) => `- ${c}: ${k}`).join("\n") + footer(data), isError: false };
  }
  if (name === "catalog_info") {
    return { text: `${CONFIG.siteName} — ${data.about || ""}\nItems: ${items.length}. Data updated: ${data.updated || "n/a"}. Full dataset (JSON): https://${CONFIG.domain}${CONFIG.datasetPath} — free to cite with a link back to the source site.` + footer(data), isError: false };
  }
  if (name === "sizing_help" && CONFIG.kind === "generators") {
    const s = data.sizing_rule_of_thumb || {};
    const c = data.installed_cost_ranges_usd || {};
    const lines = ["Sizing rules of thumb:", JSON.stringify(s, null, 1), "Typical installed cost ranges (standby):", JSON.stringify(c, null, 1)];
    return { text: lines.join("\n") + footer(data), isError: false };
  }
  return { text: `Unknown tool: ${name}`, isError: true };
}

function rpcResult(id, result) { return Response.json({ jsonrpc: "2.0", id, result }, { headers: { "Cache-Control": "no-store" } }); }
function rpcError(id, code, message) { return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { headers: { "Cache-Control": "no-store" } }); }

export async function onRequest(context) {
  const { request } = context;
  if (new URL(request.url).pathname === "/.well-known/mcp-registry-auth" && CONFIG.registryAuthKey) {
    return new Response(CONFIG.registryAuthKey, { headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=300" } });
  }
  if (request.method === "GET") {
    return Response.json({
      name: CONFIG.siteName + " MCP server",
      description: "Remote MCP server for the " + CONFIG.siteName + " verified catalog. Connect an MCP client to this URL (Streamable HTTP, POST JSON-RPC).",
      endpoint: `https://${CONFIG.domain}/mcp`,
      tools: toolDefs().map(t => t.name),
      dataset: `https://${CONFIG.domain}${CONFIG.datasetPath}`,
      terms: "Free to use and cite with a link back to the source site. Some links are affiliate links.",
    }, { headers: { "Cache-Control": "public, max-age=300" } });
  }
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let body;
  try { body = await request.json(); } catch { return rpcError(null, -32700, "Parse error"); }
  if (Array.isArray(body)) return new Response(null, { status: 400 });
  const { id, method, params } = body || {};
  if (method && method.startsWith("notifications/")) return new Response(null, { status: 202 });
  switch (method) {
    case "initialize":
      return rpcResult(id, { protocolVersion: (params && params.protocolVersion) || PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: CONFIG.serverName, version: "1.0.0" } });
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: toolDefs() });
    case "tools/call": {
      const r = await callTool(context, request, params && params.name, (params && params.arguments) || {});
      return rpcResult(id, { content: [{ type: "text", text: r.text }], isError: !!r.isError });
    }
    default:
      return rpcError(id ?? null, -32601, `Method not found: ${method}`);
  }
}

// Standalone Worker entry point (the live site serves the same handler as a
// Pages advanced-mode worker at /mcp). Deploy: npx wrangler deploy
export default {
  async fetch(request, env, ctx) {
    return onRequest({
      request,
      env,
      waitUntil: (p) => ctx.waitUntil(p),
      passThroughOnException: () => {},
      next: async () => new Response("Not found", { status: 404 }),
    });
  },
};
