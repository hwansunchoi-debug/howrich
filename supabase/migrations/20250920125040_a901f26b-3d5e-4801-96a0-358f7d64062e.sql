-- Update the category name from "주거&통신" to "주거&공과금&통신"
UPDATE public.categories 
SET name = '주거&공과금&통신'
WHERE name = '주거&통신';