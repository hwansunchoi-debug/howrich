-- Set default institution for CSV uploaded transactions
UPDATE transactions 
SET institution = '기타카드'
WHERE source = 'csv_upload' AND institution IS NULL AND type = 'expense';

UPDATE transactions 
SET institution = '기타계좌'
WHERE source = 'csv_upload' AND institution IS NULL AND type = 'income';