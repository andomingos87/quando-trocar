// Persistencia do modulo `prospeccao`. Acesso via service role (tabelas com RLS
// habilitada e sem policy — nada de anon/authenticated).

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AreaProspeccao,
  EstabelecimentoNormalizado,
  FonteProspeccao,
  MetricasIngestao,
  StatusEstabelecimento,
} from "./types";

/** Lotes de upsert. Acima disso o payload fica grande demais para uma request. */
const TAMANHO_LOTE = 500;

type Cliente = ReturnType<typeof createSupabaseAdminClient>;

export async function obterOuCriarArea(
  cliente: Cliente,
  entrada: { cidade: string; uf: string; codigoMunicipioRfb?: string | null; codigoIbge?: string | null },
): Promise<AreaProspeccao> {
  const { data: existente, error: erroBusca } = await cliente
    .from("prospeccao_areas")
    .select("id, cidade, uf, codigo_municipio_rfb")
    .eq("cidade", entrada.cidade)
    .eq("uf", entrada.uf)
    .maybeSingle();

  if (erroBusca) throw new Error(`Falha ao buscar area: ${erroBusca.message}`);

  if (existente) {
    // O codigo da RFB pode chegar depois da area ter sido criada por outro caminho.
    if (entrada.codigoMunicipioRfb && !existente.codigo_municipio_rfb) {
      await cliente
        .from("prospeccao_areas")
        .update({ codigo_municipio_rfb: entrada.codigoMunicipioRfb, updated_at: new Date().toISOString() })
        .eq("id", existente.id);
    }
    return {
      id: existente.id,
      cidade: existente.cidade,
      uf: existente.uf,
      codigoMunicipioRfb: entrada.codigoMunicipioRfb ?? existente.codigo_municipio_rfb,
    };
  }

  const { data: criada, error: erroInsert } = await cliente
    .from("prospeccao_areas")
    .insert({
      cidade: entrada.cidade,
      uf: entrada.uf,
      codigo_municipio_rfb: entrada.codigoMunicipioRfb ?? null,
      codigo_ibge: entrada.codigoIbge ?? null,
    })
    .select("id, cidade, uf, codigo_municipio_rfb")
    .single();

  if (erroInsert || !criada) {
    throw new Error(`Falha ao criar area: ${erroInsert?.message ?? "sem retorno"}`);
  }

  return {
    id: criada.id,
    cidade: criada.cidade,
    uf: criada.uf,
    codigoMunicipioRfb: criada.codigo_municipio_rfb,
  };
}

export async function iniciarExecucao(
  cliente: Cliente,
  entrada: { areaId: string; fonte: FonteProspeccao; competencia?: string | null },
): Promise<string> {
  const { data, error } = await cliente
    .from("prospeccao_execucoes")
    .insert({
      area_id: entrada.areaId,
      fonte: entrada.fonte,
      competencia: entrada.competencia ?? null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Falha ao iniciar execucao: ${error?.message ?? "sem retorno"}`);
  return data.id;
}

export async function finalizarExecucao(
  cliente: Cliente,
  execucaoId: string,
  entrada: { metricas: MetricasIngestao; erro?: string | null },
): Promise<void> {
  const { metricas } = entrada;
  const { error } = await cliente
    .from("prospeccao_execucoes")
    .update({
      finalizada_em: new Date().toISOString(),
      metricas,
      lidos: metricas.linhasLidas,
      descobertos: metricas.normalizados,
      novos: metricas.inseridos,
      erro: entrada.erro ?? null,
    })
    .eq("id", execucaoId);

  if (error) throw new Error(`Falha ao finalizar execucao: ${error.message}`);
}

function paraLinha(areaId: string, item: EstabelecimentoNormalizado) {
  return {
    area_id: areaId,
    fontes: item.fontes,
    cnpj: item.cnpj,
    razao_social: item.razaoSocial,
    nome_fantasia: item.nomeFantasia,
    nome_canonico: item.nomeCanonico,
    cnae_principal: item.cnaePrincipal,
    cnae_secundarios: item.cnaesSecundarios,
    situacao_cadastral: item.situacaoCadastral,
    data_abertura: item.dataAbertura,
    porte: item.porte,
    matriz_filial: item.matrizFilial,
    logradouro: item.logradouro,
    numero: item.numero,
    complemento: item.complemento,
    bairro: item.bairro,
    cidade: item.cidade,
    uf: item.uf,
    cep: item.cep,
    email: item.email,
    telefone_e164: item.telefoneE164,
    telefone_secundario_e164: item.telefoneSecundarioE164,
    telefone_movel: item.telefoneMovel,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Upsert por CNPJ.
 *
 * Idempotente de proposito: reingerir a mesma competencia da RFB deve atualizar o
 * cadastro sem criar linha nova e sem regredir o trabalho de qualificacao — por isso
 * `status`, `score_*` e `lead_id` NAO entram no payload.
 */
export async function upsertEstabelecimentos(
  cliente: Cliente,
  areaId: string,
  lote: readonly EstabelecimentoNormalizado[],
): Promise<{ gravados: number }> {
  let gravados = 0;

  for (let i = 0; i < lote.length; i += TAMANHO_LOTE) {
    const fatia = lote.slice(i, i + TAMANHO_LOTE).map((item) => paraLinha(areaId, item));
    const { error, count } = await cliente
      .from("prospeccao_estabelecimentos")
      .upsert(fatia, { onConflict: "cnpj", count: "exact" });

    if (error) throw new Error(`Falha no upsert (lote ${i / TAMANHO_LOTE}): ${error.message}`);
    gravados += count ?? fatia.length;
  }

  return { gravados };
}

/** Tamanho da pagina do PostgREST. Ler sem paginar trunca em silencio. */
const PAGINA = 1000;

/**
 * Le uma coluna de telefone inteira, paginando.
 *
 * O supabase-js corta em 1000 linhas por padrao e nao avisa. Numa checagem de
 * "esse numero ja esta no funil?", truncar significa reprospectar cliente ativo —
 * falha silenciosa e cara.
 */
async function lerTodosOsTelefones(
  cliente: Cliente,
  tabela: "leads_oficina" | "oficinas",
  coluna: "whatsapp" | "whatsapp_principal",
): Promise<Set<string>> {
  const telefones = new Set<string>();

  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await cliente
      .from(tabela)
      .select(coluna)
      .is("deleted_at", null)
      .range(offset, offset + PAGINA - 1);

    if (error) throw new Error(`Falha ao ler ${tabela}: ${error.message}`);
    const linhas = (data ?? []) as unknown as Array<Record<string, string | null>>;

    for (const linha of linhas) {
      const valor = linha[coluna];
      if (valor) telefones.add(valor);
    }

    if (linhas.length < PAGINA) break;
  }

  return telefones;
}

/**
 * Marca como descartado quem ja esta no funil.
 *
 * Prospectar de novo quem ja e lead em conversa (ou pior, quem ja e cliente pagante)
 * queima a relacao. O cruzamento e por telefone porque e a unica chave que as duas
 * bases compartilham hoje.
 */
export async function descartarJaConhecidos(
  cliente: Cliente,
  areaId: string,
): Promise<{ descartados: number }> {
  const [telefonesLead, telefonesOficina] = await Promise.all([
    lerTodosOsTelefones(cliente, "leads_oficina", "whatsapp"),
    lerTodosOsTelefones(cliente, "oficinas", "whatsapp_principal"),
  ]);

  let descartados = 0;

  for (const [telefones, motivo] of [
    [telefonesOficina, "ja_e_cliente"],
    [telefonesLead, "ja_e_lead"],
  ] as const) {
    const lista = [...telefones];
    for (let i = 0; i < lista.length; i += TAMANHO_LOTE) {
      const fatia = lista.slice(i, i + TAMANHO_LOTE);
      if (fatia.length === 0) continue;

      const { error, count } = await cliente
        .from("prospeccao_estabelecimentos")
        .update(
          { status: "descartado", motivo_descarte: motivo, updated_at: new Date().toISOString() },
          { count: "exact" },
        )
        .eq("area_id", areaId)
        .eq("status", "descoberto")
        .in("telefone_e164", fatia);

      if (error) throw new Error(`Falha ao descartar ${motivo}: ${error.message}`);
      descartados += count ?? 0;
    }
  }

  return { descartados };
}

const STATUS_CONHECIDOS: readonly StatusEstabelecimento[] = [
  "descoberto",
  "qualificado",
  "descartado",
  "aprovado",
  "promovido",
  "duplicado",
];

/** Conta no banco, um `count` por status — nunca trazendo as linhas (limite de 1000). */
export async function contarPorStatus(
  cliente: Cliente,
  areaId: string,
): Promise<Record<string, number>> {
  const contagem: Record<string, number> = {};

  for (const status of STATUS_CONHECIDOS) {
    const { count, error } = await cliente
      .from("prospeccao_estabelecimentos")
      .select("id", { count: "exact", head: true })
      .eq("area_id", areaId)
      .eq("status", status);

    if (error) throw new Error(`Falha ao contar ${status}: ${error.message}`);
    if (count) contagem[status] = count;
  }

  return contagem;
}
