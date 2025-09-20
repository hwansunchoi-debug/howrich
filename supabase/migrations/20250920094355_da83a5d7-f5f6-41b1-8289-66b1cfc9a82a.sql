-- 기존 거래들을 새로운 카테고리 체계로 매핑
-- 배달음식 → 식비
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE name = '식비' LIMIT 1)
WHERE category_id = (SELECT id FROM categories WHERE name = '배달음식');

-- 식료품 → 편의점&마트&잡화  
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE name = '편의점&마트&잡화' LIMIT 1)
WHERE category_id = (SELECT id FROM categories WHERE name = '식료품');

-- 외식 → 식비
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE name = '식비' LIMIT 1)
WHERE category_id = (SELECT id FROM categories WHERE name = '외식');

-- 의료비 → 의료&건강&피트니스
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE name = '의료&건강&피트니스' LIMIT 1)
WHERE category_id = (SELECT id FROM categories WHERE name = '의료비');

-- 문화생활 → 취미&여가
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE name = '취미&여가' LIMIT 1)
WHERE category_id = (SELECT id FROM categories WHERE name = '문화생활');

-- 주류 → 유흥&술
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE name = '유흥&술' LIMIT 1)
WHERE category_id = (SELECT id FROM categories WHERE name = '주류');

-- 백화점 → 쇼핑
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE name = '쇼핑' LIMIT 1)
WHERE category_id = (SELECT id FROM categories WHERE name = '백화점');

-- 금융수수료 → 보험&세금&기타금융
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE name = '보험&세금&기타금융' LIMIT 1)
WHERE category_id = (SELECT id FROM categories WHERE name = '금융수수료');

-- 주유비 → 교통&자동차
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE name = '교통&자동차' LIMIT 1)
WHERE category_id = (SELECT id FROM categories WHERE name = '주유비');

-- 이제 사용하지 않는 카테고리들 삭제
DELETE FROM categories WHERE name IN ('배달음식', '식료품', '외식', '의료비', '문화생활', '주류', '백화점', '금융수수료', '주유비');

-- 계좌 테이블에 계좌번호 필드 추가
ALTER TABLE account_balances ADD COLUMN IF NOT EXISTS account_number TEXT;