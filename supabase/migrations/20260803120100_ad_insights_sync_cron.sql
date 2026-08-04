-- ============================================================================
-- Agendamento do sync diário de ad insights (Meta Ads via Windsor.ai).
-- Segue o mesmo padrão do follow-up de leads (20260718141000): uma função
-- SECURITY DEFINER lê a URL do endpoint e o segredo interno do Vault e chama o
-- Route Handler protegido via net.http_post; o cron dispara 1×/dia.
--
-- Pré-requisito operacional (definir no Vault do projeto, uma vez):
--   select vault.create_secret('https://SEU_HOST/api/internal/sync-ad-insights',
--                              'ad_insights_sync_url');
-- O segredo `internal_job_secret` já existe (usado pelos lembretes/follow-up).
-- ============================================================================

create or replace function public.dispatch_ad_insights_sync()
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
   where name = 'ad_insights_sync_url'
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
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.dispatch_ad_insights_sync() from public, anon, authenticated;

-- 1×/dia às 11:30 UTC (~08:30 America/Sao_Paulo) — antes do horário comercial,
-- pra métricas do dia anterior estarem prontas quando o admin abrir a tela.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'ad-insights-sync-daily') then
    perform cron.schedule(
      'ad-insights-sync-daily',
      '30 11 * * *',
      $cron$select public.dispatch_ad_insights_sync();$cron$
    );
  end if;
end
$$;
