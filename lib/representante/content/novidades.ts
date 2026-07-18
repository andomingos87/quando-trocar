// Novidades para a rede de representantes (ADR-0025, Fase R4.4). Conteudo
// ESTATICO, curado no repositorio: publicar uma novidade = adicionar um item
// neste array + deploy. Ver runbook docs/runbooks/publicar-novidade-representante.md.
//
// Ordene por `data` desc (mais recente primeiro). `data` no formato "YYYY-MM-DD".

export type NovidadeTag = "produto" | "comercial" | "aviso";

export type Novidade = {
  id: string;
  data: string; // YYYY-MM-DD
  titulo: string;
  corpo: string;
  tag: NovidadeTag;
};

export const NOVIDADES: Novidade[] = [
  {
    id: "2026-07-18-portal-no-ar",
    data: "2026-07-18",
    titulo: "Seu portal do representante está no ar",
    corpo:
      "A partir de agora você acompanha aqui, em um só lugar: as oficinas que você trouxe, os leads no funil, o extrato das suas comissões e o playbook de vendas. Tudo pelo celular. Copie seu link na Visão geral e comece a divulgar.",
    tag: "produto",
  },
  {
    id: "2026-07-18-como-usar-seu-link",
    data: "2026-07-18",
    titulo: "Use sempre o seu link para não perder comissão",
    corpo:
      "A oficina só fica atribuída a você se a primeira mensagem dela carregar o seu #REP-código. Copie o link pronto na Visão geral (botão “Copiar link”) e divulgue esse link — não reescreva a mensagem tirando o código.",
    tag: "comercial",
  },
];

// Retorna as novidades ordenadas da mais recente para a mais antiga.
export function listNovidades(): Novidade[] {
  return [...NOVIDADES].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}
