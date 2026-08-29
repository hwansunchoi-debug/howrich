-- 5분마다 news-pipeline 을 실행하도록 예약한다.
-- GitHub Actions 워크플로가 psql 변수로 값을 넘겨 실행한다.
--   psql -v project_url=... -v service_key=... -f 이파일
-- 여러 번 실행해도 안전하다.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- 이전 값이 있으면 지우고 다시 넣는다.
delete from vault.secrets where name in ('news_project_url', 'news_service_role_key');
select vault.create_secret(:'project_url', 'news_project_url');
select vault.create_secret(:'service_key', 'news_service_role_key');

select cron.unschedule('news-pipeline-every-5-min')
where exists (select 1 from cron.job where jobname = 'news-pipeline-every-5-min');

select cron.schedule(
  'news-pipeline-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'news_project_url') || '/functions/v1/news-pipeline',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                     where name = 'news_service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

select jobname, schedule, active from cron.job where jobname = 'news-pipeline-every-5-min';
