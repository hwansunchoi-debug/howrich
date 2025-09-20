-- 카테고리 테이블 생성
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  color TEXT DEFAULT '#3b82f6',
  icon TEXT DEFAULT 'circle',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 거래내역 테이블 생성
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category_id UUID REFERENCES public.categories(id),
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 예산 테이블 생성
CREATE TABLE public.budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id),
  amount DECIMAL(12,2) NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('monthly', 'yearly')),
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  month INTEGER CHECK (month >= 1 AND month <= 12),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(category_id, period, year, month)
);

-- RLS 활성화 (개인 사용이므로 모든 데이터 접근 허용)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 접근 가능한 정책 생성
CREATE POLICY "Allow all access to categories" ON public.categories FOR ALL USING (true);
CREATE POLICY "Allow all access to transactions" ON public.transactions FOR ALL USING (true);
CREATE POLICY "Allow all access to budgets" ON public.budgets FOR ALL USING (true);

-- 타임스탬프 자동 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 타임스탬프 자동 업데이트 트리거
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 기본 카테고리 데이터 삽입
INSERT INTO public.categories (name, type, color, icon) VALUES
('급여', 'income', '#22c55e', 'wallet'),
('용돈', 'income', '#10b981', 'hand-coins'),
('부업', 'income', '#059669', 'briefcase'),
('식비', 'expense', '#ef4444', 'utensils'),
('교통비', 'expense', '#f97316', 'car'),
('쇼핑', 'expense', '#ec4899', 'shopping-bag'),
('의료비', 'expense', '#8b5cf6', 'heart-pulse'),
('공과금', 'expense', '#06b6d4', 'zap'),
('문화생활', 'expense', '#84cc16', 'ticket'),
('기타', 'expense', '#6b7280', 'more-horizontal');