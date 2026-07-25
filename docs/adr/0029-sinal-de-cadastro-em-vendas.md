# ADR 0029: Sinal de cadastro em vendas preserva o rascunho até a conversão

- **Status**: accepted
- **Data**: 2026-07-25
- **Decisores**: Anderson Domingos
- **Fonte**: QTR-35 P1 — oficina tentou cadastrar uma troca antes de ter sido convertida e recebeu FAQ/ROI em vez de ativação guiada.
- **Relaciona-se com**: ADR-0001 (LLM não decide estado), ADR-0017 (confirmação antes de registrar), ADR-0027 (extração de cadastro por LLM).

## Contexto

O sinal determinístico de cadastro já existia no onboarding/operação, mas vendas o ignorava. Uma mensagem como "Leonardo, BMW, troca de óleo hoje, telefone" podia ser lida como volume/ticket por conter números. Além disso, a conversão limpa `conversas.context`, o que apagaria qualquer rascunho antes de o onboarding poder extrair os dados.

## Decisão

Extrair o sinal para módulo compartilhado e avaliá-lo antes da classificação de vendas. O bot guarda o texto bruto, origem de mídia e data São Paulo em `pending_registration`, pede apenas o nome da oficina e converte normalmente. No mesmo turno da conversão, o webhook lê esse contexto antes de limpá-lo, chama o onboarding com a data original e persiste apenas o contexto devolvido.

O onboarding pode devolver card de confirmação ou pergunta de campo faltante. Não chama `register_service_with_reminder` nesse turno: o "sim" explícito da oficina continua obrigatório.

## Alternativas consideradas

- **Rodar extração LLM já em vendas** — descartada: aumenta latência/custo antes do teste e mistura aquisição com onboarding.
- **Ignorar o cadastro e pedir que envie de novo após converter** — descartada: perde a melhor intenção de compra e cria retrabalho.
- **Guardar só a data extraída** — descartada: o onboarding precisa do texto e origem completos; a data original preserva corretamente termos relativos como "hoje".

## Consequências

### Positivas

- A tentativa real de usar o produto vira um gatilho de conversão, não uma resposta genérica.
- Nenhuma escrita em serviço/lembrete ocorre sem conferência humana.

### Negativas / trade-offs

- Mais contexto temporário na conversa até a conversão.
- Se a extração falhar após converter, o bot pede o campo faltante; não inventa nem persiste dado.

## Referências

- `lib/whatsapp/registration-signal.ts`, `sales-agent.ts`, `onboarding-agent.ts`, `webhook-handler.ts`
- `docs/regras-de-negocio.md` §2.1 e §3.4
