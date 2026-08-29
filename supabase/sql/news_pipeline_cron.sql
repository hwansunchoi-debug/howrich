-- =====================================================================
-- 5분마다 뉴스 파이프라인(news-pipeline Edge Function)을 실행하는 스케줄
-- =====================================================================
-- Supabase 대시보드 > SQL Editor 에서 한 번 실행한다.
-- service_role key 가 들어가므로 이 값은 Git 에 커밋하지 말고
-- 아래 vault.create_secret 부분만 각자 값으로 바꿔 실행한다.
-- =====================================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- 1) 프로젝트 URL / service_role key 를 Vault 에 저장한다. (최초 1회)
--    이미 등록했다면 이 두 줄은 건너뛴다.
select vault.create_secret(
  'https://<YOUR-PROJECT-REF>.supabase.co',
  'news_project_url'
);
select vault.create_secret(
  '<YOUR-SERVICE-ROLE-KEY>',
  'news_service_role_key'
);

-- 2) 5분마다 파이프라인 실행
select cron.unschedule('news-pipeline-every-5-min')
where exists (
  select 1 from cron.job where jobname = 'news-pipeline-every-5-min'
);

select cron.schedule(
  'news-pipeline-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'news_project_url'
    ) || '/functions/v1/news-pipeline',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'news_service_role_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

-- 확인
-- select * from cron.job;
-- select * from cron.job_run_details order by start_time desc limit 10;
