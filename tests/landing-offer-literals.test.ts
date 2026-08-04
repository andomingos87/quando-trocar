import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * Guarda o invariante do spec da landing (P0+P1): prazo, preço e microcopy da oferta
 * vivem só em `lib/landing-offer.ts`. Um número escrito na mão num componente sai de
 * sincronia com o contrato comercial sem ninguém perceber — foi assim que a âncora de
 * preço do card virou "R$ 0" enquanto o contrato dizia R$ 59/mês.
 */
/**
 * Datas absolutas na demo envelhecem sozinhas: "set/2026" vira passado em outubro e a
 * demonstração passa a exibir o bot agendando algo que já aconteceu, sem nada quebrar.
 * A demo fala em prazo relativo ("daqui a ~5 meses"), que não expira.
 */
const DATE_FILES = ["lib/chat-scripts.ts", "components/como-funciona.tsx"];

const DATE_PATTERNS = [
  { label: "mês/ano fixo", pattern: /\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/\d{2,4}\b/i },
  { label: "data ISO fixa", pattern: /\b20\d{2}-\d{2}-\d{2}\b/ },
  { label: "data dd/mm/aaaa fixa", pattern: /\b\d{2}\/\d{2}\/20\d{2}\b/ },
];

const LANDING_FILES = [
  "app/page.tsx",
  "components/hero.tsx",
  "components/nav.tsx",
  "components/transparencia.tsx",
  "components/dor.tsx",
  "components/como-funciona.tsx",
  "components/beneficios.tsx",
  "components/preco.tsx",
  "components/objecoes.tsx",
  "components/faq.tsx",
  "components/cta-final.tsx",
  "components/floating-cta.tsx",
  "components/footer.tsx",
];

const FORBIDDEN = [
  { label: "valor em reais escrito na mão", pattern: /R\$\s*\d/ },
  { label: "prazo do teste escrito na mão", pattern: /\b14\s+dias\b/ },
  { label: "preço mensal escrito na mão", pattern: /\b59\b/ },
];

function readLanding(file: string) {
  return readFileSync(
    fileURLToPath(new URL(`../${file}`, import.meta.url)),
    "utf8",
  );
}

function offendingLines(source: string, pattern: RegExp) {
  return source
    .split("\n")
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => pattern.test(line));
}

function describeOffenders(offending: { line: string; number: number }[]) {
  return offending.map(({ line, number }) => `  ${number}: ${line.trim()}`).join("\n");
}

describe("landing offer literals", () => {
  test.each(LANDING_FILES)(
    "%s lê prazo, preço e microcopy do contrato, não de literais",
    (file) => {
      const source = readLanding(file);

      for (const { label, pattern } of FORBIDDEN) {
        const offending = offendingLines(source, pattern);

        expect(
          offending,
          `${file}: ${label} — use LANDING_OFFER em vez de escrever o valor:\n${describeOffenders(offending)}`,
        ).toEqual([]);
      }
    },
  );
});

describe("demo sem data que expira", () => {
  test.each(DATE_FILES)("%s fala em prazo relativo, não em data fixa", (file) => {
    const source = readLanding(file);

    for (const { label, pattern } of DATE_PATTERNS) {
      const offending = offendingLines(source, pattern);

      expect(
        offending,
        `${file}: ${label} — a demo envelhece sozinha; use prazo relativo ("daqui a ~5 meses"):\n${describeOffenders(offending)}`,
      ).toEqual([]);
    }
  });
});
