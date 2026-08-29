-- =====================================================================
-- AI 사용량 기록
-- =====================================================================
-- 실행할 때마다 토큰을 얼마나 썼고 요금이 대략 얼마인지 남긴다.
-- 화면에서 이번 실행과 이번 달 누적을 바로 확인할 수 있게 한다.
-- =====================================================================

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  step text not null check (step in ('cluster', 'timeline')),
  calls integer not null default 1,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_created_at_idx
  on public.ai_usage (created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage public read" on public.ai_usage;
create policy "ai_usage public read" on public.ai_usage
  for select using (true);

grant select on public.ai_usage to anon, authenticated;
grant all on public.ai_usage to service_role;

-- 화면에서 쓰는 요약: 최근 실행 / 오늘 / 이번 달
create or replace view public.ai_usage_summary
with (security_invoker = on) as
select
  coalesce(sum(input_tokens) filter (where created_at >= date_trunc('month', now())), 0) as month_input_tokens,
  coalesce(sum(output_tokens) filter (where created_at >= date_trunc('month', now())), 0) as month_output_tokens,
  coalesce(sum(cost_usd) filter (where created_at >= date_trunc('month', now())), 0) as month_cost_usd,
  coalesce(sum(input_tokens) filter (where created_at >= now() - interval '24 hours'), 0) as day_input_tokens,
  coalesce(sum(output_tokens) filter (where created_at >= now() - interval '24 hours'), 0) as day_output_tokens,
  coalesce(sum(cost_usd) filter (where created_at >= now() - interval '24 hours'), 0) as day_cost_usd,
  max(created_at) as last_run_at
from public.ai_usage;

grant select on public.ai_usage_summary to anon, authenticated, service_role;
