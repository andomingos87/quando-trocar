# Modulo: site-publico

Site publico de marketing + demo interativa + paginas legais. E a vitrine que vende a ferramenta
de retencao via WhatsApp para oficinas e roda o prototipo de validacao (demo).

## Fronteiras

**Pertence a este modulo:**
- Landing e raiz publica de `app/` (paginas nao-admin, nao-api).
- `app/demo/` — demo interativa.
- `app/privacidade/`, `app/termos/`, `app/exclusao-dados/` — paginas legais.
- `components/demo/`, `components/ui/` (componentes compartilhados de UI publica).
- `lib/demo-data.ts`, `lib/demo-store.ts`, `lib/chat-scripts.ts`.
- Assets em `public/`.

**NAO pertence:** UI/APIs do painel (modulo [[painel-admin]]), bot real (modulo [[whatsapp-bot]]),
cobranca (modulo [[billing]]), schema (modulo [[database]]).

## Regras/invariantes do modulo
- A demo e **prototipo de validacao** — usa dados/scripts locais (`demo-data`, `chat-scripts`),
  nao o backend real do bot. Nao confundir demo com produto.
- Paginas legais (privacidade, termos, exclusao de dados) sao exigencia da Meta/LGPD — nao remover
  nem quebrar links sem checar `docs/runbooks/` e o setup de WhatsApp em producao.
- Conteudo de copy/design de referencia fica fora do deploy (ver `.gitignore`:
  `docs/product/copy.md`, `docs/product/design-system.md`).
- Manter server-only fora de client components; seguir os padroes existentes de `components/ui`.
- A landing segue a ordem comercial: hero, transparencia, dor, como funciona, beneficios,
  objecoes, oferta, FAQ e CTA final. Nao usar prova social, estatistica, escassez ou promessa
  de resultado sem evidencia publicavel.
- A oferta publica e centralizada em `lib/landing-offer.ts`: 14 dias gratis, sem cartao nem
  cobranca automatica; depois R$ 59/mes, sem fidelidade. Sem confirmacao de continuidade, o
  servico fica pausado.
- Prazo, preco e microcopy da oferta **nunca** aparecem como literal em componente — sempre via
  `LANDING_OFFER`. `tests/landing-offer-literals.test.ts` barra `R$ <numero>`, `14 dias` e `59`
  nos arquivos da landing.
- A ancora de preco do card de oferta e o **mensal** (`monthlyPrice`); o teste entra como
  modificador (`trialPriceLabel` = R$ 0 nos primeiros 14 dias). Nao promover R$ 0 a ancora.
- Os roteiros da demo (`lib/chat-scripts.ts`) e os baloes de `components/como-funciona.tsx`
  falam em **prazo relativo** ("daqui a ~5 meses"), nunca em data absoluta: "set/2026" vira
  passado sem quebrar nada e a demo passa a exibir agendamento vencido.
  `tests/landing-offer-literals.test.ts` barra mes/ano, ISO e dd/mm/aaaa nesses arquivos.
- Wordmark oficial: `public/logo-qt.png` (fundo claro) e `public/logo-qt-branco.png` (fundo
  escuro), 1441x403. Os arquivos `logo_qt_byperfect*.png` e `logo.png` estao **descontinuados**
  (traziam "by Perfect Automotive" ou a versao preta) e nao devem voltar a ser referenciados.
- `public/og.png` (1200x630) e a imagem de compartilhamento; o link da landing circula por
  WhatsApp, entao ela nao pode faltar. Fonte reproduzivel: `scripts/marketing/og-source.html`.
- Todo CTA primario da landing abre o WhatsApp em nova aba com origem valida (`landing_nav`,
  `landing_hero`, `landing_como_funciona`, `landing_oferta`, `landing_floating_mobile` ou
  `landing_cta_final`). A origem e telemetria textual de MVP, nao uma plataforma de analytics.
- A configuracao publica descreve a oferta; ela nao executa expiracao, pagamento ou transicao
  de `agent_mode`. Essas automacoes pertencem aos modulos de bot e billing.

## Testes
- `tests/landing-offer.test.ts` cobre contrato comercial, origens, links, fallback da demo e
  regra do CTA flutuante. Rodar tambem `npm run build` ao mexer em rotas/boundary server-client.

## Referencias
- Prototipo de validacao: `docs/product/PRD-landing-prototype.md`
- Instagram (arte e copy do feed): `docs/marketing/instagram/estrategia.md`, `mes-1-posts.md`; skill `.claude/skills/instagram-posts/SKILL.md`
- Convencoes: `.context/conventions.md`
- Design/copy de referencia (gitignored): `docs/product/design-system.md`, `docs/product/copy.md`
