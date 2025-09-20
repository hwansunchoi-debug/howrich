-- Update upload_files record for '국내승인내역.xlsx' with correct processed_records_count
UPDATE upload_files 
SET processed_records_count = (
  SELECT COUNT(*) 
  FROM transactions 
  WHERE file_upload_id = upload_files.id
),
status = CASE 
  WHEN (SELECT COUNT(*) FROM transactions WHERE file_upload_id = upload_files.id) > 0 
  THEN 'success' 
  ELSE status 
END
WHERE original_filename LIKE '%국내승인내역%';