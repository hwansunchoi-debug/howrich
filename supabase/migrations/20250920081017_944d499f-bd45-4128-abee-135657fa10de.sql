-- hwansunchoi@gmail.com 계정에 마스터 권한 부여
UPDATE public.profiles 
SET role = 'master' 
WHERE email = 'hwansunchoi@gmail.com';

-- 다른 계정들은 member로 설정 (기본값)
UPDATE public.profiles 
SET role = 'member' 
WHERE email != 'hwansunchoi@gmail.com' AND role IS NULL;