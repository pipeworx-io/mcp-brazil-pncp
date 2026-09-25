# mcp-brazil-pncp

Brazil PNCP MCP — Brazilian government procurement (keyless).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1683+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `brazil_search_contracts` | Search signed Brazilian government contracts (contratos) from the official PNCP portal (Portal Nacional de Contratações Públicas). Covers federal, state, and municipal agencies under Lei 14.133/2021. Returns each contract with its PNCP control id, object (Portuguese), global value in BRL, supplier name and tax id (CNPJ/CPF), contracting agency, state/municipality, and signing/validity dates. Dates are YYYYMMDD and filter by PNCP publication date; omit them to get roughly the last 30 days. |
| `brazil_search_tenders` | Search published Brazilian government tenders / bidding notices (contratações / editais) from the official PNCP portal (Portal Nacional de Contratações Públicas). These are open or recently published procurement opportunities under Lei 14.133/2021. Returns each tender with its PNCP control id, object (Portuguese), estimated value in BRL, procurement modality, agency, state/municipality, proposal open/close dates, and a link to the source system. Dates are YYYYMMDD filtering by PNCP publication date; omit for roughly the last 30 days. The modality defaults to 6 (Pregão Eletrônico), the most common; pass another code to filter differently. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "brazil-pncp": {
      "url": "https://gateway.pipeworx.io/brazil-pncp/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/brazil-pncp/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1683+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/brazil_search_contracts \
  -H 'Content-Type: application/json' \
  -d '{"date_from":"20260401","date_to":"20260501"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/brazil_search_contracts`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "brazil-pncp": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-brazil-pncp"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-brazil-pncp
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Brazil Pncp data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
