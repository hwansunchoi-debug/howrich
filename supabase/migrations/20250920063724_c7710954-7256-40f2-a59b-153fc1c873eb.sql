-- Create account_balances table for storing balance information
CREATE TABLE public.account_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('bank', 'card', 'investment', 'pay', 'crypto')),
  balance NUMERIC NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'sms',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_name, account_type)
);

-- Enable Row Level Security
ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;

-- Create policies for account_balances
CREATE POLICY "Allow all access to account_balances" 
ON public.account_balances 
FOR ALL 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_account_balances_updated_at
BEFORE UPDATE ON public.account_balances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();