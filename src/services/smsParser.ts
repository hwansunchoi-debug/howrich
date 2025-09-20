interface SMSData {
  message: string;
  sender: string;
  timestamp: number;
}

interface ParsedTransaction {
  amount: number;
  merchant: string;
  type: 'income' | 'expense';
  bank: string;
  timestamp: number;
  category?: string;
}

export class SMSParser {
  private bankPatterns = {
    // 카드사 패턴들
    우리카드: {
      pattern: /\[우리카드\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?([^\d\s]+)\s+([\d,]+)원\s+결제/,
      type: 'expense' as const
    },
    신한카드: {
      pattern: /\[신한카드\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?([^\d\s]+)\s+([\d,]+)원.*?승인/,
      type: 'expense' as const
    },
    삼성카드: {
      pattern: /\[삼성카드\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?([^\d\s]+)\s+([\d,]+)원/,
      type: 'expense' as const
    },
    현대카드: {
      pattern: /\[현대카드\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?([^\d\s]+)\s+([\d,]+)원/,
      type: 'expense' as const
    },
    KB국민카드: {
      pattern: /\[KB국민카드\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?([^\d\s]+)\s+([\d,]+)원/,
      type: 'expense' as const
    },
    
    // 은행 패턴들
    우리은행: {
      pattern: /\[우리은행\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?(?:입금|출금)\s+([\d,]+)원.*?(?:받는분|보내는분):\s*([^\n\r]+)/,
      type: 'expense' as const // 출금인지 입금인지 별도 판단 필요
    },
    신한은행: {
      pattern: /\[신한은행\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?(?:입금|출금)\s+([\d,]+)원/,
      type: 'expense' as const
    },
    KB국민은행: {
      pattern: /\[KB국민은행\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?(?:입금|출금)\s+([\d,]+)원/,
      type: 'expense' as const
    },
    카카오뱅크: {
      pattern: /\[카카오뱅크\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?(?:입금|출금)\s+([\d,]+)원.*?([^\n\r]+)/,
      type: 'expense' as const
    },
    토스뱅크: {
      pattern: /\[토스뱅크\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?(?:입금|출금)\s+([\d,]+)원.*?([^\n\r]+)/,
      type: 'expense' as const
    },

    // 간편결제 서비스들
    네이버페이: {
      pattern: /\[네이버페이\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    카카오페이: {
      pattern: /\[카카오페이\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    토스페이: {
      pattern: /\[토스\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    페이코: {
      pattern: /\[PAYCO\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    삼성페이: {
      pattern: /\[삼성페이\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    LG페이: {
      pattern: /\[LG페이\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    
    // 기타 결제 서비스
    아이뱅크: {
      pattern: /\[아이뱅크\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?([^\d\s]+).*?([\d,]+)원/,
      type: 'expense' as const
    },
    뱅크월렛카카오: {
      pattern: /\[뱅크월렛카카오\].*?(\d{2}\/\d{2})\s+(\d{2}:\d{2}).*?([^\d\s]+).*?([\d,]+)원/,
      type: 'expense' as const
    }
  };

  private categoryMap = {
    // 식음료
    '스타벅스': '식비',
    '맥도날드': '식비',
    '버거킹': '식비',
    '롯데리아': '식비',
    'KFC': '식비',
    '이마트': '식비',
    '홈플러스': '식비',
    '코스트코': '식비',
    '편의점': '식비',
    'GS25': '식비',
    'CU': '식비',
    '세븐일레븐': '식비',
    
    // 교통
    '지하철': '교통비',
    '버스': '교통비',
    '택시': '교통비',
    'KTX': '교통비',
    '주유소': '교통비',
    'GS칼텍스': '교통비',
    'SK에너지': '교통비',
    '현대오일뱅크': '교통비',
    
    // 배달앱
    '배달의민족': '식비',
    '요기요': '식비',
    '쿠팡이츠': '식비',
    '우버이츠': '식비',
    
    // 온라인쇼핑
    '쿠팡': '쇼핑',
    '11번가': '쇼핑',
    '옥션': '쇼핑',
    'G마켓': '쇼핑',
    '네이버': '쇼핑',
    '아마존': '쇼핑',
    '무신사': '쇼핑',
    '29CM': '쇼핑',
    '브랜디': '쇼핑',
    '스타일난다': '쇼핑',
    
    // 문화생활
    'CGV': '문화생활',
    '롯데시네마': '문화생활',
    '메가박스': '문화생활',
    '왓챠': '문화생활',
    '넷플릭스': '문화생활',
    '유튜브': '문화생활',
    '스포티파이': '문화생활',
    
    // 의료
    '병원': '의료비',
    '약국': '의료비',
    '한의원': '의료비',
    '치과': '의료비',
    
    // 공과금
    '전기료': '공과금',
    '가스료': '공과금',
    '수도료': '공과금',
    '인터넷': '공과금',
    'SK텔레콤': '공과금',
    'KT': '공과금',
    'LG유플러스': '공과금'
  };

  parseSMS(smsData: SMSData): ParsedTransaction | null {
    const { message, sender } = smsData;
    
    // 금융 관련 SMS가 아니면 무시
    if (!this.isFinancialSMS(sender, message)) {
      return null;
    }

    // 각 은행/카드사 패턴으로 파싱 시도
    for (const [bank, config] of Object.entries(this.bankPatterns)) {
      const match = message.match(config.pattern);
      if (match) {
        return this.extractTransactionData(match, bank, message, config.type, smsData.timestamp);
      }
    }

    return null;
  }

  private isFinancialSMS(sender: string, message: string): boolean {
    const financialKeywords = [
      // 카드사
      '우리카드', '신한카드', '삼성카드', '현대카드', 'KB국민카드', 'NH농협카드', '하나카드', '롯데카드', 'BC카드',
      
      // 은행
      '우리은행', '신한은행', 'KB국민은행', '카카오뱅크', '토스뱅크', 'NH농협은행', '하나은행', 'KEB하나은행',
      '기업은행', '수협은행', '새마을금고', '신협', '우체국', '경남은행', '대구은행', '부산은행', '광주은행', '전북은행', '제주은행',
      
      // 간편결제 서비스
      '네이버페이', '카카오페이', '토스', 'PAYCO', '페이코', '삼성페이', 'LG페이', '뱅크월렛카카오', '아이뱅크',
      
      // 일반 키워드
      '결제', '승인', '입금', '출금', '이체', '잔액', '송금', '충전'
    ];

    return financialKeywords.some(keyword => 
      sender.includes(keyword) || message.includes(keyword)
    );
  }

  private extractTransactionData(
    match: RegExpMatchArray, 
    bank: string, 
    message: string, 
    defaultType: 'income' | 'expense',
    timestamp: number
  ): ParsedTransaction {
    const date = match[1]; // MM/DD
    const time = match[2]; // HH:MM
    const merchant = match[3] || '알 수 없음';
    const amountStr = match[4];
    
    // 금액에서 콤마 제거 후 숫자로 변환
    const amount = parseInt(amountStr.replace(/,/g, ''));
    
    // 입금/출금 구분
    let type: 'income' | 'expense' = defaultType;
    if (message.includes('입금') || message.includes('받은돈')) {
      type = 'income';
    } else if (message.includes('출금') || message.includes('결제') || message.includes('승인')) {
      type = 'expense';
    }
    
    // 카테고리 자동 분류
    const category = this.categorizeTransaction(merchant);
    
    return {
      amount,
      merchant: merchant.trim(),
      type,
      bank,
      timestamp,
      category
    };
  }

  private categorizeTransaction(merchant: string): string {
    const normalizedMerchant = merchant.toLowerCase().replace(/\s/g, '');
    
    for (const [keyword, category] of Object.entries(this.categoryMap)) {
      if (normalizedMerchant.includes(keyword.toLowerCase()) || 
          merchant.includes(keyword)) {
        return category;
      }
    }
    
    return '기타';
  }

  // 날짜 파싱 (MM/DD -> 현재 연도의 실제 날짜)
  private parseDate(dateStr: string): string {
    const [month, day] = dateStr.split('/');
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
}

export const smsParser = new SMSParser();