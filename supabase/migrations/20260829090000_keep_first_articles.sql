-- =====================================================================
-- 오래된 기사 정리에서 "최초 보도"는 남긴다.
-- =====================================================================
-- 이슈마다 가장 먼저 나온 기사는 그 이슈가 언제 시작됐는지 보여주는
-- 기준점이므로, 보관 기간이 지나도 지우지 않는다.
-- =====================================================================

create or replace function public.prune_old_news(retain_days integer default 7)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with first_articles as (
    select distinct on (ia.issue_id) ia.article_id
    from public.issue_articles ia
    join public.articles a on a.id = ia.article_id
    order by ia.issue_id, a.published_at asc
  )
  delete from public.articles a
  where a.published_at < now() - make_interval(days => retain_days)
    and not exists (
      select 1 from first_articles f where f.article_id = a.id
    );

  -- 기사가 모두 사라진 이슈는 함께 정리한다.
  delete from public.issues i
  where not exists (
    select 1 from public.issue_articles ia where ia.issue_id = i.id
  )
  and i.created_at < now() - interval '1 day';
end;
$$;

revoke execute on function public.prune_old_news(integer) from public;
grant execute on function public.prune_old_news(integer) to service_role;
