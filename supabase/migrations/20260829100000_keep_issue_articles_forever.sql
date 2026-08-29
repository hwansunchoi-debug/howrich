-- =====================================================================
-- 보관 정책 변경: 이슈에 묶인 기사는 지우지 않는다
-- =====================================================================
-- 기존 정책은 7일이 지난 기사를 모두 지워, 오래 이어지는 이슈의
-- 타임라인이 중간부터 끊겼다.
--
-- 바뀐 정책
--   1. 이슈에 묶인 기사 : 제목·언론사·링크·보도시각을 계속 보관한다.
--      다만 용량이 큰 요약(summary)은 보관 기간이 지나면 비운다.
--      요약은 이슈를 묶을 때만 쓰고 화면에는 보여주지 않는다.
--   2. 이슈에 묶이지 않은 기사 : 보관 기간이 지나면 지운다.
--      (AI 가 이슈로 다루지 않기로 한 기사들로, 전체의 절반 이상이다)
--   3. 기사가 하나도 없는 이슈 : 하루 뒤 정리한다.
--
-- 무료 플랜 500MB 기준으로 하루 1,500건을 수집해도 몇 년치를 담을 수 있다.
-- =====================================================================

create or replace function public.prune_old_news(retain_days integer default 7)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. 이슈에 묶이지 않은 오래된 기사만 지운다.
  delete from public.articles a
  where a.published_at < now() - make_interval(days => retain_days)
    and not exists (
      select 1 from public.issue_articles ia where ia.article_id = a.id
    );

  -- 2. 오래된 기사의 요약을 비워 용량을 줄인다. 제목·링크·시각은 남는다.
  update public.articles a
  set summary = null
  where a.summary is not null
    and a.published_at < now() - make_interval(days => retain_days);

  -- 3. 기사가 모두 사라진 이슈는 함께 정리한다.
  delete from public.issues i
  where not exists (
    select 1 from public.issue_articles ia where ia.issue_id = i.id
  )
  and i.created_at < now() - interval '1 day';
end;
$$;

revoke execute on function public.prune_old_news(integer) from public;
grant execute on function public.prune_old_news(integer) to service_role;

-- 저장 용량을 확인할 때 쓴다.
create or replace view public.news_storage_usage
with (security_invoker = on) as
select
  (select count(*) from public.articles) as 전체_기사,
  (select count(*) from public.articles a
    where exists (select 1 from public.issue_articles ia where ia.article_id = a.id)
  ) as 이슈에_묶인_기사,
  (select count(*) from public.issues) as 이슈,
  (select count(*) from public.timeline_events) as 타임라인_요약,
  pg_size_pretty(
    pg_total_relation_size('public.articles')
    + pg_total_relation_size('public.issues')
    + pg_total_relation_size('public.issue_articles')
    + pg_total_relation_size('public.timeline_events')
  ) as 사용_용량;

grant select on public.news_storage_usage to service_role;
