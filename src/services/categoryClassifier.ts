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
    keywords: ['월급', '급여', '연봉', '보너스', '상여', '임금', '수당', '급료'],
    category: '급여',
    type: 'income',
    confidence: 0.95
  },
  {
    keywords: ['이자', '예금이자', '적금이자', '투자', '배당', '수익'],
    category: '투자수익',
    type: 'income',
    confidence: 0.9
  },
  {
    keywords: ['용돈', '경조비입금', '송금입금', '이체입금'],
    category: '기타수입',
    type: 'income',
    confidence: 0.8
  },

  // 식비 카테고리
  {
    keywords: ['맥도날드', '버거킹', 'KFC', '롯데리아', '스타벅스', '카페', '커피', '이디야', '빽다방', '투썸', '엔젤리너스'],
    category: '외식',
    type: 'expense',
    confidence: 0.95
  },
  {
    keywords: ['마트', '이마트', '롯데마트', '홈플러스', '코스트코', '편의점', 'GS25', 'CU', '세븐일레븐', '미니스톱'],
    category: '식료품',
    type: 'expense',
    confidence: 0.9
  },
  {
    keywords: ['치킨', '피자', '족발', '보쌈', '김밥', '도시락', '배달', '요기요', '배달의민족', '쿠팡이츠'],
    category: '배달음식',
    type: 'expense',
    confidence: 0.95
  },

  // 교통비
  {
    keywords: ['지하철', '버스', '택시', '카카오택시', '우버', '지하철공사', '시내버스', '시외버스', '고속버스'],
    category: '대중교통',
    type: 'expense',
    confidence: 0.95
  },
  {
    keywords: ['주유소', 'SK에너지', 'GS칼텍스', 'S-OIL', '현대오일뱅크', '주유', '기름'],
    category: '주유비',
    type: 'expense',
    confidence: 0.95
  },
  {
    keywords: ['톨게이트', '고속도로', '유료도로', '통행료'],
    category: '통행료',
    type: 'expense',
    confidence: 0.9
  },

  // 쇼핑
  {
    keywords: ['쿠팡', '네이버쇼핑', '11번가', 'G마켓', '옥션', '티몬', '위메프', '온라인쇼핑'],
    category: '온라인쇼핑',
    type: 'expense',
    confidence: 0.9
  },
  {
    keywords: ['백화점', '신세계', '롯데백화점', '현대백화점', '아울렛'],
    category: '백화점',
    type: 'expense',
    confidence: 0.9
  },
  {
    keywords: ['의류', '옷', '신발', '가방', '액세서리', '유니클로', 'H&M', 'ZARA'],
    category: '의류',
    type: 'expense',
    confidence: 0.85
  },

  // 의료비
  {
    keywords: ['병원', '의원', '클리닉', '치과', '한의원', '약국', '진료비', '처방전'],
    category: '의료비',
    type: 'expense',
    confidence: 0.95
  },

  // 통신비
  {
    keywords: ['SKT', 'KT', 'LG유플러스', '핸드폰', '휴대폰', '인터넷', '와이파이'],
    category: '통신비',
    type: 'expense',
    confidence: 0.95
  },

  // 공과금
  {
    keywords: ['전기요금', '가스요금', '수도요금', '관리비', '아파트관리사무소', '한국전력', '도시가스'],
    category: '공과금',
    type: 'expense',
    confidence: 0.95
  },

  // 금융
  {
    keywords: ['대출', '이자', '수수료', '은행', '카드', '연회비', '카드수수료'],
    category: '금융수수료',
    type: 'expense',
    confidence: 0.9
  },

  // 교육
  {
    keywords: ['학원', '과외', '교육', '학습지', '온라인강의', '도서', '책'],
    category: '교육비',
    type: 'expense',
    confidence: 0.9
  },

  // 문화생활
  {
    keywords: ['영화', 'CGV', '롯데시네마', '메가박스', '노래방', 'PC방', '헬스장', '수영장'],
    category: '문화생활',
    type: 'expense',
    confidence: 0.85
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