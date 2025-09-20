import { supabase } from '@/integrations/supabase/client';
import { BankTemplate } from './bankTemplates';
import { CategoryClassifier } from './categoryClassifier';

interface TransactionRow {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  institution?: string;
}

interface ParseResult {
  transactions: TransactionRow[];
  errors: string[];
}

export class CSVParser {
  /**
   * 템플릿을 사용해서 CSV 파일을 파싱
   */
  static async parseTransactionCSVWithTemplate(csvData: string[][], template: BankTemplate): Promise<ParseResult> {
    try {
      const transactions: TransactionRow[] = [];
      const errors: string[] = [];

      // 헤더 행 건너뛰기
      const startIndex = template.hasHeader ? 1 : 0;
      const skipRows = template.skipRows || 0;
      const dataStartIndex = Math.max(startIndex, skipRows);

      for (let i = dataStartIndex; i < csvData.length; i++) {
        const lineNumber = i + 1;
        const row = csvData[i];
        
        if (!row || row.length === 0) continue;

        try {
          const transaction = this.parseTransactionWithTemplate(row, template, lineNumber);
          if (transaction) {
            transactions.push(transaction);
          }
        } catch (error) {
          errors.push(`라인 ${lineNumber}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
      }

      return { transactions, errors };
    } catch (error) {
      return { 
        transactions: [], 
        errors: [`템플릿 파싱 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`] 
      };
    }
  }

  /**
   * 템플릿을 사용해서 단일 행을 거래내역으로 파싱
   */
  private static parseTransactionWithTemplate(row: string[], template: BankTemplate, lineNumber: number): TransactionRow | null {
    console.log(`라인 ${lineNumber} 파싱 중:`, row);
    
    // 날짜 추출
    const dateValue = template.columns.date !== undefined ? row[template.columns.date] : '';
    console.log(`날짜 원본:`, dateValue);
    
    const normalizedDate = this.normalizeDate(dateValue);
    if (!normalizedDate) {
      throw new Error(`잘못된 날짜 형식: ${dateValue}`);
    }
    console.log(`정규화된 날짜:`, normalizedDate);

    // 설명/내용 추출
    let description = '';
    if (template.columns.description !== undefined) {
      description = row[template.columns.description] || '';
    } else if (template.columns.merchant !== undefined) {
      description = row[template.columns.merchant] || '';
    }

    if (!description.trim()) {
      throw new Error('거래 내용이 비어있습니다.');
    }
    console.log(`설명:`, description);

    // 금액 및 타입 추출
    let amount = 0;
    let type: 'income' | 'expense' = 'expense';

    if (template.columns.amount !== undefined) {
      // 단일 금액 컬럼 (양수/음수로 구분)
      const amountStr = row[template.columns.amount] || '';
      const numericAmount = this.extractAmount(amountStr);
      amount = Math.abs(numericAmount);
      type = numericAmount < 0 ? 'expense' : 'income';
    } else if (template.columns.withdrawal !== undefined && template.columns.deposit !== undefined) {
      // 출금/입금 분리 컬럼
      const withdrawalStr = row[template.columns.withdrawal] || '';
      const depositStr = row[template.columns.deposit] || '';
      
      console.log(`지출금액:`, withdrawalStr, `수입금액:`, depositStr);
      
      const withdrawalAmount = this.extractAmount(withdrawalStr);
      const depositAmount = this.extractAmount(depositStr);
      
      console.log(`파싱된 지출:`, withdrawalAmount, `파싱된 수입:`, depositAmount);
      
      if (withdrawalAmount > 0) {
        amount = withdrawalAmount;
        type = 'expense';
      } else if (depositAmount > 0) {
        amount = depositAmount;
        type = 'income';
      } else {
        // 둘 다 0인 경우 해당 행 건너뛰기
        console.log(`금액이 모두 0인 행 건너뛰기: 라인 ${lineNumber}`);
        return null;
      }
    } else {
      throw new Error('금액 컬럼을 찾을 수 없습니다.');
    }

    // 금액 검증 (0 허용하도록 수정)
    if (isNaN(amount)) {
      throw new Error(`잘못된 금액: ${amount}`);
    }

    // 금융기관 추출 (CSV 파일명이나 설명에서 추출 시도)
    let institution = '';
    if (template.columns.institution !== undefined) {
      institution = row[template.columns.institution] || '';
    } else {
      // 설명에서 금융기관 추출 시도
      institution = this.extractInstitution(description);
    }

    console.log(`최종 거래:`, { date: normalizedDate, description: description.trim(), amount, type, institution });

    return {
      date: normalizedDate,
      description: description.trim(),
      amount,
      type,
      institution: institution || undefined
    };
  }

  /**
   * 설명에서 금융기관명 추출
   */
  private static extractInstitution(description: string): string {
    const institutionPatterns = [
      /삼성카드/,
      /농협카드/,
      /신한카드/,
      /현대카드/,
      /하나카드/,
      /롯데카드/,
      /KB카드/,
      /우리카드/,
      /BC카드/,
      /NH농협은행/,
      /신한은행/,
      /우리은행/,
      /하나은행/,
      /KB국민은행/,
      /IBK기업은행/,
      /KEB하나은행/,
      /카카오뱅크/,
      /토스뱅크/,
      /케이뱅크/
    ];

    for (const pattern of institutionPatterns) {
      if (pattern.test(description)) {
        return pattern.source.replace(/[\/\\]/g, '');
      }
    }

    return '';
  }

  /**
   * CSV 파일을 파싱하여 거래내역으로 변환
   */
  static async parseTransactionCSV(file: File): Promise<ParseResult> {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        return { transactions: [], errors: ['CSV 파일이 비어있습니다.'] };
      }

      const transactions: TransactionRow[] = [];
      const errors: string[] = [];

      // 헤더 행 건너뛰기 (첫 번째 행이 헤더인 경우)
      const startIndex = this.hasHeader(lines[0]) ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const lineNumber = i + 1;
        const line = lines[i].trim();
        
        if (!line) continue;

        try {
          const transaction = this.parseTransactionLine(line, lineNumber);
          if (transaction) {
            transactions.push(transaction);
          }
        } catch (error) {
          errors.push(`라인 ${lineNumber}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
      }

      return { transactions, errors };
    } catch (error) {
      return { 
        transactions: [], 
        errors: [`파일 읽기 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`] 
      };
    }
  }

  /**
   * 첫 번째 행이 헤더인지 확인
   */
  private static hasHeader(firstLine: string): boolean {
    const headerKeywords = ['날짜', '일자', '거래일', '내용', '금액', '수입', '지출', '분류', '카테고리', 'date', 'amount', 'description'];
    const lowercaseLine = firstLine.toLowerCase();
    
    return headerKeywords.some(keyword => lowercaseLine.includes(keyword.toLowerCase()));
  }

  /**
   * 단일 라인을 거래내역으로 파싱
   */
  private static parseTransactionLine(line: string, lineNumber: number): TransactionRow | null {
    // CSV 라인을 컬럼으로 분리 (쉼표 또는 탭으로 구분)
    const columns = this.parseCSVLine(line);
    
    if (columns.length < 3) {
      throw new Error('최소 3개 컬럼(날짜, 내용, 금액)이 필요합니다.');
    }

    // 다양한 CSV 형식 지원
    let date: string, description: string, amount: number, type: 'income' | 'expense', category: string | undefined;

    // 형식 1: 날짜, 내용, 금액, 분류 (4컬럼)
    if (columns.length >= 4) {
      [date, description, , category] = columns;
      const amountStr = columns[2];
      
      // 금액에서 숫자만 추출
      const numericAmount = this.extractAmount(amountStr);
      amount = Math.abs(numericAmount);
      type = numericAmount < 0 ? 'expense' : 'income';
    }
    // 형식 2: 날짜, 내용, 금액 (3컬럼)
    else {
      [date, description] = columns;
      const amountStr = columns[2];
      
      const numericAmount = this.extractAmount(amountStr);
      amount = Math.abs(numericAmount);
      type = numericAmount < 0 ? 'expense' : 'income';
    }

    // 날짜 형식 검증 및 정규화
    const normalizedDate = this.normalizeDate(date);
    if (!normalizedDate) {
      throw new Error(`잘못된 날짜 형식: ${date}`);
    }

    // 금액 검증
    if (isNaN(amount) || amount <= 0) {
      throw new Error(`잘못된 금액: ${columns[2]}`);
    }

    return {
      date: normalizedDate,
      description: description.trim(),
      amount,
      type,
      category: category?.trim()
    };
  }

  /**
   * CSV 라인을 컬럼으로 파싱 (쉼표와 따옴표 처리)
   */
  private static parseCSVLine(line: string): string[] {
    const columns: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === ',' || char === '\t') && !inQuotes) {
        columns.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    columns.push(current.trim());
    return columns.map(col => col.replace(/^"|"$/g, '')); // 따옴표 제거
  }

  /**
   * 문자열에서 금액 추출
   */
  private static extractAmount(amountStr: string): number {
    // 금액에서 숫자, 콤마, 마이너스, 소수점만 추출
    const cleanAmount = amountStr.replace(/[^\d,.-]/g, '');
    
    // 콤마 제거
    const numberStr = cleanAmount.replace(/,/g, '');
    
    return parseFloat(numberStr) || 0;
  }

  /**
   * 날짜를 YYYY-MM-DD 형식으로 정규화
   */
  private static normalizeDate(dateStr: string): string | null {
    console.log('날짜 정규화 시작:', dateStr);
    
    if (!dateStr || typeof dateStr !== 'string') {
      console.log('유효하지 않은 날짜 문자열');
      return null;
    }
    
    // 숫자만 추출 (점, 대시, 슬래시 포함)
    const cleanDate = dateStr.toString().replace(/[^\d.\-\/]/g, '');
    console.log('정리된 날짜 문자열:', cleanDate);
    
    // 다양한 날짜 형식 처리
    const patterns = [
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
      /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/, // YYYY.MM.DD
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, // YYYY/MM/DD
      /^(\d{4})(\d{2})(\d{2})$/, // YYYYMMDD
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // MM-DD-YYYY 또는 DD-MM-YYYY
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, // MM.DD.YYYY 또는 DD.MM.YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY 또는 DD/MM/YYYY
    ];

    for (const pattern of patterns) {
      const match = cleanDate.match(pattern);
      if (match) {
        console.log('패턴 매칭됨:', pattern.source, match);
        let year: number, month: number, day: number;
        
        if (pattern.source.startsWith('^(\\d{4})')) {
          // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD 형식
          [, year, month, day] = match.map(Number);
        } else {
          // MM-DD-YYYY 또는 DD-MM-YYYY 형식 (한국은 보통 DD-MM-YYYY)
          [, day, month, year] = match.map(Number);
        }
        
        console.log('추출된 날짜 요소:', { year, month, day });
        
        // 날짜 유효성 검사
        if (year < 1900 || year > 2099) {
          console.log('연도 범위 오류:', year);
          continue;
        }
        if (month < 1 || month > 12) {
          console.log('월 범위 오류:', month);
          continue;
        }
        if (day < 1 || day > 31) {
          console.log('일 범위 오류:', day);
          continue;
        }
        
        // YYYY-MM-DD 형식으로 반환
        const result = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        console.log('정규화 완료:', result);
        return result;
      }
    }
    
    console.log('날짜 패턴 매칭 실패');
    return null;
  }

  /**
   * 거래내역을 데이터베이스에 저장
   */
  static async saveTransactions(transactions: TransactionRow[], fileUploadId?: string): Promise<{ success: number; errors: string[] }> {
    const { supabase } = await import('@/integrations/supabase/client');
    
    // 현재 사용자 ID 가져오기
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: 0, errors: ['사용자가 로그인되어 있지 않습니다.'] };
    }
    
    let success = 0;
    const errors: string[] = [];

    for (const transaction of transactions) {
      try {
        // 카테고리 처리 - 기존 카테고리가 없으면 자동 분류 시도
        let categoryId = null;
        let categoryName = transaction.category;
        
        if (!categoryName) {
          // 자동 카테고리 분류 시도
          categoryName = CategoryClassifier.classifyCategory(transaction.description, transaction.type);
        }
        
        if (categoryName) {
          categoryId = await this.findOrCreateCategory(categoryName, transaction.type, user.id);
        }

        // 중복 검사를 위한 기본 정보로 먼저 확인
        const { data: existingTransaction } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', user.id)
          .eq('date', transaction.date)
          .eq('description', transaction.description)
          .eq('amount', transaction.amount)
          .eq('type', transaction.type)
          .maybeSingle();

        if (existingTransaction) {
          console.log('중복 거래 발견, 건너뛰기:', transaction.description);
          continue;
        }

        // 거래내역 저장 (user_id 및 file_upload_id, institution 추가)
        const { error } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,  // 현재 사용자 ID 설정
            date: transaction.date,
            description: transaction.description,
            amount: transaction.amount,
            type: transaction.type,
            category_id: categoryId,
            institution: transaction.institution,
            source: fileUploadId ? 'csv_upload' : 'csv_import',
            file_upload_id: fileUploadId
          });

        if (error) {
          console.error('거래내역 저장 오류:', error);
          errors.push(`"${transaction.description}" 저장 실패: ${error.message}`);
        } else {
          success++;
        }
      } catch (error) {
        console.error('거래내역 처리 오류:', error);
        errors.push(`"${transaction.description}" 처리 중 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    }

    return { success, errors };
  }

  /**
   * 카테고리 찾기 또는 생성
   */
  private static async findOrCreateCategory(categoryName: string, type: 'income' | 'expense', userId: string): Promise<string> {
    const { supabase } = await import('@/integrations/supabase/client');
    
    // 기존 카테고리 찾기
    const { data: existingCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('name', categoryName)
      .eq('type', type)
      .eq('user_id', userId)  // 사용자별 카테고리 검색
      .maybeSingle();

    if (existingCategory) {
      return existingCategory.id;
    }

    // 새 카테고리 생성 (user_id 추가)
    const { data: newCategory, error } = await supabase
      .from('categories')
      .insert({
        user_id: userId,  // 현재 사용자 ID 설정
        name: categoryName,
        type: type,
        color: type === 'income' ? '#10b981' : '#ef4444',
        icon: 'circle'
      })
      .select('id')
      .single();

    if (error || !newCategory) {
      console.error('카테고리 생성 오류:', error);
      throw new Error(`카테고리 생성 실패: ${error?.message}`);
    }

    return newCategory.id;
  }
}