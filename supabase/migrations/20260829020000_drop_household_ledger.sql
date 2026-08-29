-- =====================================================================
-- 가계부(우리 가계부) 기능 제거
-- =====================================================================
-- 이 저장소는 실시간 뉴스 이슈 서비스 전용으로 전환되었다.
-- 아래 테이블과 함수는 더 이상 사용하지 않으므로 삭제한다.
--
-- ⚠️ 주의: 거래내역·자산·예산·가족 정보 등 가계부 데이터가 영구히 삭제된다.
--    필요한 데이터가 있다면 적용 전에 백업할 것.
--    (Supabase 대시보드 > Database > Backups, 또는 Table Editor 에서 CSV 내보내기)
--
-- auth.users 의 계정 자체는 건드리지 않는다. 계정 삭제는
-- Supabase 대시보드 > Authentication 에서 직접 하면 된다.
-- =====================================================================

-- 신규 가입 시 profiles 행을 만들던 트리거부터 제거한다.
drop trigger if exists on_auth_user_created on auth.users;

-- 테이블 (참조 관계는 cascade 로 함께 정리된다)
drop table if exists public.balance_snapshots cascade;
drop table if exists public.merchant_category_mappings cascade;
drop table if exists public.upload_files cascade;
drop table if exists public.transactions cascade;
drop table if exists public.budgets cascade;
drop table if exists public.account_balances cascade;
drop table if exists public.categories cascade;
drop table if exists public.user_settings cascade;
drop table if exists public.family_members cascade;
drop table if exists public.profiles cascade;

-- 함수 (뉴스 서비스는 이 함수들을 사용하지 않는다)
drop function if exists public.handle_new_user() cascade;
drop function if exists public.get_user_role(uuid) cascade;
drop function if exists public.is_master_user(uuid) cascade;
drop function if exists public.update_updated_at_column() cascade;

-- 확인용 (적용 후 수동 점검)
-- select table_name from information_schema.tables where table_schema = 'public' order by 1;
-- select routine_name from information_schema.routines where routine_schema = 'public' order by 1;
