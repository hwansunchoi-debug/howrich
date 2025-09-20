-- Fix user_settings table - remove duplicate entries and fix user_id constraint
-- First, clean up null user_id entries
DELETE FROM user_settings WHERE user_id IS NULL;

-- Add unique constraint to prevent duplicates per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_user_id 
ON user_settings(user_id);