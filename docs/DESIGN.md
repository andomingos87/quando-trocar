---
name: Quando Trocar
description: Lembrete automático de manutenção por WhatsApp para oficinas mecânicas
colors:
  brand: "#E19D4E"
  brand-dark: "#c87f30"
  brand-deep: "#8e5a1f"
  brand-soft: "#fdf0dc"
  ink: "#001E62"
  ink-soft: "#0a2a7a"
  ink-deep: "#041C2C"
  paper: "#ffffff"
  paper-soft: "#f5f7fb"
  line: "#dde3ee"
  line-soft: "#eef2f8"
  muted: "#5b6478"
  red: "#EE2737"
  red-soft: "#fde2e4"
  cyan: "#71C5E8"
  cyan-soft: "#e0f3fb"
  orange: "#FFA300"
  orange-soft: "#fff1d1"
typography:
  display:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6.2vw, 4.75rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.035em"
    fontFeature: "ss01, ss02"
  headline:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  title:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 2.6vw, 2.125rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  lead:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.125rem, 1.8vw, 1.4rem)"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1rem, 1.4vw, 1.1875rem)"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.18em"
  ui-lg:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  ui-md:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  ui-base:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  ui-sm:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.35
  ui-xs:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.3
  ui-2xs:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.06em"
rounded:
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
  2xl: "1rem"
  full: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  section-y: "5rem"
  section-y-lg: "7rem"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.paper}"
    rounded: "{rounded.2xl}"
    padding: "1rem 1.5rem"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.paper}"
    rounded: "{rounded.2xl}"
    padding: "1rem 1.5rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "1rem 1.5rem"
  button-white:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.brand}"
    rounded: "{rounded.2xl}"
    padding: "1rem 1.5rem"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "1.25rem"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.75rem"
  modal:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "1.25rem"
    width: "min(90vw, 32rem)"
  eyebrow:
    backgroundColor: "transparent"
    textColor: "{colors.brand}"
    typography: "{typography.label}"
---

# Design System: Quando Trocar

> **Fonte de verdade executável é `app/globals.css` (`@theme`).** Este arquivo espelha aqueles tokens em formato legível por máquina e registra o que o CSS não consegue dizer: o porquê, as regras e as proibições. Se os dois divergirem, o `globals.css` está certo e este arquivo está desatualizado — rode `/impeccable doctor`.
>
> Cabeçalhos em inglês por exigência da [spec DESIGN.md](https://github.com/google-labs-code/design.md) (portabilidade entre ferramentas); prosa em português, conforme a convenção do repositório.

## Overview

**Creative North Star: "A Ordem de Serviço"**

O sistema visual do Quando Trocar é o documento técnico da oficina, não o site de SaaS. Papel com grão de jornal, grid de desenho técnico ao fundo, carimbo laranja de aprovado, navy institucional que segura o conjunto. A referência não é o dashboard de startup — é a folha que o mecânico preenche, prende na prancheta e entrega ao cliente: legível a um metro de distância, sem ornamento, com a informação importante marcada em cor forte.

Isso tem consequência prática. A textura (`bg-grain`, `bg-blueprint`) existe para dar superfície ao papel, não para "dar profundidade". O eyebrow monoespaçado em caixa alta com `tracking` de `0.18em` é rótulo de campo de formulário, não decoração tipográfica. E o botão primário tem sombra sólida de 6px que afunda ao clique porque, neste mundo, o que é acionável é fisicamente acionável.

A densidade muda com a superfície, o vocabulário não: a landing (**Persuade**) respira, o painel admin (**Operate**) comprime. Ambos usam os mesmos tokens, a mesma família, a mesma doutrina de profundidade.

**Key Characteristics:**
- Laranja de carimbo sobre navy institucional — nunca o inverso
- Texturas técnicas (grão, blueprint, hairline) em vez de sombra difusa
- Tipografia única (DM Sans) carregando toda a hierarquia por peso e tamanho, com monoespaçada só em rótulo
- Componentes táteis: o que clica, afunda
- Alinhamento à esquerda como padrão inegociável

## Colors

Paleta de dois pesos: um navy institucional que ocupa área e um laranja de baixa saturação que aparece pouco e manda muito.

### Primary
- **Laranja Ordem de Serviço** (`#E19D4E`): o laranja do "CAR" no logotipo. CTA primário, foco, links de marca, elemento ativo. É o único token que autoriza ação. `brand-dark` (`#c87f30`) é a sombra sólida do botão; `brand-deep` (`#8e5a1f`) é o laranja legível como texto sobre fundo claro; `brand-soft` (`#fdf0dc`) é o realce de fundo e o marca-texto do `underline-brand`.

### Secondary
- **Navy Prancheta** (`#001E62`): texto principal sobre fundo claro e fundo das seções institucionais. `ink-soft` (`#0a2a7a`) para hover; `ink-deep` (`#041C2C`) para o fundo mais escuro do sistema — rodapé e seções de encerramento.

### Tertiary
- **Ciano Diagrama** (`#71C5E8`): acento pontual em badge, tag e ilustração. Nunca estrutural.
- **Âmbar Sinal** (`#FFA300`): acento terciário, mais saturado que o `brand`. Badge e destaque — **não** substitui o `brand` em CTA.
- **Vermelho Alerta** (`#EE2737`): urgência, erro, atenção. Ver a regra abaixo.

### Neutral
- **Papel** (`#ffffff`) e **Papel Frio** (`#f5f7fb`): as duas camadas de fundo claro. A alternância entre elas é o principal recurso de separação entre seções.
- **Linha** (`#dde3ee`) e **Linha Suave** (`#eef2f8`): borda e divisor de 1px.
- **Cinza Corpo** (`#5b6478`): texto secundário e parágrafo de apoio. Cinza frio, dessaturado, para não competir com o navy.

### Named Rules

**A Regra do Carimbo.** O laranja `brand` ocupa no máximo ~10% de qualquer tela. Ele é o carimbo na ordem de serviço: uma marca por documento. Uma tela com três blocos laranja não tem hierarquia, tem ruído.

**A Regra do Vermelho Reservado.** `#EE2737` é urgência, nunca ação. É o desvio deliberado do manual de marca herdado, que descrevia o vermelho como CTA primário. Aqui: CTA é `brand`; vermelho é alerta, erro, atraso, badge de atenção. Um botão vermelho neste produto significa que algo deu errado, não que algo pode ser feito. Quando alguém pedir "botão vermelho", confirme se quer CTA (`bg-brand`) ou urgência (`bg-red`).

## Typography

**Display Font:** DM Sans (fallback declarado para Graphik na especificação de marca)
**Body Font:** DM Sans — a mesma família
**Label/Mono Font:** `ui-monospace` / SF Mono / Menlo / Consolas

**Character:** Uma família só, carregando tudo por peso e tamanho. DM Sans é geométrica e neutra o bastante para não roubar cena do laranja, e tem `ss01`/`ss02` ativados no `body` (aplicados globalmente via `font-feature-settings`) — é o que dá o desenho fechado ao `a` e ao `g` e evita a leitura genérica. A monoespaçada aparece exclusivamente em rótulo: é a etiqueta de campo do formulário técnico.

### Hierarchy
- **Display** (700, `clamp(2.5rem, 6.2vw, 4.75rem)`, `line-height: 0.98`, `letter-spacing: -0.035em`): hero. Aplicado via `.font-display`, que também liga `ss01`/`ss02`.
- **Headline** (700, `clamp(2rem, 4vw, 3.25rem)`, `-0.035em`): título de seção.
- **Title** (600, `clamp(1.5rem, 2.6vw, 2.125rem)`, `-0.02em`): subtítulo e título de card.
- **Lead** (400, `clamp(1.125rem, 1.8vw, 1.4rem)`, `line-height: 1.5`): parágrafo de abertura de seção. É o tamanho mais reutilizado do sistema.
- **Body** (400, `clamp(1rem, 1.4vw, 1.1875rem)`, `line-height: 1.625`): corpo. Limitar a `max-w-[520px]` a `65ch`.
- **Label** (mono, `11px`, caixa alta, `letter-spacing: 0.18em`): eyebrow e rótulo. Sempre acompanhado do traço de 24×1px que o componente `Eyebrow` desenha à esquerda.

### Escala de interface (superfície Operate)

A hierarquia acima é fluida (`clamp`) e serve à landing. O painel admin e a área do representante usam uma escala fixa e densa, porque tabela e formulário não podem respirar com o viewport:

- **ui-lg** (400, `15px`, `1.5`): corpo de leitura do admin, descrição de card.
- **ui-md** (400, `14px`, `1.45`): corpo de formulário, valor de campo.
- **ui-base** (400, `13px`, `1.4`): corpo de tabela, item de navegação.
- **ui-sm** (500, `12px`, `1.35`): metadado, timestamp, texto de apoio.
- **ui-xs** (500, `11px`, `1.3`): badge, chip, contador.
- **ui-2xs** (600, `10px`, `letter-spacing: 0.06em`): caption densa de tabela, rótulo de coluna. É o menor tamanho permitido do sistema.

Abaixo de `10px` não existe. Acima de `15px` no admin, suba para `title`.

### Named Rules

**A Regra do Tracking Negativo.** Todo título grande fecha o espacejamento (`-0.02em` a `-0.035em`). DM Sans em corpo grande com tracking padrão lê como slide de apresentação. O aperto é o que faz o título parecer desenhado.

**A Regra da Mono Reservada.** A monoespaçada só aparece em caixa alta, ≤12px, com tracking ≥0.14em. Nunca em corpo de texto, nunca em título. Ela é etiqueta, não voz.

## Layout

Container de `1080px` para conteúdo de seção (`Section`), `1200px` para a barra de navegação — a nav é deliberadamente mais larga que o conteúdo. Ritmo vertical de seção: `py-20` no mobile, `py-28` a partir de `md`. Padding lateral `px-5` → `sm:px-8`.

Alternância de fundo é o recurso primário de separação: `paper` → `paper-soft` → `ink` → `ink-deep`, sem régua divisória entre seções. Quando um divisor é necessário dentro de uma seção, use `.hairline` (gradiente que some nas pontas), não uma borda sólida de ponta a ponta.

Alinhamento à esquerda em todo bloco de texto. Assimetria intencional — layouts perfeitamente espelhados são evitados. Espaço negativo generoso nas seções institucionais; densidade maior no admin, onde a tarefa manda.

Grafismo diagonal (`clip-path` em ângulo, `skewY(-2deg)`, paralelogramo de 15–20°) é permitido para dar energia, com parcimônia.

## Elevation & Depth

**O sistema é chapado por padrão.** Profundidade vem de camada tonal (`paper` → `paper-soft` → `ink` → `ink-deep`), de hairline de 1px e de textura (`bg-grain`, `bg-blueprint`, `bg-dots`, `bg-stripes-soft`). Não há sombra ambiente decorativa em superfície que esteja no fluxo da página.

Sombra existe em exatamente dois papéis:

1. **Affordance física** — a sombra sólida sem blur do botão, que encurta ao ser pressionada.
2. **Camada flutuante** — o que está literalmente acima da página: modal, dropdown, tooltip, CTA flutuante.

### Shadow Vocabulary
- **Botão em repouso** (`box-shadow: 0 6px 0 var(--color-brand-dark)`): sombra sólida, sem blur, na cor escura do próprio botão. É espessura, não sombra.
- **Botão em hover** (`0 8px 0 var(--color-brand-dark)` + `translateY(-2px)`): o botão sobe.
- **Botão pressionado** (`0 2px 0 var(--color-brand-dark)` + `translateY(2px)`): o botão afunda. Transição de `150ms` sobre `transform, background, box-shadow`.
- **Camada flutuante** (`shadow-xl` do Tailwind): modal e CTA flutuante.
- **Popover** (`shadow-lg` + `ring-1 ring-ink/5`): menu de usuário e dropdown.
- **Borda hairline em card** (`0 1px 1px rgba(0,0,0,0.08)`): quase imperceptível, apenas para descolar o card do fundo `paper-soft`.

### Named Rules

**A Regra Sombra é Affordance.** Sombra difusa em superfície que não flutua é proibida. Se um card precisa se destacar, ele ganha borda `line`, fundo `paper` sobre `paper-soft`, ou hairline — não `shadow-md`.

> **Desvios conhecidos no código (2 ocorrências).** [components/preco.tsx](components/preco.tsx) e [components/como-funciona.tsx](components/como-funciona.tsx) usam `hover:shadow-xl` em cards que não flutuam. Contraria a regra acima. Registrado, não corrigido — corrigir é mudança de design, não de documentação.

## Shapes

Raio generoso e consistente, escalando com o tamanho do elemento: `full` para pílula, badge e ponto de status (o raio mais frequente do sistema, 20 ocorrências); `2xl` (1rem) para botão, card e modal; `xl` (0.75rem) para dropdown; `lg` (0.5rem) para input do admin; `md` (0.375rem) para botão compacto de tabela.

Borda de 1px em `line` é o contorno padrão. O botão `ghost` é a exceção com borda de 2px em `ink` — ele precisa do peso porque não tem preenchimento.

Iconografia: flat, monocromática, geométrica, espessura única, no ângulo do símbolo do logotipo.

## Components

### Buttons
- **Shape:** `rounded-2xl` (1rem), `px-6 py-4`, `font-extrabold` (800), `gap-2.5` entre ícone e rótulo.
- **Primary:** `bg-brand` + texto branco + sombra sólida `0 6px 0 brand-dark`. É o único botão de ação principal.
- **Hover / Focus:** sobe `2px`, sombra vai a `8px`. **Active:** desce `2px`, sombra a `2px`. Transição `150ms`.
- **Ghost:** transparente, texto `ink`, borda `2px ink`; no hover inverte para `bg-ink` + texto branco.
- **White:** para uso sobre fundo `brand` ou `ink` — fundo branco, texto `brand`, sombra `0 6px 0 rgba(0,0,0,0.2)`.

### Cards / Containers
- **Corner Style:** `rounded-2xl`.
- **Background:** `paper` sobre seção `paper-soft`; `ink-soft` translúcido sobre seção `ink`.
- **Shadow Strategy:** nenhuma (ver Elevation & Depth).
- **Border:** `1px solid line`.
- **Internal Padding:** `1.25rem` (`p-5`).

### Inputs / Fields
- **Style:** `rounded-lg`, `border border-line`, fundo branco, `px-3 py-2`, `text-sm`.
- **Focus:** `outline-none focus:border-brand` — a borda troca para laranja. Sem glow, sem ring colorido.
- **Error:** `border-red/30` + `bg-red-soft` + `text-red`.
- **Disabled:** `opacity-50`.

### Navigation
- Sticky, `z-50`, `bg-paper/85` com `backdrop-blur-xl`, borda inferior `line/80`. Links em `13.5px` `text-muted` que viram `text-ink` no hover. Divisor vertical de `1px × 20px` em `line` entre grupos. No mobile, gaveta com `admin-drawer` (`translateX` de 180ms).

### Eyebrow (componente assinatura)
Rótulo de seção: traço horizontal de `24×1px` na cor do tom + texto mono `11px` caixa alta com `tracking-[0.18em]`. Três tons: `brand`, `ink`, `white`. É o que dá ao sistema a leitura de documento técnico — usar em toda abertura de seção.

### Reveal (comportamento assinatura)
`.reveal` + `.reveal-stagger` fazem entrada por scroll via `IntersectionObserver` que seta `data-revealed`. Direções: `up`, `down`, `left`, `right`, `scale`, `fade`. Escalonamento até 9 filhos com atraso configurável (`--reveal-stagger`, padrão `0.1s`). Respeita `prefers-reduced-motion` desligando tudo.

## Do's and Don'ts

### Do:
- **Do** usar `bg-brand` (`#E19D4E`) como CTA primário — é o desvio deliberado deste projeto frente ao manual herdado.
- **Do** consultar `app/globals.css` antes de criar qualquer token ou utilitário: `bg-grain`, `bg-blueprint`, `bg-blueprint-fade`, `bg-dots`, `chat-dots`, `glow-brand`, `glow-border`, `bg-stripes-soft`, `underline-brand`, `underline-brand-dark`, `hairline`, `hairline-dark`, `animate-pulse-dot`, `animate-typing-bounce`, `animate-glow-pulse`, `reveal`/`reveal-stagger` já existem.
- **Do** alinhar todo bloco de texto à esquerda.
- **Do** abrir seção com o componente `Eyebrow`.
- **Do** apertar o tracking em título grande (`-0.02em` a `-0.035em`).
- **Do** separar seções por alternância de fundo (`paper` ↔ `paper-soft` ↔ `ink`), não por régua.
- **Do** manter o laranja em ≤10% da tela.

### Don't:
- **Don't** usar vermelho `#EE2737` como botão primário — ele é urgência, nunca ação.
- **Don't** escrever cor literal (`#xxxxxx`, `rgb(...)`) em componente. Use a classe do token ou `var(--color-*)`.
- **Don't** aplicar sombra difusa (`shadow-md`, `shadow-lg`) em superfície que não flutua sobre a página.
- **Don't** usar gradiente roxo→azul, neon, glassmorphism ou qualquer estética genérica de IA. Não é a marca.
- **Don't** usar Inter, Roboto ou Arial como display — `font-sans` (DM Sans) já é o fallback oficial de Graphik.
- **Don't** centralizar parágrafo longo.
- **Don't** usar a monoespaçada fora de rótulo em caixa alta ≤12px.
- **Don't** aplicar efeito no logotipo: sem sombra, glow, opacidade, rotação, outline ou alteração de cor. Área de proteção = largura da letra "E".
- **Don't** usar os tokens `wa-*` fora de mockup de conversa de WhatsApp.
- **Don't** introduzir emoji decorativo em UI sem pedido explícito.
- **Don't** inflar o `globals.css` com one-off: se vale para uma tela só, resolva com utility class inline.
