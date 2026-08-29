-- 자동 실행 예약
--   기사 수집 (AI 안 씀, 비용 없음)  : 15분마다
--   AI 분석 + 타임라인 생성           : 1시간마다 (매시 5분)
--
-- GitHub Actions 워크플로가 psql 변수로 값을 넘겨 실행한다.
--   psql -v project_url=... -v service_key=... -f 이파일
-- 여러 번 실행해도 안전하다.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- 이전 값이 있으면 지우고 다시 넣는다.
delete from vault.secrets where name in ('news_project_url', 'news_service_role_key');
select vault.create_secret(:'project_url', 'news_project_url');
select vault.create_secret(:'service_key', 'news_service_role_key');

-- 예전 이름의 예약이 남아 있으면 정리한다.
select cron.unschedule(jobname)
from cron.job
where jobname in (
  'news-pipeline-every-5-min',
  'news-collect-every-15-min',
  'news-pipeline-hourly'
);

-- 15분마다 기사만 수집한다. RSS 만 읽으므로 AI 요금이 들지 않는다.
select cron.schedule(
  'news-collect-every-15-min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'news_project_url') || '/functions/v1/news-collect',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                     where name = 'news_service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- 매시 5분에 AI 분석과 타임라인 생성까지 포함한 전체 과정을 실행한다.
select cron.schedule(
  'news-pipeline-hourly',
  '5 * * * *',
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
    timeout_milliseconds := 300000
  );
  $$
);

select jobname, schedule, active from cron.job
where jobname in ('news-collect-every-15-min', 'news-pipeline-hourly')
order by jobname;
