-- Fase 3 do plano "3 niveis de produto":
-- FAQ "serve para outros servicos alem de troca de oleo?" para o vendedor
-- responder cirurgicamente sem diluir a saudacao principal (que continua
-- focada em oleo). Ativa quando o lead pergunta explicitamente.

insert into public.faq_vendas (pergunta, resposta, palavras_chave, ordem, ativo)
values (
  'Serve para outros servicos alem de troca de oleo?',
  'O carro-chefe e troca de oleo chefe. Mas a gente tambem traz de volta cliente de revisao, troca de amortecedor e qualquer servico com retorno previsivel (3 meses a 2 anos).',
  array[
    'outros servicos','outros servico','alem de oleo','alem do oleo',
    'amortecedor','amortecedores',
    'revisao','revisão','revisar',
    'alinhamento','balanceamento',
    'suspensao','suspensão',
    'freio','freios','pastilha',
    'filtro','filtros',
    'servicos diferentes','tipos de servico','tipo de servico',
    'so faz oleo','so faz troca','so e oleo'
  ],
  250,
  true
);
