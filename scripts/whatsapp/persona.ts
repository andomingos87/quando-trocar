// Simulador de persona: um interlocutor sintético conversa com o bot pelo
// harness, N turnos, e a conversa é julgada em duas camadas.
//
//   npm run persona:whatsapp                       # todas, roteiro fixo, sem custo
//   npm run persona:whatsapp -- --persona hostil
//   npm run persona:whatsapp -- --openai real --turnos 8 --judge
//
// Camada 1 (invariantes determinísticas) é quem reprova. Camada 2 (LLM-judge)
// só relata: um juiz não-determinístico controlando exit code transforma o
// simulador em ruído que você aprende a ignorar.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stdout } from "node:process";

import { createHarness, silenciarFailOpenConhecido } from "../../tests/harness/whatsapp";
import type { TurnObservation } from "../../tests/harness/whatsapp";
import { checkInvariants } from "../../tests/harness/whatsapp/invariants";
import type { Violation } from "../../tests/harness/whatsapp/invariants";

import { findPersona, PERSONAS } from "./personas";
import type { Persona } from "./personas";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

const PRECO_PARTIDA = 59;
// Mesmo número do salesConfig default do repositório em memória. O validador
// compara host+caminho, então a allowlist precisa da URL completa.
const HANDOFF_COMERCIAL = "5511999990099";
const ALLOWED_LINKS = [`https://wa.me/${HANDOFF_COMERCIAL}`, "https://quandotrocar.com.br"];

// ─── Interlocutor ───────────────────────────────────────────────────────────

type Interlocutor = {
  proximaMensagem(historico: ReadonlyArray<{ de: "persona" | "bot"; texto: string }>): Promise<string | null>;
};

/** Roteiro fixo: determinístico, grátis, e suficiente para provar as invariantes. */
function interlocutorRoteirizado(persona: Persona): Interlocutor {
  let indice = 0;
  return {
    async proximaMensagem() {
      return persona.roteiro[indice++] ?? null;
    },
  };
}

/** Interlocutor LLM: é aqui que aparece o caso que ninguém escreveu. */
function interlocutorLlm(persona: Persona, maxTurnos: number): Interlocutor {
  let turno = 0;
  return {
    async proximaMensagem(historico) {
      if (turno++ >= maxTurnos) return null;

      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const transcript = historico
        .map((h) => `${h.de === "persona" ? "VOCÊ" : "BOT"}: ${h.texto}`)
        .join("\n");

      const response = await openai.responses.create({
        model: process.env.OPENAI_MODEL_CLASSIFIER ?? "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: [
              "Você está testando um bot de WhatsApp brasileiro por meio de roleplay.",
              `SEU PAPEL: ${persona.descricao}`,
              `SEU OBJETIVO: ${persona.objetivo}`,
              `SEU ESTILO: ${persona.estilo}`,
              "Responda APENAS com a próxima mensagem que você mandaria no WhatsApp.",
              "Sem aspas, sem narração, sem explicar o que está fazendo. Só a mensagem.",
              "Nunca repita literalmente uma mensagem que você já mandou.",
            ].join("\n"),
          },
          {
            role: "user",
            content: transcript || "(início da conversa — mande a primeira mensagem)",
          },
        ],
      });

      const texto = response.output_text?.trim();
      return texto || null;
    },
  };
}

// ─── LLM-judge ──────────────────────────────────────────────────────────────

type JudgeVerdict = {
  scores: { naturalidade: number; coerencia: number; progresso: number; tom_marca: number };
  violations: Array<{ rule: string; turn: number; quote: string; severity: string }>;
  inconclusive: boolean;
  summary: string;
};

const JUDGE_RULES = [
  "repeticao",
  "contradicao",
  "promessa_indevida",
  "tom_robotico",
  "ignorou_pergunta",
  "informacao_inventada",
  "portugues_ruim",
];

async function julgar(
  persona: Persona,
  historico: ReadonlyArray<{ de: "persona" | "bot"; texto: string }>,
): Promise<JudgeVerdict | null> {
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const transcript = historico
    .map((h, i) => `[${Math.floor(i / 2) + 1}] ${h.de === "persona" ? "CLIENTE" : "BOT"}: ${h.texto}`)
    .join("\n");

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL_CLASSIFIER ?? "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: [
            "Você é auditor de qualidade de um bot comercial de oficinas mecânicas no WhatsApp brasileiro.",
            `Contexto do interlocutor: ${persona.descricao}`,
            "Julgue APENAS o que está no transcript. Nunca infira estado interno do sistema.",
            "Toda violação EXIGE uma citação literal (`quote`) copiada do transcript. Sem citação, não reporte.",
            `Use apenas estas regras: ${JUDGE_RULES.join(", ")}.`,
            "NÃO julgue preço, agendamento nem opt-out — isso é verificado deterministicamente em outra camada.",
            "Em dúvida, devolva inconclusive=true em vez de chutar.",
            "Notas de 1 a 5. Resumo em no máximo 3 frases, em português do Brasil.",
          ].join("\n"),
        },
        { role: "user", content: transcript },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "judge_verdict",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              scores: {
                type: "object",
                additionalProperties: false,
                properties: {
                  naturalidade: { type: "integer" },
                  coerencia: { type: "integer" },
                  progresso: { type: "integer" },
                  tom_marca: { type: "integer" },
                },
                required: ["naturalidade", "coerencia", "progresso", "tom_marca"],
              },
              violations: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    rule: { type: "string", enum: JUDGE_RULES },
                    turn: { type: "integer" },
                    quote: { type: "string" },
                    severity: { type: "string", enum: ["alta", "media", "baixa"] },
                  },
                  required: ["rule", "turn", "quote", "severity"],
                },
              },
              inconclusive: { type: "boolean" },
              summary: { type: "string" },
            },
            required: ["scores", "violations", "inconclusive", "summary"],
          },
        },
      },
    });

    const verdict = JSON.parse(response.output_text) as JudgeVerdict;
    // Juiz sem evidência literal é descartado: alucinação não vira bug report.
    verdict.violations = verdict.violations.filter((v) =>
      historico.some((h) => h.texto.includes(v.quote.slice(0, 20))),
    );
    return verdict;
  } catch {
    return null;
  }
}

// ─── Execução ───────────────────────────────────────────────────────────────

type RunResult = {
  persona: string;
  turnos: TurnObservation[];
  historico: Array<{ de: "persona" | "bot"; texto: string }>;
  violacoes: Violation[];
  judge: JudgeVerdict | null;
  stopReason: string;
};

async function rodarPersona(
  persona: Persona,
  opts: { openai: "off" | "real"; turnos: number; judge: boolean },
): Promise<RunResult> {
  const harness = createHarness({
    openai: opts.openai,
    geracaoLlmModo: "off",
    seed: { profile: persona.perfil, from: "5511999990001" },
    precoPartida: PRECO_PARTIDA,
  });

  const interlocutor =
    opts.openai === "real" ? interlocutorLlm(persona, opts.turnos) : interlocutorRoteirizado(persona);

  const historico: Array<{ de: "persona" | "bot"; texto: string }> = [];
  const turnos: TurnObservation[] = [];
  const violacoes: Violation[] = [];
  let stopReason = "max_turnos";

  for (let i = 0; i < opts.turnos; i += 1) {
    const mensagem = await interlocutor.proximaMensagem(historico);
    if (!mensagem) {
      stopReason = "roteiro_terminou";
      break;
    }

    historico.push({ de: "persona", texto: mensagem });
    const turn = await harness.send(mensagem);
    turnos.push(turn);
    if (turn.deliveredText) historico.push({ de: "bot", texto: turn.deliveredText });

    violacoes.push(
      ...checkInvariants(turn, {
        precoPartida: PRECO_PARTIDA,
        allowedLinks: ALLOWED_LINKS,
        anteriores: turnos.slice(0, -1),
      }),
    );

    const lead = Object.values(turn.stateAfter.leads)[0];
    if (lead?.status === "perdido") {
      stopReason = "lead_perdido";
      break;
    }
  }

  const judge = opts.judge && opts.openai === "real" ? await julgar(persona, historico) : null;

  return { persona: persona.id, turnos, historico, violacoes, judge, stopReason };
}

// ─── Relatório ──────────────────────────────────────────────────────────────

function escreverRelatorio(destino: string, resultados: RunResult[]) {
  mkdirSync(destino, { recursive: true });

  for (const resultado of resultados) {
    writeFileSync(
      join(destino, `${resultado.persona}.jsonl`),
      resultado.turnos.map((t) => JSON.stringify(t)).join("\n"),
    );
  }

  const linhas: string[] = ["# Simulação de personas — relatório", ""];
  for (const resultado of resultados) {
    linhas.push(`## ${resultado.persona}`, "");
    linhas.push(`- turnos: ${resultado.turnos.length} · parada: ${resultado.stopReason}`);
    linhas.push(`- violações: ${resultado.violacoes.length}`, "");

    linhas.push("### Transcript", "");
    for (const item of resultado.historico) {
      linhas.push(`**${item.de === "persona" ? "Cliente" : "Bot"}:** ${item.texto}`, "");
    }

    if (resultado.violacoes.length > 0) {
      linhas.push("### Violações", "");
      for (const v of resultado.violacoes) {
        linhas.push(`- \`${v.id}\` (${v.severity}) turno ${v.turn}: ${v.evidencia}`);
        linhas.push(
          `  - reproduzir: \`npm run repl:whatsapp -- --perfil ${
            PERSONAS.find((p) => p.id === resultado.persona)?.perfil ?? "lead"
          }\``,
        );
      }
      linhas.push("");
    }

    if (resultado.judge) {
      linhas.push("### LLM-judge (relato, não reprova)", "");
      linhas.push(`- ${resultado.judge.summary}`);
      linhas.push(`- notas: ${JSON.stringify(resultado.judge.scores)}`);
      for (const v of resultado.judge.violations) {
        linhas.push(`- \`${v.rule}\` (${v.severity}) turno ${v.turn}: "${v.quote}"`);
      }
      linhas.push("");
    }
  }

  writeFileSync(join(destino, "relatorio.md"), linhas.join("\n"));
}

// ─── CLI ────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  const get = (flag: string) => {
    const index = argv.indexOf(`--${flag}`);
    return index === -1 ? null : (argv[index + 1] ?? null);
  };

  const personaId = get("persona");
  const openai = (get("openai") ?? "off") as "off" | "real";
  const turnos = Number(get("turnos") ?? 8);
  const judge = argv.includes("--judge");
  const saida = get("saida") ?? join(process.cwd(), "output", "persona", `run-${process.pid}`);

  const alvo = personaId ? [findPersona(personaId)] : PERSONAS;

  if (openai === "real" && !process.env.OPENAI_API_KEY) {
    stdout.write(`${red("--openai real exige OPENAI_API_KEY")}\n`);
    process.exit(1);
  }

  stdout.write(
    `${bold("simulador de persona")} ${dim(
      `${alvo.length} persona(s) · até ${turnos} turnos · openai=${openai}${judge ? " · judge" : ""}`,
    )}\n\n`,
  );
  if (openai === "off") {
    stdout.write(`${dim("modo roteiro: turnos fixos por persona (determinístico, sem custo)")}\n\n`);
  }

  const restaurarConsole = silenciarFailOpenConhecido();
  const resultados: RunResult[] = [];
  for (const persona of alvo) {
    resultados.push(await rodarPersona(persona, { openai, turnos, judge }));
  }
  const ruido = restaurarConsole();

  let bloqueios = 0;
  for (const resultado of resultados) {
    const blocks = resultado.violacoes.filter((v) => v.severity === "block");
    const warns = resultado.violacoes.filter((v) => v.severity === "warn");
    bloqueios += blocks.length;

    const marcador = blocks.length > 0 ? red("✗") : warns.length > 0 ? yellow("~") : green("✓");
    stdout.write(
      `${marcador} ${resultado.persona.padEnd(18)} ${dim(
        `${resultado.turnos.length} turnos · ${resultado.stopReason}`,
      )}\n`,
    );
    for (const v of resultado.violacoes) {
      const cor = v.severity === "block" ? red : yellow;
      stdout.write(`    ${cor(v.id)} turno ${v.turn}: ${v.evidencia}\n`);
    }
    if (resultado.judge && !resultado.judge.inconclusive) {
      stdout.write(`    ${dim(`judge: ${resultado.judge.summary}`)}\n`);
      for (const v of resultado.judge.violations) {
        stdout.write(`    ${dim(`judge/${v.rule} (turno ${v.turn}): "${v.quote}"`)}\n`);
      }
    }
  }

  escreverRelatorio(saida, resultados);
  stdout.write(`\n${dim(`relatório em ${saida}`)}\n`);
  if (ruido > 0) {
    stdout.write(`${dim(`(${ruido} log(s) de fail-open do guard de inadimplência suprimidos)`)}\n`);
  }
  stdout.write(`${bloqueios === 0 ? green("nenhuma violação bloqueante") : red(`${bloqueios} violação(ões) bloqueante(s)`)}\n`);

  process.exit(bloqueios > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
