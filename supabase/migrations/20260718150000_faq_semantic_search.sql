-- ============================================================================
-- CV5 (QTR-14): busca semântica na FAQ de vendas.
-- Fonte: docs/backlog-whatsapp-bot/fase-camada-conversacional.md (Fase CV5),
--        docs/regras-de-negocio.md §1.
-- O match atual é por palavra-chave (substring) — "quanto sai por mês?" não
-- acha a FAQ de preço se a keyword cadastrada for "custa". Aqui adicionamos um
-- embedding por FAQ (OpenAI text-embedding-3-small, 1536 dims) e uma busca por
-- similaridade de cosseno. Sem embedding, o bot cai no match por keyword atual
-- (fallback — o embedding é preenchido no save do admin, best-effort).
-- ============================================================================

create extension if not exists vector with schema extensions;

alter table public.faq_vendas
  add column if not exists embedding extensions.vector(1536);

-- HNSW funciona em tabela vazia/pequena (sem etapa de treino do IVFFlat) e a FAQ
-- é pequena e cresce devagar.
create index if not exists faq_vendas_embedding_hnsw_idx
  on public.faq_vendas using hnsw (embedding extensions.vector_cosine_ops);

comment on column public.faq_vendas.embedding is
  'Embedding (OpenAI text-embedding-3-small, 1536d) da pergunta+resposta, para busca semântica (CV5). Nulo → cai no match por keyword.';

-- Busca as FAQs ativas mais similares à pergunta do usuário. Retorna a
-- similaridade de cosseno (1 - distância). SECURITY DEFINER: chamada só pelo
-- service-role (bot no server); revogada de anon/authenticated.
create or replace function public.match_faq_vendas(
  query_embedding extensions.vector(1536),
  match_threshold double precision default 0.78,
  match_count int default 3
)
returns table (
  id uuid,
  pergunta text,
  resposta text,
  palavras_chave text[],
  ordem int,
  similarity double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    f.id,
    f.pergunta,
    f.resposta,
    f.palavras_chave,
    f.ordem,
    1 - (f.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.faq_vendas f
  where f.ativo = true
    and f.embedding is not null
    and 1 - (f.embedding operator(extensions.<=>) query_embedding) >= match_threshold
  order by f.embedding operator(extensions.<=>) query_embedding asc
  limit match_count;
$$;

revoke all on function public.match_faq_vendas(extensions.vector, double precision, int)
  from public, anon, authenticated;
