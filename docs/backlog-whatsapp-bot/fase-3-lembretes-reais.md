# Fase 3 - Lembretes reais

## Objetivo

Enviar lembretes reais pelo WhatsApp para clientes finais com consentimento, registrar status de entrega, interpretar respostas simples e tratar opt-out.

## Escopo

Inclui:

- Scheduler diario de lembretes.
- Fila de mensagens de saida.
- Envio de template aprovado pela Meta.
- Controle de horario comercial.
- Controle de consentimento.
- Deduplicacao de envio por servico/lembrete.
- Registro de status do provedor.
- Retry para erro temporario.
- Interpretacao de respostas simples do cliente final.
- Opt-out automatico.

Nao inclui:

- Campanhas promocionais.
- Calendario externo.
- Confirmacao definitiva de agenda.
- Segmentacao avancada.
- Multiatendente complexo.

## Dependencias

- Fase 2 concluida.
- Template `lembrete_troca_oleo` aprovado na Meta.
- Tabela `lembretes` populada.
- Cliente final com `consentimento_whatsapp = true`.
- Configuracao de horario de envio por oficina.

## Dados

Tabelas usadas:

- `lembretes`
- `clientes_finais`
- `oficinas`
- `mensagens`
- `outbound_messages`
- `whatsapp_events`
- `conversas`

Status principais:

```text
lembretes.status:
pendente, enfileirado, enviado, respondido, agendado, sem_resposta, cancelado, erro_envio

clientes_finais.status:
ativo, opt_out, numero_errado
```

## Tarefas tecnicas

- [ ] Criar fila `outbound_message_jobs`.
- [ ] Criar tabela `outbound_messages` se ainda nao existir.
- [ ] Criar funcao de selecao de lembretes vencidos.
- [ ] Implementar regra de horario comercial por oficina.
- [ ] Implementar regra de consentimento.
- [ ] Implementar bloqueio para cliente `opt_out`.
- [ ] Implementar deduplicacao por `lembrete_id`.
- [ ] Criar job `schedule-reminders`.
- [ ] Criar consumer `send-outbound`.
- [ ] Implementar envio de template pela Cloud API.
- [ ] Persistir texto renderizado do template em `mensagens.body`.
- [ ] Persistir `whatsapp_message_id`.
- [ ] Atualizar `lembretes.status = enviado` quando o envio for aceito.
- [ ] Registrar erro do provedor em `provider_error_code` e `last_error`.
- [ ] Implementar retry com limite de tentativas.
- [ ] Interpretar webhook de status da Meta.
- [ ] Interpretar resposta do cliente final.
- [ ] Implementar opt-out por palavras-chave.
- [ ] Cancelar lembretes futuros de cliente em opt-out.
- [ ] Notificar oficina quando houver pergunta especifica.

## Regras de envio

Um lembrete so pode ser enviado quando:

- `lembretes.status` for `pendente` ou `erro_envio` elegivel para retry.
- `scheduled_at <= now()`.
- `oficinas.status = ativa`.
- Cliente final estiver `ativo`.
- `consentimento_whatsapp = true`.
- Horario local da oficina estiver dentro da janela permitida.
- Nao houver envio anterior bem-sucedido para o mesmo `lembrete_id`.

Template padrao:

```text
Oi {{1}}, aqui e da {{2}}.
Ja esta na hora da proxima troca de oleo do seu {{3}}.
Quer agendar?
```

## Regras de resposta do cliente

Intencoes esperadas:

```text
quer_agendar
quer_reagendar
pergunta_preco
pergunta_horario
nao_tem_interesse
ja_fez_servico
numero_errado
mensagem_indefinida
opt_out
```

Condutas:

- `quer_agendar`: marcar como `agendado` quando houver data/horario claro, usando linguagem de pre-agendamento.
- `pergunta_preco`: acionar handoff para oficina.
- `pergunta_horario`: acionar handoff para oficina quando exigir disponibilidade real.
- `nao_tem_interesse`: marcar como `sem_resposta` ou `cancelado`, conforme texto.
- `numero_errado`: marcar cliente como `numero_errado` e cancelar lembretes futuros.
- `opt_out`: marcar cliente como `opt_out`, cancelar lembretes futuros e confirmar remocao.

## Criterios de aceite

- Dado um lembrete pendente vencido, quando o scheduler roda, o lembrete muda para `enfileirado`.
- Dado um lembrete enfileirado elegivel, o sistema envia template pela Cloud API e grava `whatsapp_message_id`.
- Dado um cliente sem consentimento, nenhum envio e feito.
- Dado um cliente respondendo "parar", o sistema marca `opt_out`, cancela lembretes futuros e responde confirmando remocao.
- Dado um cliente perguntando preco, o sistema registra handoff e notifica a oficina.
- Dado um erro temporario de provedor, o sistema agenda retry ate o limite configurado.

## Testes recomendados

- Teste de selecao de lembretes vencidos.
- Teste de bloqueio fora do horario comercial.
- Teste de bloqueio por falta de consentimento.
- Teste de deduplicacao de envio.
- Teste de montagem de template.
- Teste de persistencia de `whatsapp_message_id`.
- Teste de opt-out.
- Teste de classificacao de resposta do cliente final.
- Teste de retry em erro temporario.

## Riscos

- Template ser recusado pela Meta.
- Envio fora de horario gerar experiencia ruim.
- Cliente sem consentimento receber mensagem.
- Reenvio duplicado parecer spam.
- Resposta ambigua ser marcada como agendamento real.

## Saida esperada

Ao final da fase, o sistema envia lembretes reais com controle de consentimento, registra status e interpreta respostas simples sem depender de atendimento humano para cada mensagem.
