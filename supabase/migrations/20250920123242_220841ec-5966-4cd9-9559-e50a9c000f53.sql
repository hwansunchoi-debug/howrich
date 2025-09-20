-- First, drop the existing check constraint on categories.type
ALTER TABLE public.categories 
DROP CONSTRAINT IF EXISTS categories_type_check;

-- Add a new check constraint that allows 'income', 'expense', and 'other'
ALTER TABLE public.categories 
ADD CONSTRAINT categories_type_check 
CHECK (type IN ('income', 'expense', 'other'));

-- Update existing 계좌간이체 categories from 지출 to 기타
UPDATE public.categories 
SET type = 'other' 
WHERE type = 'expense' AND name = '계좌간이체';

-- Add new 카드대금결제 category under 기타
INSERT INTO public.categories (name, type, color, icon, user_id)
VALUES ('카드대금결제', 'other', '#9333ea', 'credit-card', NULL)
ON CONFLICT DO NOTHING;