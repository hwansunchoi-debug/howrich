-- 현재 이슈 상태를 JSON 한 덩어리로 뽑는다.
-- 화면 미리보기를 만들 때 사용한다.
select json_build_object(
  'generated_at', now(),
  'article_total', (select count(*) from articles),
  'issue_total', (select count(*) from issues where article_count > 0),
  'sources', coalesce((
    select json_agg(json_build_object('name', name, 'status', last_status) order by name)
    from news_sources
  ), '[]'::json),
  'issues', coalesce((
    select json_agg(x) from (
      select
        i.id,
        i.title,
        i.description,
        i.issue_score,
        i.article_count,
        i.recent_article_count,
        i.trend,
        i.last_article_at,
        (
          select coalesce(json_agg(json_build_object(
            'start_time', te.start_time,
            'summary', te.summary,
            'article_count', te.article_count
          ) order by te.start_time desc), '[]'::json)
          from timeline_events te where te.issue_id = i.id
        ) as timeline,
        (
          select coalesce(json_agg(json_build_object(
            'title', a.title,
            'publisher', a.publisher,
            'published_at', a.published_at,
            'url', a.url
          ) order by a.published_at desc), '[]'::json)
          from issue_articles ia
          join articles a on a.id = ia.article_id
          where ia.issue_id = i.id
        ) as articles
      from issues i
      where i.article_count > 0
      order by i.issue_score desc
      limit 12
    ) x
  ), '[]'::json)
);
