// Runner do eval set dos agentes de WhatsApp.
//
//   npm run eval:whatsapp
//   npm run eval:whatsapp -- --agente vendas --openai real
//   npm run eval:whatsapp -- --caso sales-003 --verbose
//
// Roda cada caso pelo caminho REAL do webhook (não chamando o agente direto):
// é o que exercita router, guardrails, validador de saída, split e botões. O
// texto que o usuário lê não é `reply.body`.
//
// Fica FORA do `npm test` de propósito: com `--openai real` gasta OpenAI e é
// não-determinístico. Se `npm test` ficar caro e piscante, o time aprende a
// ignorar vermelho — que é o pior desfecho possível.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stdout } from "node:process";

import { createHarness, silenciarFailOpenConhecido } from "../../tests/harness/whatsapp";
import type { TurnObservation } from "../../tests/harness/whatsapp";
import {
  parseEvalCase,
  REGISTER_SERVICE_FIELD_MAP,
  userTurnsToReplay,
} from "../../tests/whatsapp-agent-evals/schema";
import type { EvalCase } from "../../tests/whatsapp-agent-evals/schema";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const blue = (s: string) => `\x1b[34m${s}\x1b[0m`;

const EVAL_DIR = join(process.cwd(), "tests", "whatsapp-agent-evals");
const ARQUIVOS: Record<string, string> = {
  vendas: "sales.json",
  onboarding: "onboarding.json",
  lembrete: "reminder.json",
};

// ─── Comparação ─────────────────────────────────────────────────────────────

/** Normaliza para comparar substring sem tropeçar em acento ou caixa. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function contains(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle));
}

type Failure = { campo: string; esperado: string; obtido: string };

/** Match parcial: só as chaves declaradas no fixture são comparadas. */
function matchPartial(
  esperado: Record<string, unknown>,
  obtido: Record<string, unknown> | null,
  prefixo: string,
  fieldMap?: Record<string, string>,
): Failure[] {
  if (!obtido) {
    return [{ campo: prefixo, esperado: JSON.stringify(esperado), obtido: "null" }];
  }
  const falhas: Failure[] = [];
  for (const [chave, valor] of Object.entries(esperado)) {
    const chaveReal = fieldMap?.[chave] ?? chave;
    const atual = obtido[chaveReal];
    if (JSON.stringify(atual) !== JSON.stringify(valor)) {
      falhas.push({
        campo: `${prefixo}.${chave}`,
        esperado: JSON.stringify(valor),
        obtido: JSON.stringify(atual),
      });
    }
  }
  return falhas;
}

// ─── Execução de um caso ────────────────────────────────────────────────────

type CaseResult = {
  caso: EvalCase;
  falhas: Failure[];
  erro: string | null;
  turn: TurnObservation | null;
};

async function runCase(caso: EvalCase, openai: "off" | "real"): Promise<CaseResult> {
  const falhas: Failure[] = [];
  const modo = caso.agent_mode;
  const world = caso.context.world ?? {};

  const perfil =
    modo === "vendas" ? "lead" : modo === "cliente_final_lembrete" ? "cliente_final" : "oficina";

  const harness = createHarness({
    openai,
    geracaoLlmModo: "off",
    seed: {
      profile: perfil,
      from: "5511999990001",
      leadStatus: caso.context.lead_status,
      context: caso.context.seed,
      agentMode: modo === "operacao" ? "operacao" : modo === "onboarding" ? "onboarding" : undefined,
      oficinaNome: world.oficina_nome,
      lembrete: world.lembrete_id
        ? { id: world.lembrete_id, veiculo: world.veiculo }
        : undefined,
    },
  });

  try {
    // Replay: o estado (ex.: `sales.price_mentions`) acumula sozinho porque
    // cada turno prévio passa pelo webhook de verdade.
    const replay = userTurnsToReplay(caso.context.previous_messages);
    if (replay.length > 0) await harness.replay(replay);

    // `context.lead_status` é o estado ANTES do primeiro turno de replay, não
    // no momento do turno julgado — o replay legitimamente move o status (é o
    // ponto dele). Comparar os dois seria transformar comportamento correto em
    // falha.

    const turn = await harness.send(caso.input, { mediaType: caso.source_media_type });
    const exp = caso.expected;
    const reply = turn.agentInvocations[0]?.reply as Record<string, unknown> | undefined;

    if (turn.httpStatus !== 200) {
      falhas.push({ campo: "http", esperado: "200", obtido: String(turn.httpStatus) });
    }

    if (exp.intent) {
      const obtido = (reply?.intent as string | undefined) ?? null;
      if (obtido !== exp.intent) {
        falhas.push({ campo: "intent", esperado: exp.intent, obtido: String(obtido) });
      }
    }

    if (exp.status_after) {
      const lead = Object.values(turn.stateAfter.leads)[0];
      const obtido = lead?.status ?? null;
      if (obtido !== exp.status_after) {
        falhas.push({ campo: "status_after", esperado: exp.status_after, obtido: String(obtido) });
      }
    }

    if (exp.lembrete_status_after) {
      const lembrete = Object.values(turn.stateAfter.lembretes)[0];
      const obtido = lembrete?.status ?? null;
      if (obtido !== exp.lembrete_status_after) {
        falhas.push({
          campo: "lembrete_status_after",
          esperado: exp.lembrete_status_after,
          obtido: String(obtido),
        });
      }
    }

    for (const trecho of exp.reply_must_contain ?? []) {
      if (!contains(turn.deliveredText, trecho)) {
        falhas.push({
          campo: "reply_must_contain",
          esperado: trecho,
          obtido: turn.deliveredText.slice(0, 120),
        });
      }
    }

    for (const trecho of exp.reply_must_not_contain ?? []) {
      if (contains(turn.deliveredText, trecho)) {
        falhas.push({
          campo: "reply_must_not_contain",
          esperado: `sem "${trecho}"`,
          obtido: turn.deliveredText.slice(0, 120),
        });
      }
    }

    for (const trecho of exp.delivered_contains ?? []) {
      if (!turn.deliveredText.includes(trecho)) {
        falhas.push({
          campo: "delivered_contains",
          esperado: trecho,
          obtido: turn.deliveredText.slice(0, 120),
        });
      }
    }

    for (const esperada of exp.tool_calls ?? []) {
      const encontrada = turn.toolCalls.find((t) => t.toolName === esperada.tool_name);
      if (!encontrada) {
        falhas.push({
          campo: "tool_calls",
          esperado: esperada.tool_name,
          obtido: `[${turn.toolCalls.map((t) => t.toolName).join(", ")}]`,
        });
        continue;
      }
      if (esperada.input_contains && !JSON.stringify(encontrada.input).includes(esperada.input_contains)) {
        falhas.push({
          campo: `tool_calls.${esperada.tool_name}.input_contains`,
          esperado: esperada.input_contains,
          obtido: JSON.stringify(encontrada.input),
        });
      }
    }

    const signals = exp.signals ?? {};
    if (signals.handoff_required !== undefined) {
      const obtido = Boolean(reply?.handoffRequired);
      if (obtido !== signals.handoff_required) {
        falhas.push({
          campo: "signals.handoff_required",
          esperado: String(signals.handoff_required),
          obtido: String(obtido),
        });
      }
    }
    if (signals.cliente_status) {
      const cliente = Object.values(turn.stateAfter.clientes)[0];
      const obtido = cliente?.status ?? null;
      if (obtido !== signals.cliente_status) {
        falhas.push({
          campo: "signals.cliente_status",
          esperado: signals.cliente_status,
          obtido: String(obtido),
        });
      }
    }
    if (signals.should_cancel_future_reminders !== undefined) {
      const obtido = Boolean(reply?.shouldCancelFutureReminders);
      if (obtido !== signals.should_cancel_future_reminders) {
        falhas.push({
          campo: "signals.should_cancel_future_reminders",
          esperado: String(signals.should_cancel_future_reminders),
          obtido: String(obtido),
        });
      }
    }
    if (signals.register_service_called !== undefined) {
      const obtido = turn.stateAfter.servicosRegistrados > turn.stateBefore.servicosRegistrados;
      if (obtido !== signals.register_service_called) {
        falhas.push({
          campo: "signals.register_service_called",
          esperado: String(signals.register_service_called),
          obtido: String(obtido),
        });
      }
    }

    if (exp.convert_to_oficina !== undefined) {
      const obtido = Boolean(reply?.convertToOficina);
      if (obtido !== exp.convert_to_oficina) {
        falhas.push({
          campo: "convert_to_oficina",
          esperado: String(exp.convert_to_oficina),
          obtido: String(obtido),
        });
      }
    }

    if (exp.service_draft) {
      falhas.push(
        ...matchPartial(
          exp.service_draft as Record<string, unknown>,
          (turn.serviceDraft ?? null) as Record<string, unknown> | null,
          "service_draft",
        ),
      );
    }

    if (exp.register_service_input !== undefined) {
      const obtido = (reply?.registerServiceInput ?? null) as Record<string, unknown> | null;
      if (exp.register_service_input === null) {
        if (obtido !== null) {
          falhas.push({
            campo: "register_service_input",
            esperado: "null",
            obtido: JSON.stringify(obtido),
          });
        }
      } else {
        falhas.push(
          ...matchPartial(
            exp.register_service_input,
            obtido,
            "register_service_input",
            REGISTER_SERVICE_FIELD_MAP,
          ),
        );
      }
    }

    return { caso, falhas, erro: null, turn };
  } catch (error) {
    return {
      caso,
      falhas,
      erro: error instanceof Error ? error.message : String(error),
      turn: null,
    };
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const index = argv.indexOf(`--${flag}`);
    return index === -1 ? null : (argv[index + 1] ?? null);
  };
  return {
    agente: get("agente"),
    caso: get("caso"),
    openai: (get("openai") ?? "off") as "off" | "real",
    verbose: argv.includes("--verbose"),
    json: get("json"),
  };
}

function carregarCasos(agente: string | null): EvalCase[] {
  const alvos = agente ? [ARQUIVOS[agente]] : Object.values(ARQUIVOS);
  if (alvos.some((a) => !a)) {
    throw new Error(`--agente inválido (use ${Object.keys(ARQUIVOS).join(" | ")})`);
  }
  return alvos.flatMap((arquivo) => {
    const conteudo = JSON.parse(readFileSync(join(EVAL_DIR, arquivo), "utf8")) as unknown[];
    return conteudo.map((raw) => parseEvalCase(raw, arquivo));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let casos = carregarCasos(args.agente);
  if (args.caso) casos = casos.filter((c) => c.id === args.caso);

  if (casos.length === 0) {
    stdout.write(`${yellow("nenhum caso selecionado")}\n`);
    process.exit(1);
  }

  stdout.write(
    `${bold("eval do bot WhatsApp")} ${dim(`${casos.length} casos · openai=${args.openai}`)}\n\n`,
  );

  const pulados = args.openai === "off" ? casos.filter((c) => c.requires_llm) : [];
  const executaveis = casos.filter((c) => !pulados.includes(c));

  const restaurarConsole = silenciarFailOpenConhecido();
  const resultados: CaseResult[] = [];
  for (const caso of executaveis) {
    resultados.push(await runCase(caso, args.openai));
  }

  const ruidoSuprimido = restaurarConsole();

  let bloqueantes = 0;
  let avisos = 0;
  let quarentenaPassando = 0;
  let ok = 0;

  for (const resultado of resultados) {
    const { caso, falhas, erro } = resultado;
    const passou = falhas.length === 0 && !erro;
    const ativo = caso.status === "active";

    if (passou && ativo) {
      ok += 1;
      stdout.write(`${green("✓")} ${caso.id}${dim(caso.expected.intent ? `  ${caso.expected.intent}` : "")}\n`);
      continue;
    }

    if (passou && !ativo) {
      // Antídoto contra quarentena eterna.
      quarentenaPassando += 1;
      stdout.write(
        `${red("!")} ${caso.id}  ${red("STALE_QUARANTINE")} ${dim(`— passou mas está '${caso.status}'; promova para 'active'`)}\n`,
      );
      continue;
    }

    const marcador = ativo ? (caso.critical ? red("✗") : yellow("~")) : blue("◌");
    const rotulo = ativo ? (caso.critical ? "crítico" : "aviso") : caso.status;
    stdout.write(`${marcador} ${caso.id}  ${dim(`(${rotulo})`)}\n`);

    if (erro) stdout.write(`    ${red(erro)}\n`);
    for (const falha of falhas) {
      stdout.write(
        `    ${falha.campo}: esperado ${green(falha.esperado)} · obtido ${red(falha.obtido)}\n`,
      );
    }
    if (args.verbose && resultado.turn) {
      stdout.write(`    ${dim(`resposta: ${resultado.turn.deliveredText.replace(/\n/g, " ")}`)}\n`);
    }

    if (!ativo) continue;
    if (caso.critical) bloqueantes += 1;
    else avisos += 1;
  }

  for (const caso of pulados) {
    stdout.write(`${dim(`- ${caso.id}  pulado (requires_llm; rode com --openai real)`)}\n`);
  }

  const quarentena = resultados.filter((r) => r.caso.status !== "active").length;
  stdout.write(
    `\n${ok}/${resultados.filter((r) => r.caso.status === "active").length} ativos passando · ` +
      `${bloqueantes} crítico(s) falhando · ${avisos} aviso(s) · ${quarentena} em quarentena` +
      (pulados.length ? ` · ${pulados.length} pulado(s)` : "") +
      "\n",
  );

  if (quarentenaPassando > 0) {
    stdout.write(
      `${red(`${quarentenaPassando} caso(s) em quarentena passaram`)} — promova para 'active'.\n`,
    );
  }

  if (ruidoSuprimido > 0) {
    stdout.write(
      `${dim(`(${ruidoSuprimido} log(s) de fail-open do guard de inadimplência suprimidos — esperado sem env Supabase)`)}\n`,
    );
  }

  if (args.json) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      args.json,
      JSON.stringify(
        resultados.map((r) => ({
          id: r.caso.id,
          status: r.caso.status,
          critical: r.caso.critical,
          passou: r.falhas.length === 0 && !r.erro,
          erro: r.erro,
          falhas: r.falhas,
          resposta: r.turn?.deliveredText ?? null,
        })),
        null,
        2,
      ),
    );
    stdout.write(`${dim(`relatório em ${args.json}`)}\n`);
  }

  process.exit(bloqueantes > 0 || quarentenaPassando > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
