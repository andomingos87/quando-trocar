import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { SupabaseWhatsappRepository } from "@/lib/whatsapp/repository";
import { productLabelForConfirmation } from "@/lib/whatsapp/service-confirmation";
import type { TipoServico } from "@/lib/whatsapp/types";

/**
 * F1 do pivot do catálogo (ADR-0031): o catálogo passa a ser a autoridade de
 * cadência e template, mas o comportamento tem que continuar IDÊNTICO.
 *
 * A identidade depende de um invariante frágil e invisível: o seed de
 * `servicos_catalogo` é um espelho de `tipos_servico_default`. Se alguém editar
 * um dos dois lados — mudar 90 para 120, trocar o template do amortecedor — o
 * banco aceita numa boa e a divergência só aparece meses depois, num lembrete
 * enviado na data errada. Estes testes leem as duas migrations e comparam.
 *
 * Não é teste de banco: é teste do contrato entre os dois arquivos. A validação
 * contra o banco real (backfill, idempotência, advisors) está no plano da F1.
 */

const FAMILIAS: TipoServico[] = ["troca_oleo", "amortecedor", "revisao", "outro"];

function readMigration(file: string) {
  return readFileSync(
    fileURLToPath(new URL(`../supabase/migrations/${file}`, import.meta.url)),
    "utf8",
  );
}

const CATALOGO_BASE = readMigration("20260808210000_catalogo_base.sql");
const CATALOGO_RPCS = readMigration("20260808210100_catalogo_rpcs.sql");
const TIPOS_SERVICO_DEFAULT = readMigration("20260522000000_tipos_servico_default.sql");
const TIPO_SERVICO_MARCA_PECA = readMigration("20260521000000_tipo_servico_marca_peca.sql");

/** Recorta o bloco VALUES de um insert, para não casar com SQL de outras partes do arquivo. */
function valuesBlock(sql: string, insertInto: string) {
  const start = sql.indexOf(`insert into ${insertInto}`);
  expect(start, `insert into ${insertInto} não encontrado`).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("on conflict", start);
  const stop = end >= 0 ? end : sql.indexOf(";", start);
  return sql.slice(start, stop);
}

type ItemCatalogo = {
  slug: string;
  nome: string;
  familia: string;
  produtoLabel: string;
  base: string;
  intervaloDias: number;
  templateName: string;
  templateLanguage: string;
};

function parseSeedCatalogo(): ItemCatalogo[] {
  const bloco = valuesBlock(CATALOGO_BASE, "public.servicos_catalogo");
  const linha =
    /\(\s*null,\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*array\[[^\]]*\](?:::text\[\])?,\s*'([^']+)',\s*(\d+),\s*'([^']+)',\s*'([^']+)'/g;
  const itens: ItemCatalogo[] = [];
  for (const m of bloco.matchAll(linha)) {
    itens.push({
      slug: m[1],
      nome: m[2],
      familia: m[3],
      produtoLabel: m[4],
      base: m[5],
      intervaloDias: Number(m[6]),
      templateName: m[7],
      templateLanguage: m[8],
    });
  }
  return itens;
}

type TipoDefault = {
  tipoServico: string;
  diasLembrete: number;
  templateName: string;
  templateLanguage: string;
};

function parseTiposServicoDefault(): TipoDefault[] {
  const bloco = valuesBlock(TIPOS_SERVICO_DEFAULT, "public.tipos_servico_default");
  const linha = /\(\s*'([a-z_]+)',\s*'[^']*',\s*(\d+),\s*'([^']+)',\s*'([^']+)',\s*(?:true|false)\s*\)/g;
  const tipos: TipoDefault[] = [];
  for (const m of bloco.matchAll(linha)) {
    tipos.push({
      tipoServico: m[1],
      diasLembrete: Number(m[2]),
      templateName: m[3],
      templateLanguage: m[4],
    });
  }
  return tipos;
}

function parseSeedProdutos() {
  const bloco = valuesBlock(CATALOGO_BASE, "public.produtos_catalogo");
  const linha = /\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(?:true|false)\s*\)/g;
  return [...bloco.matchAll(linha)].map((m) => ({
    slug: m[1],
    nome: m[2],
    marca: m[3],
    familia: m[4],
  }));
}

describe("seed do catálogo espelha tipos_servico_default", () => {
  const seed = parseSeedCatalogo();
  const tipos = parseTiposServicoDefault();

  test("as duas migrations foram lidas e parseadas", () => {
    expect(seed).toHaveLength(4);
    expect(tipos).toHaveLength(4);
  });

  test("os valores conhecidos foram extraídos de verdade", () => {
    // Sem esta âncora os testes de espelho abaixo seriam vacuosos: um parser
    // quebrado produziria `NaN` dos dois lados e `toBe` passaria (Object.is).
    expect(
      Object.fromEntries(seed.map((i) => [i.familia, i.intervaloDias])),
    ).toEqual({
      troca_oleo: 90,
      amortecedor: 730,
      revisao: 180,
      outro: 180,
    });
    expect(
      Object.fromEntries(tipos.map((t) => [t.tipoServico, t.diasLembrete])),
    ).toEqual({
      troca_oleo: 90,
      amortecedor: 730,
      revisao: 180,
      outro: 180,
    });
    expect(seed.map((i) => i.templateName).sort()).toEqual([
      "lembrete_amortecedor",
      "lembrete_revisao_geral",
      "lembrete_revisao_geral",
      "lembrete_troca_oleo",
    ]);
  });

  test("existe exatamente um item global por família", () => {
    expect(seed.map((i) => i.familia).sort()).toEqual([...FAMILIAS].sort());
  });

  test.each(FAMILIAS)("família %s: cadência e template idênticos ao legado", (familia) => {
    const item = seed.find((i) => i.familia === familia);
    const tipo = tipos.find((t) => t.tipoServico === familia);

    expect(item, `sem item de catálogo para ${familia}`).toBeDefined();
    expect(tipo, `sem tipos_servico_default para ${familia}`).toBeDefined();

    // É isto que garante "comportamento idêntico": o RPC resolve a cadência
    // pelo catálogo, e o catálogo devolve o mesmo número de antes.
    expect(item!.intervaloDias).toBe(tipo!.diasLembrete);
    expect(item!.templateName).toBe(tipo!.templateName);
    expect(item!.templateLanguage).toBe(tipo!.templateLanguage);
  });

  test.each(FAMILIAS)("família %s: produto_label bate com PRODUCT_LABEL_BY_TIPO", (familia) => {
    const item = seed.find((i) => i.familia === familia)!;
    // O fallback por família no código (ADR-0031 §5) e o label curado no
    // catálogo têm que dizer a mesma coisa para os 4 itens do seed — senão o
    // cliente final lê uma palavra diferente conforme o caminho que a mensagem
    // tomou.
    expect(item.produtoLabel).toBe(
      productLabelForConfirmation({ tipoServico: familia }),
    );
  });

  test("todo item do seed nasce por tempo (km só na F3)", () => {
    for (const item of seed) {
      expect(item.base).toBe("tempo");
      // Limites sanitários da ADR-0031 §4, replicados no check da tabela.
      expect(item.intervaloDias).toBeGreaterThanOrEqual(7);
      expect(item.intervaloDias).toBeLessThanOrEqual(3650);
    }
  });

  test("todo item do seed é padrão da família (a ponte família→item precisa disso)", () => {
    // A cascata do RPC resolve `familia -> item` por `padrao_familia`. Um item
    // do seed sem a flag deixaria a família órfã e a cadência cairia no
    // fallback legado sem ninguém perceber.
    const bloco = valuesBlock(CATALOGO_BASE, "public.servicos_catalogo");
    const marcados = bloco.match(/'seed',\s*true,\s*true/g) ?? [];
    expect(marcados).toHaveLength(4);
  });
});

describe("seed de produtos cobre as marcas do legado", () => {
  const produtos = parseSeedProdutos();

  test("uma linha por marca de amortecedor, menos 'outra'", () => {
    const permitidas = TIPO_SERVICO_MARCA_PECA.match(
      /marca_peca in \(([^)]+)\)/,
    );
    expect(permitidas).not.toBeNull();
    const marcas = [...permitidas![1].matchAll(/'([a-z]+)'/g)]
      .map((m) => m[1])
      .filter((m) => m !== "outra");

    // `outra` é ausência de marca, não marca: não vira produto canônico.
    expect(marcas.length).toBeGreaterThan(0);
    expect(produtos.map((p) => p.slug).sort()).toEqual(
      marcas.map((m) => `amortecedor-${m}`).sort(),
    );
  });

  test("o slug é a chave do backfill e do RPC", () => {
    // O vínculo `servicos.marca_peca -> produtos_catalogo` é resolvido por
    // `'amortecedor-' || marca_peca` nos dois lugares. Se o padrão do slug
    // mudar aqui, o backfill e o RPC param de achar o produto em silêncio.
    for (const produto of produtos) {
      expect(produto.slug).toMatch(/^amortecedor-[a-z]+$/);
      expect(produto.familia).toBe("amortecedor");
    }
    expect(CATALOGO_BASE).toContain("'amortecedor-' || s.marca_peca");
    expect(CATALOGO_RPCS).toContain("'amortecedor-' || p_marca_peca");
  });
});

describe("invariantes das migrations da F1", () => {
  test("o seed é idempotente (rodar a migration 2x não duplica)", () => {
    expect(CATALOGO_BASE).toContain(
      "on conflict (coalesce(oficina_id, '00000000-0000-0000-0000-000000000000'::uuid), slug)",
    );
    expect(CATALOGO_BASE).toMatch(/on conflict \(slug\)\s*do nothing/);
  });

  test("o backfill não sobrescreve vínculo existente", () => {
    // Sem os `is null` os updates deixariam de ser reexecutáveis e um replay da
    // migration re-vincularia serviços já corrigidos à mão.
    expect(CATALOGO_BASE).toContain("and s.catalogo_id is null");
    expect(CATALOGO_BASE).toContain("and s.produto_id is null");
  });

  test("as tabelas do catálogo são service-role only (sem policy)", () => {
    expect(CATALOGO_BASE).toContain(
      "alter table public.servicos_catalogo enable row level security",
    );
    expect(CATALOGO_BASE).toContain(
      "alter table public.produtos_catalogo enable row level security",
    );
    // A leitura pelo painel da oficina entra na F4, com policy própria.
    expect(CATALOGO_BASE).not.toMatch(/create policy[\s\S]*servicos_catalogo/);
  });

  test("toda função nova revoga EXECUTE de anon/authenticated", () => {
    // Lição 0001: função em `public` vaza EXECUTE por default no Supabase, e
    // revogar de `public` não remove o grant nominal dos roles.
    for (const fn of [
      "public.catalogo_normalize_texto(text)",
      "public.catalogo_slugify(text)",
    ]) {
      expect(CATALOGO_BASE).toContain(`revoke all on function ${fn} from public, anon, authenticated`);
    }
    expect(CATALOGO_RPCS).toMatch(
      /revoke all on function public\.match_servicos_catalogo\([^)]*\)\s*\n?\s*from public, anon, authenticated/,
    );
  });

  test("match_servicos_catalogo é security definer com search_path fixo", () => {
    const trecho = CATALOGO_RPCS.slice(
      CATALOGO_RPCS.indexOf("create or replace function public.match_servicos_catalogo"),
    );
    expect(trecho).toContain("security definer");
    expect(trecho).toContain("set search_path = public, extensions, pg_temp");
  });

  test("o corpo em português do lembrete não muda na F1", () => {
    // `outbound_messages.body` é auditoria do que o cliente final leu. Mudar o
    // texto aqui seria mudança observável — o contrato da F1 é o oposto.
    for (const frase of [
      "Ja esta na hora da proxima troca de oleo do seu",
      "Ja faz um tempo que voce trocou os amortecedores do seu",
      "Ja esta na hora da proxima revisao do seu",
      "Esta na hora do proximo servico do seu",
    ]) {
      expect(CATALOGO_RPCS).toContain(frase);
    }
  });

  test("os fallbacks legados de cadência e template continuam na cascata", () => {
    expect(CATALOGO_RPCS).toContain("from public.tipos_servico_default");
    expect(CATALOGO_RPCS).toContain("select dias_lembrete_padrao");
    expect(CATALOGO_RPCS).toContain("v_row.template_name := 'lembrete_troca_oleo'");
  });

  test("a assinatura do register_service_with_reminder não perdeu parâmetros", () => {
    for (const param of [
      "p_oficina_id uuid",
      "p_nome_cliente text",
      "p_whatsapp_cliente text",
      "p_veiculo text",
      "p_servico text",
      "p_data_servico date",
      "p_valor numeric",
      "p_consentimento_whatsapp boolean",
      "p_tipo_servico text default 'troca_oleo'",
      "p_marca_peca text default null",
    ]) {
      expect(CATALOGO_RPCS).toContain(param);
    }
  });
});

/** Cliente Supabase mínimo: só o `rpc` que o método sob teste usa. */
function fakeSupabase(data: unknown) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const client = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return { data, error: null };
    },
  };
  return { client, calls };
}

describe("repositório mapeia os campos novos do catálogo", () => {
  test("registerServiceWithReminder devolve catalogoId e produtoId", async () => {
    const { client, calls } = fakeSupabase({
      cliente_id: "cliente-1",
      veiculo_id: "veiculo-1",
      servico_id: "servico-1",
      lembrete_id: "lembrete-1",
      scheduled_at: "2026-11-06T00:00:00.000Z",
      dias_lembrete: 90,
      catalogo_id: "catalogo-1",
      produto_id: null,
    });

    const repository = new SupabaseWhatsappRepository(
      client as unknown as ConstructorParameters<typeof SupabaseWhatsappRepository>[0],
    );

    const result = await repository.registerServiceWithReminder({
      oficinaId: "oficina-1",
      nomeCliente: "João",
      whatsappCliente: "+5541999990000",
      veiculo: "Civic 2015",
      servico: "troca de óleo",
      dataServico: "2026-08-08",
      valor: null,
      consentimentoWhatsapp: true,
      tipoServico: "troca_oleo",
      marcaPeca: null,
    });

    expect(result.catalogoId).toBe("catalogo-1");
    expect(result.produtoId).toBeNull();
    // Nada mais mudou no contrato de retorno.
    expect(result.diasLembrete).toBe(90);
    expect(result.scheduledAt).toBe("2026-11-06T00:00:00.000Z");
    expect(calls[0]?.fn).toBe("register_service_with_reminder");
  });

  test("registerServiceWithReminder tolera RPC antigo sem os campos novos", async () => {
    // Lição 0002: o deploy sobe antes das migrations. Entre um e outro o RPC
    // ainda é o de ontem e não devolve `catalogo_id` — o cadastro não pode
    // quebrar por causa disso.
    const { client } = fakeSupabase({
      cliente_id: "cliente-1",
      veiculo_id: "veiculo-1",
      servico_id: "servico-1",
      lembrete_id: null,
      scheduled_at: null,
      dias_lembrete: 90,
    });

    const repository = new SupabaseWhatsappRepository(
      client as unknown as ConstructorParameters<typeof SupabaseWhatsappRepository>[0],
    );

    const result = await repository.registerServiceWithReminder({
      oficinaId: "oficina-1",
      nomeCliente: "João",
      whatsappCliente: "+5541999990000",
      veiculo: "Civic 2015",
      servico: "troca de óleo",
      dataServico: "2026-08-08",
      valor: null,
      consentimentoWhatsapp: false,
      tipoServico: "troca_oleo",
      marcaPeca: null,
    });

    expect(result.catalogoId).toBeNull();
    expect(result.produtoId).toBeNull();
    expect(result.lembreteId).toBeNull();
  });

  test("dequeueReminderQueueMessages devolve o produtoLabel do item", async () => {
    const { client } = fakeSupabase([
      {
        queue_message_id: 1,
        outbound_message_id: "out-1",
        lembrete_id: "lembrete-1",
        conversa_id: "conversa-1",
        oficina_id: "oficina-1",
        cliente_id: "cliente-1",
        to_whatsapp: "+5541999990000",
        customer_name: "João",
        workshop_name: "Auto Center Silva",
        vehicle_description: "Civic 2015",
        attempts: 0,
        template_name: "lembrete_troca_oleo",
        template_language: "pt_BR",
        tipo_servico: "troca_oleo",
        produto_label: "óleo",
      },
    ]);

    const repository = new SupabaseWhatsappRepository(
      client as unknown as ConstructorParameters<typeof SupabaseWhatsappRepository>[0],
    );

    const [message] = await repository.dequeueReminderQueueMessages({
      batchSize: 10,
      visibilityTimeoutSeconds: 60,
    });

    expect(message.produtoLabel).toBe("óleo");
    // O worker da F1 continua enviando 3 parâmetros: o label só viaja junto.
    expect(message.templateName).toBe("lembrete_troca_oleo");
    expect(message.tipoServico).toBe("troca_oleo");
  });
});
