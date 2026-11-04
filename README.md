# Agent Stack Data — MCP Server

A curated, verified catalog of 30 tools for AI agents — web search APIs, voice & transcription, MCP platforms, automation, and data/enrichment — with entry pricing checked against vendor pages.

**Live endpoint:** `https://agentstackdata.com/mcp` (Streamable HTTP, stateless, no auth)
**Website:** https://agentstackdata.com
**Official MCP Registry:** `com.agentstackdata/agentstack`

## Connect a client

```json
{
  "mcpServers": {
    "agentstack-mcp": {
      "url": "https://agentstackdata.com/mcp"
    }
  }
}
```

## Tools

| Tool | Description |
|---|---|
| `search_tools` | Search the Agent Stack Data verified catalog of tools. Returns a compact ranked shortlist with prices and links. |
| `get_tool` | Get the full verified record for one tool by name. |
| `compare_tools` | Compare two or more tools side by side on key specs and price. |
| `list_categories` | List the catalog categories with item counts. |
| `catalog_info` | About this catalog: coverage, item count, last update, and usage terms. |

## Run it yourself

The server is a single Cloudflare Worker (`src/worker.js`) with its dataset
bundled in `data/` — the same code that serves the live endpoint, with the
dataset snapshotted from https://agentstackdata.com/data/tools.json.

```bash
npm install
npx wrangler dev      # local
npx wrangler deploy   # your own Cloudflare account
```

## Data and attribution

The catalog data is free to use and cite with a link back to
https://agentstackdata.com. Prices are verified against vendor pages when the
dataset is updated; the live dataset (and its changelog) is at
https://agentstackdata.com/data/tools.json. Some product links are affiliate links — see the
site's affiliate disclosure page.

## License

MIT (code). Catalog data: free with attribution, as above.
