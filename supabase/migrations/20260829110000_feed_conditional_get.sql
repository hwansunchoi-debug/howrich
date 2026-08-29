-- =====================================================================
-- 같은 내용을 반복해서 내려받지 않도록 피드 캐시 정보를 저장한다.
-- =====================================================================
-- RSS 는 요청할 때마다 최근 기사 전체를 돌려준다. 15분마다 15곳을
-- 받아오면 대부분이 이미 저장한 기사다. 서버가 준 ETag / Last-Modified 를
-- 기억했다가 다음 요청에 함께 보내면, 바뀐 게 없을 때 304 만 돌아온다.
-- =====================================================================

alter table public.news_sources add column if not exists last_etag text;
alter table public.news_sources add column if not exists last_modified text;

comment on column public.news_sources.last_etag is
  '서버가 준 ETag. 다음 요청에 If-None-Match 로 보낸다.';
comment on column public.news_sources.last_modified is
  '서버가 준 Last-Modified. 다음 요청에 If-Modified-Since 로 보낸다.';
