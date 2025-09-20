-- Migrate existing CSV upload data to upload_files table
-- Create upload_files entries for existing csv_import transactions

DO $$
DECLARE
    upload_group RECORD;
    new_file_id UUID;
BEGIN
    -- Group existing csv_import transactions by user and creation date
    FOR upload_group IN 
        SELECT 
            user_id, 
            DATE(created_at) as upload_date,
            COUNT(*) as transaction_count,
            MIN(created_at) as first_created
        FROM transactions 
        WHERE source = 'csv_import' AND file_upload_id IS NULL
        GROUP BY user_id, DATE(created_at)
        ORDER BY MIN(created_at)
    LOOP
        -- Create upload_files entry
        INSERT INTO upload_files (
            user_id,
            filename,
            original_filename,
            file_size,
            file_type,
            upload_date,
            processed_records_count,
            status,
            created_at,
            updated_at
        ) VALUES (
            upload_group.user_id,
            'legacy_upload_' || upload_group.upload_date || '.csv',
            'legacy_upload_' || upload_group.upload_date || '.csv',
            upload_group.transaction_count * 100, -- Estimate file size
            'csv',
            upload_group.first_created,
            upload_group.transaction_count,
            'success',
            upload_group.first_created,
            upload_group.first_created
        ) RETURNING id INTO new_file_id;

        -- Update transactions to reference the new upload_files entry
        UPDATE transactions 
        SET 
            file_upload_id = new_file_id,
            source = 'csv_upload'
        WHERE 
            user_id = upload_group.user_id 
            AND DATE(created_at) = upload_group.upload_date 
            AND source = 'csv_import' 
            AND file_upload_id IS NULL;
            
        RAISE NOTICE 'Created upload file for user % on date % with % transactions', 
            upload_group.user_id, upload_group.upload_date, upload_group.transaction_count;
    END LOOP;
END $$;