---
name: quando-trocar-design
description: "Use when implementing, ajustando ou revisando qualquer UI/frontend deste projeto — landing, painel admin, componentes, CSS, telas web. Triggers: editando arquivos em app/, components/, app/globals.css, app/admin/, app/demo/, tailwind config, qualquer .tsx/.css; tarefas como 'criar página', 'nova seção', 'novo componente', 'ajustar layout', 'melhorar UI', 'aplicar identidade visual', 'aplicar marca', 'design da landing', 'tela do admin', 'mexer no hero', 'mudar cor', 'aplicar tema', 'criar dashboard'."
metadata:
  scope: project
  version: "0.1.0"
---

# Quando Trocar — Design Skill

Guia obrigatório quando você for tocar qualquer pedaço de UI deste projeto. A identidade visual segue o **Manual Perfect Automotive** adaptado para o produto **Quando Trocar** — não é genérico, e tem desvios deliberados que não estão no PDF original.

## Fontes de verdade (nessa ordem)

1. `app/globals.css` — **tokens reais usados em produção** (Tailwind v4 `@theme`). Esta é a fonte canônica para cores, fontes e utilitários custom. Se o que você precisa já existe aqui, **reuse**; nunca crie tokens inline em componentes.
2. `docs/product/design-system.md` — fundamento da marca (paleta, tipografia, grafismos, regras de logo). Ler integralmente se a tarefa for criar **uma seção nova de landing** ou um **componente reutilizável de alto nível**.
3. `docs/product/telas-web.md` — telas web mapeadas (consultar se a tarefa for sobre uma tela existente).
4. `docs/product/copy.md` — copy oficial. Não inventar headline/CTA sem checar.

## Desvio importante: laranja é o CTA primário, não o vermelho

O manual Perfect Automotive descreve vermelho `#EE2737` como CTA primário. **No Quando Trocar isso mudou:**

- **Laranja `#E19D4E`** (cor do "CAR" no logo Quando Trocar) → **CTA primário**, ações principais, foco.
- **Vermelho `#EE2737`** → **urgência / destaque pontual** (alertas, badges de atenção). **NÃO usar como botão primário.**
- **Navy `#001E62`** → texto principal sobre fundo claro, fundos institucionais.
- **Ink-deep `#041C2C`** → fundos mais escuros, footer.
- **Ciano `#71C5E8`** e **laranja vivo `#FFA300`** → acentos pontuais (badges, tags, decoração), não estruturais.

Se um designer/usuário pedir "botão vermelho" pensando no manual antigo, pergunte se ele quer CTA (laranja `bg-brand`) ou alerta de urgência (`bg-red`).

## Tokens disponíveis (já no globals.css → classes Tailwind)

Cores principais (use as classes Tailwind: `bg-*`, `text-*`, `border-*`):

| Token | Hex | Uso |
|-------|-----|-----|
| `brand` / `brand-dark` / `brand-deep` / `brand-soft` | `#E19D4E` família | CTA primário, foco, links de marca |
| `ink` / `ink-soft` / `ink-deep` | navy `#001E62` → `#041C2C` | Texto principal, fundos institucionais, footer |
| `paper` / `paper-soft` | `#fff` / `#f5f7fb` | Fundos claros |
| `line` / `line-soft` | `#dde3ee` / `#eef2f8` | Bordas, divisores |
| `muted` | `#5b6478` | Corpo de texto secundário |
| `red` / `red-soft` | `#EE2737` / `#fde2e4` | **Urgência apenas**, não CTA |
| `cyan` / `cyan-soft` | `#71C5E8` / `#e0f3fb` | Acento secundário, links, badges |
| `orange` / `orange-soft` | `#FFA300` / `#fff1d1` | Acento terciário, badges |
| `navy` / `dark` | aliases | Sinônimos legados de `ink` / `ink-deep` — preferir `ink*` |
| `wa-*` | tons WhatsApp | Bolhas/chats demonstrativos — não usar fora de mockups WA |

Tipografia: `font-sans` = **DM Sans** (fallback de Graphik por spec). Pesos: 400 corpo, 500 labels/nav, 600 títulos/CTAs. Use `.font-display` para títulos grandes (tracking apertado + ligaturas).

Utilitários custom já prontos (todos em `app/globals.css` — verifique antes de criar similar):
`bg-grain`, `bg-blueprint`, `bg-blueprint-fade`, `bg-dots`, `chat-dots`, `glow-brand`, `glow-border`, `bg-stripes-soft`, `underline-brand`, `underline-brand-dark`, `hairline`, `hairline-dark`, `animate-pulse-dot`, `animate-typing-bounce`, `animate-glow-pulse`, `reveal` + `reveal-stagger` (scroll reveal via IntersectionObserver).

## Logos

- `/public/logo_qt_byperfect.png` — versão colorida (fundos claros)
- `/public/logo_qt_byperfect_white.png` — versão branca (fundos escuros: navy, ink-deep, brand)
- `/public/logo.png` — versão genérica

Regras do manual que **continuam valendo**: nunca distorcer, sem opacity, sem sombra/outline/glow, sem rotação, sem cor alterada. Área de proteção = largura da letra "E". Tamanho mínimo: "PERFECT" 12px, "AUTOMOTIVE" 6px.

## Princípios de layout

- **Alinhamento à esquerda** sempre em blocos de texto. Nunca centralizar parágrafos.
- **Assimetria intencional** — evite layouts perfeitamente espelhados.
- **Grafismos diagonais** quando precisar de energia: `clip-path` em ângulo, `transform: skewY(-2deg)`, paralelogramos ~15–20°. Usar com parcimônia.
- **Espaço negativo generoso** em seções institucionais.
- Hierarquia tipográfica clara: hero (clamp 3rem→6rem, weight 600, tracking -0.02em) → seção (2rem→3.5rem) → subtítulo (1.125rem→1.5rem) → corpo (1rem, line-height 1.6) → label (0.75rem, uppercase, letter-spacing 0.1em).

## Iconografia

Flat, monocromático, geométrico, espessura única. Ângulo coincide com o ângulo do símbolo do logo. Se introduzir biblioteca de ícones nova, justifique — preferir manter consistência com o que já existe no projeto (lucide-react se for o padrão atual; checar antes).

## Don'ts (não fazer)

- Não criar valores de cor hardcoded em componentes (`#xxxxxx`, `rgb(...)`). Sempre usar token via classe Tailwind ou `var(--color-*)`.
- Não usar gradientes roxos, neon, glassmorphism genérico ou aesthetic "AI generic". Não é a marca.
- Não usar Inter, Roboto ou Arial como display. `font-sans` (DM Sans) já é o fallback oficial de Graphik.
- Não centralizar blocos de texto longos.
- Não usar **vermelho** como CTA primário — esse é o desvio do projeto. CTA = `bg-brand` (laranja).
- Não aplicar efeitos no logo (sombra, glow, opacity, rotate, outline).
- Não introduzir emojis decorativos em UI (só quando o usuário pedir explicitamente).
- Não duplicar utilitários que já existem em `globals.css`. Cheque primeiro com grep.
- Não inflar `globals.css` com one-offs — se for usado em **uma** tela, deixe inline com Tailwind utility classes.

## Workflow recomendado

1. Antes de codar UI nova, abra `app/globals.css` e veja quais tokens/utilitários já existem.
2. Se a tarefa pedir uma **seção ou componente sem precedente claro no codebase**, leia `docs/product/design-system.md` § relevante (cores, tipografia, layout, componentes sugeridos).
3. Se a tarefa for sobre uma tela já existente, abra-a primeiro (`app/page.tsx`, `app/admin/*`, etc.) e siga as convenções daquela tela.
4. Verifique no browser com preview tools quando a mudança for visual e o dev server estiver rodando.
5. Se descobrir que um token novo é genuinamente necessário (e reusável), adicione em `app/globals.css` `@theme` — não em arquivo separado.

## Quando atualizar a documentação

Se você fizer uma decisão de design que vale para o projeto inteiro (ex.: trocou cor de marca, mudou família de fonte, adicionou família nova de utilitários), atualize:

1. `app/globals.css` — tokens
2. `docs/product/design-system.md` — explicar o desvio (não apagar o original, anotar a adaptação Quando Trocar)
3. Esta skill — se a regra/desvio muda comportamento futuro

Não atualize docs para mudanças pontuais de uma única tela.
