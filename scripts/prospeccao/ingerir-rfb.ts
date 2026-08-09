// Ingestao dos Dados Abertos do CNPJ (Receita Federal) para a base de prospeccao.
//
//   npm run prospeccao:ingerir -- --cidade Guarulhos --uf SP --municipio 6477
//   npm run prospeccao:ingerir -- --cidade Guarulhos --uf SP --municipio 6477 --dry-run
//
// Pre-requisito: rodar `scripts/prospeccao/baixar-rfb.sh <competencia> <municipio>`,
// que baixa os ~5 GB de Estabelecimentos e deixa o pre-filtro em
// `.data/rfb/<competencia>/estabelecimentos-<municipio>.csv`.
//
// O pre-filtro e grosso (grep pelo codigo do municipio em qualquer coluna); o filtro
// exato por coluna, CNAE e situacao cadastral acontece aqui.

import { createReadStream, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stdout } from "node:process";

import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { ehCandidatoIcp } from "../../lib/prospeccao/cnaes";
import { colapsarLote } from "../../lib/prospeccao/dedupe";
import { normalizarEstabelecimento } from "../../lib/prospeccao/normalize";
import {
  mesmoMunicipio,
  parsearLinhaEmpresa,
  parsearLinhaEstabelecimento,
} from "../../lib/prospeccao/rfb-parser";
import {
  contarPorStatus,
  descartarJaConhecidos,
  finalizarExecucao,
  iniciarExecucao,
  obterOuCriarArea,
  upsertEstabelecimentos,
} from "../../lib/prospeccao/repository";
import type {
  EmpresaRfb,
  EstabelecimentoNormalizado,
  MetricasIngestao,
} from "../../lib/prospeccao/types";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

type Args = {
  cidade: string;
  uf: string;
  municipio: string;
  competencia: string;
  arquivo: string | null;
  arquivoEmpresas: string | null;
  dryRun: boolean;
  limite: number | null;
};

function parseArgs(argv: string[]): Args {
  const get = (nome: string): string | null => {
    const indice = argv.indexOf(`--${nome}`);
    if (indice === -1) return null;
    return argv[indice + 1] ?? null;
  };

  const cidade = get("cidade");
  const uf = get("uf");
  const municipio = get("municipio");

  if (!cidade || !uf || !municipio) {
    throw new Error(
      "uso: --cidade <nome> --uf <UF> --municipio <codigo RFB> [--competencia AAAA-MM] [--dry-run] [--limite N]",
    );
  }

  const limiteRaw = get("limite");

  return {
    cidade,
    uf: uf.toUpperCase(),
    municipio,
    competencia: get("competencia") ?? "2026-07",
    arquivo: get("arquivo"),
    arquivoEmpresas: get("arquivo-empresas"),
    dryRun: argv.includes("--dry-run"),
    limite: limiteRaw ? Number(limiteRaw) : null,
  };
}

/**
 * Le o arquivo linha a linha decodificando latin-1.
 *
 * Sem `encoding` no stream de proposito: os arquivos da RFB sao ISO-8859-1 e ler como
 * utf-8 corrompe todo nome com acento (o dado que o vendedor vai ler na tela). Node
 * decodifica latin-1 nativamente por Buffer, sem dependencia nova.
 */
async function* lerLinhasLatin1(caminho: string): AsyncGenerator<string> {
  const stream = createReadStream(caminho);
  let resto = Buffer.alloc(0);

  for await (const pedaco of stream) {
    let buffer = Buffer.concat([resto, pedaco as Buffer]);
    let inicio = 0;
    let quebra = buffer.indexOf(0x0a, inicio);

    while (quebra !== -1) {
      const fim = quebra > inicio && buffer[quebra - 1] === 0x0d ? quebra - 1 : quebra;
      yield buffer.subarray(inicio, fim).toString("latin1");
      inicio = quebra + 1;
      quebra = buffer.indexOf(0x0a, inicio);
    }

    resto = buffer.subarray(inicio);
    buffer = Buffer.alloc(0);
  }

  if (resto.length > 0) yield resto.toString("latin1");
}

/**
 * Carrega Empresas (razao social e porte) para enriquecer os estabelecimentos.
 *
 * O script roda sem isso, mas a lista fica praticamente inutilizavel: no dado real de
 * Guarulhos so 27% dos estabelecimentos tem nome fantasia — os outros 73% apareceriam
 * como "(sem nome)" na tela do vendedor. Na pratica este passo e obrigatorio.
 */
async function carregarEmpresas(caminho: string | null): Promise<Map<string, EmpresaRfb>> {
  const mapa = new Map<string, EmpresaRfb>();
  if (!caminho || !existsSync(caminho)) return mapa;

  for await (const linha of lerLinhasLatin1(caminho)) {
    if (!linha.trim()) continue;
    const empresa = parsearLinhaEmpresa(linha);
    if (empresa) mapa.set(empresa.cnpjBasico, empresa);
  }

  return mapa;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raiz = join(import.meta.dirname, "..", "..");
  const caminho =
    args.arquivo ??
    join(raiz, ".data", "rfb", args.competencia, `estabelecimentos-${args.municipio}.csv`);

  if (!existsSync(caminho)) {
    throw new Error(
      `Arquivo nao encontrado: ${caminho}\n` +
        `Rode antes: scripts/prospeccao/baixar-rfb.sh ${args.competencia} ${args.municipio}`,
    );
  }

  stdout.write(`${bold("Ingestao RFB")} — ${args.cidade}/${args.uf} (municipio ${args.municipio})\n`);
  stdout.write(`${dim(`arquivo: ${caminho}`)}\n`);
  if (args.dryRun) stdout.write(`${yellow("modo dry-run: nada sera gravado")}\n`);
  stdout.write("\n");

  const empresas = await carregarEmpresas(
    args.arquivoEmpresas ??
      join(raiz, ".data", "rfb", args.competencia, `empresas-${args.municipio}.csv`),
  );
  if (empresas.size > 0) {
    stdout.write(`${dim(`empresas carregadas para enriquecimento: ${empresas.size}`)}\n`);
  }

  const metricas: MetricasIngestao = {
    linhasLidas: 0,
    forteMunicipio: 0,
    aptosPorCnae: 0,
    semTelefone: 0,
    descartadosSituacao: 0,
    normalizados: 0,
    duplicadosNoLote: 0,
    inseridos: 0,
    atualizados: 0,
  };

  const normalizados: EstabelecimentoNormalizado[] = [];

  for await (const linha of lerLinhasLatin1(caminho)) {
    if (!linha.trim()) continue;
    metricas.linhasLidas += 1;

    const bruto = parsearLinhaEstabelecimento(linha);
    if (!bruto) continue;

    // O pre-filtro por grep pega o codigo em qualquer coluna (numero do endereco,
    // p.ex.). Aqui e a coluna certa que decide.
    if (!mesmoMunicipio(bruto.codigoMunicipio, args.municipio)) continue;
    metricas.forteMunicipio += 1;

    if (!ehCandidatoIcp(bruto.cnaePrincipal, bruto.cnaesSecundarios)) continue;
    metricas.aptosPorCnae += 1;

    if (bruto.situacaoCadastral !== "ativa") {
      metricas.descartadosSituacao += 1;
      continue;
    }

    const item = normalizarEstabelecimento(bruto, {
      cidade: args.cidade,
      uf: args.uf,
      empresa: empresas.get(bruto.cnpjBasico) ?? null,
    });

    if (!item.telefoneE164) metricas.semTelefone += 1;

    normalizados.push(item);
    metricas.normalizados += 1;

    if (args.limite && metricas.normalizados >= args.limite) break;
  }

  // Matriz e filiais da mesma rede repetem telefone: um alvo comercial so.
  const { unicos, duplicados } = colapsarLote(
    normalizados.map((item) => ({ ...item, id: item.cnpj, googlePlaceId: null })),
  );
  metricas.duplicadosNoLote = duplicados.length;

  // Lista de raizes de CNPJ para o filtro do arquivo de Empresas (razao social e
  // porte). Sem ela, baixar Empresas exigiria varrer 1,3 GB sem criterio.
  const caminhoCnpjs = join(
    raiz,
    ".data",
    "rfb",
    args.competencia,
    `cnpjs-basicos-${args.municipio}.txt`,
  );
  const raizes = [...new Set(unicos.map((item) => item.cnpj.slice(0, 8)))];
  writeFileSync(caminhoCnpjs, `${raizes.join("\n")}\n`, "utf-8");

  stdout.write(`${dim("linhas lidas")}            ${metricas.linhasLidas}\n`);
  stdout.write(`${dim("no municipio")}            ${metricas.forteMunicipio}\n`);
  stdout.write(`${dim("com CNAE de ICP")}         ${metricas.aptosPorCnae}\n`);
  stdout.write(`${dim("descartados (situacao)")}  ${metricas.descartadosSituacao}\n`);
  stdout.write(`${dim("normalizados")}            ${metricas.normalizados}\n`);
  stdout.write(`${dim("duplicados no lote")}      ${metricas.duplicadosNoLote}\n`);
  stdout.write(`${dim("sem telefone")}            ${metricas.semTelefone}\n`);
  stdout.write(`${bold("a gravar")}                 ${unicos.length}\n`);
  if (empresas.size === 0) {
    stdout.write(
      `${dim(`raizes de CNPJ para enriquecer: ${caminhoCnpjs} (${raizes.length})`)}\n`,
    );
  }
  stdout.write("\n");

  if (args.dryRun) {
    for (const item of unicos.slice(0, 10)) {
      stdout.write(
        `${dim("·")} ${item.nomeFantasia ?? item.razaoSocial ?? "(sem nome)"} — ` +
          `${item.telefoneE164 ?? "sem telefone"} — CNAE ${item.cnaePrincipal} — ${item.bairro ?? ""}\n`,
      );
    }
    stdout.write(`\n${yellow("dry-run: nada gravado")}\n`);
    return;
  }

  const cliente = createSupabaseAdminClient();
  const area = await obterOuCriarArea(cliente, {
    cidade: args.cidade,
    uf: args.uf,
    codigoMunicipioRfb: args.municipio,
  });
  const execucaoId = await iniciarExecucao(cliente, {
    areaId: area.id,
    fonte: "rfb",
    competencia: args.competencia,
  });

  try {
    const { gravados } = await upsertEstabelecimentos(cliente, area.id, unicos);
    metricas.inseridos = gravados;

    const { descartados } = await descartarJaConhecidos(cliente, area.id);
    await finalizarExecucao(cliente, execucaoId, { metricas });

    const contagem = await contarPorStatus(cliente, area.id);
    stdout.write(`${green("gravados")} ${gravados}\n`);
    stdout.write(`${dim("descartados por ja estarem no funil")} ${descartados}\n`);
    stdout.write(`${dim("por status:")} ${JSON.stringify(contagem)}\n`);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await finalizarExecucao(cliente, execucaoId, { metricas, erro: mensagem });
    throw erro;
  }
}

main().catch((erro) => {
  process.exitCode = 1;
  stdout.write(`\n\x1b[31m${erro instanceof Error ? erro.message : String(erro)}\x1b[0m\n`);
});
