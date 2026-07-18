-- ============================================================================
-- CV3 (QTR-12): seeds de OBJEÇÃO de vendas como FAQ.
-- ============================================================================
-- As objeções entram como linhas de `faq_vendas` (editáveis no admin, sem
-- deploy) em vez de uma coluna `tipo` dedicada: o CV2/ADR-0022 estabeleceu a
-- FAQ do banco como o canal editável que alimenta o modo `respond` e o match
-- determinístico de `pergunta_faq`. Cada objeção vira contorno + CTA para o
-- teste — nunca cita preço/condição comercial (ADR-0012; senão o filtro de
-- preço as removeria do bloco de conhecimento do respond).
--
-- Cobertura anterior já existente (não duplicar): "Isso nao e spam? E a LGPD?"
-- e "O cliente vai se incomodar com a mensagem?" (migration 20260520213000) e
-- "Ja uso outro sistema, qual a diferenca?" (planilha). Aqui entram as objeções
-- que ainda caíam no `fora_escopo`: falta de tempo, cliente sem WhatsApp,
-- "já controlo no caderno/na cabeça" e "meu cliente vai achar chato".
--
-- Idempotente: só insere a objeção cuja `pergunta` ainda não existe, para ser
-- seguro reaplicar (neste projeto as migrations são aplicadas à parte via MCP).

insert into faq_vendas (pergunta, resposta, palavras_chave, ordem)
select v.pergunta, v.resposta, v.palavras_chave, v.ordem
from (
  values
    (
      'Nao tenho tempo pra mais um sistema',
      'Justamente por isso chefe: quem trabalha o dia inteiro nao pode parar pra ficar ligando cliente. Voce so registra a troca e o sistema chama sozinho na hora certa. Bora ativar 14 dias gratis pra voce ver que quase nao toma seu tempo?',
      array['nao tenho tempo','sem tempo','tempo pra isso','tempo pra mais um','muito corrido','muita correria','atarefado','mao cheia','nao paro']::text[],
      300
    ),
    (
      'Meu cliente nao usa WhatsApp',
      'Alguns nao usam mesmo chefe, mas hoje a grande maioria ta no WhatsApp. Pra quem nao tem, voce segue chamando do seu jeito — o sistema so cuida de quem da pra avisar por aqui, sem esforco seu. Quer testar 14 dias gratis e ver na sua base?',
      array['nao usa whatsapp','cliente nao tem whatsapp','nao usam whatsapp','nao mexe no whatsapp','cliente nao usa zap','nao tem zap','cliente mais velho']::text[],
      310
    ),
    (
      'Ja controlo no caderno ou de cabeca',
      'Massa que voce ja se organiza chefe. A diferenca e que caderno nao te avisa na hora da proxima troca — a gente lembra o cliente sozinho e ainda te mostra quem voltou e quem sumiu. Bora ativar 14 dias gratis pra voce comparar com o caderno?',
      array['anoto em caderno','tenho caderno','caderninho','ja controlo','na cabeca','de cabeca','ja anoto','agenda de papel','anoto tudo','controlo tudo']::text[],
      320
    ),
    (
      'Meu cliente vai achar chato',
      'Boa preocupacao chefe. Nao e chato porque a frequencia e baixa — so um toque na hora da proxima troca, no jeitinho de oficina. E se alguem nao quiser, e so pedir pra parar que a gente respeita na hora. Quer testar 14 dias gratis pra sentir o tom das mensagens?',
      array['vai achar chato','achar chato','achar ruim','vao achar chato','invasivo','achar invasivo','cliente vai reclamar da mensagem','encher o saco']::text[],
      330
    )
) as v(pergunta, resposta, palavras_chave, ordem)
where not exists (
  select 1 from faq_vendas f where f.pergunta = v.pergunta
);
