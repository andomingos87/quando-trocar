---
name: instagram-posts
description: >-
  Use when producing Instagram feed art for Quando Trocar — montar prompt do GPT Image 2,
  anexos (logo, referência visual do usuário, print de WhatsApp), revisar texto da arte ou legenda,
  ou editar docs/marketing/instagram/*.md. Triggers: post do Instagram, arte do feed, GPT Image,
  mes-1-posts, estrategia instagram, prompt de cena, bloco MARCA, direção CENA/RETRATO/PAINEL.
metadata:
  scope: project
  version: "2.0.0"
---

# Instagram — produção de arte (Quando Trocar)

Guia para gerar ou revisar posts do feed. Fonte da verdade: `docs/marketing/instagram/`.

## Fontes (nessa ordem)

1. `docs/marketing/instagram/estrategia.md` §7 — bloco `MARCA`, direções de cena, anexos, iteração
2. `docs/marketing/instagram/mes-1-posts.md` — 12 posts do mês 1 (CENA + tabela TEXTO + legenda)
3. `docs/regras-de-negocio.md` — guardrails de comunicação (§ estrategia §4); nunca prometer o que o produto não faz
4. `.claude/skills/quando-trocar-design/SKILL.md` — tokens de cor e logo quando precisar calibrar `#E19D4E`, navy, wordmark

## Princípio — prompt curto, referência anexada

A peça sai **completa** do GPT Image 2: cena + texto em português + URL + logo. Nada de pedir imagem sem texto ou sem logo para montar depois — o modelo reproduz acento, hierarquia tipográfica e o wordmark anexado.

Prompt **curto e aberto**. Diga só duas coisas: o que é marca (bloco `MARCA`) e qual é a ideia da cena (1 a 3 frases). Enquadramento, lente, profundidade de campo, textura, onde cai a sombra: **decisão do modelo**.

> Se dá pra mostrar com um anexo, não descreva. Referência vale mais que parágrafo.

Não reintroduza prompt prescritivo: sem parágrafo de luz, sem "terço esquerdo reservado", sem lista longa de proibições. Se o resultado errou, **itere** (mais variações, outra referência, correção só do texto) em vez de engordar o prompt.

## Anexos

| Anexo | Quando | Papel |
|---|---|---|
| `public/logo-qt-branco.png` | sempre | Wordmark do rodapé — reproduzir fiel |
| 1 a 3 referências visuais do usuário | sempre que houver | Luz, cor, composição, peso tipográfico |
| Print real de WhatsApp | Posts 4 e 8 | Reproduzir a conversa — **nunca** inventar chat |

Referência pode ser post já no ar, post de terceiro, frame de filme, paleta. Sempre declarar o papel de cada anexo em uma linha (`ref 1 = luz e cor; ref 2 = peso do texto; logo = reproduzir fiel`), senão o modelo mistura.

## Montagem do prompt (uma mensagem)

```
[MARCA — bloco fixo de estrategia.md §7]

CENA:
Direção: CENA | RETRATO | PAINEL
[a ideia da imagem em 1 a 3 frases]

TEXTO:
Entrada: ...
Punch (caixa alta): ...
Em laranja: ...

Anexos: [papel de cada um]
```

Converter a tabela "Texto na arte" de `mes-1-posts.md` para o bloco `TEXTO:` — três linhas: Entrada, Punch, Em laranja. **O texto vai literal**, com acentos e quebras de linha; não reescrever copy aprovada.

## Direções de cena

| Direção | Quando | Referência no ar |
|---|---|---|
| `CENA` | Dor, reconhecimento, bastidor — oficina sem pessoa em foco | "Quantos clientes você perde por mês?" |
| `RETRATO` | Mecanismo, prova humana, oferta — o dono na cena | "A gente cuida do resto" |
| `PAINEL` | Dado, lista, print de produto — sem foto, fundo navy | Post dos 4 benefícios com o celular |

No `PAINEL`, grafismo (barra, ponto, lista) se descreve por **intenção** — "o contraste entre muitos atendidos e poucos que voltaram" — nunca por especificação (altura, opacidade, quantidade, qual terço do quadro).

## Não negociável (o resto é liberdade)

- Retrato 4:5, 1080×1350
- Navy `#001E62`–`#041C2C` + âmbar `#E19D4E`; **uma** palavra/linha em laranja
- Texto exato, alinhado à esquerda, nunca centralizado
- `QUANDOTROCAR.COM.BR` no topo à esquerda, `CAR` em laranja
- Logo do anexo no rodapé à esquerda, reproduzido com fidelidade
- Guardrails de conteúdo (estrategia §4): sem prova social inventada, sem promessa de resultado, sem feature que o produto não tem

## Iterar

1. Gerar 3–4 variações do mesmo prompt e escolher.
2. Texto torto → pedir só a correção do texto, mantendo a cena.
3. Cena fora da marca → anexar outra referência, não escrever outro parágrafo.
4. Peça boa → salvar e usar como referência da próxima da mesma direção.

## Carrosséis

Capa e slides internos usam a mesma montagem (`MARCA` + `Direção: PAINEL` + `TEXTO`), um slide por geração. Tabelas de texto por slide em `mes-1-posts.md`. Canva segue válido como atalho ou fallback.

## Quando atualizar documentação

Mudou o fluxo de produção, anexo padrão ou o bloco `MARCA` → atualizar na mesma entrega:

1. `docs/marketing/instagram/estrategia.md` §7
2. `docs/marketing/instagram/mes-1-posts.md` (bloco intro)
3. Esta skill
4. `docs/README.md` (linha do Instagram)
5. Regenerar PDFs: `scripts/marketing/instagram-pdf/build.py`
