// Datas e horários. Tudo internamente em ms UTC; o "relógio humano" é BRT (UTC-3, sem horário de verão).
import type { Rng } from "./prng";

export const HORA_MS = 3_600_000;
export const DIA_MS = 24 * HORA_MS;
export const BRT_OFFSET_MS = 3 * HORA_MS;

export function brt(y: number, m: number, d: number, h = 0, mi = 0, s = 0): number {
  return Date.UTC(y, m - 1, d, h, mi, s) + BRT_OFFSET_MS;
}

export function iso(ms: number): string {
  return new Date(Math.round(ms)).toISOString();
}

/** Data civil (yyyy-mm-dd) no fuso BRT. */
export function dataBRT(ms: number): string {
  return new Date(ms - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

export function horaBRT(ms: number): number {
  return new Date(ms - BRT_OFFSET_MS).getUTCHours();
}

export function diaSemanaBRT(ms: number): number {
  return new Date(ms - BRT_OFFSET_MS).getUTCDay(); // 0 = domingo
}

/** Meia-noite UTC do dia civil — é como o RPC grava `scheduled_at` (date::timestamptz em sessão UTC). */
export function meiaNoiteUtc(data: string): number {
  return Date.parse(`${data}T00:00:00Z`);
}

export function dataParaMs(data: string): number {
  return meiaNoiteUtc(data);
}

export function somaDias(data: string, n: number): string {
  return new Date(meiaNoiteUtc(data) + n * DIA_MS).toISOString().slice(0, 10);
}

/** Espelha `avancarVencimentoMensal`: setMonth(+1) em data UTC. */
export function somaUmMes(data: string): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function formatBR(data: string): string {
  const [y, m, d] = data.split("-");
  return `${d}/${m}/${y}`;
}

export function diffDias(a: string, b: string): number {
  return Math.round((meiaNoiteUtc(b) - meiaNoiteUtc(a)) / DIA_MS);
}

export function mesDe(data: string): string {
  return data.slice(0, 7);
}

export type PerfilHorario = "lead" | "oficina" | "cliente" | "admin" | "cron";

const PESO_DIA_SEMANA: Record<PerfilHorario, number[]> = {
  // dom, seg, ter, qua, qui, sex, sab
  lead: [2, 16, 18, 18, 17, 16, 10],
  oficina: [1, 17, 18, 18, 18, 17, 9],
  cliente: [5, 15, 16, 16, 16, 16, 12],
  admin: [1, 20, 20, 20, 20, 18, 3],
  cron: [1, 1, 1, 1, 1, 1, 1],
};

const PESO_HORA: Record<PerfilHorario, number[]> = {
  lead: hourWeights({ 7: 2, 8: 5, 9: 8, 10: 10, 11: 10, 12: 6, 13: 6, 14: 8, 15: 8, 16: 8, 17: 9, 18: 9, 19: 7, 20: 5, 21: 3, 22: 1 }),
  oficina: hourWeights({ 7: 2, 8: 6, 9: 8, 10: 8, 11: 8, 12: 5, 13: 5, 14: 7, 15: 8, 16: 9, 17: 10, 18: 10, 19: 6, 20: 3 }),
  cliente: hourWeights({ 7: 2, 8: 5, 9: 7, 10: 8, 11: 8, 12: 7, 13: 7, 14: 7, 15: 7, 16: 7, 17: 8, 18: 9, 19: 9, 20: 8, 21: 5, 22: 2 }),
  admin: hourWeights({ 8: 4, 9: 8, 10: 9, 11: 8, 12: 3, 13: 4, 14: 8, 15: 9, 16: 8, 17: 7, 18: 4, 19: 2, 20: 1 }),
  cron: hourWeights({ 9: 1 }),
};

function hourWeights(map: Record<number, number>): number[] {
  const out = new Array(24).fill(0);
  for (const [h, w] of Object.entries(map)) out[Number(h)] = w;
  return out;
}

/** Sorteia um instante entre `inicio` e `fim` (ms), respeitando dia da semana e hora do perfil. */
export function momento(rng: Rng, inicio: number, fim: number, perfil: PerfilHorario): number {
  if (fim <= inicio) return inicio;
  for (let tentativa = 0; tentativa < 40; tentativa += 1) {
    const dia = dataBRT(rng.float(inicio, fim));
    const base = brt(...splitData(dia));
    const dow = new Date(base - BRT_OFFSET_MS).getUTCDay();
    const pesoDia = PESO_DIA_SEMANA[perfil][dow] / 20;
    if (!rng.chance(pesoDia)) continue;
    const hora = rng.weighted(PESO_HORA[perfil].map((w, h) => [h, w] as const));
    const ms = base + hora * HORA_MS + rng.int(0, 59) * 60_000 + rng.int(0, 59) * 1000;
    if (ms >= inicio && ms <= fim) return ms;
  }
  return rng.float(inicio, fim);
}

/** Instante dentro de um dia civil, na janela de horas [hIni, hFim) BRT. */
export function momentoNoDia(rng: Rng, data: string, hIni: number, hFim: number): number {
  const [y, m, d] = splitData(data);
  const hora = rng.int(hIni, Math.max(hIni, hFim - 1));
  return brt(y, m, d, hora, rng.int(0, 59), rng.int(0, 59));
}

export function splitData(data: string): [number, number, number] {
  const [y, m, d] = data.split("-").map(Number);
  return [y, m, d];
}

export function ehDiaUtil(data: string): boolean {
  const dow = new Date(meiaNoiteUtc(data)).getUTCDay();
  return dow >= 1 && dow <= 5;
}

/** Próximo dia útil ≥ data. */
export function proximoDiaUtil(data: string): string {
  let d = data;
  while (!ehDiaUtil(d)) d = somaDias(d, 1);
  return d;
}

/** Gap entre a resposta do bot e a próxima mensagem do humano. */
export function gapHumano(rng: Rng): number {
  return rng.weighted([
    [rng.int(20, 120) * 1000, 30],
    [rng.int(2, 15) * 60_000, 35],
    [rng.int(15, 90) * 60_000, 18],
    [rng.int(2, 8) * HORA_MS, 12],
    [rng.int(18, 40) * HORA_MS, 5],
  ]);
}

export function gapBot(rng: Rng): number {
  return rng.int(2, 18) * 1000 + rng.int(0, 999);
}
