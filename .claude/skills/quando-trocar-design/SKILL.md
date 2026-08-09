---
name: quando-trocar-design
description: "Use when implementing, ajustando ou revisando qualquer UI/frontend deste projeto — landing, painel admin, componentes, CSS, telas web. Triggers: editando arquivos em app/, components/, app/globals.css, app/admin/, app/demo/, tailwind config, qualquer .tsx/.css; tarefas como 'criar página', 'nova seção', 'novo componente', 'ajustar layout', 'melhorar UI', 'aplicar identidade visual', 'aplicar marca', 'design da landing', 'tela do admin', 'mexer no hero', 'mudar cor', 'aplicar tema', 'criar dashboard'."
metadata:
  scope: project
  version: "0.2.0"
---

# Quando Trocar — Design Skill

Roteador de design deste projeto. **Esta skill não carrega tokens** — ela diz onde a verdade mora, o que é inegociável e quem ganha quando duas fontes discordam.

## Precedência (quem ganha)

1. **`app/globals.css`** (`@theme`) — tokens executáveis. Token que não está aqui **não existe**. Nunca crie valor de cor inline em componente.
2. **`docs/DESIGN.md`** — sistema de design normativo: paleta com nomes e papéis, hierarquia tipográfica, doutrina de profundidade, componentes, regras nomeadas, do's & don'ts. Segue a [spec DESIGN.md](https://github.com/google-labs-code/design.md); o `.impeccable/design.json` é o sidecar com sombras, motion, breakpoints e snippets de componente.
3. **`docs/product/design-system.md`** — memória de marca: o manual herdado da Perfect Automotive e o porquê dos desvios. Não normativo.
4. **Skill `impeccable`** (genérica, de terceiro) — orientação de craft. **Perde para 1–3 sempre.** Onde ela sugerir algo que contrarie o `DESIGN.md`, o `DESIGN.md` vence; o próprio SKILL.md dela manda respeitar o brief do projeto.

Outras fontes por tipo de tarefa:

- `docs/product/telas-web.md` — telas web mapeadas (consultar se a tarefa for sobre uma tela existente).
- `docs/product/copy.md` — copy oficial. Não inventar headline/CTA sem checar.
- Arte do feed Instagram → `.claude/skills/instagram-posts/SKILL.md` (fluxo GPT Image 2; não misturar com tokens de landing).

## A regra que mais se erra

**Laranja `#E19D4E` é o CTA primário. Vermelho `#EE2737` é urgência, nunca ação.**

Esse é o desvio deliberado frente ao manual herdado, que descrevia o vermelho como CTA. Um botão vermelho neste produto significa que algo deu errado, não que algo pode ser feito. Se um designer ou usuário pedir "botão vermelho" pensando no manual antigo, pergunte se ele quer CTA (`bg-brand`) ou alerta de urgência (`bg-red`).

As demais regras nomeadas — do Carimbo, do Tracking Negativo, da Mono Reservada, Sombra é Affordance — estão no `docs/DESIGN.md`.

## Logos

- `/public/logo-qt.png` — wordmark colorido (fundos claros)
- `/public/logo-qt-branco.png` — wordmark branco (fundos escuros, navy, feed Instagram)
- `/public/logo.png` — legado; preferir `logo-qt*`

> Os assets `logo_qt_byperfect*.png` estão **descontinuados** (traziam "by Perfect Automotive" embutido na imagem).

Nunca distorcer, sem opacity, sem sombra/outline/glow, sem rotação, sem cor alterada. Área de proteção = largura da letra "E". Tamanho mínimo: manter o wordmark "Quando Trocar" legível (não reduzir abaixo de ~12px de altura de texto).

## Workflow

1. Antes de codar UI nova, abra `app/globals.css` e veja quais tokens e utilitários já existem. Há uma família grande de utilitários prontos (grafismos, glows, hairlines, reveal por scroll) — **cheque com grep antes de criar similar**.
2. Se a tarefa pedir seção ou componente **sem precedente claro no codebase**, leia o `docs/DESIGN.md` inteiro.
3. Se a tarefa for sobre uma tela já existente, abra-a primeiro (`app/page.tsx`, `app/admin/*`, etc.) e siga as convenções daquela tela.
4. Verifique no browser com as preview tools quando a mudança for visual e o dev server estiver rodando.
5. Se um token novo for genuinamente necessário e reusável, adicione em `app/globals.css` `@theme` — não em arquivo separado — e reflita no `docs/DESIGN.md`.

## Quando atualizar a documentação

Decisão de design que vale para o projeto inteiro (trocou cor de marca, mudou família de fonte, adicionou família nova de utilitários, mudou a doutrina de profundidade):

1. `app/globals.css` — o token
2. `docs/DESIGN.md` — frontmatter + a seção correspondente (e `.impeccable/design.json` se envolver sombra, motion, breakpoint ou snippet de componente)
3. `docs/product/design-system.md` — **só** se o desvio precisar de justificativa histórica registrada
4. Esta skill — só se a **precedência** ou a regra do vermelho mudar

Mudança pontual de uma única tela não atualiza documentação nenhuma.

`/impeccable doctor` reporta deriva entre `globals.css`, `docs/DESIGN.md` e o sidecar.
