// PRNG determinístico (mulberry32). Mesmo seed → mesmo mundo.
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Inteiro em [min, max] (inclusivo). */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: ReadonlyArray<T>): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Sorteia por peso: [[valor, peso], ...]. */
  weighted<T>(items: ReadonlyArray<readonly [T, number]>): T {
    const total = items.reduce((acc, [, w]) => acc + w, 0);
    let r = this.next() * total;
    for (const [value, w] of items) {
      r -= w;
      if (r <= 0) return value;
    }
    return items[items.length - 1][0];
  }

  /** Normal aproximada (soma de uniformes), truncada em [min, max]. */
  normal(mean: number, sd: number, min: number, max: number): number {
    let s = 0;
    for (let i = 0; i < 6; i += 1) s += this.next();
    const z = (s - 3) / Math.sqrt(0.5);
    return Math.min(max, Math.max(min, mean + z * sd));
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Divide `total` em `parts` inteiros com jitter, somando exatamente `total`. */
  split(total: number, weights: number[], jitter = 0.08): number[] {
    const noisy = weights.map((w) => w * (1 + this.float(-jitter, jitter)));
    const sum = noisy.reduce((a, b) => a + b, 0);
    const out = noisy.map((w) => Math.floor((w / sum) * total));
    let rest = total - out.reduce((a, b) => a + b, 0);
    let i = 0;
    while (rest > 0) {
      out[i % out.length] += 1;
      rest -= 1;
      i += 1;
    }
    return out;
  }

  /** UUID v4 determinístico. */
  uuid(): string {
    const hex = "0123456789abcdef";
    let s = "";
    for (let i = 0; i < 36; i += 1) {
      if (i === 8 || i === 13 || i === 18 || i === 23) s += "-";
      else if (i === 14) s += "4";
      else if (i === 19) s += hex[(this.int(0, 15) & 0x3) | 0x8];
      else s += hex[this.int(0, 15)];
    }
    return s;
  }

  digits(n: number): string {
    let s = "";
    for (let i = 0; i < n; i += 1) s += this.int(0, 9);
    return s;
  }
}
