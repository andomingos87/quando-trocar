-- ============================================================================
-- Admin-2: FAQ de vendas + Configuracoes do agente vendedor
-- Fonte: docs/regras-de-negocio.md, plano de personalizacao do agente vendedor.
-- Objetivo: tirar a FAQ e a config do vendedor do codigo, deixar gerenciavel
-- no painel admin. Atualiza preco_base do plano unico para R$ 59 (a partir de).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. faq_vendas
-- ----------------------------------------------------------------------------
create table faq_vendas (
  id uuid primary key default gen_random_uuid(),
  pergunta text not null,
  resposta text not null,
  palavras_chave text[] not null default '{}',
  ativo boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index faq_vendas_ativo_ordem_idx on faq_vendas(ativo, ordem);

alter table faq_vendas enable row level security;

-- O painel admin acessa via service-role (bypassa RLS). O bot tambem.
-- Nenhuma policy criada de proposito: nao queremos leitura anonima.

-- ----------------------------------------------------------------------------
-- 2. configuracoes_vendedor (singleton: sempre exatamente 1 linha)
-- ----------------------------------------------------------------------------
create table configuracoes_vendedor (
  id uuid primary key default gen_random_uuid(),
  taxa_recuperacao_roi numeric(4,3) not null default 0.150
    check (taxa_recuperacao_roi > 0 and taxa_recuperacao_roi < 1),
  whatsapp_handoff_comercial text not null
    check (whatsapp_handoff_comercial ~ '^\+[1-9][0-9]{7,14}$'),
  frases_landing text[] not null default array['oi quero testar o quando trocar']::text[],
  updated_at timestamptz not null default now(),
  updated_by uuid references admin_users(id)
);

-- Garante que so existe 1 linha (singleton).
create unique index configuracoes_vendedor_singleton_idx
  on configuracoes_vendedor((true));

alter table configuracoes_vendedor enable row level security;

-- ----------------------------------------------------------------------------
-- 3. Atualiza preco de partida do plano unico (ADR-0012, "a partir de R$ 59")
-- ----------------------------------------------------------------------------
update planos
   set preco_base = 59.00,
       updated_at = now()
 where nome = 'Quando Trocar Mensal';

-- ----------------------------------------------------------------------------
-- 4. Seed inicial das 16 FAQs aprovadas
-- ----------------------------------------------------------------------------
insert into faq_vendas (pergunta, resposta, palavras_chave, ordem) values
  (
    'Quanto tempo dura o teste?',
    '14 dias gratis chefe, sem cartao e sem compromisso.',
    array['teste','dias','gratis','periodo','quanto tempo'],
    10
  ),
  (
    'Precisa cartao de credito pra comecar o teste?',
    'Nao precisa nao chefe. So se voce quiser continuar depois dos 14 dias.',
    array['cartao','credito','cobrar'],
    20
  ),
  (
    'Tem fidelidade ou contrato longo?',
    'Sem fidelidade, e mes a mes. Cancela quando quiser.',
    array['fidelidade','contrato','prazo','multa','longo'],
    30
  ),
  (
    'Posso cancelar quando quiser?',
    'Pode sim chefe, e so me avisar por aqui e a gente pausa. Sem multa.',
    array['cancelar','sair','parar'],
    40
  ),
  (
    'Tem nota fiscal?',
    'Tem sim, NF mensal.',
    array['nota','fiscal','nf','nfe','nfse'],
    50
  ),
  (
    'Ja uso WhatsApp pra avisar meus clientes, qual a diferenca?',
    'A gente automatiza chefe. Voce nao precisa lembrar de chamar ninguem — o sistema chama no dia certo e te mostra quem voltou e quem nao respondeu.',
    array['ja uso','ja faco','diferenca','manualmente'],
    60
  ),
  (
    'E se o cliente nao responder a mensagem?',
    'A gente registra e te mostra a lista de quem ficou em silencio, pra voce decidir se chama, oferece desconto ou deixa quieto.',
    array['nao responde','nao responder','sem resposta'],
    70
  ),
  (
    'Quem manda a mensagem, meu numero ou o de voces?',
    'No teste sai do nosso numero oficial. Depois da pra configurar pra sair do seu se voce quiser.',
    array['numero','qual numero','sai de qual','meu whatsapp'],
    80
  ),
  (
    'Funciona so pra troca de oleo?',
    'Funciona pra qualquer servico com retorno previsivel: oleo, alinhamento, revisao, filtro. Voce define o intervalo.',
    array['so oleo','outros servicos','alinhamento','revisao'],
    90
  ),
  (
    'Como cadastro os clientes?',
    'Manualmente por aqui mesmo, ou importando uma planilha se voce ja tiver uma lista.',
    array['cadastro','cadastrar','importar','planilha','base'],
    100
  ),
  (
    'Tem app ou e so WhatsApp?',
    'Tudo pelo WhatsApp chefe, sem app pra instalar. Tem um painel web so pra ver os numeros.',
    array['app','aplicativo','baixar','instalar'],
    110
  ),
  (
    'Precisa integrar com meu sistema?',
    'Nao precisa nao chefe. Funciona a parte. Integracao especifica a gente ve caso a caso depois.',
    array['integrar','integracao','sistema','erp','software'],
    120
  ),
  (
    'Funciona pra oficina pequena?',
    'Funciona melhor ainda chefe. Quanto menor a oficina, mais cada cliente perdido pesa.',
    array['pequena','sozinho','pouco movimento','comeco'],
    130
  ),
  (
    'Como sei que vai dar certo?',
    'Pra isso e o teste de 14 dias chefe. Voce roda com seus clientes reais e ve se compensa.',
    array['vai funcionar','dar certo','garantia','comprovar'],
    140
  ),
  (
    'O cliente final paga alguma coisa?',
    'Nao chefe, so a oficina paga. Pro cliente e so receber a mensagem.',
    array['cliente paga','cobra cliente','cobrar cliente'],
    150
  );

-- ----------------------------------------------------------------------------
-- 5. Seed singleton configuracoes_vendedor (taxa 15%, fallback Anderson)
-- ----------------------------------------------------------------------------
insert into configuracoes_vendedor (
  taxa_recuperacao_roi,
  whatsapp_handoff_comercial,
  frases_landing
) values (
  0.150,
  '+5511945207618',
  array['oi quero testar o quando trocar']
);
