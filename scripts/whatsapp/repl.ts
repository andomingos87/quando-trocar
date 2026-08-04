// REPL do bot WhatsApp: conversa com o agente pelo caminho real do webhook,
// no terminal, sem WhatsApp, sem Supabase e (por padrão) sem OpenAI.
//
//   npm run repl:whatsapp
//   npm run repl:whatsapp -- --perfil oficina --geracao on --openai real
//
// O valor não é ver o texto — é ver a DECISÃO: intent aplicado, modo resolvido
// pelo router, transição de status, tool calls e o que a camada de geração fez.

import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

import { createHarness } from "../../tests/harness/whatsapp";
import type { HarnessProfile, TurnObservation } from "../../tests/harness/whatsapp";
import type { GeracaoLlmModo, InboundMediaType } from "../../lib/whatsapp/types";

// ─── Cores (sem dependência externa) ────────────────────────────────────────

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

// ─── Argumentos ─────────────────────────────────────────────────────────────

type Args = {
  perfil: HarnessProfile;
  geracao: GeracaoLlmModo;
  openai: "off" | "real";
  from: string;
  json: boolean;
};

function parseArgs(argv: string[]): Args {
  const get = (flag: string, fallback: string) => {
    const index = argv.indexOf(`--${flag}`);
    if (index === -1) return fallback;
    return argv[index + 1] ?? fallback;
  };

  const perfil = get("perfil", "lead") as HarnessProfile;
  if (!["lead", "oficina", "cliente_final"].includes(perfil)) {
    throw new Error(`--perfil inválido: ${perfil} (use lead | oficina | cliente_final)`);
  }

  const geracao = get("geracao", "off") as GeracaoLlmModo;
  if (!["off", "sombra", "on"].includes(geracao)) {
    throw new Error(`--geracao inválido: ${geracao} (use off | sombra | on)`);
  }

  const openai = get("openai", "off") as "off" | "real";
  if (!["off", "real"].includes(openai)) {
    throw new Error(`--openai inválido: ${openai} (use off | real)`);
  }

  const defaultFrom =
    perfil === "oficina" ? "5511999990002" : perfil === "cliente_final" ? "5511999990003" : "5511999990001";

  return {
    perfil,
    geracao,
    openai,
    from: get("de", defaultFrom),
    json: argv.includes("--json"),
  };
}

// ─── Trace ──────────────────────────────────────────────────────────────────

/**
 * Intent aplicado. O reply de vendas ainda não expõe `intent` diretamente —
 * `classificationAudit` só é preenchido quando o determinístico diverge do LLM
 * — então a procedência é marcada para você não confundir inferência com fato.
 */
function readIntent(turn: TurnObservation): { intent: string | null; inferido: boolean } {
  const reply = turn.agentInvocations[0]?.reply as
    | { intent?: string; classificationAudit?: { appliedIntent?: string } }
    | undefined;
  if (!reply) return { intent: null, inferido: false };
  if (typeof reply.intent === "string") return { intent: reply.intent, inferido: false };
  if (reply.classificationAudit?.appliedIntent) {
    return { intent: reply.classificationAudit.appliedIntent, inferido: false };
  }
  return { intent: null, inferido: true };
}

function statusTransition(turn: TurnObservation): string | null {
  const entry = Object.entries(turn.stateDiff).find(([path]) => /^leads\..+\.status$/.test(path));
  if (!entry) return null;
  const [, [antes, depois]] = entry;
  return `${String(antes)}→${String(depois)}`;
}

function printTurn(turn: TurnObservation, json: boolean) {
  if (json) {
    stdout.write(`${JSON.stringify(turn, null, 2)}\n`);
    return;
  }

  if (turn.httpStatus !== 200) {
    stdout.write(`${red(`[erro ${turn.httpStatus}]`)} ${JSON.stringify(turn.responseBody)}\n`);
    return;
  }

  for (const message of turn.delivered) {
    if (message.kind === "text") {
      stdout.write(`${green("[bot]")} ${message.body}\n`);
    } else if (message.kind === "interactive") {
      stdout.write(`${green("[bot]")} ${message.body}\n`);
      stdout.write(`       ${cyan(message.buttons.map((b) => `[${b.title}]`).join(" "))}\n`);
    } else {
      stdout.write(
        `${green("[bot]")} ${dim(`template ${message.templateName}`)} ${message.bodyParameters.join(" · ")}\n`,
      );
    }
  }

  if (turn.delivered.length === 0) {
    stdout.write(`${yellow("[bot]")} ${dim("(silêncio — nenhuma mensagem enviada)")}\n`);
  }

  const { intent, inferido } = readIntent(turn);
  const partes = [
    `modo=${turn.agentMode ?? "?"}`,
    intent ? `intent=${intent}` : inferido ? dim("intent=?") : "",
    statusTransition(turn) ? `status ${statusTransition(turn)}` : "",
    `tools=[${turn.toolCalls.map((t) => t.toolName).join(", ")}]`,
  ].filter(Boolean);

  const invocation = turn.agentInvocations[0];
  if (invocation?.error) partes.push(red(`erro=${invocation.error.message}`));

  const reply = invocation?.reply as { handoffRequired?: boolean } | undefined;
  if (reply?.handoffRequired) partes.push(yellow("handoff"));

  stdout.write(`       ${dim(partes.join("  "))}\n`);
}

// ─── Loop ───────────────────────────────────────────────────────────────────

const AJUDA = `
Comandos:
  /estado     dump do mundo em memória (leads, conversas, contexto)
  /contexto   só o contexto da conversa atual
  /raw        objeto cru do último reply do agente
  /turno      TurnObservation completo do último turno
  /audio TXT  envia TXT como se fosse transcrição de áudio
  /botao ID   simula clique num reply button
  /reset      recomeça a conversa do zero
  /ajuda      esta lista
  /sair       encerra
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let harness = createHarness({
    seed: { profile: args.perfil, from: args.from },
    openai: args.openai,
    geracaoLlmModo: args.geracao,
  });

  stdout.write(
    `${bold("REPL do bot WhatsApp")} ${dim(
      `perfil=${args.perfil} de=+${args.from} geracao=${args.geracao} openai=${args.openai}`,
    )}\n`,
  );
  if (args.openai === "real" && !process.env.OPENAI_API_KEY) {
    stdout.write(`${yellow("aviso:")} --openai real sem OPENAI_API_KEY — os agentes vão degradar para determinístico.\n`);
  }
  stdout.write(`${dim("/ajuda para comandos, /sair para encerrar")}\n\n`);

  // Async iterator em vez de `rl.question` em loop: com stdin redirecionado
  // (`printf ... | npm run repl:whatsapp`), `question` só resolve a primeira
  // chamada e trava nas seguintes. O iterator funciona em TTY e em pipe — o
  // que também torna o REPL roteirizável.
  const rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
  const prompt = () => stdout.write("> ");
  prompt();

  /** Trata uma linha. Devolve `false` quando o REPL deve encerrar. */
  async function handle(linha: string): Promise<boolean> {
    if (linha === "/sair" || linha === "/quit") return false;

    if (linha === "/ajuda") {
      stdout.write(AJUDA);
      return true;
    }

    if (linha === "/reset") {
      harness = createHarness({
        seed: { profile: args.perfil, from: args.from },
        openai: args.openai,
        geracaoLlmModo: args.geracao,
      });
      stdout.write(`${dim("conversa reiniciada")}\n`);
      return true;
    }

    if (linha === "/estado") {
      stdout.write(`${JSON.stringify(harness.repository.dump(), null, 2)}\n`);
      return true;
    }

    if (linha === "/contexto") {
      stdout.write(`${JSON.stringify(harness.snapshot().conversations, null, 2)}\n`);
      return true;
    }

    if (linha === "/raw" || linha === "/turno") {
      const ultimo = harness.turns.at(-1);
      if (!ultimo) {
        stdout.write(`${dim("nenhum turno ainda")}\n`);
        return true;
      }
      const alvo = linha === "/raw" ? ultimo.agentInvocations[0]?.reply : ultimo;
      stdout.write(`${JSON.stringify(alvo, null, 2)}\n`);
      return true;
    }

    let mediaType: InboundMediaType = "text";
    let buttonReplyId: string | undefined;
    let mensagem = linha;

    if (linha.startsWith("/audio ")) {
      mediaType = "audio";
      mensagem = linha.slice("/audio ".length);
    } else if (linha.startsWith("/botao ")) {
      buttonReplyId = linha.slice("/botao ".length).trim();
      mensagem = buttonReplyId;
    } else if (linha.startsWith("/")) {
      stdout.write(`${yellow("comando desconhecido")} ${dim("(/ajuda)")}\n`);
      return true;
    }

    try {
      const turn = await harness.send(mensagem, { mediaType, buttonReplyId });
      printTurn(turn, args.json);
    } catch (error) {
      stdout.write(`${red("[falha]")} ${error instanceof Error ? error.message : String(error)}\n`);
    }
    return true;
  }

  for await (const raw of rl) {
    const linha = raw.trim();
    if (linha && !(await handle(linha))) break;
    prompt();
  }

  rl.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
