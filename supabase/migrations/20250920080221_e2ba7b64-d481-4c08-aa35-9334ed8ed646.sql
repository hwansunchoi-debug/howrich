-- Add source field to transactions table for tracking data source
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- Add index for better performance on source queries
CREATE INDEX IF NOT EXISTS idx_transactions_source ON public.transactions(source);

-- Add financial institution field to transactions table
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS institution text;

-- Add index for better performance on institution queries
CREATE INDEX IF NOT EXISTS idx_transactions_institution ON public.transactions(institution);

-- Create balance_snapshots table for tracking historical balance changes
CREATE TABLE IF NOT EXISTS public.balance_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  snapshot_date date NOT NULL,
  total_balance numeric NOT NULL DEFAULT 0,
  account_details jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);

-- Enable RLS on balance_snapshots
ALTER TABLE public.balance_snapshots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for balance_snapshots
CREATE POLICY "Users can manage their own balance snapshots" ON public.balance_snapshots
FOR ALL USING (
  (auth.uid() = user_id) OR 
  (is_master_user(auth.uid()) AND (user_id IN (
    SELECT family_members.member_id
    FROM family_members
    WHERE family_members.owner_id = auth.uid()
    UNION
    SELECT auth.uid()
  )))
);

-- Create trigger for automatic timestamp updates on balance_snapshots
CREATE TRIGGER update_balance_snapshots_updated_at
BEFORE UPDATE ON public.balance_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add unique constraint to prevent duplicate transactions
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_duplicate_check 
ON public.transactions (user_id, date, description, amount, type) 
WHERE source != 'manual';