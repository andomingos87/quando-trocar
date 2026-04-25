# 📄 PRD — Quando Trocar

**Versão:** 1.0 — Protótipo Comercial
**Data:** 2026-04-24
**Responsável:** Anderson Domingos
**Status:** Aprovado para execução

---

## 1. 🧠 Visão do Produto

> **O Quando Trocar é a máquina de recorrência da oficina.**
> Ele faz o cliente voltar no momento certo — automaticamente, via WhatsApp.

### O que NÃO é
- ❌ Não é CRM
- ❌ Não é ERP
- ❌ Não é sistema de gestão
- ❌ Não é concorrente de software de oficina

### O que É
- ✅ Ferramenta de **recorrência automática**
- ✅ Canal direto **WhatsApp → Cliente → Retorno**
- ✅ **Produto de ticket recorrente** vendido via representante

---

## 2. 🎯 Objetivo do Protótipo

Validar **em reunião presencial/remota** a proposta de valor com três públicos distintos:

| Público | O que precisa sentir |
|---|---|
| **Perfect Automotive** | "Isso vende fácil no meu portfólio" |
| **Representantes comerciais** | "Eu consigo explicar isso em 3 minutos" |
| **Oficinas (cliente final)** | "Isso me faz ganhar dinheiro" |

### Definição de Sucesso

- ✅ Entendimento do valor em **menos de 60 segundos**
- ✅ Pelo menos **1 representante** demonstra intenção de vender
- ✅ Pelo menos **1 oficina** demonstra intenção de contratar
- ✅ Zero perguntas do tipo *"mas e como funciona tecnicamente?"* — se perguntarem isso, a demo falhou em vender o resultado

---

## 3. 👤 Usuários & Personas

### 3.1 Usuário Primário — Dono da Oficina
- **Perfil:** Homem, 35-55 anos, toca oficina de bairro ou rede pequena
- **Dor:** Ver o cliente sumir depois da troca de óleo
- **Linguagem:** Direta, prática, orientada a dinheiro
- **Decisão de compra:** Emocional + prova rápida de ROI

### 3.2 Usuário Secundário — Recepcionista / Mecânico
- **Perfil:** Operacional, usa o sistema no dia a dia
- **Critério de sucesso:** Rápido de preencher, não atrapalha o atendimento

### 3.3 Comprador Intermediário — Representante Comercial
- **Perfil:** Vende peças e insumos para oficinas (Perfect Automotive)
- **Motivação:** Adicionar recorrência à comissão
- **Critério de sucesso:** Demo de 3 minutos que fecha

---

## 4. 💥 Problema

```
Cliente troca óleo hoje
        ↓
  3 meses depois
        ↓
Esquece da oficina
        ↓
Vai para o concorrente
        ↓
Oficina perde receita recorrente
```

### Dados do problema (validação qualitativa)
- Oficinas **não fazem follow-up** estruturado
- **WhatsApp do cliente fica parado** no caderno ou planilha
- Não existe **gatilho automático** de retorno
- Dono da oficina **sabe que perde cliente**, mas não sabe quanto

---

## 5. 💡 Proposta de Valor

> **"A gente lembra o cliente na hora certa pra ele voltar."**

### Pitch em 1 frase (representante)
> "É um sistema que manda WhatsApp automático pro cliente voltar trocar óleo — e você cobra mensalidade da oficina."

### Pitch em 1 frase (oficina)
> "Você cadastra o cliente hoje, a gente avisa ele daqui 3 meses e ele volta trocar óleo com você."

---

## 6. 🔁 Fluxo Principal (Core do Produto)

### Macro-fluxo

```
Registro → Lembrete → Retorno → Receita
```

### Fluxo 1 — Registro
1. Cliente chega para trocar óleo
2. Oficina cadastra: nome, WhatsApp, veículo, serviço, data
3. Sistema agenda o próximo lembrete (default: +90 dias)

### Fluxo 2 — Lembrete
1. Sistema identifica clientes com lembrete pendente
2. Dispara mensagem no WhatsApp (simulada no protótipo)
3. Status muda: pendente → enviado

### Fluxo 3 — Retorno
1. Cliente responde / agenda
2. Cliente volta na oficina
3. Oficina marca como "Retornou" e informa valor
4. Receita é contabilizada no dashboard

---

## 7. 🧩 Funcionalidades do Protótipo

### 7.1 Dashboard (tela inicial)

**Objetivo:** impacto visual imediato do valor.

| Card | Valor mockado |
|---|---|
| Clientes cadastrados | 128 |
| Lembretes enviados | 42 |
| Clientes que voltaram | 11 |
| **Receita gerada (estimada)** | **R$ 8.250** |

**Regra visual:** o card de Receita é **2x maior** que os demais, em laranja vibrante.

---

### 7.2 Cadastro de Cliente

**Campos obrigatórios:**
- Nome
- WhatsApp
- Veículo (marca/modelo)
- Serviço (default: Troca de óleo)
- Data da troca (default: hoje)

**Ação:** botão único — **"Registrar troca"**

**Feedback visual:**
- Toast: *"Cliente cadastrado! Próximo lembrete em 90 dias."*
- Contador do dashboard incrementa (+1)

---

### 7.3 Lembretes (Simulado)

**Tela:** lista de clientes com lembrete pendente.

**Colunas:**
- Cliente
- Veículo
- Dias desde a última troca
- Status (pendente / enviado)
- Ação: **"Enviar lembrete"**

**Mensagem padrão:**
> *"Oi [nome], aqui é da Auto Center Silva. Já está na hora da sua próxima troca de óleo do [veículo]. Quer agendar?"*

---

### 7.4 Simulação WhatsApp

**Objetivo:** o momento mágico da demo.

**Layout:** interface tipo WhatsApp Web
- Bolha verde (oficina)
- Bolha cinza (cliente)
- Animação de "digitando..."

**Sequência scriptada:**
1. Oficina envia lembrete
2. Cliente responde: *"Opa, pode ser quinta 14h?"*
3. Oficina confirma
4. Status: **agendado**

---

### 7.5 Retorno (Conversão)

**Tela:** lista de clientes que voltaram após lembrete.

**Colunas:**
- Cliente
- Data do retorno
- Valor do serviço
- Status: concluído

**Rodapé da tela:**
> 💰 **Receita gerada por lembretes este mês: R$ 8.250**

---

## 8. 📊 Dados Mockados

### Oficina exemplo
- **Nome:** Auto Center Silva
- **Cidade:** Curitiba - PR
- **Ticket médio:** R$ 250

### Números
| Métrica | Valor |
|---|---|
| Clientes cadastrados | 128 |
| Lembretes enviados | 42 |
| Retornos confirmados | 11 |
| Taxa de conversão (lembrete → retorno) | 26% |
| **Receita gerada** | **R$ 8.250** |

### Clientes exemplo (seed)
1. João Silva — Civic 2018 — WhatsApp (41) 99xxx
2. Maria Costa — HB20 2020 — WhatsApp (41) 98xxx
3. Pedro Lima — Onix 2022 — WhatsApp (41) 99xxx
4. +10 fictícios para popular listas

---

## 9. 🎯 Métricas do Produto

**Métricas que aparecem no produto (única regra):**

| Métrica | Por quê |
|---|---|
| Clientes cadastrados | Mostra base de ativos |
| Lembretes enviados | Mostra máquina rodando |
| Clientes que voltaram | Mostra **resultado** |
| **Receita gerada** | **Fecha a venda** |

❌ **Nada além disso.** Qualquer métrica técnica (uptime, tempo de resposta, etc.) está fora.

---

## 10. 🚫 Fora de Escopo (CRÍTICO)

Estas funcionalidades **não serão construídas no protótipo**. Se alguém pedir, responda: *"na versão de produção."*

- ❌ Integração real com API do WhatsApp (Z-API, Meta Business, etc.)
- ❌ Login / autenticação complexa
- ❌ Multi-usuário / multi-oficina
- ❌ Financeiro / ERP / emissão de nota
- ❌ Backend real (banco de dados em produção)
- ❌ Automação real de agendamento
- ❌ Importação de planilha
- ❌ Relatórios customizáveis
- ❌ App mobile nativo

👉 **Qualquer coisa fora do core mata velocidade de validação.**

---

## 11. 🖥️ UI/UX

### Princípios
1. **Simples** — cada tela tem 1 objetivo
2. **Mobile-first** — dono de oficina usa celular
3. **Visual forte** — preto + laranja (branding)
4. **Poucos campos** — nunca mais de 5 por formulário
5. **Números grandes** — dashboard é peça de venda

### Paleta
- **Preto:** `#0A0A0A` (fundo e textos)
- **Laranja:** `#FF6B00` (CTA, destaques, receita)
- **Branco:** `#FFFFFF` (cards)
- **Cinza:** `#F3F3F3` (backgrounds secundários)

### Tipografia
- Headings: bold, alto contraste
- Números (métricas): **extra-bold, 2x do corpo**

### Componentes críticos
- Cards grandes no dashboard
- Botão primário laranja, cheio, grande
- Toast de confirmação após cada ação
- Chat WhatsApp com animação

---

## 12. ⚙️ Stack Técnica

| Camada | Escolha |
|---|---|
| Framework | Next.js 15 (App Router) |
| Hospedagem | Vercel |
| Estilo | Tailwind CSS |
| Persistência | LocalStorage (simular "salvando") |
| Dados | Mock hardcoded + seed em JSON |
| Autenticação | **Nenhuma** |
| Backend | **Nenhum** (frontend apenas) |

### Performance
- LCP < 2.5s
- Total JS < 200kb
- Imagens otimizadas (Next/Image)

---

## 13. 🧪 Hipóteses a Validar

| # | Hipótese | Como validar |
|---|---|---|
| H1 | Representante entende o produto em < 3 min | Demo cronometrada |
| H2 | Oficina vê valor imediato | Pergunta aberta: *"o que você achou?"* |
| H3 | A mensagem de WhatsApp parece natural | Mostrar e perguntar: *"você mandaria isso?"* |
| H4 | "Cliente voltando" é percebido como o benefício principal | Observar qual tela gera mais reação |
| H5 | R$ 8.250 de receita é um número crível e atrativo | Observar reação ao dashboard |

---

## 14. 🧠 Riscos

| Risco | Mitigação |
|---|---|
| Parecer "complexo demais" | Remover qualquer feature que não seja core |
| Parecer "só mais um sistema" | Dashboard com **R$** gigante na tela inicial |
| Não mostrar dinheiro gerado | Receita é a **primeira coisa** que aparece |
| Foco em feature ao invés de resultado | Roteiro de demo obrigatório (seção 16) |
| Representante não saber vender | Script de 3 minutos anexo |
| Oficina pedir integração real | Responder: *"versão de produção, set 2026"* |

---

## 15. 🗺️ Roadmap Pós-Validação

### Fase 1 — Protótipo (AGORA)
- Frontend mockado
- Validação com 3-5 oficinas

### Fase 2 — MVP (se validado)
- Backend real (Supabase)
- Integração WhatsApp (Z-API ou Meta Business)
- Cadastro persistente
- 1 oficina piloto pagante

### Fase 3 — Escala
- Multi-oficina
- Dashboard do representante (comissão)
- Integração com sistemas de oficina existentes

---

## 16. 🎤 Roteiro de Demonstração (OBRIGATÓRIO)

**Duração:** 3 minutos.
**Regra:** nunca começar pela tela de cadastro.

### Passo 1 — Dashboard (30s)
> *"Olha aqui. Essa oficina gerou **R$ 8.250 de receita** só com clientes que voltaram por causa de lembrete."*

### Passo 2 — Cadastro (30s)
> *"Cliente chega, você cadastra em 10 segundos. Pronto, a gente cuida do resto."*

### Passo 3 — WhatsApp (60s)
> *"Daqui 3 meses, o sistema manda essa mensagem. Olha a resposta do cliente…"* *(mostra animação do chat)*

### Passo 4 — Retorno (30s)
> *"Cliente voltou. R$ 250 na conta. Repete isso com 100 clientes por mês."*

### Fechamento (30s)
> **"Isso aqui coloca cliente de volta na sua oficina. Quanto vale pra você?"**

---

## 17. ✅ Critérios de Aceite do Protótipo

- [ ] Dashboard abre em < 2s com 4 métricas visíveis
- [ ] Cadastro funciona com 5 campos e toast de confirmação
- [ ] Lista de lembretes mostra ≥ 10 clientes mockados
- [ ] Simulação de WhatsApp tem animação de "digitando..."
- [ ] Lista de retornos soma receita corretamente (R$ 8.250)
- [ ] Design segue paleta preto + laranja
- [ ] Deploy na Vercel funciona em domínio público
- [ ] Mobile-first testado em iPhone e Android (preview Chrome)
- [ ] Roteiro de demo executável em 3 min cronometrados

---

## 18. 📎 Anexos

- [copy.md](copy.md) — textos e microcopy
- [design-system.md](design-system.md) — tokens visuais
- `quando-trocar-plano-validacao-30d.docx` — plano de validação
- `quando-trocar-script-abordagem.docx` — script comercial
- `quando-trocar-tracking.xlsx` — controle de validação
