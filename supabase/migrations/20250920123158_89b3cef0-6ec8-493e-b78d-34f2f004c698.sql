-- Update existing 계좌간이체 categories from 지출 to 기타
UPDATE public.categories 
SET type = 'other' 
WHERE type = 'expense' AND name = '계좌간이체';

-- Add new 카드대금결제 category under 기타
INSERT INTO public.categories (name, type, color, icon, user_id)
VALUES ('카드대금결제', 'other', '#9333ea', 'credit-card', NULL)
ON CONFLICT DO NOTHING;