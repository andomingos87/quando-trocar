-- Backfill: normaliza clientes_finais.nome já gravado.
-- Antes da correção em lib/whatsapp/onboarding-agent.ts, a oficina às vezes
-- enviava o nome embrulhado em frase de intenção/rótulo
-- ("Quero cadastrar o cliente Luca Marcilli") e o parser salvava a frase inteira.
-- Esta migration espelha normalizeNomeCliente() para limpar os registros
-- existentes: remove prefixos de intenção/rótulo, apara pontuação nas pontas e
-- aplica caixa de nome próprio (partículas de/da/do/das/dos/e em minúsculas).
-- Forward-only. Não reverte (os nomes originais não são preservados).

create or replace function public._normalize_nome_cliente(raw text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
  prev text;
  parts text[];
  out_parts text[];
  w text;
  i int;
begin
  if raw is null then return null; end if;
  v := btrim(regexp_replace(raw, '\s+', ' ', 'g'));
  if v = '' then return null; end if;

  -- remove prefixos de intenção/rótulo iterativamente até estabilizar
  loop
    prev := v;
    v := regexp_replace(v, '^(eu\s+)?(quero|queria|gostaria(\s+de)?|preciso(\s+de)?|vou|pode(r(ia)?)?|favor|por\s+favor|me\s+ajud\w*(\s+a)?)\s+', '', 'i');
    v := regexp_replace(v, '^(cadastr\w*|registr\w*|adicion\w*|inclu\w*|inser\w*|anot\w*|salv\w*|coloc\w*|criar?|abrir?)\s+', '', 'i');
    v := regexp_replace(v, '^(o|a|os|as|um|uma|esse|essa|este|esta|aquele|aquela|meu|minha|novo|nova)\s+', '', 'i');
    v := regexp_replace(v, '^(clientes?|clienta|nome(\s+(do|da|de))?(\s+cliente)?)\y\s*', '', 'i');
    v := regexp_replace(v, '^(chamad[oa]|de\s+nome|que\s+(se\s+)?chama|é|eh|seria)\s+', '', 'i');
    v := regexp_replace(v, '^[\s:,.\-]+', '', '');
    v := btrim(v);
    exit when v = prev;
  end loop;

  v := regexp_replace(v, '[\s:,.\-]+$', '', '');
  v := btrim(v);
  if v = '' then return null; end if;

  -- caixa de nome próprio, mantendo partículas em minúsculas
  parts := regexp_split_to_array(v, '\s+');
  out_parts := array[]::text[];
  for i in 1 .. array_length(parts, 1) loop
    w := parts[i];
    if i > 1 and lower(w) in ('de', 'da', 'do', 'das', 'dos', 'e') then
      out_parts := out_parts || lower(w);
    else
      out_parts := out_parts || initcap(w);
    end if;
  end loop;
  return array_to_string(out_parts, ' ');
end;
$$;

-- Só atualiza quando a normalização produz um nome não-vazio e diferente.
-- Quando o resultado seria vazio (ex.: "quero cadastrar o cliente"), preserva o
-- valor original para não perder dado — admin pode corrigir manualmente.
update public.clientes_finais c
set nome = public._normalize_nome_cliente(c.nome),
    updated_at = now()
where c.nome is not null
  and public._normalize_nome_cliente(c.nome) is not null
  and public._normalize_nome_cliente(c.nome) <> c.nome;

drop function public._normalize_nome_cliente(text);
