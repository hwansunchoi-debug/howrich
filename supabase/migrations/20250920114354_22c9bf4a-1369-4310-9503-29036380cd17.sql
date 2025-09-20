-- Update existing transactions to extract institution information from description
UPDATE transactions 
SET institution = 
  CASE 
    WHEN description LIKE '%삼성카드%' THEN '삼성카드'
    WHEN description LIKE '%농협카드%' THEN '농협카드'
    WHEN description LIKE '%신한카드%' THEN '신한카드'
    WHEN description LIKE '%현대카드%' THEN '현대카드'
    WHEN description LIKE '%하나카드%' THEN '하나카드'
    WHEN description LIKE '%롯데카드%' THEN '롯데카드'
    WHEN description LIKE '%KB카드%' THEN 'KB카드'
    WHEN description LIKE '%우리카드%' THEN '우리카드'
    WHEN description LIKE '%BC카드%' THEN 'BC카드'
    WHEN description LIKE '%NH농협은행%' THEN 'NH농협은행'
    WHEN description LIKE '%신한은행%' THEN '신한은행'
    WHEN description LIKE '%우리은행%' THEN '우리은행'
    WHEN description LIKE '%하나은행%' THEN '하나은행'
    WHEN description LIKE '%KB국민은행%' THEN 'KB국민은행'
    WHEN description LIKE '%IBK기업은행%' THEN 'IBK기업은행'
    WHEN description LIKE '%카카오뱅크%' THEN '카카오뱅크'
    WHEN description LIKE '%토스뱅크%' THEN '토스뱅크'
    WHEN description LIKE '%케이뱅크%' THEN '케이뱅크'
    ELSE NULL
  END
WHERE institution IS NULL AND description IS NOT NULL;