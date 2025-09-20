-- 현재 categories 테이블의 RLS 정책 확인 후 수정
-- 전역 카테고리(user_id가 null)와 사용자별 카테고리 모두 볼 수 있도록 수정

-- 기존 정책 제거
DROP POLICY IF EXISTS "Users can manage their own categories" ON categories;

-- 새로운 정책 생성: 전역 카테고리 + 자신의 카테고리 조회 가능
CREATE POLICY "Users can view global and own categories" 
ON categories 
FOR SELECT 
USING (user_id IS NULL OR auth.uid() = user_id);

-- 사용자는 자신의 카테고리만 생성 가능
CREATE POLICY "Users can create own categories" 
ON categories 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 카테고리만 수정/삭제 가능
CREATE POLICY "Users can update own categories" 
ON categories 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" 
ON categories 
FOR DELETE 
USING (auth.uid() = user_id);

-- 계좌간이체 카테고리 추가 (아직 없다면)
INSERT INTO categories (name, type, color, icon, user_id) 
SELECT '계좌간이체', 'expense', '#6b7280', 'arrow-right-left', null
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = '계좌간이체');