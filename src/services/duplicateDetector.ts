import { supabase } from '@/integrations/supabase/client';

interface TransactionData {
  amount: number;
  merchant: string;
  type: 'income' | 'expense';
  timestamp: number;
  source: 'sms' | 'notification';
}

export class DuplicateDetector {
  // 최근 처리된 거래들을 임시 저장 (메모리)
  private recentTransactions: TransactionData[] = [];
  private readonly DUPLICATE_WINDOW_MS = 3 * 60 * 1000; // 3분 이내는 중복으로 간주
  private readonly MAX_RECENT_COUNT = 50; // 최대 50개까지만 메모리에 보관

  /**
   * 중복 거래인지 확인
   */
  async isDuplicate(newTransaction: TransactionData): Promise<boolean> {
    // 1. 메모리에서 빠른 중복 체크
    const memoryDuplicate = this.checkMemoryDuplicates(newTransaction);
    if (memoryDuplicate) {
      console.log('메모리에서 중복 거래 감지:', newTransaction.merchant, newTransaction.amount);
      return true;
    }

    // 2. 데이터베이스에서 중복 체크 (더 정확한 확인)
    const dbDuplicate = await this.checkDatabaseDuplicates(newTransaction);
    if (dbDuplicate) {
      console.log('DB에서 중복 거래 감지:', newTransaction.merchant, newTransaction.amount);
      return true;
    }

    // 3. 중복이 아니면 메모리에 추가
    this.addToRecent(newTransaction);
    return false;
  }

  /**
   * 메모리에서 중복 체크 (빠름)
   */
  private checkMemoryDuplicates(newTransaction: TransactionData): boolean {
    const now = Date.now();
    
    // 오래된 거래는 메모리에서 제거
    this.recentTransactions = this.recentTransactions.filter(
      t => now - t.timestamp < this.DUPLICATE_WINDOW_MS
    );

    // 중복 체크
    return this.recentTransactions.some(existing => 
      this.isSimilarTransaction(existing, newTransaction)
    );
  }

  /**
   * 데이터베이스에서 중복 체크 (정확함)
   */
  private async checkDatabaseDuplicates(newTransaction: TransactionData): Promise<boolean> {
    const startTime = new Date(newTransaction.timestamp - this.DUPLICATE_WINDOW_MS);
    const endTime = new Date(newTransaction.timestamp + this.DUPLICATE_WINDOW_MS);

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, description, created_at')
        .eq('type', newTransaction.type)
        .eq('amount', newTransaction.amount)
        .gte('created_at', startTime.toISOString())
        .lte('created_at', endTime.toISOString());

      if (error) {
        console.error('중복 체크 중 DB 오류:', error);
        return false; // 오류 시 중복이 아닌 것으로 가정
      }

      // 상호명이 비슷한 거래가 있는지 확인
      return (data || []).some(existingTransaction => {
        const existingMerchant = this.extractMerchantFromDescription(existingTransaction.description || '');
        return this.isSimilarMerchant(existingMerchant, newTransaction.merchant);
      });

    } catch (error) {
      console.error('중복 체크 중 예외:', error);
      return false;
    }
  }

  /**
   * 두 거래가 유사한지 판단
   */
  private isSimilarTransaction(existing: TransactionData, newTx: TransactionData): boolean {
    // 금액이 다르면 다른 거래
    if (existing.amount !== newTx.amount) return false;
    
    // 거래 유형이 다르면 다른 거래
    if (existing.type !== newTx.type) return false;
    
    // 시간 차이가 윈도우를 벗어나면 다른 거래
    const timeDiff = Math.abs(existing.timestamp - newTx.timestamp);
    if (timeDiff > this.DUPLICATE_WINDOW_MS) return false;
    
    // 상호명이 비슷한지 확인
    return this.isSimilarMerchant(existing.merchant, newTx.merchant);
  }

  /**
   * 상호명이 비슷한지 판단
   */
  private isSimilarMerchant(merchant1: string, merchant2: string): boolean {
    if (!merchant1 || !merchant2) return false;

    // 정규화: 공백, 특수문자 제거, 소문자 변환
    const normalize = (str: string) => 
      str.toLowerCase()
         .replace(/[\s\-_\(\)\[\]\.]/g, '')
         .replace(/[가-힣]+점/g, '') // "스타벅스 강남점" -> "스타벅스"
         .replace(/[가-힣]+점포/g, '');

    const norm1 = normalize(merchant1);
    const norm2 = normalize(merchant2);

    // 완전 일치
    if (norm1 === norm2) return true;

    // 한쪽이 다른 쪽을 포함 (길이 차이가 크지 않을 때만)
    if (Math.abs(norm1.length - norm2.length) <= 3) {
      return norm1.includes(norm2) || norm2.includes(norm1);
    }

    // 유사도 계산 (간단한 버전)
    const similarity = this.calculateSimilarity(norm1, norm2);
    return similarity > 0.8; // 80% 이상 유사하면 같은 거래
  }

  /**
   * 간단한 문자열 유사도 계산
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * 레벤슈타인 거리 계산
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * description에서 상호명 추출
   */
  private extractMerchantFromDescription(description: string): string {
    // "토스 - 스타벅스" -> "스타벅스"
    // "신한카드 - 맥도날드" -> "맥도날드"
    const parts = description.split(' - ');
    return parts.length > 1 ? parts[1].trim() : description.trim();
  }

  /**
   * 최근 거래 목록에 추가
   */
  private addToRecent(transaction: TransactionData): void {
    this.recentTransactions.push(transaction);
    
    // 메모리 사용량 제한
    if (this.recentTransactions.length > this.MAX_RECENT_COUNT) {
      this.recentTransactions = this.recentTransactions
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.MAX_RECENT_COUNT);
    }
  }

  /**
   * 메모리 정리
   */
  cleanup(): void {
    const now = Date.now();
    this.recentTransactions = this.recentTransactions.filter(
      t => now - t.timestamp < this.DUPLICATE_WINDOW_MS
    );
  }
}

export const duplicateDetector = new DuplicateDetector();