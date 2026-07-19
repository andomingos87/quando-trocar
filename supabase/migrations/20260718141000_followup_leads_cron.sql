-- ============================================================================
-- CV4 (QTR-13): agendamento do follow-up proativo de leads.
-- Fonte: docs/backlog-whatsapp-bot/fase-camada-conversacional.md (Fase CV4).
-- Segue o padrão do consumidor de lembretes (20260426130513): uma função
-- SECURITY DEFINER lê a URL do endpoint e o segredo interno do Vault e chama o
-- Route Handler protegido via net.http_post; o cron dispara 1×/dia em horário
-- comercial.
--
-- Pré-requisito operacional (definir no Vault do projeto, uma vez):
--   select vault.create_secret('https://SEU_HOST/api/internal/followup-leads',
--                              'followup_leads_url');
-- O segredo `internal_job_secret` já existe (usado pelos lembretes).
-- ============================================================================

create or replace function public.dispatch_followup_leads()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets
   where name = 'followup_leads_url'
   limit 1;

  select decrypted_secret into v_secret
    from vault.decrypted_secrets
   where name = 'internal_job_secret'
   limit 1;

  -- Sem URL/segredo configurados o job simplesmente não roda (não quebra o cron).
  if v_url is null or v_secret is null then
    return null;
  end if;

  return net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object('limit', 200),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function public.dispatch_followup_leads() from public, anon, authenticated;

-- 1×/dia às 13:00 UTC (~10:00 America/Sao_Paulo) — horário comercial.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'followup-leads-daily') then
    perform cron.schedule(
      'followup-leads-daily',
      '0 13 * * *',
      $cron$select public.dispatch_followup_leads();$cron$
    );
  end if;
end
$$;
