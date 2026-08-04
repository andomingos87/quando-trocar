# Relatório de público, persona e estratégia de conteúdo — Quando Trocar

> Documento de marketing. Base factual: `docs/product/copy.md`, `docs/product/PRD-landing-prototype.md`, `docs/product/PRD-whatsapp-bot.md`, `docs/marketing/instagram/estrategia.md`, `lib/landing-offer.ts`, `lib/representante/content/playbook.ts`, ADR-0012, ADR-0019, ADR-0025.
> Tudo que estiver marcado **[hipótese]** ainda não foi validado com dado real — trate como pauta de pesquisa, não como fato.

---

## 1. O que estamos vendendo (base para toda a comunicação)

**Uma frase:** o Quando Trocar registra o serviço pelo WhatsApp, calcula a data do próximo retorno e lembra o cliente na hora certa — com o nome da oficina.

| É | Não é |
|---|---|
| Máquina de recorrência | CRM |
| Canal WhatsApp → cliente → retorno | ERP / sistema de gestão |
| Produto de mensalidade baixa (R$ 59/mês) | Concorrente de software de oficina |
| Vendido por WhatsApp e por rede de representantes | Produto de autosserviço/self-checkout |

**Oferta oficial (nunca variar):** 14 dias grátis · sem cartão · sem cobrança automática · depois R$ 59/mês · sem fidelidade · serviço pausado se não houver pagamento.

**Dois públicos, duas promessas:**

| Público | Promessa central | Emoção que compra |
|---|---|---|
| Oficina (cliente final) | "Você já tem cliente. Só precisa lembrar ele de voltar." | Alívio de culpa + dinheiro que já era dela |
| Representante comercial | "Você já entra nessa oficina. Agora leva também uma comissão que se repete todo mês." | Renda recorrente sobre a carteira que ele já tem |

---

## 2. Público-alvo — cliente final (oficinas)

### 2.1 Perfil de mercado

- Oficina mecânica independente, auto center, centro automotivo, troca-óleo rápido, oficina de bairro.
- Porte: **1 a 5 boxes**, 1 a 8 funcionários, dono no balcão.
- Brasil inteiro, com concentração inicial onde a rede de representantes já atua.
- Serviços com retorno previsível: troca de óleo (~90 dias), revisão e serviços gerais (~180 dias), amortecedor (~2 anos). *Os prazos são o padrão do sistema, ajustável pela oficina — nunca comunicar como verdade de engenharia.*

### 2.2 Segmentação por prontidão

| Segmento | Como reconhecer | Prioridade |
|---|---|---|
| **A — Dor consciente** | Já tenta mandar mensagem manual, tem caderno/planilha de clientes, reclama que "o movimento caiu" | Alta — converte rápido |
| **B — Dor inconsciente** | Movimento razoável, nunca mediu retorno, acha que "cliente bom volta sozinho" | Média — precisa de conteúdo de reconhecimento |
| **C — Já tem sistema de gestão** | Usa ERP de oficina, acha que já está coberto | Média — precisa do ângulo "não substitui, completa" |
| **D — Não serve** | Concessionária, rede grande com CRM e time de pós-venda, funilaria/estética sem recorrência previsível, oficina sem WhatsApp de cliente | Descartar cedo — economiza conversa |

### 2.3 Quem NÃO é o público (dizer isso em público qualifica lead)

Concessionária, rede com pós-venda estruturado, quem quer emitir nota/controlar estoque, quem quer disparo em massa para lista fria, quem quer acompanhar quilometragem.

---

## 3. Personas — cliente final

### 3.1 Persona primária — "Marcão", dono de oficina

| Campo | Descrição |
|---|---|
| Idade / perfil | 35–55 anos, começou como mecânico, virou dono. Escolaridade média, inteligência prática altíssima |
| Rotina | Chega 7h30, atende balcão, orça, ajuda no box, fecha 18h30 e ainda responde WhatsApp em casa |
| Relação com tecnologia | WhatsApp é o sistema operacional dele. Planilha, quase nunca. App novo, resistência forte |
| Como decide | Emocional + prova rápida de retorno. Confia em indicação de par (outro dono) e em quem já entra na oficina (representante de peças) |
| Como fala | "Movimento", "cliente sumiu", "cliente fiel", "o povo só aparece quando quebra", "não tenho cabeça pra isso" |
| Quem influencia | Esposa/sócia que cuida do financeiro, filho mais novo que "entende de computador", representante de peças de confiança |

**Dores (na língua dele)**
1. "O cara faz troca aqui, some, e três meses depois eu vejo o carro dele saindo da oficina do concorrente."
2. "Movimento oscila demais — mês bom e mês morto, e eu não sei por quê."
3. "Meu cliente eu conheço pelo carro, não pelo nome. Se eu quiser chamar, não sei nem onde tá o número."
4. "Tenho o WhatsApp de todo mundo e nunca uso pra nada."
5. "Já tentei mandar mensagem pra uns clientes, mas parei na segunda semana."
6. "Quando o funcionário antigo saiu, foi embora metade da memória da carteira."
7. "Só dou desconto pra atrair gente nova, e quem já era meu eu deixo escapar."

**Desejos**
- Agenda cheia com cliente que ele já conhece (menos negociação, menos desconto).
- Previsibilidade: saber que o mês que vem tem serviço marcado.
- Ser lembrado como "a oficina do cara" — orgulho de nome, não só de preço.
- Parar de depender da memória (dele e da equipe).
- Parecer profissional sem virar burocracia.

**Crenças** *(o que ele já acredita — usar como alavanca, não confrontar)*
- "Cliente bom volta sozinho." → **Reenquadrar:** ele volta, mas volta pra quem lembrou primeiro.
- "Sistema é coisa de oficina grande."
- "Marketing é pra quem não tem serviço bom."
- "Mensalidade sempre vira armadilha: você entra fácil e sai difícil."
- "Ninguém entende da minha oficina melhor do que eu."
- "Mandar mensagem pra cliente é chato / é forçar a barra."

**Medos**
- Perder o cliente pro concorrente do lado — e não perceber.
- Ficar preso num contrato/fidelidade.
- Ser cobrado sem avisar (cartão salvo, débito automático).
- Passar vergonha: o sistema mandar mensagem errada, na hora errada, ou pra cliente que já morreu / já vendeu o carro.
- Comprar mais uma coisa que ninguém na oficina vai usar.
- Ser visto como spammer pelo próprio cliente.

**Objeções e respostas** *(as 4 primeiras são a versão oficial da landing)*

| Objeção | Resposta |
|---|---|
| "Não tenho tempo pra mexer em mais um sistema." | É um WhatsApp rápido. Você manda texto, áudio ou foto da nota. |
| "Já tenho sistema de gestão." | O Quando Trocar não substitui a gestão. Ele cuida do lembrete de retorno. |
| "O cliente vai achar que é spam?" | O contato acontece quando existe contexto de manutenção real e leva o nome da sua oficina. |
| "O que acontece depois dos 14 dias?" | O serviço é pausado, sem cobrança automática. Para continuar, você confirma R$ 59/mês pelo WhatsApp. |
| "R$ 59 é caro." | Um retorno de troca de óleo por mês já paga. E não tem fidelidade. *(nunca prometer o retorno — falar em ordem de grandeza)* |
| "Meu funcionário não vai usar." | Quem registra é quem já mexe no WhatsApp. Uma mensagem por serviço. |
| "E se eu quiser sair?" | Você para de pagar e o serviço é pausado. Sem multa, sem carência. |
| "Vocês vão pegar minha lista de clientes?" | Os dados são da oficina. O lembrete sai com o nome dela, não com o nosso. |
| "Nunca ouvi falar de vocês." | Estamos começando agora — por isso você testa 14 dias sem pagar e sem cartão antes de decidir. |

**Gatilhos que funcionam com ele**
Especificidade ("três meses depois"), alívio de culpa ("ninguém lembrou" > "você esqueceu"), transparência radical (preço no primeiro segundo), prova visível (print real de conversa), reversibilidade (sem cartão, sem fidelidade), pertencimento (outra oficina igual à dele).

**Gatilhos que queimam a marca com ele**
Promessa de percentual de recuperação, "revolucionário/game-changer", aula de mecânica, jargão de SaaS (LTV, churn, ticket médio), urgência artificial, depoimento inventado.

### 3.2 Persona secundária — "Simone", balcão / financeiro

Recepcionista, esposa ou sócia administrativa. **Usuária diária e freio ou acelerador da renovação.**

- **Dor:** atender telefone, WhatsApp, orçamento e nota ao mesmo tempo.
- **Critério de sucesso:** registrar não pode atrapalhar o atendimento. Se levar mais de 30 segundos, morre.
- **Medo:** ser cobrada por algo que "não funcionou" e que ela é quem opera.
- **O que a conquista:** áudio no lugar de formulário, confirmação antes de gravar, poder corrigir.
- **Conteúdo para ela:** prova de mecanismo (o áudio de 8 segundos), "não muda nada no seu atendimento".

### 3.3 Persona de bloqueio — "o filho que entende de computador"
Compara com concorrentes, procura pegadinha no contrato, pesquisa o CNPJ. Conteúdo de transparência (preço aberto, o que o produto não faz, quem somos) é o que desarma esse perfil.

---

## 4. Público-alvo — representante comercial

### 4.1 Perfil

Representante que já vende peças, lubrificantes e insumos para oficinas (perfil Perfect Automotive e similares). Carteira formada, entra na oficina sem agendar, é ouvido pelo dono. Ganha por comissão de venda de produto físico — **receita não recorrente, refeita do zero todo mês**.

Modelo do produto para ele: link `wa.me` com o código `#REP-<codigo>`; a atribuição fica registrada no lead e propaga para a oficina; cada mensalidade paga gera comissão com a regra congelada no momento do pagamento; payout manual pelo admin; portal próprio (login por OTP no WhatsApp) com carteira, leads, comissões e playbook.

### 4.2 Persona — "Rogério", representante

| Campo | Descrição |
|---|---|
| Perfil | 30–55 anos, carro cheio de amostra, 15–40 oficinas na carteira, roda a região o mês inteiro |
| Motivação | Somar uma comissão que **se repete** sem carregar caixa, sem logística, sem devolução |
| Rotina de venda | 5–12 visitas/dia, 10 minutos por visita, café no balcão, conversa curta |
| Como avalia um produto novo | "Consigo explicar em 3 minutos?", "vai me dar dor de cabeça de suporte?", "quando eu recebo?" |

**Dores**
1. Renda zera todo dia 1º — vive de recomeço.
2. Comissão fina em produto de commodity, cliente pechinchando preço.
3. Concorrência por preço em peça: pouca diferenciação para oferecer.
4. Não tem visibilidade do que já vendeu nem do que vai receber (planilha, papel, palavra do gerente).
5. Perde tempo com oficina que "vai pensar" e nunca fecha.

**Desejos**
- Comissão recorrente sobre a carteira que ele **já** tem — trabalho novo perto de zero.
- Um produto que ele consiga explicar em 3 minutos e que faça o dono sorrir.
- Ser visto como consultor, não tirador de pedido — motivo novo para voltar na oficina.
- Ver na tela quanto entrou e quanto vai entrar.

**Crenças**
- "Software é complicado de vender, o dono não usa."
- "Se der problema, sobra pra mim."
- "Comissão de recorrência sempre some depois do primeiro mês."
- "Cliente meu confia em mim — se eu indicar bosta, perco o cliente da peça também." ← **o medo mais forte dele; é reputacional, não financeiro**

**Medos**
1. Queimar a relação da carteira com um produto que não entrega.
2. Virar suporte técnico de graça.
3. Comissão que não aparece / atribuição roubada / "esqueceram de contar a sua".
4. Ter que fechar a venda sozinho, sem apoio.
5. Meta e exclusividade impostas.

**Objeções e respostas**

| Objeção | Resposta |
|---|---|
| "Não entendo de software." | Você não instala nada. Manda o seu link, o time fecha por WhatsApp e a comissão fica no seu nome. |
| "Vou ter que dar suporte?" | Não. Ativação, dúvida e cobrança são conosco. Você apresenta. |
| "E se a oficina reclamar comigo?" | São 14 dias grátis sem cartão e sem fidelidade. O pior cenário para ela é parar de usar — sua relação não é exposta. |
| "Como eu sei que a venda é minha?" | O código vai no seu link e fica gravado no lead e na oficina. Você acompanha no seu portal. |
| "Quanto eu ganho?" | *[definir e comunicar percentual/valor, duração e data de pagamento — a política é configurável, mas o número precisa ser fixo e público para o representante]* |
| "Quantas oficinas preciso trazer?" | Não tem meta nem exclusividade. Você oferece para quem fizer sentido na sua carteira. |
| "Já falo de mil produtos, não tenho tempo." | São 3 minutos no fim da visita que você já faz. Um link, uma frase. |

**Pitch de 10 segundos que ele deve saber de cor**
> "É um sistema que manda WhatsApp automático pro cliente da oficina voltar trocar óleo. A oficina testa 14 dias de graça, e eu ganho comissão todo mês que ela pagar."

---

## 5. Estágios de consciência e o que publicar em cada um

*(Eugene Schwartz aplicado ao funil real: Instagram/conteúdo → WhatsApp comercial → 14 dias → assinatura.)*

| Estágio | Onde ele está | Conteúdo que move | CTA |
|---|---|---|---|
| **Inconsciente** | "Meu movimento é o que é" | Cena de reconhecimento: o cliente que não voltou, o caderno, a memória da equipe | Salvar / seguir |
| **Consciente do problema** | "Perco cliente e não sei quanto" | Como medir taxa de retorno; 5 jeitos de perder um cliente que já era seu | Comentar / DM |
| **Consciente da solução** | "Devia mandar lembrete, mas não dá tempo" | Por que a mensagem manual sempre para na segunda semana; lembrete não é spam quando tem contexto | Link da bio |
| **Consciente do produto** | "Esse Quando Trocar aí" | Print real do registro por áudio; a mensagem que o cliente recebe; o que o produto **não** faz | WhatsApp |
| **Mais consciente** | "Quanto custa e qual a pegadinha?" | Preço aberto, 14 dias sem cartão, o que acontece no dia 15 | Começar o teste |

---

## 6. Mensagens núcleo (reutilizar; não reescrever a cada peça)

**Oficina**
1. Seu cliente não esquece da troca. Ele esquece de voltar pra você.
2. Você não perde o cliente porque ele deixou de confiar. Você perde porque ninguém lembrou na hora certa.
3. Você já tem cliente. Só precisa lembrar ele de voltar.
4. O caderno lembra. Mas não avisa.
5. Registrar leva um áudio. O resto é automático.
6. R$ 59 por mês, dito no primeiro dia.

**Representante**
1. A carteira é sua. A comissão passa a ser todo mês.
2. Três minutos no fim da visita que você já faz.
3. Você apresenta. A gente fecha, ativa e cobra.
4. Sua oficina testa 14 dias sem cartão — sua relação não fica exposta.

---

## 7. Estratégia de conteúdo — oficinas

### 7.1 Pilares (validados em `docs/marketing/instagram/estrategia.md`)

| # | Pilar | % | Papel |
|---|---|---|---|
| 1 | Reconhecimento da dor | 30% | A oficina se vê na cena |
| 2 | Gestão simples | 25% | Utilidade mesmo sem comprar |
| 3 | Prova em ação | 20% | O mecanismo visível (print real) |
| 4 | Bastidor e transparência | 15% | Preço aberto, o que não fazemos |
| 5 | Oferta | 10% | 14 dias, sem cartão |

O pilar 4 é o diferencial competitivo de comunicação num nicho onde todo mundo promete — e pré-qualifica o lead, economizando conversa do vendedor.

### 7.2 Canais por função

| Canal | Função | Métrica |
|---|---|---|
| Instagram feed | Reconhecimento + prova | Salvamento, clique no link da bio |
| Stories (fase 2) | Presença diária, enquete, bastidor | Respostas |
| Reels (fase 2) | Alcance frio: registro real em 15s de tela | Alcance + perfis alcançados |
| WhatsApp comercial | **Onde a venda acontece** | Lead → teste → assinatura |
| Landing | Conversão de quem pesquisou | CTA → WhatsApp |
| Grupos/feiras/rede de peças | Distribuição via representante | Oficinas ativadas por rep |

### 7.3 Banco de ganchos (prontos para virar post, anúncio ou abertura de conversa)

- Quantos clientes você perde por mês? Você não sabe — e é por isso que dói pouco.
- O cliente não sumiu. Ele foi lembrado por outra oficina.
- Você tem o WhatsApp de todo mundo e não usa pra nada.
- A troca de óleo é a única venda que já vem com data marcada. E é a que mais se perde.
- Seu funcionário antigo saiu e levou metade da sua carteira na cabeça dele.
- Desconto traz cliente novo. Lembrete traz o cliente que já era seu.
- Se você tivesse que dizer hoje quantos dos seus clientes voltaram no último ano, você saberia?
- O que o Quando Trocar **não** faz (e por que a gente fala isso antes de vender).

---

## 8. Estratégia de conteúdo — representantes

Dois objetivos distintos, não misturar na mesma peça:

### 8.1 Recrutar representante
| Formato | Conteúdo |
|---|---|
| Página/PDF de 1 folha | Produto em 3 linhas, comissão, como recebe, o que não é responsabilidade dele |
| Vídeo de 90 segundos | O pitch em ação numa oficina de verdade |
| Post no Instagram/LinkedIn | "Você já entra em 30 oficinas por mês. Nenhuma delas te paga no mês seguinte." |
| Conversa 1:1 no WhatsApp | Canal principal — igual ao cliente final |

### 8.2 Capacitar e manter ativo o representante
| Peça | Frequência | Conteúdo |
|---|---|---|
| Playbook no portal | Vivo | Pitch, como funciona, ROI, objeções (já existe em `lib/representante/content/playbook.ts`) |
| Novidades no portal | A cada release | O que mudou no produto, em linguagem de vendedor |
| Card de resultado mensal | Mensal | Oficinas ativas, comissões previstas/pagas |
| Áudio/script de 3 minutos | Fixo | O pitch de balcão, gravado, para ele imitar |
| Mensagem pronta para copiar | Fixa | Texto + link com `#REP-<codigo>` já embutido |

**Regra dura (ADR-0012):** material automático do representante **não traz preço nem condição comercial** — quem fecha valor é o atendimento humano. Preço aparece na landing e na conversa, não no playbook.

---

## 9. Guardrails de comunicação (valem para todo conteúdo, os dois públicos)

| Nunca | Por quê |
|---|---|
| Prometer que o cliente volta / "recupere X%" | ROI é tendência, nunca promessa |
| Criar promoção, desconto ou urgência artificial | Preço é R$ 59/mês + 14 dias grátis, sempre |
| Se posicionar como sistema de gestão | Não substitui ERP, não emite nota, não controla estoque |
| Dizer que o bot **agenda** o retorno | Ele lembra; o agendamento é entre oficina e cliente |
| Sugerir disparo em massa ou lista fria | Exige consentimento e contexto de manutenção real |
| Inventar número, faturamento ou depoimento | "Estamos começando agora" é ativo, não fraqueza |
| Falar prazo de troca como verdade técnica | É o padrão do sistema; a oficina ajusta |
| Prometer acompanhamento por quilometragem | O lembrete é por **data**; km não é monitorado |
| Usar jargão de SaaS (LTV, churn, ticket médio) | Língua de investidor, não de balcão |

---

## 10. O que medir

| Público | Métrica de topo | Métrica que importa |
|---|---|---|
| Oficina | Alcance, salvamento | Leads no WhatsApp → testes iniciados → **assinaturas confirmadas** |
| Oficina | — | Taxa de conversão do dia 14 (teste → pagamento) |
| Representante | Representantes cadastrados | **Representantes com ≥1 oficina paga** (ativação real) |
| Representante | — | Oficinas por rep ativo; comissão média por rep |

Sinal de alerta: alcance alto com zero clique no link da bio = problema de CTA, não de conteúdo.

---

## 11. Lacunas a validar (não inventar enquanto não houver dado)

1. **Ticket e frequência reais** da oficina média — para dimensionar o argumento de ROI com honestidade.
2. **Taxa de retorno atual** de uma oficina sem lembrete — a régua contra a qual o produto se compara.
3. **Percentual/valor e duração da comissão** a comunicar publicamente ao representante.
4. **Primeiros depoimentos reais** — substituem o pilar de transparência quando existirem.
5. **Objeção dominante no dia 14** (por que não converte teste → pago) — hoje é a maior incógnita do funil.
