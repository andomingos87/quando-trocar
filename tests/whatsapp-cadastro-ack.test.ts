import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { formatDateBRFromIso } from "@/lib/whatsapp/webhook-handler";

// QTR-35 P0-3: o ack de cadastro tem de informar a MESMA data que ficou em
// `lembretes.scheduled_at`. Estes testes cobrem as duas pontas do contrato: o
// formato da data mostrada e a garantia de que o RPC devolve o campo.

describe("formatDateBRFromIso", () => {
  test("formata em UTC — o RPC grava meia-noite UTC do dia pretendido", () => {
    // A sessão do Postgres roda em UTC, então `data_servico::timestamptz + 90d`
    // é meia-noite UTC. Formatar em America/Sao_Paulo (UTC-3) devolveria
    // 23/07/2026: um erro de um dia, todo dia.
    expect(formatDateBRFromIso("2026-07-24T00:00:00+00:00")).toBe("24/07/2026");
    expect(formatDateBRFromIso("2026-07-24T00:00:00Z")).toBe("24/07/2026");
  });

  test("aceita o texto cru do Postgres (espaço e offset curto)", () => {
    expect(formatDateBRFromIso("2026-07-24 00:00:00+00")).toBe("24/07/2026");
  });

  test("cadências reais de tipos_servico_default sobre data_servico 2026-04-25", () => {
    // troca_oleo 90 · amortecedor 730 · revisao/outro 180
    expect(formatDateBRFromIso("2026-07-24T00:00:00Z")).toBe("24/07/2026");
    expect(formatDateBRFromIso("2028-04-24T00:00:00Z")).toBe("24/04/2028");
    expect(formatDateBRFromIso("2026-10-22T00:00:00Z")).toBe("22/10/2026");
  });

  test("sem lembrete agendado não há data para prometer", () => {
    expect(formatDateBRFromIso(null)).toBeNull();
    expect(formatDateBRFromIso("")).toBeNull();
    expect(formatDateBRFromIso("nao é data")).toBeNull();
  });
});

describe("contrato do RPC register_service_with_reminder", () => {
  // O RPC já foi recriado inteiro por três migrations diferentes, e foi
  // exatamente assim que a divergência de data nasceu. Este teste falha se
  // alguém recriar a função sem devolver a data agendada.
  test("a definição mais recente devolve scheduled_at e dias_lembrete", () => {
    const dir = join(process.cwd(), "supabase", "migrations");
    const definitions = readdirSync(dir)
      .filter((file) => file.endsWith(".sql"))
      .sort()
      .filter((file) =>
        readFileSync(join(dir, file), "utf8").includes(
          "function public.register_service_with_reminder",
        ),
      );

    expect(definitions.length).toBeGreaterThan(0);
    const latest = readFileSync(join(dir, definitions.at(-1)!), "utf8");

    expect(latest).toContain("'scheduled_at', v_scheduled_at");
    expect(latest).toContain("'dias_lembrete', v_dias_lembrete");
    // O lembrete continua condicionado ao consentimento: sem ele
    // `scheduled_at` volta null e o bot não promete aviso.
    expect(latest).toContain("returning id, scheduled_at into v_lembrete_id, v_scheduled_at");
    // Grants não podem se perder ao recriar a função (lição SECURITY DEFINER).
    expect(latest).toContain("from public, anon, authenticated");
    expect(latest).toContain("to service_role");
  });
});
