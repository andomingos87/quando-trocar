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

## Testes
- Sem suite dedicada atualmente (modulo majoritariamente de apresentacao). Rodar `npm run build`
  ao mexer em rotas/boundary server-client.

## Referencias
- Prototipo de validacao: `docs/product/PRD-landing-prototype.md`
- Convencoes: `.context/conventions.md`
- Design/copy de referencia (gitignored): `docs/product/design-system.md`, `docs/product/copy.md`
