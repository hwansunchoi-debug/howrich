// 자동 카테고리 분류 서비스
// 내용(가맹점명/거래처)을 기반으로 카테고리를 자동으로 분류합니다.

interface CategoryPattern {
  keywords: string[];
  category: string;
  type: 'income' | 'expense';
  confidence: number;
}

const categoryPatterns: CategoryPattern[] = [
  // 수입 카테고리
  {
    keywords: ['월급', '급여', '연봉', '보너스', '상여', '임금', '수당', '급료', '사무소', '회사', '직장'],
    category: '급여',
    type: 'income',
    confidence: 0.95
  },
  {
    keywords: ['이자', '예금이자', '적금이자', '투자', '배당', '수익', '펀드', '주식'],
    category: '투자수익',
    type: 'income',
    confidence: 0.9
  },
  {
    keywords: ['용돈', '경조비입금', '송금입금', '이체입금', '환급', '보험금', '지원금'],
    category: '기타수입',
    type: 'income',
    confidence: 0.8
  },

  // 교육
  {
    keywords: ['교육', '학원', '과외', '학습', '강의', '도서', '책', '교재', '수업', '등록금', '학비', '교과서', '문제집', '사교육'],
    category: '교육',
    type: 'expense',
    confidence: 0.95
  },

  // 식비
  {
    keywords: ['식비', '음식', '식당', '외식', '레스토랑', '한식', '중식', '일식', '양식', '분식', '치킨', '피자', '햄버거', '족발', '보쌈', '찜닭', '떡볶이'],
    category: '식비',
    type: 'expense',
    confidence: 0.9
  },

  // 경조사
  {
    keywords: ['경조사', '축의', '부의', '조의', '결혼', '장례', '돌잔치', '선물', '꽃', '화환', '축하', '부조'],
    category: '경조사',
    type: 'expense',
    confidence: 0.95
  },

  // 취미&여가
  {
    keywords: ['취미', '여가', '오락', '게임', '영화', 'CGV', '롯데시네마', '메가박스', '노래방', 'PC방', '볼링', '당구', '골프', '야구', '축구', '공연', '콘서트'],
    category: '취미&여가',
    type: 'expense',
    confidence: 0.9
  },

  // 교통&자동차
  {
    keywords: ['교통', '자동차', '차량', '지하철', '버스', '택시', '카카오택시', '우버', '주유', '기름', '휘발유', '경유', 'SK에너지', 'GS칼텍스', 'S-OIL', '현대오일뱅크', '톨게이트', '통행료', '주차', '자동차보험', '정비', '수리'],
    category: '교통&자동차',
    type: 'expense',
    confidence: 0.95
  },

  // 쇼핑
  {
    keywords: ['쇼핑', '백화점', '아울렛', '온라인쇼핑', '쿠팡', '11번가', 'G마켓', '옥션', '네이버쇼핑', '티몬', '위메프', '당근마켓', '의류', '옷', '신발', '가방', '액세서리'],
    category: '쇼핑',
    type: 'expense',
    confidence: 0.9
  },

  // 여행&숙박
  {
    keywords: ['여행', '숙박', '호텔', '모텔', '펜션', '리조트', '항공', '비행기', '기차', 'KTX', '고속버스', '시외버스', '관광', '렌터카', '여행사'],
    category: '여행&숙박',
    type: 'expense',
    confidence: 0.9
  },

  // 보험&세금&기타금융
  {
    keywords: ['보험', '세금', '금융', '적금', '저축', '펀드', '투자', '대출', '이자', '수수료', '연금', '국민연금', '건강보험', '자동차보험', '화재보험', '현대해'],
    category: '보험&세금&기타금융',
    type: 'expense',
    confidence: 0.9
  },

  // 편의점&마트&잡화
  {
    keywords: ['편의점', '마트', '잡화', 'GS25', 'CU', '세븐일레븐', '미니스톱', '이마트24', '이마트', '롯데마트', '홈플러스', '코스트코', '하나로마트', '농협마트'],
    category: '편의점&마트&잡화',
    type: 'expense',
    confidence: 0.95
  },

  // 유흥&술
  {
    keywords: ['유흥', '술', '소주', '맥주', '와인', '위스키', '칵테일', '주점', '호프', '펜', '바', '클럽', '치킨호프', '주류', '안주'],
    category: '유흥&술',
    type: 'expense',
    confidence: 0.95
  },

  // 의료&건강&피트니스
  {
    keywords: ['의료', '건강', '피트니스', '병원', '의원', '클리닉', '치과', '한의원', '약국', '진료', '검진', '건강검진', '헬스장', '헬스클럽', '요가', '필라테스', '수영장'],
    category: '의료&건강&피트니스',
    type: 'expense',
    confidence: 0.95
  },

  // 미용
  {
    keywords: ['미용', '화장품', '미용실', '헤어샵', '네일샵', '피부관리', '에스테틱', '마사지', '스파', '뷰티', '메이크업'],
    category: '미용',
    type: 'expense',
    confidence: 0.95
  },

  // 생활
  {
    keywords: ['생활', '생필품', '세제', '화장지', '세탁', '청소', '빨래방', '세탁소', '생활용품', '일용품'],
    category: '생활',
    type: 'expense',
    confidence: 0.85
  },

  // 주거&통신
  {
    keywords: ['주거', '통신', '월세', '전세', '관리비', '전기', '가스', '수도', '인터넷', '와이파이', '핸드폰', '휴대폰', 'SKT', 'KT', 'LG유플러스', '한국전력', '도시가스'],
    category: '주거&통신',
    type: 'expense',
    confidence: 0.95
  },

  // 카페&간식
  {
    keywords: ['카페', '간식', '커피', '스타벅스', '이디야', '빽다방', '투썸', '엔젤리너스', '탐앤탐스', '공차', '컴포즈커피', '메가커피', '빈스빈스', '디저트', '케이크', '아이스크림', '과자'],
    category: '카페&간식',
    type: 'expense',
    confidence: 0.95
  }
];

export class CategoryClassifier {
  /**
   * 거래 내용을 기반으로 카테고리를 자동 분류
   */
  static classifyCategory(description: string, type: 'income' | 'expense'): string | null {
    const cleanDescription = description.toLowerCase();
    
    let bestMatch: { category: string; confidence: number } | null = null;
    
    for (const pattern of categoryPatterns) {
      // 타입이 일치하는 패턴만 검사
      if (pattern.type !== type) continue;
      
      // 카테고리 이름 자체가 포함되어 있는지 먼저 확인 (가장 높은 우선순위)
      if (cleanDescription.includes(pattern.category.toLowerCase())) {
        return pattern.category;
      }
      
      // 카테고리 이름의 일부가 포함되어 있는지 확인
      const categoryWords = pattern.category.split('&').map(word => word.trim());
      for (const categoryWord of categoryWords) {
        if (categoryWord.length >= 2 && cleanDescription.includes(categoryWord.toLowerCase())) {
          if (!bestMatch || pattern.confidence > bestMatch.confidence) {
            bestMatch = {
              category: pattern.category,
              confidence: pattern.confidence + 0.1 // 카테고리명 포함시 가중치 추가
            };
          }
        }
      }
      
      // 키워드 매칭
      for (const keyword of pattern.keywords) {
        if (cleanDescription.includes(keyword.toLowerCase())) {
          if (!bestMatch || pattern.confidence > bestMatch.confidence) {
            bestMatch = {
              category: pattern.category,
              confidence: pattern.confidence
            };
          }
        }
      }
    }
    
    // 신뢰도가 0.7 이상인 경우에만 자동 분류
    return bestMatch && bestMatch.confidence >= 0.7 ? bestMatch.category : null;
  }
  
  /**
   * 새로운 패턴을 학습하여 분류 정확도를 향상
   */
  static learnFromTransaction(description: string, actualCategory: string, type: 'income' | 'expense') {
    // 향후 머신러닝 기반 학습 기능을 위한 플레이스홀더
    // 현재는 단순히 로그만 남김
    console.log(`Learning: ${description} -> ${actualCategory} (${type})`);
  }
  
  /**
   * 사용 가능한 모든 카테고리 목록 반환
   */
  static getAvailableCategories(type?: 'income' | 'expense'): string[] {
    const categories = categoryPatterns
      .filter(pattern => !type || pattern.type === type)
      .map(pattern => pattern.category);
    
    return [...new Set(categories)].sort();
  }
}