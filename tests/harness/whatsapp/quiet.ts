// Colapsa um ruído de log CONHECIDO e benigno dos CLIs do harness.
//
// `getOficinaPauseState` (inadimplencia-guard.ts) cria o próprio client
// Supabase — não é injetável — e sem env falha em `fail-open`, que é o
// comportamento correto e documentado no próprio guard ("ex.: env nao
// configurada em ambiente de teste"). O problema é só volume: um stack trace
// por turno torna a saída do eval ilegível.
//
// Isto NÃO silencia erro desconhecido: qualquer mensagem fora da allowlist
// passa direto. E é usado apenas pelos CLIs — as suítes em `tests/` continuam
// vendo tudo.

const RUIDOS_CONHECIDOS = ["oficina pause state check failed (fail-open)"];

export function silenciarFailOpenConhecido(): () => number {
  const original = console.error;
  let suprimidos = 0;

  console.error = (...args: unknown[]) => {
    const primeiro = typeof args[0] === "string" ? args[0] : "";
    if (RUIDOS_CONHECIDOS.some((ruido) => primeiro.includes(ruido))) {
      suprimidos += 1;
      return;
    }
    original(...args);
  };

  return () => {
    console.error = original;
    return suprimidos;
  };
}
