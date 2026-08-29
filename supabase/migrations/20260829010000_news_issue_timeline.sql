-- =====================================================================
-- 대한민국 실시간 뉴스 이슈 타임라인 서비스
-- =====================================================================
-- 수집(articles) -> 이슈 묶기(issues, issue_articles)
-- -> 이슈 점수(issue_score) -> 시간대별 타임라인(timeline_events)
-- 모든 쓰기는 service_role(Edge Function)에서만 수행하고,
-- 읽기는 로그인 없이 누구나 가능하도록 한다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 뉴스 수집 소스 (RSS 또는 공식 뉴스 API)
-- ---------------------------------------------------------------------
create table if not exists public.news_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- 언론사 이름 (예: 연합뉴스)
  feed_url text not null unique,            -- RSS 주소 또는 API 엔드포인트
  source_type text not null default 'rss'   -- 'rss' | 'api'
    check (source_type in ('rss', 'api')),
  category text,                            -- 선택: 정치/경제/사회 등
  enabled boolean not null default true,
  last_fetched_at timestamptz,
  last_status text,                         -- 'ok' | 'error'
  last_error text,
  created_at timestamptz not null default now()
);

comment on table public.news_sources is 'RSS/API 뉴스 수집 소스 목록. 코드 배포 없이 소스를 켜고 끌 수 있다.';

-- ---------------------------------------------------------------------
-- 2. 기사
-- ---------------------------------------------------------------------
-- 기사 원문 전체는 저장하지 않는다. 제목/요약/링크만 저장하고,
-- 사용자는 클릭 시 언론사 원문 페이지로 이동한다.
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  publisher text not null,
  published_at timestamptz not null,
  url text not null unique,
  summary text,
  source_id uuid references public.news_sources(id) on delete set null,
  clustered_at timestamptz,                       -- AI 이슈 분류를 마친 시각
  created_at timestamptz not null default now()   -- 수집 시간
);

create index if not exists articles_published_at_idx
  on public.articles (published_at desc);
create index if not exists articles_created_at_idx
  on public.articles (created_at desc);

comment on column public.articles.created_at is '수집 시간';

-- ---------------------------------------------------------------------
-- 3. 이슈
-- ---------------------------------------------------------------------
create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,                        -- 이슈 제목
  description text,                           -- 현재 상황 한 줄 요약
  issue_score numeric(10, 2) not null default 0,

  -- 점수 계산에 사용한 값 (UI에서 그대로 보여주기 위해 함께 저장)
  article_count integer not null default 0,        -- 전체 기사 수
  recent_article_count integer not null default 0, -- 최근 24시간 기사 수
  last_hour_count integer not null default 0,      -- 최근 1시간 기사 수
  prev_hour_count integer not null default 0,      -- 직전 1시간 기사 수
  trend text not null default 'steady'             -- 'surging' | 'rising' | 'steady' | 'cooling'
    check (trend in ('surging', 'rising', 'steady', 'cooling')),
  last_article_at timestamptz,                     -- 최근 업데이트 시간

  timeline_built_at timestamptz,                   -- 마지막 타임라인 생성 시각
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists issues_score_idx
  on public.issues (issue_score desc);
create index if not exists issues_last_article_at_idx
  on public.issues (last_article_at desc nulls last);

-- ---------------------------------------------------------------------
-- 4. 이슈 <-> 기사 연결
-- ---------------------------------------------------------------------
create table if not exists public.issue_articles (
  issue_id uuid not null references public.issues(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (issue_id, article_id)
);

-- 한 기사는 하나의 이슈에만 속한다. (아직 분류되지 않은 기사 조회를 단순하게 유지)
create unique index if not exists issue_articles_article_id_key
  on public.issue_articles (article_id);

-- 아직 AI 분류를 거치지 않은 기사. (이슈에 묶이지 않기로 판단된 기사도
-- clustered_at 이 채워지므로 같은 기사를 반복해서 분석하지 않는다.)
create index if not exists articles_clustered_at_idx
  on public.articles (clustered_at)
  where clustered_at is null;

create or replace view public.unclustered_articles
with (security_invoker = on) as
select a.id, a.title, a.publisher, a.published_at, a.url, a.summary, a.created_at
from public.articles a
where a.clustered_at is null;

-- ---------------------------------------------------------------------
-- 5. 시간대별 타임라인
-- ---------------------------------------------------------------------
create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  start_time timestamptz not null,          -- 시간대 시작 (정시)
  end_time timestamptz not null,            -- 시간대 끝 (다음 정시)
  summary text not null,                    -- AI가 만든 한 줄 요약
  article_count integer not null default 0, -- 요약에 사용한 기사 수
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issue_id, start_time)
);

create index if not exists timeline_events_issue_start_idx
  on public.timeline_events (issue_id, start_time desc);

-- ---------------------------------------------------------------------
-- 6. 이슈 점수 계산
-- ---------------------------------------------------------------------
-- 초기 버전은 단순하고 이해하기 쉬운 방식을 사용한다.
--
--   issue_score = 기사량 점수 + 증가속도 점수 + 최신성 점수
--
--   기사량   : 12 * ln(1 + 최근 24시간 기사 수)
--   증가속도 : 20 * ((최근 1시간 + 1) / (직전 1시간 + 1) - 1), -10 ~ 30 으로 제한
--              예) 오후 7시 기준 18~19시 기사 수와 17~18시 기사 수를 비교한다.
--              기사가 1~2건뿐인데 증가율만 커 보이는 경우를 막기 위해
--              최근 1시간 기사 수가 3건이 될 때까지는 비례해서 줄여 반영한다.
--   최신성   : 30 * exp(-(마지막 기사 이후 경과 시간) / 6)
--              기사가 많아도 최근 업데이트가 없으면 점수가 빠르게 낮아진다.
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

comment on function public.refresh_issue_scores() is
  '이슈별 기사 수 / 증가 속도 / 최신성을 기준으로 issue_score를 다시 계산한다.';

-- 오래된 데이터 정리 (기본 7일). 파이프라인에서 주기적으로 호출한다.
create or replace function public.prune_old_news(retain_days integer default 7)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.articles
  where published_at < now() - make_interval(days => retain_days);

  -- 기사가 모두 사라진 이슈는 함께 정리한다.
  delete from public.issues i
  where not exists (
    select 1 from public.issue_articles ia where ia.issue_id = i.id
  )
  and i.created_at < now() - interval '1 day';
end;
$$;

-- ---------------------------------------------------------------------
-- 7. RLS - 읽기는 공개, 쓰기는 service_role 전용
-- ---------------------------------------------------------------------
alter table public.news_sources    enable row level security;
alter table public.articles        enable row level security;
alter table public.issues          enable row level security;
alter table public.issue_articles  enable row level security;
alter table public.timeline_events enable row level security;

drop policy if exists "news_sources public read" on public.news_sources;
create policy "news_sources public read" on public.news_sources
  for select using (true);

drop policy if exists "articles public read" on public.articles;
create policy "articles public read" on public.articles
  for select using (true);

drop policy if exists "issues public read" on public.issues;
create policy "issues public read" on public.issues
  for select using (true);

drop policy if exists "issue_articles public read" on public.issue_articles;
create policy "issue_articles public read" on public.issue_articles
  for select using (true);

drop policy if exists "timeline_events public read" on public.timeline_events;
create policy "timeline_events public read" on public.timeline_events
  for select using (true);

-- 점수 재계산 / 정리 함수는 서버(service_role)에서만 호출한다.
revoke execute on function public.refresh_issue_scores() from public;
revoke execute on function public.prune_old_news(integer) from public;
grant execute on function public.refresh_issue_scores() to service_role;
grant execute on function public.prune_old_news(integer) to service_role;

grant select on
  public.news_sources,
  public.articles,
  public.issues,
  public.issue_articles,
  public.timeline_events
to anon, authenticated;

grant all on
  public.news_sources,
  public.articles,
  public.issues,
  public.issue_articles,
  public.timeline_events
to service_role;

-- 미분류 기사 뷰는 파이프라인에서만 사용한다.
grant select on public.unclustered_articles to service_role;

-- ---------------------------------------------------------------------
-- 8. 기본 수집 소스
-- ---------------------------------------------------------------------
-- 배포 후 news-collect 함수를 한 번 호출하면 소스별 성공/실패가
-- news_sources.last_status / last_error 에 기록된다.
-- 동작하지 않는 소스는 enabled = false 로 끄거나 주소를 수정하면 된다.
insert into public.news_sources (name, feed_url, source_type, category) values
  ('연합뉴스',   'https://www.yna.co.kr/rss/news.xml',                         'rss', '종합'),
  ('YTN',        'https://www.ytn.co.kr/rss/Y_rss_news.xml',                   'rss', '종합'),
  ('SBS',        'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01', 'rss', '종합'),
  ('JTBC',       'https://fs.jtbc.co.kr/RSS/newsflash.xml',                    'rss', '종합'),
  ('노컷뉴스',   'https://rss.nocutnews.co.kr/nocutnews.xml',                  'rss', '종합'),
  ('한겨레',     'https://www.hani.co.kr/rss/',                                'rss', '종합'),
  ('경향신문',   'https://www.khan.co.kr/rss/rssdata/total_news.xml',          'rss', '종합'),
  ('동아일보',   'https://rss.donga.com/total.xml',                            'rss', '종합'),
  ('매일경제',   'https://www.mk.co.kr/rss/30000001/',                         'rss', '경제'),
  ('한국경제',   'https://www.hankyung.com/feed/all-news',                     'rss', '경제')
on conflict (feed_url) do nothing;
