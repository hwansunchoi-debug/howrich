-- Make merchant category mappings global by removing user_id requirement
-- and updating RLS policies to allow global access

-- First, remove user_id constraint from merchant_category_mappings table
ALTER TABLE merchant_category_mappings ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policy to allow global access to merchant mappings
DROP POLICY IF EXISTS "Users can manage their own merchant mappings" ON merchant_category_mappings;

-- Create new policy for merchant mappings - anyone can read, but only authenticated users can create/update
CREATE POLICY "Anyone can view merchant mappings" 
ON merchant_category_mappings 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can manage merchant mappings" 
ON merchant_category_mappings 
FOR INSERT, UPDATE, DELETE
USING (auth.uid() IS NOT NULL);

-- Create a unique constraint to prevent duplicate mappings for the same merchant
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_name_unique 
ON merchant_category_mappings(merchant_name);