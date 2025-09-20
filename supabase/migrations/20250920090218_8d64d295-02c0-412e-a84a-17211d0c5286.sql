-- 기존 카테고리 삭제 (사용자별로 다를 수 있으므로 조건부)
DELETE FROM categories WHERE name IN ('식료품', '배달음식', '주류', '카페/디저트', '편의점', '쇼핑', '의료비', '교통비', '문화/여가');

-- 새로운 사용자 정의 카테고리 추가 (모든 사용자에게 기본 제공)
INSERT INTO categories (name, type, color, icon, user_id) 
SELECT category_name, category_type, category_color, category_icon, profiles.user_id
FROM (
  VALUES 
    ('교육', 'expense', '#10B981', 'book'),
    ('식비', 'expense', '#F59E0B', 'utensils'), 
    ('경조사', 'expense', '#8B5CF6', 'gift'),
    ('취미&여가', 'expense', '#EF4444', 'gamepad2'),
    ('교통&자동차', 'expense', '#3B82F6', 'car'),
    ('쇼핑', 'expense', '#EC4899', 'shopping-bag'),
    ('여행&숙박', 'expense', '#06B6D4', 'plane'),
    ('보험&세금&기타금융', 'expense', '#6B7280', 'shield'),
    ('편의점&마트&잡화', 'expense', '#84CC16', 'shopping-cart'),
    ('유흥&술', 'expense', '#F97316', 'wine'),
    ('의료&건강&피트니스', 'expense', '#EF4444', 'heart'),
    ('미용', 'expense', '#EC4899', 'sparkles'),
    ('생활', 'expense', '#6B7280', 'home'),
    ('주거&통신', 'expense', '#0EA5E9', 'wifi'),
    ('카페&간식', 'expense', '#F59E0B', 'coffee')
) AS category_data(category_name, category_type, category_color, category_icon)
CROSS JOIN profiles
WHERE NOT EXISTS (
  SELECT 1 FROM categories 
  WHERE categories.name = category_data.category_name 
  AND categories.user_id = profiles.user_id
);