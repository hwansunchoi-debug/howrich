-- 이슈를 한눈에 구분할 수 있도록 이모지를 붙인다.
-- AI 가 이슈를 만들 때 함께 고르고, 없으면 화면에서 기본값을 쓴다.
alter table public.issues add column if not exists emoji text;

comment on column public.issues.emoji is 'AI 가 고른 이슈 대표 이모지 (없으면 화면에서 추론)';
