// Catalogo de CNAEs que define o ICP do Quando Trocar em formato de dado.
//
// A tese do produto e "infraestrutura de retorno": serve o servico automotivo com
// RETORNO PREVISIVEL. E isso que separa mecanica e troca de oleo (o cliente volta em
// ~90 dias, por definicao) de funilaria (volta quando bater o carro de novo).
//
// Codigos sem formatacao, como vem da RFB (7 digitos).

export type CategoriaCnae =
  /** E a definicao do ICP: servico recorrente por natureza. */
  | "nucleo"
  /** Retorno previsivel, um passo abaixo do nucleo. */
  | "alto"
  /** Serve, mas o retorno e menos regular. */
  | "medio"
  /** Automotivo, porem sem cadencia previsivel de retorno. */
  | "baixo"
  /** Nao e ICP em nenhuma hipotese — descarte duro. */
  | "excluir"
  /** Fora do dominio automotivo. */
  | "neutro";

const CATALOGO: Record<string, { categoria: CategoriaCnae; descricao: string }> = {
  "4520001": { categoria: "nucleo", descricao: "Manutencao e reparacao mecanica de veiculos" },
  "4520005": { categoria: "nucleo", descricao: "Lavagem, lubrificacao e polimento" },
  "4520004": { categoria: "alto", descricao: "Alinhamento e balanceamento" },
  "4520003": { categoria: "alto", descricao: "Manutencao e reparacao eletrica" },
  "4520007": { categoria: "medio", descricao: "Instalacao e reparacao de acessorios" },
  "4520002": { categoria: "baixo", descricao: "Lanternagem, funilaria e pintura" },
  "4520006": { categoria: "baixo", descricao: "Borracharia" },
  "4520008": { categoria: "baixo", descricao: "Capotaria" },
  "4530703": { categoria: "medio", descricao: "Varejo de pecas e acessorios novos" },
  "4530704": { categoria: "baixo", descricao: "Varejo de pecas e acessorios usados" },
  "4530705": { categoria: "baixo", descricao: "Varejo de pneumaticos e camaras-de-ar" },
  "4530701": { categoria: "excluir", descricao: "Atacado de pecas e acessorios" },
  "4530702": { categoria: "excluir", descricao: "Atacado de pneumaticos" },
  "4530706": { categoria: "excluir", descricao: "Representantes comerciais de pecas" },
  "4511101": { categoria: "excluir", descricao: "Varejo de automoveis novos" },
  "4511102": { categoria: "excluir", descricao: "Varejo de automoveis usados" },
  "4511103": { categoria: "excluir", descricao: "Atacado de automoveis" },
  "4511104": { categoria: "excluir", descricao: "Atacado de caminhoes" },
  "4511105": { categoria: "excluir", descricao: "Atacado de reboques" },
  "4511106": { categoria: "excluir", descricao: "Atacado de onibus" },
};

/** CNAEs que fazem um estabelecimento entrar na base. Abaixo disso nao ingerimos. */
const CATEGORIAS_INGERIVEIS: ReadonlySet<CategoriaCnae> = new Set<CategoriaCnae>([
  "nucleo",
  "alto",
  "medio",
]);

export function classificarCnae(cnae: string | null | undefined): CategoriaCnae {
  if (!cnae) return "neutro";
  const limpo = cnae.replace(/\D+/g, "");
  return CATALOGO[limpo]?.categoria ?? "neutro";
}

export function descreverCnae(cnae: string | null | undefined): string | null {
  if (!cnae) return null;
  return CATALOGO[cnae.replace(/\D+/g, "")]?.descricao ?? null;
}

/**
 * CNAEs fora do dominio automotivo que ainda assim podem ser oficina de verdade,
 * desde que acumulem um servico recorrente no secundario.
 *
 * Lista curta de proposito. Aceitar QUALQUER principal com mecanica no secundario
 * enche a base de transportadora, estacionamento e despachante — empresas que fazem
 * manutencao da PROPRIA frota e nao tem cliente final para lembrar. Sem cliente
 * final, nao ha retorno para agendar, e o produto nao serve.
 */
const PRINCIPAIS_PONTE: ReadonlySet<string> = new Set([
  "4731800", // Comercio varejista de combustiveis — posto que faz troca de oleo
]);

/**
 * Decide se o estabelecimento entra na base.
 *
 * O CNAE principal manda: se ele e de exclusao (concessionaria, atacado), esta fora
 * mesmo que tenha "mecanica" como secundario — quem vende carro nao e nosso cliente.
 * Se o principal e de baixo retorno (funilaria, borracharia), so entra acumulando um
 * servico recorrente. Fora do dominio automotivo, so a lista-ponte acima passa.
 */
export function ehCandidatoIcp(
  cnaePrincipal: string | null | undefined,
  cnaesSecundarios: readonly string[] = [],
): boolean {
  const principal = classificarCnae(cnaePrincipal);
  if (principal === "excluir") return false;
  if (CATEGORIAS_INGERIVEIS.has(principal)) return true;

  const temServicoRecorrente = cnaesSecundarios.some((c) => {
    const cat = classificarCnae(c);
    return cat === "nucleo" || cat === "alto";
  });

  if (principal === "baixo") {
    // funilaria/borracharia so entram se acumularem um servico recorrente
    return cnaesSecundarios.some((c) => CATEGORIAS_INGERIVEIS.has(classificarCnae(c)));
  }

  const limpo = (cnaePrincipal ?? "").replace(/\D+/g, "");
  return PRINCIPAIS_PONTE.has(limpo) && temServicoRecorrente;
}

/** Todos os CNAEs do dominio automotivo — util para pre-filtro e relatorios. */
export function cnaesAutomotivos(): string[] {
  return Object.keys(CATALOGO);
}
