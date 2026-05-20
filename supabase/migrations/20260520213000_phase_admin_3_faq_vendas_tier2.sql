-- ============================================================================
-- Admin-3: FAQ vendas TIER 2 (5 perguntas frequentes em B2B)
-- Fonte: docs/regras-de-negocio.md, plano Ciclo 3 (TIER 1 + 4 TIER 2 criticos).
-- ============================================================================

insert into faq_vendas (pergunta, resposta, palavras_chave, ordem) values
  (
    'Voces tem cliente? Quem usa?',
    'Produto novo chefe, to abrindo as primeiras oficinas agora. Se quiser conversar com o Anderson direto, te conecto.',
    array['tem cliente','quem usa','quem ja usou','cases','case de sucesso','referencia','exemplo de cliente','prova social'],
    200
  ),
  (
    'Ja uso outro sistema, qual a diferenca?',
    'Massa que voce ja se organiza chefe. A gente automatiza a parte de chamar o cliente de volta no dia certo e mostra quem voltou e quem nao respondeu. Bora ativar 14 dias gratis pra voce comparar?',
    array['ja uso outro','outro sistema','tenho sistema','tenho um software','uso planilha','tenho planilha','qual a diferenca','ja organizo','ja faco diferente'],
    210
  ),
  (
    'O cliente vai se incomodar com a mensagem?',
    'Boa chefe, a frequencia e baixa (uma mensagem so na hora da proxima troca). E o cliente pode pedir pra parar a qualquer momento que a gente respeita.',
    array['cliente incomoda','cliente reclama','vai chatear','vai encher','ele vai gostar','vai irritar'],
    220
  ),
  (
    'Isso nao e spam? E a LGPD?',
    'Nada de spam chefe. Mandamos so no momento certo, com consentimento da oficina, e o cliente pode dar opt-out a qualquer hora. A gente segue a LGPD direitinho.',
    array['spam','lgpd','privacidade','dados do cliente','dado do cliente','e legal','e permitido'],
    230
  ),
  (
    'Quem e voce? E IA?',
    'Sou o assistente do Quando Trocar chefe, ajudo a oficina a entender o produto. Pra fechar negocio e direto com o Anderson. Quer que ele te chame?',
    array['quem e voce','voce e ia','voce e robo','voce e bot','voce trabalha','voce e humano','qual seu nome','seu nome','voce e quem','robo ou humano','humano ou robo'],
    240
  );
