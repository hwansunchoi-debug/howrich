-- Add role system to profiles table
ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'member' CHECK (role IN ('master', 'member'));

-- Add family_id to group family members
ALTER TABLE public.profiles ADD COLUMN family_id UUID;

-- Update existing user to master role (first user becomes master)
UPDATE public.profiles 
SET role = 'master' 
WHERE id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1);

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = $1;
$$;

-- Create function to check if user is master
CREATE OR REPLACE FUNCTION public.is_master_user(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'master' FROM public.profiles WHERE user_id = $1), false);
$$;

-- Update family_members policies to respect master permissions
DROP POLICY IF EXISTS "Users can manage their family members" ON public.family_members;

CREATE POLICY "Masters can manage all family members" 
ON public.family_members 
FOR ALL 
USING (public.is_master_user(auth.uid()) OR auth.uid() = owner_id OR auth.uid() = member_id);

-- Update transactions policy to allow masters to view all family data
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;

CREATE POLICY "Users can manage their own transactions" 
ON public.transactions 
FOR ALL 
USING (
  auth.uid() = user_id OR 
  (public.is_master_user(auth.uid()) AND user_id IN (
    SELECT member_id FROM public.family_members WHERE owner_id = auth.uid()
    UNION
    SELECT auth.uid()
  ))
);

-- Update categories policy for masters
DROP POLICY IF EXISTS "Users can manage their own categories" ON public.categories;

CREATE POLICY "Users can manage their own categories" 
ON public.categories 
FOR ALL 
USING (
  auth.uid() = user_id OR 
  (public.is_master_user(auth.uid()) AND user_id IN (
    SELECT member_id FROM public.family_members WHERE owner_id = auth.uid()
    UNION
    SELECT auth.uid()
  ))
);

-- Update budgets policy for masters
DROP POLICY IF EXISTS "Users can manage their own budgets" ON public.budgets;

CREATE POLICY "Users can manage their own budgets" 
ON public.budgets 
FOR ALL 
USING (
  auth.uid() = user_id OR 
  (public.is_master_user(auth.uid()) AND user_id IN (
    SELECT member_id FROM public.family_members WHERE owner_id = auth.uid()
    UNION
    SELECT auth.uid()
  ))
);

-- Update account_balances policy for masters
DROP POLICY IF EXISTS "Users can manage their own account_balances" ON public.account_balances;

CREATE POLICY "Users can manage their own account_balances" 
ON public.account_balances 
FOR ALL 
USING (
  auth.uid() = user_id OR 
  (public.is_master_user(auth.uid()) AND user_id IN (
    SELECT member_id FROM public.family_members WHERE owner_id = auth.uid()
    UNION
    SELECT auth.uid()
  ))
);