-- Drop the existing constraint that's causing issues
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Add a new constraint that allows both 'expense' and 'other' values
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check 
CHECK (type IN ('expense', 'income', 'other'));