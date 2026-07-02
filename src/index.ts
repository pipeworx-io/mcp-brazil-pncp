interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Brazil PNCP MCP — Brazilian government procurement (keyless).
 *
 * Wraps the public, no-auth PNCP (Portal Nacional de Contratações Públicas)
 * consulta API at https://pncp.gov.br/api/consulta/v1. PNCP is the official
 * national portal aggregating public contracts and tenders (editais) for all
 * federal, state, and municipal agencies under Brazil's Lei 14.133/2021.
 *
 * Covers signed contracts (contratos) and published tenders/bids
 * (contratações) within a date range. Dates are YYYYMMDD; both tools default
 * to roughly the last 30 days when no range is supplied.
 *
 * Values and free-text fields are Portuguese (as published by PNCP); object
 * keys are English. All tools return shaped, LLM-friendly objects (not raw API
 * passthrough) and never throw — fetch/parse failures resolve to { error }.
 */


const BASE = 'https://pncp.gov.br/api/consulta/v1';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

// Procurement modalities (codigoModalidadeContratacao) under Lei 14.133/2021.
// The tenders endpoint REQUIRES one of these; default is 6 (Pregão Eletrônico),
// by far the most common modality.
const MODALITIES: Record<number, string> = {
  1: 'Leilão - Eletrônico',
  2: 'Diálogo Competitivo',
  3: 'Concurso',
  4: 'Concorrência - Eletrônica',
  5: 'Concorrência - Presencial',
  6: 'Pregão - Eletrônico',
  7: 'Pregão - Presencial',
  8: 'Dispensa de Licitação',
  9: 'Inexigibilidade',
  10: 'Manifestação de Interesse',
  11: 'Pré-qualificação',
  12: 'Credenciamento',
  13: 'Leilão - Presencial',
};

const tools: McpToolExport['tools'] = [
  {
    name: 'brazil_search_contracts',
    description:
      'Search signed Brazilian government contracts (contratos) from the official PNCP portal (Portal Nacional de Contratações Públicas). Covers federal, state, and municipal agencies under Lei 14.133/2021. Returns each contract with its PNCP control id, object (Portuguese), global value in BRL, supplier name and tax id (CNPJ/CPF), contracting agency, state/municipality, and signing/validity dates. Dates are YYYYMMDD and filter by PNCP publication date; omit them to get roughly the last 30 days.',
    inputSchema: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Start date (PNCP publication) as YYYYMMDD, e.g. "20260501". Defaults to ~30 days ago.' },
        date_to: { type: 'string', description: 'End date (PNCP publication) as YYYYMMDD, e.g. "20260601". Defaults to today.' },
        page: { type: ['number', 'string'], description: 'Page number (1-based). Default 1.' },
      },
    },
  },
  {
    name: 'brazil_search_tenders',
    description:
      'Search published Brazilian government tenders / bidding notices (contratações / editais) from the official PNCP portal (Portal Nacional de Contratações Públicas). These are open or recently published procurement opportunities under Lei 14.133/2021. Returns each tender with its PNCP control id, object (Portuguese), estimated value in BRL, procurement modality, agency, state/municipality, proposal open/close dates, and a link to the source system. Dates are YYYYMMDD filtering by PNCP publication date; omit for roughly the last 30 days. The modality defaults to 6 (Pregão Eletrônico), the most common; pass another code to filter differently.',
    inputSchema: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Start date (PNCP publication) as YYYYMMDD, e.g. "20260501". Defaults to ~30 days ago.' },
        date_to: { type: 'string', description: 'End date (PNCP publication) as YYYYMMDD, e.g. "20260601". Defaults to today.' },
        modality: {
          type: ['number', 'string'],
          description:
            'Procurement modality code (codigoModalidadeContratacao). REQUIRED by the API; defaults to 6 (Pregão Eletrônico). Others: 4=Concorrência Eletrônica, 8=Dispensa, 9=Inexigibilidade, 12=Credenciamento, 3=Concurso, 1=Leilão Eletrônico.',
        },
        page: { type: ['number', 'string'], description: 'Page number (1-based). Default 1.' },
      },
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'brazil_search_contracts':
        return await searchContracts(args);
      case 'brazil_search_tenders':
        return await searchTenders(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function searchContracts(args: Record<string, unknown>): Promise<unknown> {
  const { from, to } = dateRange(args);
  const page = pageArg(args.page);
  const params = new URLSearchParams({ dataInicial: from, dataFinal: to, pagina: page });
  const data = (await pncpGet(`/contratos?${params.toString()}`)) as PncpPage;
  const contracts = (data.data ?? []).map((c: any) => ({
    id: c.numeroControlePNCP ?? c.numeroControlePncpCompra,
    object: clean(c.objetoContrato),
    value_brl: c.valorGlobal,
    initial_value_brl: c.valorInicial,
    supplier: c.nomeRazaoSocialFornecedor,
    supplier_tax_id: c.niFornecedor,
    supplier_type: c.tipoPessoa,
    agency: c.orgaoEntidade?.razaoSocial,
    agency_tax_id: c.orgaoEntidade?.cnpj,
    unit: c.unidadeOrgao?.nomeUnidade,
    state: c.unidadeOrgao?.ufSigla,
    municipality: c.unidadeOrgao?.municipioNome,
    category: c.categoriaProcesso?.nome,
    contract_number: str(c.numeroContratoEmpenho),
    signed_date: c.dataAssinatura,
    validity_start: c.dataVigenciaInicio,
    validity_end: c.dataVigenciaFim,
    published_at: c.dataPublicacaoPncp,
  }));
  return {
    date_from: from,
    date_to: to,
    page: data.numeroPagina ?? Number(page),
    total_records: data.totalRegistros ?? contracts.length,
    total_pages: data.totalPaginas ?? 1,
    count: contracts.length,
    contracts,
  };
}

async function searchTenders(args: Record<string, unknown>): Promise<unknown> {
  const { from, to } = dateRange(args);
  const page = pageArg(args.page);
  const modality = modalityArg(args.modality);
  const params = new URLSearchParams({
    dataInicial: from,
    dataFinal: to,
    codigoModalidadeContratacao: modality,
    pagina: page,
  });
  const data = (await pncpGet(`/contratacoes/publicacao?${params.toString()}`)) as PncpPage;
  const tenders = (data.data ?? []).map((t: any) => ({
    id: t.numeroControlePNCP,
    object: clean(t.objetoCompra),
    estimated_value_brl: t.valorTotalEstimado,
    awarded_value_brl: t.valorTotalHomologado,
    modality: t.modalidadeNome ?? MODALITIES[Number(modality)],
    modality_code: t.modalidadeId ?? Number(modality),
    dispute_mode: t.modoDisputaNome,
    price_registration: t.srp,
    agency: t.orgaoEntidade?.razaoSocial,
    agency_tax_id: t.orgaoEntidade?.cnpj,
    unit: t.unidadeOrgao?.nomeUnidade,
    state: t.unidadeOrgao?.ufSigla,
    municipality: t.unidadeOrgao?.municipioNome,
    status: t.situacaoCompraNome,
    legal_basis: t.amparoLegal?.nome,
    process: str(t.processo),
    proposal_open: t.dataAberturaProposta,
    proposal_close: t.dataEncerramentoProposta,
    published_at: t.dataPublicacaoPncp,
    source_link: t.linkSistemaOrigem,
  }));
  return {
    date_from: from,
    date_to: to,
    modality: MODALITIES[Number(modality)] ?? modality,
    modality_code: Number(modality),
    page: data.numeroPagina ?? Number(page),
    total_records: data.totalRegistros ?? tenders.length,
    total_pages: data.totalPaginas ?? 1,
    count: tenders.length,
    tenders,
  };
}

interface PncpPage {
  data?: unknown[];
  totalRegistros?: number;
  totalPaginas?: number;
  numeroPagina?: number;
}

async function pncpGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  // PNCP returns 204 (no content) for date ranges/pages with zero results.
  if (res.status === 204) return { data: [], totalRegistros: 0, totalPaginas: 0 };
  if (!res.ok) {
    const body = await res.text().then((t) => t.slice(0, 200)).catch(() => '');
    throw new Error(`PNCP API: ${res.status} ${body}`.trim());
  }
  return res.json();
}

// PNCP tenders REQUIRE dataInicial+dataFinal AND the range must not exceed the
// API's max window; ~30 days is safe and the natural default for "recent".
function dateRange(args: Record<string, unknown>): { from: string; to: string } {
  const to = str(args.date_to) ?? ymd(new Date());
  const fromDefault = new Date();
  fromDefault.setDate(fromDefault.getDate() - 30);
  const from = str(args.date_from) ?? ymd(fromDefault);
  return { from, to };
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function pageArg(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? String(Math.floor(n)) : '1';
}

function modalityArg(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) && MODALITIES[n] ? String(Math.floor(n)) : '6';
}

function str(v: unknown): string | undefined {
  if (typeof v === 'string') {
    const t = v.trim();
    return t ? t : undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

// PNCP free-text objects often carry embedded \r\n and doubled whitespace.
function clean(v: unknown): string | undefined {
  const s = str(v);
  return s ? s.replace(/\s+/g, ' ').trim() : undefined;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
