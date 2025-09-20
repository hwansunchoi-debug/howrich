export interface BankTemplate {
  id: string;
  name: string;
  category: 'bank' | 'card' | 'securities' | 'other';
  columns: {
    date: number;
    description?: number;
    withdrawal?: number;
    deposit?: number;
    amount?: number;
    balance?: number;
    merchant?: number;
  };
  dateFormat: string;
  encoding?: string;
  skipRows?: number;
  hasHeader: boolean;
  sampleColumns: string[];
}

export const bankTemplates: BankTemplate[] = [
  // 은행들
  {
    id: 'kb_bank',
    name: 'KB국민은행',
    category: 'bank',
    columns: {
      date: 0,      // 거래일자
      description: 2, // 내용
      withdrawal: 3,  // 출금금액
      deposit: 4,     // 입금금액
      balance: 5      // 잔액
    },
    dateFormat: 'YYYY-MM-DD',
    hasHeader: true,
    sampleColumns: ['거래일자', '거래시간', '내용', '출금금액', '입금금액', '잔액', '취급점']
  },
  {
    id: 'shinhan_bank',
    name: '신한은행',
    category: 'bank',
    columns: {
      date: 0,        // 거래일
      description: 1, // 적요
      withdrawal: 2,  // 출금
      deposit: 3,     // 입금
      balance: 4      // 잔액
    },
    dateFormat: 'YYYY.MM.DD',
    hasHeader: true,
    sampleColumns: ['거래일', '적요', '출금', '입금', '잔액', '거래처']
  },
  {
    id: 'woori_bank',
    name: '우리은행',
    category: 'bank',
    columns: {
      date: 0,
      description: 2,
      withdrawal: 3,
      deposit: 4,
      balance: 5
    },
    dateFormat: 'YYYY-MM-DD',
    hasHeader: true,
    sampleColumns: ['거래일자', '거래시간', '거래내용', '출금금액', '입금금액', '잔액']
  },
  {
    id: 'hana_bank',
    name: '하나은행',
    category: 'bank',
    columns: {
      date: 0,
      description: 1,
      withdrawal: 2,
      deposit: 3,
      balance: 4
    },
    dateFormat: 'YYYY-MM-DD',
    hasHeader: true,
    sampleColumns: ['거래일자', '적요', '출금금액', '입금금액', '잔액']
  },
  {
    id: 'nh_bank',
    name: 'NH농협은행',
    category: 'bank',
    columns: {
      date: 0,
      description: 1,
      withdrawal: 2,
      deposit: 3,
      balance: 4
    },
    dateFormat: 'YYYY-MM-DD',
    hasHeader: true,
    sampleColumns: ['거래일자', '거래내용', '출금금액', '입금금액', '잔액']
  },

  // 카드사들
  {
    id: 'woori_card',
    name: '우리카드',
    category: 'card',
    columns: {
      date: 0,        // 이용일자
      merchant: 2,    // 이용처
      amount: 3       // 이용금액
    },
    dateFormat: 'YYYY-MM-DD',
    hasHeader: true,
    sampleColumns: ['이용일자', '이용시간', '이용처', '이용금액', '할부개월']
  },
  {
    id: 'samsung_card',
    name: '삼성카드',
    category: 'card',
    columns: {
      date: 0,        // 승인일자
      merchant: 2,    // 가맹점명
      amount: 3       // 승인금액
    },
    dateFormat: 'YYYY-MM-DD',
    hasHeader: true,
    sampleColumns: ['승인일자', '승인시간', '가맹점명', '승인금액', '할부']
  },
  {
    id: 'hyundai_card',
    name: '현대카드',
    category: 'card',
    columns: {
      date: 0,
      merchant: 1,
      amount: 2
    },
    dateFormat: 'YYYY.MM.DD',
    hasHeader: true,
    sampleColumns: ['이용일자', '가맹점명', '이용금액', '할부개월', '구분']
  },
  {
    id: 'shinhan_card',
    name: '신한카드',
    category: 'card',
    columns: {
      date: 0,
      merchant: 1,
      amount: 2
    },
    dateFormat: 'YYYY-MM-DD',
    hasHeader: true,
    sampleColumns: ['승인일자', '가맹점', '승인금액', '할부']
  },
  {
    id: 'kb_card',
    name: 'KB국민카드',
    category: 'card',
    columns: {
      date: 0,
      merchant: 1,
      amount: 2
    },
    dateFormat: 'YYYY-MM-DD',
    hasHeader: true,
    sampleColumns: ['이용일자', '가맹점명', '이용금액', '할부개월']
  },

  // 증권사들
  {
    id: 'kiwoom_securities',
    name: '키움증권',
    category: 'securities',
    columns: {
      date: 0,
      description: 1,
      withdrawal: 2,
      deposit: 3,
      balance: 4
    },
    dateFormat: 'YYYY-MM-DD',
    hasHeader: true,
    sampleColumns: ['거래일자', '거래내역', '출금', '입금', '잔고']
  },
  {
    id: 'mirae_asset',
    name: '미래에셋증권',
    category: 'securities',
    columns: {
      date: 0,
      description: 1,
      amount: 2,
      balance: 3
    },
    dateFormat: 'YYYY-MM-DD',
    hasHeader: true,
    sampleColumns: ['거래일', '거래내용', '거래금액', '잔액']
  },

  // 범용 템플릿
  {
    id: 'generic_3col',
    name: '범용 (날짜, 내용, 금액)',
    category: 'other',
    columns: {
      date: 0,
      description: 1,
      amount: 2
    },
    dateFormat: 'auto',
    hasHeader: false,
    sampleColumns: ['날짜', '내용', '금액']
  },
  {
    id: 'generic_4col',
    name: '범용 (날짜, 내용, 출금, 입금)',
    category: 'other',
    columns: {
      date: 0,
      description: 1,
      withdrawal: 2,
      deposit: 3
    },
    dateFormat: 'auto',
    hasHeader: false,
    sampleColumns: ['날짜', '내용', '출금', '입금']
  }
];

export const getBankTemplate = (id: string): BankTemplate | undefined => {
  return bankTemplates.find(template => template.id === id);
};

export const getBankTemplatesByCategory = (category?: string): BankTemplate[] => {
  if (!category) return bankTemplates;
  return bankTemplates.filter(template => template.category === category);
};

export const detectBankTemplate = (headers: string[]): BankTemplate | null => {
  // 헤더를 기반으로 자동으로 은행 템플릿 감지
  const headerStr = headers.join('|').toLowerCase();
  
  for (const template of bankTemplates) {
    const sampleStr = template.sampleColumns.join('|').toLowerCase();
    
    // 헤더 매칭 점수 계산
    let matchScore = 0;
    for (const sampleCol of template.sampleColumns) {
      if (headerStr.includes(sampleCol.toLowerCase())) {
        matchScore++;
      }
    }
    
    // 70% 이상 매칭되면 해당 템플릿으로 간주
    if (matchScore / template.sampleColumns.length >= 0.7) {
      return template;
    }
  }
  
  return null;
};