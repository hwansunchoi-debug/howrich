-- =====================================================================
-- 이슈 기준: 몇 개 언론사가 다뤘는가
-- =====================================================================
-- 한 언론사만 단발로 쓴 기사까지 이슈가 되면서 목록이 지저분해졌다.
-- "여러 언론사가 같은 사건을 다룬다"는 것이 이슈의 실질적인 기준이므로,
-- 이슈마다 참여 언론사 수를 세어 두고 화면에서 걸러 쓸 수 있게 한다.
-- =====================================================================

alter table public.issues
  add column if not exists publisher_count integer not null default 0;

comment on column public.issues.publisher_count is
  '이 이슈를 보도한 서로 다른 언론사 수. 2 이상이어야 목록에 노출한다.';

create index if not exists issues_publisher_count_idx
  on public.issues (publisher_count, issue_score desc);

-- 점수 계산에 언론사 수를 함께 갱신한다.
create or replace function public.refresh_issue_scores()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with stats as (
    select
      i.id,
      count(a.id)                                                                    as total_count,
      count(distinct a.publisher)                                                    as publisher_count,
      count(a.id) filter (where a.published_at >= now() - interval '24 hours')        as recent_count,
      count(a.id) filter (where a.published_at >= now() - interval '1 hour')          as last_hour,
      count(a.id) filter (where a.published_at >= now() - interval '2 hours'
                            and a.published_at <  now() - interval '1 hour')          as prev_hour,
      max(a.published_at)                                                            as last_at
    from public.issues i
    left join public.issue_articles ia on ia.issue_id = i.id
    left join public.articles a on a.id = ia.article_id
    group by i.id
  ),
  scored as (
    select
      s.*,
      case
        when s.last_at is null then 0
        else greatest(0, extract(epoch from (now() - s.last_at)) / 3600.0)
      end as hours_since_last
    from stats s
  )
  update public.issues i
  set
    article_count        = sc.total_count,
    publisher_count      = sc.publisher_count,
    recent_article_count = sc.recent_count,
    last_hour_count      = sc.last_hour,
    prev_hour_count      = sc.prev_hour,
    last_article_at      = sc.last_at,
    trend = case
      when sc.last_hour = 0 and sc.prev_hour = 0 then 'steady'
      when sc.last_hour >= sc.prev_hour * 2 and sc.last_hour >= 3 then 'surging'
      when sc.last_hour > sc.prev_hour then 'rising'
      when sc.last_hour < sc.prev_hour then 'cooling'
      else 'steady'
    end,
    issue_score = case
      when sc.last_at is null then 0
      else round((
              12 * ln(1 + sc.recent_count)
            + greatest(-10, least(30,
                20 * ((sc.last_hour + 1)::numeric / (sc.prev_hour + 1)::numeric - 1)
              )) * least(1, sc.last_hour / 3.0)
            + 30 * exp(-sc.hours_since_last / 6.0)
      )::numeric, 2)
    end,
    updated_at = now()
  from scored sc
  where sc.id = i.id;
end;
$$;

revoke execute on function public.refresh_issue_scores() from public;
grant execute on function public.refresh_issue_scores() to service_role;
