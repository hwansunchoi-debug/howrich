-- 먼저 거래 내역의 카테고리 참조 해제
UPDATE transactions SET category_id = NULL;

-- 지출 거래 내역 삭제
DELETE FROM transactions WHERE type = 'expense';

-- 기존 카테고리 삭제
DELETE FROM categories;

-- 새로운 카테고리 생성
INSERT INTO categories (name, type, color, icon, user_id) VALUES
-- 지출 카테고리
('교육', 'expense', '#8b5cf6', 'graduation-cap', NULL),
('식비', 'expense', '#f59e0b', 'utensils', NULL),
('경조사', 'expense', '#ec4899', 'gift', NULL),
('취미&여가', 'expense', '#10b981', 'gamepad-2', NULL),
('교통&자동차', 'expense', '#3b82f6', 'car', NULL),
('쇼핑', 'expense', '#ef4444', 'shopping-bag', NULL),
('여행&숙박', 'expense', '#06b6d4', 'plane', NULL),
('보험&세금&기타금융', 'expense', '#6366f1', 'shield', NULL),
('편의점&마트&잡화', 'expense', '#84cc16', 'shopping-cart', NULL),
('유흥&술', 'expense', '#f97316', 'wine', NULL),
('의료&건강&피트니스', 'expense', '#14b8a6', 'heart', NULL),
('미용', 'expense', '#a855f7', 'sparkles', NULL),
('생활', 'expense', '#64748b', 'home', NULL),
('주거&통신', 'expense', '#0ea5e9', 'wifi', NULL),
('카페&간식', 'expense', '#d97706', 'coffee', NULL),

-- 수입 카테고리
('급여', 'income', '#22c55e', 'banknote', NULL),
('보너스', 'income', '#16a34a', 'trending-up', NULL),
('부업', 'income', '#059669', 'briefcase', NULL),
('투자수익', 'income', '#0d9488', 'line-chart', NULL),
('기타수입', 'income', '#0891b2', 'plus-circle', NULL);