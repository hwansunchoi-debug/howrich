-- 기존 잘못된/중복된 카테고리들 삭제
DELETE FROM categories WHERE name IN ('배달음식', '식료품', '외식', '의료비', '문화생활', '주류', '백화점', '금융수수료');

-- 새로운 카테고리 추가
INSERT INTO categories (name, type, color, icon, user_id) VALUES
  ('취미&여가', 'expense', '#8b5cf6', 'gamepad-2', null),
  ('편의점&마트&잡화', 'expense', '#10b981', 'shopping-cart', null),
  ('카페&간식', 'expense', '#f59e0b', 'coffee', null);

-- 머천트별 카테고리 학습을 위한 테이블 생성
CREATE TABLE IF NOT EXISTS public.merchant_category_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  merchant_name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, merchant_name)
);

-- RLS 정책 적용
ALTER TABLE public.merchant_category_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own merchant mappings" 
ON public.merchant_category_mappings 
FOR ALL 
USING (auth.uid() = user_id);

-- 업데이트 트리거 추가
CREATE TRIGGER update_merchant_category_mappings_updated_at
BEFORE UPDATE ON public.merchant_category_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();