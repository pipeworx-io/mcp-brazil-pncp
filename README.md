# mcp-brazil-pncp

Brazil PNCP MCP — Brazilian government procurement (keyless).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Brazil Pncp data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
