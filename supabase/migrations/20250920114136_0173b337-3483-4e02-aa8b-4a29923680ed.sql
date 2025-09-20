-- Fix user_settings table by removing duplicates and keeping the latest one for each user
WITH ranked_settings AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) as rn
  FROM user_settings 
  WHERE user_id IS NOT NULL
)
DELETE FROM user_settings 
WHERE id IN (
  SELECT id FROM ranked_settings WHERE rn > 1
);

-- Also clean up remaining null user_id entries
DELETE FROM user_settings WHERE user_id IS NULL;

-- Now create the unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_user_id 
ON user_settings(user_id);