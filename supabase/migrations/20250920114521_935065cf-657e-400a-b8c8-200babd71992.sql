-- Extract institution from various patterns in transaction descriptions
UPDATE transactions 
SET institution = 
  CASE 
    -- 직접적인 카드/은행명 패턴
    WHEN description LIKE '%삼성카드%' THEN '삼성카드'
    WHEN description LIKE '%농협카드%' THEN '농협카드'
    WHEN description LIKE '%신한카드%' THEN '신한카드'
    WHEN description LIKE '%현대카드%' THEN '현대카드'
    WHEN description LIKE '%하나카드%' THEN '하나카드'
    WHEN description LIKE '%롯데카드%' THEN '롯데카드'
    WHEN description LIKE '%KB카드%' THEN 'KB카드'
    WHEN description LIKE '%우리카드%' THEN '우리카드'
    WHEN description LIKE '%BC카드%' THEN 'BC카드'
    
    -- 간접적인 패턴 (토스, 카카오페이 등 간편결제)
    WHEN description LIKE '%토스%' THEN '토스'
    WHEN description LIKE '%카카오페이%' THEN '카카오페이'
    WHEN description LIKE '%네이버페이%' THEN '네이버페이'
    WHEN description LIKE '%삼성페이%' THEN '삼성페이'
    WHEN description LIKE '%페이코%' THEN '페이코'
    
    -- 은행 패턴
    WHEN description LIKE '%농협은행%' OR description LIKE '%NH농협%' THEN 'NH농협은행'
    WHEN description LIKE '%신한은행%' THEN '신한은행'
    WHEN description LIKE '%우리은행%' THEN '우리은행'
    WHEN description LIKE '%하나은행%' THEN '하나은행'
    WHEN description LIKE '%국민은행%' OR description LIKE '%KB국민%' THEN 'KB국민은행'
    WHEN description LIKE '%기업은행%' OR description LIKE '%IBK%' THEN 'IBK기업은행'
    WHEN description LIKE '%카카오뱅크%' THEN '카카오뱅크'
    WHEN description LIKE '%토스뱅크%' THEN '토스뱅크'
    WHEN description LIKE '%케이뱅크%' THEN '케이뱅크'
    
    -- CSV 업로드된 거래들은 파일명 기준으로 추정
    WHEN source = 'csv_upload' AND description IS NOT NULL THEN 
      CASE 
        WHEN LOWER(description) LIKE '%삼성%' THEN '삼성카드'
        WHEN LOWER(description) LIKE '%농협%' THEN '농협카드'
        WHEN LOWER(description) LIKE '%신한%' THEN '신한카드'
        WHEN LOWER(description) LIKE '%현대%' THEN '현대카드'
        ELSE '기타카드'
      END
    ELSE NULL
  END
WHERE institution IS NULL AND description IS NOT NULL;