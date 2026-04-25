# Fase 4 - Retorno e dashboard

## Objetivo

Fechar o ciclo de valor do produto registrando retornos, receita gerada e exibindo as metricas principais em um dashboard operacional simples para a oficina.

## Escopo

Inclui:

- Registro de retorno pelo WhatsApp.
- Registro de retorno pelo painel.
- Vinculo entre retorno, cliente, veiculo, servico e lembrete.
- Calculo de receita gerada.
- Dashboard com metricas principais.
- Telas basicas de clientes, lembretes, conversas e retornos.
- Configuracoes essenciais da oficina.

Nao inclui:

- ERP completo.
- Financeiro completo.
- Nota fiscal.
- Estoque.
- CRM avancado.
- Relatorios complexos.
- Agenda com calendario externo.

## Dependencias

- Fase 3 concluida.
- Lembretes enviados e respostas registradas.
- Supabase Auth definido para area logada.
- `oficina_members` associando usuarios autenticados a oficinas.
- RLS funcionando por `oficina_id`.

## Dados

Tabelas usadas:

- `retornos`
- `clientes_finais`
- `veiculos`
- `servicos`
- `lembretes`
- `conversas`
- `mensagens`
- `oficinas`

Metricas principais:

```text
receita_gerada
clientes_que_voltaram
lembretes_enviados
clientes_cadastrados
taxa_de_conversao
```

Status de retorno:

```text
agendado, concluido, nao_compareceu, reagendar
```

## Tarefas tecnicas

- [ ] Criar tabela `retornos`.
- [ ] Criar ferramenta `create_retorno`.
- [ ] Implementar extracao estruturada para mensagem de retorno.
- [ ] Vincular retorno ao cliente por nome, telefone ou conversa ativa.
- [ ] Vincular retorno ao lembrete quando houver lembrete relacionado.
- [ ] Atualizar `lembretes.status = agendado` ou status final quando aplicavel.
- [ ] Criar consultas agregadas para dashboard.
- [ ] Implementar tela `Inicio` com receita gerada em destaque.
- [ ] Implementar tela `Clientes`.
- [ ] Implementar tela `Lembretes`.
- [ ] Implementar tela `Conversas`.
- [ ] Implementar tela `Retornos`.
- [ ] Implementar tela `Configuracoes`.
- [ ] Implementar acao manual `Confirmar retorno`.
- [ ] Implementar campo de valor com ticket medio como sugestao.
- [ ] Garantir RLS por oficina nas telas.
- [ ] Criar estados vazios para primeira utilizacao.

## Regras de retorno

Formas aceitas via WhatsApp:

```text
Joao voltou hoje, servico R$ 250
Joao veio trocar oleo, 250 reais
Cliente Joao retornou hoje
```

Quando faltar valor:

- Criar retorno com `valor = null` ou sugerir ticket medio para confirmacao, conforme origem.
- No painel, preencher valor sugerido com `oficinas.ticket_medio`.

Quando houver ambiguidade:

- Se houver mais de um cliente com nome parecido, pedir confirmacao.
- Se nao houver lembrete relacionado, criar retorno sem `lembrete_id` e registrar auditoria.

## Dashboard MVP

Tela `Inicio`:

- Card principal: receita gerada por lembretes no mes.
- Cards secundarios: clientes cadastrados, lembretes enviados e clientes que voltaram.
- Bloco de atividades recentes.
- Bloco `Hoje`: lembretes pendentes, respostas aguardando acao e retornos previstos.

Tela `Clientes`:

- Busca por nome, telefone, veiculo ou placa.
- Lista com status do proximo lembrete.
- Perfil simples com historico.
- Marcacao de opt-out.

Tela `Lembretes`:

- Filtros por status.
- Acao individual de envio quando permitido.
- Historico de tentativas.

Tela `Conversas`:

- Lista por prioridade.
- Visual de mensagens.
- Acoes rapidas: marcar como agendado, confirmar retorno, encerrar conversa.

Tela `Retornos`:

- Lista de agendados e concluidos.
- Acao `Confirmar retorno`.
- Campo de valor.
- Marcacao de nao compareceu.

Tela `Configuracoes`:

- Dados basicos da oficina.
- Ticket medio.
- Horario permitido de envio.
- Texto base do lembrete.
- Prazo padrao de lembrete.

## Criterios de aceite

- Dado uma oficina informando "Joao voltou hoje, R$ 250", o sistema cria retorno vinculado ao cliente quando houver correspondencia segura.
- Dado um retorno concluido com valor, o dashboard aumenta `receita_gerada`.
- Dado um cliente agendado, a oficina consegue confirmar retorno pelo painel.
- Dado um usuario autenticado de uma oficina, ele nao consegue acessar dados de outra oficina.
- Dado uma oficina sem retorno ainda, o dashboard mostra proximas acoes sem quebrar a experiencia.

## Testes recomendados

- Teste de extracao de retorno por WhatsApp.
- Teste de vinculacao segura ao cliente.
- Teste de comportamento com cliente ambiguo.
- Teste de agregacao de receita por mes.
- Teste de RLS por oficina.
- Teste de renderizacao das telas com estado vazio.
- Teste de acao manual `Confirmar retorno`.

## Riscos

- Receita ser inflada por retorno duplicado.
- Vinculo errado entre retorno e cliente.
- Dashboard virar CRM complexo cedo demais.
- RLS mal configurado expor dados entre oficinas.
- Oficina interpretar pre-agendamento como agenda confirmada.

## Saida esperada

Ao final da fase, o produto mostra valor financeiro claro: clientes cadastrados, lembretes enviados, clientes que voltaram e receita gerada por recorrencia.
