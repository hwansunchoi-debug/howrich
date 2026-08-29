-- =====================================================================
-- 수집 소스 정리
-- =====================================================================
-- GitHub Actions 의 "RSS 주소 점검" 워크플로로 실제 응답을 확인한 결과를
-- 반영한다. 여러 번 실행해도 안전하다.
-- =====================================================================

-- YTN: 알려진 주소 4개가 모두 404 였다. 쓸 수 있는 주소를 찾을 때까지 끈다.
update public.news_sources
set enabled = false,
    last_error = '사용 가능한 RSS 주소를 찾지 못했습니다 (404)'
where name = 'YTN';

-- 확인된 주소를 새 소스로 추가한다. (기사 수는 점검 당시 응답 기준)
insert into public.news_sources (name, feed_url, source_type, category) values
  ('조선일보',   'https://www.chosun.com/arc/outboundfeeds/rss/?outputType=xml', 'rss', '종합'),
  ('아시아경제', 'https://www.asiae.co.kr/rss/all.htm',                          'rss', '종합'),
  ('서울신문',   'https://www.seoul.co.kr/xml/rss/rss_society.xml',              'rss', '사회'),
  ('세계일보',   'https://www.segye.com/Articles/RSSList/segye_recent.xml',      'rss', '종합'),
  ('오마이뉴스', 'http://rss.ohmynews.com/rss/ohmynews.xml',                     'rss', '종합')
on conflict (feed_url) do update
set enabled = true,
    name = excluded.name,
    category = excluded.category;

-- 한겨레는 피드에 발행 시간 태그가 없어 기사가 0건으로 잡히고 있었다.
-- 수집 코드가 수집 시각을 발행 시각으로 대신 쓰도록 고쳤으므로 그대로 둔다.
update public.news_sources
set last_error = null
where name = '한겨레';
