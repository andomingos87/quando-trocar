# Instagram · Quando Trocar — Estratégia e cronograma

> Escopo desta fase: **feed de imagem + legenda**. Reels e Stories entram na fase 2 (ver §9).
> Os posts escritos estão em [mes-1-posts.md](./mes-1-posts.md).

---

## 1. Objetivo do perfil

O Quando Trocar vende por WhatsApp. O Instagram **não fecha venda** — ele produz reconhecimento da dor e prova de que a coisa funciona, e empurra para a conversa.

| Camada | Papel do Instagram |
|---|---|
| Topo | A oficina se reconhece na dor: "cliente que não voltou" |
| Meio | Ela entende o mecanismo (registra no WhatsApp → data agendada → lembrete com o nome dela) |
| Fundo | Ela clica no link da bio e cai no WhatsApp comercial |

**Métrica que importa:** clique no link da bio, DM recebida e **salvamento** do post. Seguidor é consequência, não meta — 400 seguidores donos de oficina valem mais que 8.000 curiosos.

**Ação única desejada em todo post:** mandar mensagem no WhatsApp para começar os 14 dias.

---

## 2. Público

Dono ou gerente de **oficina mecânica independente / auto center / centro automotivo** no Brasil, tipicamente 1–5 boxes, ele mesmo no balcão.

O que isso implica na comunicação:

- **Vive no WhatsApp, não no Instagram.** Ele abre o Instagram em intervalo de trabalho. Post que exige leitura longa na primeira dobra morre.
- **Desconfia de sistema e de mensalidade.** Já foi vendido antes. Palavra de marketing inflada queima a peça.
- **Fala a língua da bancada.** "Taxa de recuperação de receita" não existe pra ele. "Cliente que não voltou" existe.
- **Ele sabe mais de mecânica que você.** Nunca dar aula técnica de intervalo de troca — ele corrige e o comentário viraliza contra a marca. Prazo sempre entra como *o padrão que o sistema usa e a oficina ajusta*, nunca como verdade da engenharia.

---

## 3. Tom de voz

Derivado direto de [`docs/product/copy.md`](../../product/copy.md) — o Instagram não inventa voz nova.

**É:** frase curta. Afirmação verificável. Sujeito + verbo. Aliviar culpa em vez de acusar ("ninguém lembrou" e não "você esqueceu").

**Não é:** emoji decorativo, CAPSLOCK, "revolucionário", "game-changer", "transforme sua oficina", ponto de exclamação em série, pergunta retórica de engajamento barato ("marca um amigo mecânico! 👇").

**Também não é jargão de SaaS.** "Lifetime value", "recorrência de receita", "automatiza o pós-venda", "reduz dependência de equipe", "churn", "LTV", "ticket médio" — é a língua de investidor e de painel, não a de quem está no balcão. O mesmo conteúdo, traduzido:

| Em vez de | Escreva |
|---|---|
| Aumenta lifetime value do cliente | O cliente volta mais vezes na sua oficina |
| Atua direto na recorrência de receita | Traz de volta serviço que você já teria perdido |
| Automatiza o pós-venda | Lembra o cliente sem você precisar lembrar |
| Reduz dependência de equipe | Não depende do funcionário antigo lembrar |

Referência de calibragem — as três linhas da landing são o padrão-ouro do tom:

> Seu cliente não esquece da troca. Ele esquece de voltar pra você.
> Você não perde o cliente porque ele deixou de confiar. Você perde porque ninguém lembrou na hora certa.
> Você já tem cliente. Só precisa lembrar ele de voltar.

---

## 4. Guardrails — o que nunca pode ir ao ar

Não são preferências de estilo. Cada item vem de uma regra de negócio ou decisão registrada; quebrar gera promessa que o produto não cumpre.

| Regra | Por quê |
|---|---|
| **Nunca prometer que o cliente volta.** Falar em "lembrete na hora certa", "tendência". Nunca "garantimos retorno", "recupere X% dos clientes" | §1.3 — o ROI é apresentado como tendência, nunca promessa |
| **Preço sempre R$ 59/mês + 14 dias grátis sem cartão.** Nunca criar promoção, desconto, "só essa semana" | §1.4 — bot fala valor de partida; preço vem de `planos.preco_base` |
| **Nunca se posicionar como sistema de gestão.** Não substitui ERP, não emite nota, não controla estoque | Objeção oficial da landing |
| **Nunca dizer que o bot agenda o retorno.** Ele lembra; quando o cliente quer voltar, a conversa vai pra oficina | §5.3 / ADR-0009 — bot não agenda |
| **Nunca sugerir disparo em massa ou lista fria.** O produto exige consentimento e contexto de manutenção real | §7.1 e §7.2 — sem consentimento não há lembrete; opt-out é imediato |
| **Nunca inventar número de clientes, faturamento ou depoimento.** "Estamos começando agora" é ativo, não fraqueza | Seção Transparência da landing |
| **Nunca falar prazo de troca como verdade técnica.** Sempre "prazo padrão que o sistema usa, sua oficina ajusta" | §4.1 — cadência vem de `tipos_servico_default`, com fallback por oficina |
| **Nunca prometer acompanhamento por quilometragem.** Nada de "monitoro a km e te aviso quando chegar perto" ou próxima troca projetada em km | §3.2 e §4.1 — km não é campo do cadastro nem base de agendamento; o lembrete é por **data**. A visão só *lê* o odômetro de uma foto para descrever a imagem (`lib/whatsapp/image-vision.ts`), não guarda nem monitora |

---

## 5. Pilares de conteúdo

| # | Pilar | % | O que entrega | Formato típico |
|---|---|---|---|---|
| 1 | **Reconhecimento da dor** | 30% | A oficina se vê na cena: o cliente que não voltou, o caderno, a memória da equipe | Post único, frase forte |
| 2 | **Gestão simples** | 25% | Algo útil mesmo sem comprar: como medir taxa de retorno, prazos padrão, por que lembrete não é spam | Carrossel |
| 3 | **Prova em ação** | 20% | O mecanismo visível: print do registro por áudio, a mensagem que o cliente recebe | Carrossel com print real |
| 4 | **Bastidor e transparência** | 15% | Preço aberto, o que o produto **não** faz, estamos começando | Post único |
| 5 | **Oferta** | 10% | 14 dias grátis, sem cartão | Post único |

O pilar 4 é o que diferencia num nicho onde todo mundo promete. "O que o Quando Trocar não faz" costuma performar melhor que qualquer lista de benefício — e pré-qualifica o lead, o que economiza conversa do vendedor depois.

---

## 6. Cronograma — mês 1

**3 posts por semana.** Cadência escolhida por sustentabilidade: dá pra produzir tudo em um bloco de 2h no domingo e não trava se a semana apertar. Melhor 3 constantes por 6 meses que 7 por três semanas e o perfil morrer.

| Dia | Horário | Pilar da vez |
|---|---|---|
| Terça | 19h | Dor ou oferta |
| Quinta | 12h | Educação ou prova |
| Sábado | 11h | Bastidor ou dor |

> Horários são **hipótese inicial** (almoço e fim de expediente, quando o balcão dá trégua). Depois de 4 semanas, abra o Insights, olhe o horário real dos seus seguidores e ajuste. Não trate essa tabela como dado.

### Arco do mês

| Semana | Tema | Objetivo |
|---|---|---|
| 1 | Reconhecimento | A oficina se vê no problema |
| 2 | Mecanismo | Ela entende como funciona |
| 3 | Objeção | "é spam?", "vai dar trabalho?" caem |
| 4 | Oferta | Convite direto pros 14 dias |

| # | Dia | Pilar | Formato | Tema |
|---|---|---|---|---|
| 1 | S1 · Ter | 1 | Post único | Seu cliente não esquece da troca |
| 2 | S1 · Qui | 2 | Carrossel 6 | 3 prazos que decidem se o cliente volta |
| 3 | S1 · Sáb | 1 | Post único (foto) | O caderno lembra, mas não avisa |
| 4 | S2 · Ter | 3 | Carrossel 5 | Um áudio de 8 segundos |
| 5 | S2 · Qui | 2 | Post único | Taxa de retorno: o número que ninguém mede |
| 6 | S2 · Sáb | 4 | Post único | O que o Quando Trocar não faz |
| 7 | S3 · Ter | 1 | Post único | Ele não deixou de confiar |
| 8 | S3 · Qui | 3 | Carrossel 6 | A mensagem que o seu cliente recebe |
| 9 | S3 · Sáb | 2 | Post único | Lembrete não é spam quando tem contexto |
| 10 | S4 · Ter | 2 | Carrossel 7 | 5 jeitos de perder um cliente que já era seu |
| 11 | S4 · Qui | 4 | Post único | R$ 59 por mês, dito no primeiro dia |
| 12 | S4 · Sáb | 5 | Post único | 14 dias. Sem cartão. |

Distribuição final: pilar 1 = 3 posts, pilar 2 = 4, pilar 3 = 2, pilar 4 = 2, pilar 5 = 1. Bate com os percentuais da §5.

---

## 7. Como produzir a arte (GPT Image 2)

A identidade do perfil é **cinematográfica**: foto escura de oficina, luz âmbar, e por cima uma display condensada pesada em caixa alta com uma palavra em laranja. É o que já está no ar nos três primeiros posts, e é o que os posts do mês 1 seguem.

A peça sai **completa** do GPT Image 2 — cena, texto em português, URL e logo. **Canva ou Figma só entram como retoque** (crop, contraste, ajuste fino) ou fallback se uma geração falhar.

### Princípio: prompt curto, referência anexada

O modelo é bom e é criativo. Prompt longo e prescritivo — luz descrita em duas frases, terço do quadro reservado, lista de dez proibições — engessa a geração, gasta atenção do modelo em detalhe irrelevante e não melhora o resultado. Aqui o prompt diz só duas coisas:

1. **O que é marca** — o bloco `MARCA`, obrigatório e igual em todo post.
2. **Qual é a ideia da cena e o texto** — uma a três frases + as três linhas de texto.

Enquadramento, lente, profundidade de campo, textura, onde exatamente cai a sombra: **decisão do modelo**, calibrada pelas referências anexadas.

> **Regra prática:** se dá pra mostrar com um anexo, não descreva. Referência vale mais que parágrafo.

### Anexos

| Anexo | Quando | Papel |
|---|---|---|
| `public/logo-qt-branco.png` | sempre | Wordmark do rodapé — reproduzir fiel |
| 1 a 3 referências visuais | sempre que tiver | Luz, cor, composição, peso tipográfico |
| Print real de WhatsApp | Posts 4 e 8 | Reproduzir a conversa — nunca inventar |

Referência visual pode ser: captura de um post já no ar, um post de terceiro salvo, um frame de filme, uma paleta. Vale qualquer coisa que resolva em imagem o que o texto tentaria descrever.

**Diga o papel de cada anexo em uma linha**, senão o modelo mistura tudo:

```
Anexos: ref 1 = luz e cor; ref 2 = peso e hierarquia do texto; logo = reproduzir fiel no rodapé.
```

### Montagem do prompt (uma mensagem)

```
[MARCA — bloco fixo abaixo, igual em todo post]

CENA:
Direção: CENA | RETRATO | PAINEL
[a ideia da imagem em 1 a 3 frases]

TEXTO:
Entrada: ...
Punch (caixa alta): ...
Em laranja: ...

Anexos: [papel de cada um]
```

#### Bloco `MARCA` (fixo)

```
MARCA:
Post de Instagram em retrato 4:5, 1080x1350 px.
Fotografia documental cinematográfica de oficina mecânica independente brasileira, real e em uso.
Escura, de baixa chave: luz âmbar quente contra sombra azul-marinho profunda (#001E62 a #041C2C).
Nada cenográfico, nada de concessionária.

Sobre a imagem, texto em português — reproduzir exatamente como escrito, com acentos e quebras de linha:
- Entrada: sans-serif regular, branca, corpo menor.
- Punch: display condensada muito pesada, CAIXA ALTA, tracking apertado, entrelinha fechada.
- Uma palavra ou uma linha do punch em laranja #E19D4E — uma só.
Texto alinhado à esquerda, com margem folgada. Nunca centralizar.
QUANDOTROCAR.COM.BR em caps pequenas no topo à esquerda, com CAR em laranja #E19D4E.
Logo do anexo no rodapé à esquerda — reproduzir com fidelidade, sem redesenhar nem distorcer.
Escurecer a cena atrás do texto o quanto for preciso para o branco passar.

Enquadramento, lente e composição: sua escolha. Use as referências anexadas para calibrar luz, cor e
peso tipográfico.
Evitar: marca de fabricante ou placa legível, mão malformada, estética de propaganda de banco,
glassmorphism, gradiente neon.
```

#### As três direções de cena

Uma linha dentro do bloco `CENA:` — `Direção: CENA`, `Direção: RETRATO` ou `Direção: PAINEL`.

| Direção | Quando usar | O que muda |
|---|---|---|
| `CENA` | Dor, reconhecimento, bastidor | Oficina sem pessoa em foco. Referência no ar: "Quantos clientes você perde por mês?" |
| `RETRATO` | Mecanismo, prova humana, oferta | Dono de oficina, 40 a 55 anos, uniforme com marca de uso, expressão contida — nunca pose de banco de imagens. Luz âmbar lateral, fundo desfocado. Referência: "A gente cuida do resto" |
| `PAINEL` | Dado, lista, print de produto | Sem fotografia: fundo navy com um brilho âmbar sutil. Numerais e listas entram pelo bloco `TEXTO`. Referência: post dos 4 benefícios |

**Grafismo no `PAINEL`:** quando o post pede um elemento gráfico (barra, ponto, lista), diga a **intenção** e pare aí — "o contraste entre muitos atendidos e poucos que voltaram", "uma lista de cinco itens ainda vazia". Nunca a especificação (altura da barra, opacidade, quantos pontos, qual terço). O modelo compõe melhor que a descrição.

> **Display condensada:** a referência é o post "QUANTOS CLIENTES VOCÊ PERDE POR MÊS?" — grotesca, muito pesada, caixa alta, contraforma fechada. Equivalentes gratuitas: **Anton**, **Archivo Expanded Black**, **Bebas Neue** (esta exige subir o peso por tamanho).

### Iterar em vez de prescrever

O caminho mais rápido para uma peça boa não é um prompt maior — é mais gerações.

1. Gere **3 ou 4 variações** do mesmo prompt e escolha.
2. Texto saiu errado ou torto: peça **só a correção do texto**, mantendo a cena.
3. Cena fugiu da marca: **anexe outra referência**, não escreva outro parágrafo.
4. Deu certo uma vez: salve a peça e use como referência do próximo post da mesma direção.

O que não é negociável — 4:5, texto exato, uma palavra em laranja, logo fiel, URL no topo, sem prova social inventada (§4) — vem do bloco `MARCA` e dos guardrails. Fora disso, liberdade.

### Print real de WhatsApp — anexo, não inventar

Nos posts de prova (4 e 8), a conversa precisa ser **captura de tela verdadeira** do bot ou da demo em `/demo`. Anexe a captura e peça para reproduzi-la — não peça ao gerador para inventar o chat. Bolha errada, horário impossível e texto torto destoam do produto real, e esse público reconhece na hora.

Confira que o conteúdo do print bate com o produto: o bot confirma antes de gravar e devolve **a data** do próximo retorno. Ele não acompanha quilometragem (§4).

### Slides internos de carrossel

Mesma montagem (`MARCA` + `CENA: Direção: PAINEL` + `TEXTO`), um slide por geração. Cada carrossel do mês 1 traz a tabela de textos por slide. **Canva** continua válido como atalho tipográfico ou fallback se um slide sair inconsistente.

## 8. Estrutura da legenda

```
[Linha 1 — o gancho. Até ~125 caracteres: é só isso que aparece antes do "mais".]

[2 a 4 blocos curtos, uma ideia por bloco, linha em branco entre eles.
Frase curta. Sem parágrafo denso — no celular, bloco de 5 linhas não é lido.]

[CTA — uma só. Nunca duas.]

[3 a 5 hashtags no fim]
```

**Hashtags: 3 a 5, nunca mais.** O limite oficial do Instagram hoje é 5, e empilhar tag não traz alcance — traz aparência de conta amadora. Pool do nicho, rotacione:

`#oficinamecanica` `#mecanicaautomotiva` `#autocenter` `#gestaodeoficina` `#donodeoficina` `#trocadeoleo` `#centroautomotivo` `#oficinaindependente`

---

## 9. Medição e o que fazer depois de 4 semanas

Carrossel se julga por **salvamento e conclusão**, não por like. Salvamento é o sinal de que o post virou referência — e é o que o algoritmo premia nesse formato.

Ao fim do mês 1, com 12 posts no ar, faça uma revisão de 30 minutos:

1. **Os 3 melhores por salvamento.** Que pilar? Que formato? Repita a estrutura, não o assunto.
2. **Os 3 piores.** Se o post morreu no alcance, o problema é quase sempre a primeira imagem (não parou o scroll) — não o meio do carrossel.
3. **Onde o carrossel perdeu gente.** O Insights mostra a queda por slide. Queda no slide 2 = a capa prometeu o que o slide 2 não pagou.
4. **Cliques no link da bio.** Esse é o número que liga Instagram a receita. Se está em zero com alcance bom, o problema é CTA, não conteúdo.

Só depois disso decida a fase 2 — e a ordem recomendada é:

1. **Stories diários** (3–5/dia, reaproveitando o post do dia + enquete). Barato, e é onde a audiência de oficina realmente responde.
2. **Reels** — o formato de maior alcance. Ativo mais forte disponível: gravar o registro real de um serviço pelo WhatsApp em 15 segundos, tela do celular, sem locução.
3. **Prova social real**, quando existirem oficinas usando e dispostas a aparecer. Até lá, o pilar 4 (transparência) cobre esse papel.
