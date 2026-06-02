// Parser determinístico de datas em português (pt-BR) usado no fluxo de
// onboarding/operação para extrair `data_servico` da mensagem da oficina.
//
// Cobre os formatos mais comuns que uma oficina digita no WhatsApp:
//   - relativos explícitos: hoje, ontem, anteontem, amanhã, depois de amanhã
//   - contagem de dias: "daqui 3 dias", "em 2 dias", "daqui a uma semana",
//     "há 5 dias", "5 dias atrás"
//   - dia da semana QUALIFICADO: "quarta que vem", "próxima sexta",
//     "sábado passado", "terça retrasada"
//   - numérico: 05/06, 5/6/26, 05-06-2026
//   - "dia 5", "dia 05"
//   - extenso: "5 de junho", "5 de jun", "5 de junho de 2026"
//
// Decisão de produto: dia da semana SEM qualificador ("segunda") permanece
// AMBÍGUO (o bot pergunta a data), porque pode tanto ser a semana passada
// quanto a próxima. Só resolvemos quando há qualificador temporal explícito.
// Ver docs/regras-de-negocio.md §3.2.

export type ParsedDate = {
  /** ISO `YYYY-MM-DD` quando reconhecido; senão `null`. */
  date: string | null;
  /** `true` quando há sinal de data mas não dá pra resolver com segurança. */
  ambiguous: boolean;
  /** Trecho que casou — útil pra remover a data do texto do serviço. */
  matchedText: string | null;
};

const NONE: ParsedDate = { date: null, ambiguous: false, matchedText: null };

// domingo=0 ... sábado=6 (alinhado com Date#getUTCDay)
const WEEKDAYS: ReadonlyArray<{ dow: number; pattern: RegExp; canonical: string }> = [
  { dow: 0, pattern: /\bdomingo\b/, canonical: "domingo" },
  { dow: 1, pattern: /\bsegunda(?:\s*-?\s*feira)?\b/, canonical: "segunda" },
  { dow: 2, pattern: /\bter[çc]a(?:\s*-?\s*feira)?\b/, canonical: "terca" },
  { dow: 3, pattern: /\bquarta(?:\s*-?\s*feira)?\b/, canonical: "quarta" },
  { dow: 4, pattern: /\bquinta(?:\s*-?\s*feira)?\b/, canonical: "quinta" },
  { dow: 5, pattern: /\bsexta(?:\s*-?\s*feira)?\b/, canonical: "sexta" },
  { dow: 6, pattern: /\bs[áa]bado\b/, canonical: "sabado" },
];

const MONTHS: Record<string, number> = {
  jan: 1, janeiro: 1,
  fev: 2, fevereiro: 2,
  mar: 3, marco: 3,
  abr: 4, abril: 4,
  mai: 5, maio: 5,
  jun: 6, junho: 6,
  jul: 7, julho: 7,
  ago: 8, agosto: 8,
  set: 9, setembro: 9,
  out: 10, outubro: 10,
  nov: 11, novembro: 11,
  dez: 12, dezembro: 12,
};

// Normaliza acentos/caixa mas PRESERVA `/` e `-` (precisamos deles pra DD/MM).
function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isoFromParts(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function isoOffset(today: string, offsetDays: number): string {
  const base = new Date(`${today}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

function todayDow(today: string): number {
  return new Date(`${today}T12:00:00.000Z`).getUTCDay();
}

// Converte número por extenso curto ("uma", "dois"...) usado em "daqui a uma semana".
const WORD_NUMBERS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
};

function toNumber(token: string): number | null {
  if (/^\d+$/.test(token)) return Number(token);
  return WORD_NUMBERS[token] ?? null;
}

export function parseBrazilianDate(message: string, today: string): ParsedDate {
  const n = normalize(message);
  if (!n) return NONE;

  // 1. Relativos explícitos (ordem importa: mais específico primeiro).
  if (/\bdepois\s+de\s+amanh[ãa]?\b/.test(n) || /\bdepois\s+de\s+amanha\b/.test(n)) {
    const m = n.match(/depois\s+de\s+amanh\w*/);
    return { date: isoOffset(today, 2), ambiguous: false, matchedText: m?.[0] ?? "depois de amanha" };
  }
  if (/\banteontem\b/.test(n)) {
    return { date: isoOffset(today, -2), ambiguous: false, matchedText: "anteontem" };
  }
  if (/\bamanha\b/.test(n)) {
    return { date: isoOffset(today, 1), ambiguous: false, matchedText: "amanha" };
  }
  if (/\bhoje\b/.test(n)) {
    return { date: today, ambiguous: false, matchedText: "hoje" };
  }
  if (/\bontem\b/.test(n)) {
    return { date: isoOffset(today, -1), ambiguous: false, matchedText: "ontem" };
  }

  // 2. Contagem de dias/semanas no futuro: "daqui 3 dias", "em 2 dias",
  //    "daqui a uma semana", "daqui a 2 semanas".
  const futureCount = n.match(
    /\b(?:daqui(?:\s+a)?|em|dentro\s+de)\s+(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+(dias?|semanas?)\b/,
  );
  if (futureCount) {
    const qty = toNumber(futureCount[1]);
    if (qty !== null) {
      const days = futureCount[2].startsWith("semana") ? qty * 7 : qty;
      return { date: isoOffset(today, days), ambiguous: false, matchedText: futureCount[0] };
    }
  }

  // 3. Contagem de dias/semanas no passado: "há 5 dias", "5 dias atrás",
  //    "2 semanas atrás".
  const pastAtras = n.match(
    /\b(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+(dias?|semanas?)\s+atras\b/,
  );
  const pastHa = n.match(
    /\bh[áa]\s+(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+(dias?|semanas?)\b/,
  );
  const past = pastAtras ?? pastHa;
  if (past) {
    const qty = toNumber(past[1]);
    if (qty !== null) {
      const days = past[2].startsWith("semana") ? qty * 7 : qty;
      return { date: isoOffset(today, -days), ambiguous: false, matchedText: past[0] };
    }
  }

  // 4. Numérico DD/MM[/AAAA] ou DD-MM[-AAAA]. Não usamos "." como separador
  //    pra não confundir com motorização do veículo ("Gol 1.0", "2.0").
  const numeric = n.match(/\b(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const year = numeric[3]
        ? numeric[3].length === 2
          ? 2000 + Number(numeric[3])
          : Number(numeric[3])
        : Number(today.slice(0, 4));
      return { date: isoFromParts(year, month, day), ambiguous: false, matchedText: numeric[0] };
    }
  }

  // 5. Extenso: "5 de junho", "5 de jun", "5 de junho de 2026".
  const written = n.match(
    /\b(\d{1,2})\s+de\s+([a-z]{3,9})(?:\s+de\s+(\d{2,4}))?\b/,
  );
  if (written) {
    const day = Number(written[1]);
    const monthKey = Object.keys(MONTHS).find((key) => written[2].startsWith(key));
    if (day >= 1 && day <= 31 && monthKey) {
      const month = MONTHS[monthKey];
      const year = written[3]
        ? written[3].length === 2
          ? 2000 + Number(written[3])
          : Number(written[3])
        : Number(today.slice(0, 4));
      return { date: isoFromParts(year, month, day), ambiguous: false, matchedText: written[0] };
    }
  }

  // 6. "dia 5" / "dia 05" — dia do mês corrente.
  const diaN = n.match(/\bdia\s+(\d{1,2})\b/);
  if (diaN) {
    const day = Number(diaN[1]);
    if (day >= 1 && day <= 31) {
      const [y, mo] = today.split("-");
      return { date: isoFromParts(Number(y), Number(mo), day), ambiguous: false, matchedText: diaN[0] };
    }
  }

  // 7. Dia da semana. Só resolve com qualificador temporal explícito.
  for (const wd of WEEKDAYS) {
    const wdMatch = n.match(wd.pattern);
    if (!wdMatch) continue;

    const future = /\b(que\s+vem|proxim[ao])\b/.test(n);
    const lastWeek = /\b(passad[ao]|passada)\b/.test(n);
    const retrasada = /\bretrasad[ao]\b/.test(n);
    const dow = todayDow(today);

    if (retrasada) {
      const back = ((dow - wd.dow + 7) % 7) + 7;
      return { date: isoOffset(today, -back), ambiguous: false, matchedText: wdMatch[0] };
    }
    if (lastWeek) {
      const back = ((dow - wd.dow + 7) % 7) || 7;
      return { date: isoOffset(today, -back), ambiguous: false, matchedText: wdMatch[0] };
    }
    if (future) {
      const fwd = ((wd.dow - dow + 7) % 7) || 7;
      return { date: isoOffset(today, fwd), ambiguous: false, matchedText: wdMatch[0] };
    }
    // Dia da semana sem qualificador → ambíguo.
    return { date: null, ambiguous: true, matchedText: wdMatch[0] };
  }

  return NONE;
}
