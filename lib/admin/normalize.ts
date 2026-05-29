// Normalizadores de exibicao para campos de texto-livre extraidos por LLM
// (nome do cliente, descricao do veiculo, tipo de servico). Sao puramente
// cosmeticos: nao alteram o dado persistido, apenas limpam para a UI do admin.

const CONNECTORS = new Set(["de", "da", "do", "das", "dos", "e"]);

function collapse(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function stripAccentsLower(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function titleCase(raw: string): string {
  return collapse(raw)
    .split(" ")
    .map((word, index) => {
      if (!word) return word;
      const lower = word.toLowerCase();
      if (index > 0 && CONNECTORS.has(stripAccentsLower(word))) return lower;
      // mantem tokens que sao so digitos/modelos (ex: "208", "2016")
      if (/^\d+$/.test(word)) return word;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

// Frases de enquadramento que o LLM costuma deixar grudadas no nome.
const NOME_PREFIXOS = [
  "quero cadastrar o cliente",
  "quero cadastrar a cliente",
  "cadastrar o cliente",
  "cadastrar a cliente",
  "o cliente se chama",
  "a cliente se chama",
  "nome do cliente e",
  "o cliente e",
  "a cliente e",
  "o cliente",
  "a cliente",
  "cliente",
];

export function normalizeClienteNome(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  let value = collapse(raw).replace(/[.;,]+$/g, "");
  if (!value) return null;

  const lower = stripAccentsLower(value);
  for (const prefixo of NOME_PREFIXOS) {
    if (lower.startsWith(prefixo + " ")) {
      value = collapse(value.slice(prefixo.length));
      break;
    }
  }
  if (!value) return null;
  return titleCase(value);
}

// Palavras de enquadramento no inicio da descricao do veiculo.
const VEICULO_PREFIXOS = [
  "tem um",
  "tem uma",
  "e um",
  "e uma",
  "meu carro e",
  "meu carro",
  "minha",
  "meu",
  "carro",
  "veiculo",
  "um",
  "uma",
];

export function normalizeVeiculo(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  let value = collapse(raw).replace(/[.;,]+$/g, "");
  if (!value) return null;

  const yearMatch = value.match(/\b(?:19|20)\d{2}\b/);
  const ano = yearMatch ? yearMatch[0] : null;
  if (ano) value = collapse(value.replace(ano, ""));

  const lower = stripAccentsLower(value);
  for (const prefixo of VEICULO_PREFIXOS) {
    if (lower.startsWith(prefixo + " ")) {
      value = collapse(value.slice(prefixo.length));
      break;
    }
  }

  const nome = value ? titleCase(value) : "";
  if (!nome && !ano) return null;
  return [nome, ano].filter(Boolean).join(" ").trim() || null;
}

// Classificacao em rotulos canonicos (alinhado com tipos_servico_default).
export function normalizeServico(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const cleaned = collapse(raw).replace(/[.;,]+$/g, "");
  if (!cleaned) return null;

  const base = stripAccentsLower(cleaned);
  if (/\boleo\b|oleo/.test(base)) return "Troca de óleo";
  if (/amortecedor/.test(base)) return "Amortecedor";
  if (/revis/.test(base)) return "Revisão";

  return titleCase(cleaned);
}
