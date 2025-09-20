import { supabase } from '@/integrations/supabase/client';

interface BalanceInfo {
  accountName: string;
  accountType: 'bank' | 'card' | 'investment' | 'pay' | 'crypto';
  balance: number;
  lastUpdated: number;
  source: 'sms' | 'notification';
}

export class BalanceTracker {
  private balances = new Map<string, BalanceInfo>();

  /**
   * SMS나 알림에서 잔액 정보 추출 및 저장
   */
  extractAndSaveBalance(message: string, sender: string, timestamp: number): void {
    const balanceInfo = this.extractBalanceFromText(message, sender, timestamp);
    if (balanceInfo) {
      this.saveBalance(balanceInfo);
    }
  }

  /**
   * 텍스트에서 잔액 정보 추출
   */
  private extractBalanceFromText(message: string, sender: string, timestamp: number): BalanceInfo | null {
    // 잔액 패턴들
    const balancePatterns = [
      // 은행 계좌 잔액
      /잔액\s*([\d,]+)원/,
      /잔고\s*([\d,]+)원/,
      /계좌잔액\s*([\d,]+)원/,
      /출금후잔액\s*([\d,]+)원/,
      /입금후잔액\s*([\d,]+)원/,
      
      // 카드 한도/잔액
      /이용가능금액\s*([\d,]+)원/,
      /사용가능한도\s*([\d,]+)원/,
      /승인가능금액\s*([\d,]+)원/,
      
      // 투자/증권 잔액
      /평가금액\s*([\d,]+)원/,
      /총자산\s*([\d,]+)원/,
      /예수금\s*([\d,]+)원/,
      /투자원금\s*([\d,]+)원/,
      
      // 간편결제 잔액
      /페이머니\s*([\d,]+)원/,
      /토스머니\s*([\d,]+)원/,
      /카카오페이머니\s*([\d,]+)원/,
      /네이버페이포인트\s*([\d,]+)원/,
      
      // 암호화폐 거래소
      /보유원화\s*([\d,]+)원/,
      /KRW잔고\s*([\d,]+)원/
    ];

    for (const pattern of balancePatterns) {
      const match = message.match(pattern);
      if (match) {
        const balance = parseInt(match[1].replace(/,/g, ''));
        const accountInfo = this.identifyAccount(sender, message);
        
        return {
          accountName: accountInfo.name,
          accountType: accountInfo.type,
          balance,
          lastUpdated: timestamp,
          source: 'sms'
        };
      }
    }

    return null;
  }

  /**
   * 발신자와 메시지 내용으로 계좌 종류 식별
   */
  private identifyAccount(sender: string, message: string): { name: string; type: BalanceInfo['accountType'] } {
    // 은행들
    const banks = {
      '우리': { name: '우리은행', type: 'bank' as const },
      '신한': { name: '신한은행', type: 'bank' as const },
      'KB': { name: 'KB국민은행', type: 'bank' as const },
      '국민': { name: 'KB국민은행', type: 'bank' as const },
      '하나': { name: '하나은행', type: 'bank' as const },
      '농협': { name: 'NH농협은행', type: 'bank' as const },
      'NH': { name: 'NH농협은행', type: 'bank' as const },
      '기업': { name: 'IBK기업은행', type: 'bank' as const },
      'IBK': { name: 'IBK기업은행', type: 'bank' as const },
      '수협': { name: '수협은행', type: 'bank' as const },
      '카카오뱅크': { name: '카카오뱅크', type: 'bank' as const },
      '토스뱅크': { name: '토스뱅크', type: 'bank' as const },
      'K뱅크': { name: 'K뱅크', type: 'bank' as const },
      '대구': { name: '대구은행', type: 'bank' as const },
      '부산': { name: '부산은행', type: 'bank' as const },
      '광주': { name: '광주은행', type: 'bank' as const },
      '전북': { name: '전북은행', type: 'bank' as const },
      '경남': { name: '경남은행', type: 'bank' as const },
      '제주': { name: '제주은행', type: 'bank' as const }
    };

    // 카드사들
    const cards = {
      '우리카드': { name: '우리카드', type: 'card' as const },
      '신한카드': { name: '신한카드', type: 'card' as const },
      '삼성카드': { name: '삼성카드', type: 'card' as const },
      '현대카드': { name: '현대카드', type: 'card' as const },
      'KB카드': { name: 'KB국민카드', type: 'card' as const },
      '국민카드': { name: 'KB국민카드', type: 'card' as const },
      '하나카드': { name: '하나카드', type: 'card' as const },
      'NH카드': { name: 'NH농협카드', type: 'card' as const },
      '농협카드': { name: 'NH농협카드', type: 'card' as const },
      '롯데카드': { name: '롯데카드', type: 'card' as const },
      'BC카드': { name: 'BC카드', type: 'card' as const }
    };

    // 증권사들
    const investments = {
      '키움': { name: '키움증권', type: 'investment' as const },
      'NH투자': { name: 'NH투자증권', type: 'investment' as const },
      '미래에셋': { name: '미래에셋증권', type: 'investment' as const },
      '삼성증권': { name: '삼성증권', type: 'investment' as const },
      '한국투자': { name: '한국투자증권', type: 'investment' as const },
      '대신증권': { name: '대신증권', type: 'investment' as const },
      '신한투자': { name: '신한투자증권', type: 'investment' as const },
      '하나증권': { name: '하나증권', type: 'investment' as const },
      '이베스트': { name: '이베스트투자증권', type: 'investment' as const },
      '유진투자': { name: '유진투자증권', type: 'investment' as const }
    };

    // 간편결제들
    const pays = {
      '토스': { name: '토스페이', type: 'pay' as const },
      '카카오페이': { name: '카카오페이', type: 'pay' as const },
      '네이버페이': { name: '네이버페이', type: 'pay' as const },
      '페이코': { name: '페이코', type: 'pay' as const },
      'PAYCO': { name: '페이코', type: 'pay' as const },
      '삼성페이': { name: '삼성페이', type: 'pay' as const },
      'LG페이': { name: 'LG페이', type: 'pay' as const }
    };

    // 암호화폐 거래소들
    const crypto = {
      '빗썸': { name: '빗썸', type: 'crypto' as const },
      '업비트': { name: '업비트', type: 'crypto' as const },
      '코인원': { name: '코인원', type: 'crypto' as const },
      '코빗': { name: '코빗', type: 'crypto' as const },
      '바이낸스': { name: '바이낸스', type: 'crypto' as const }
    };

    const allServices = { ...banks, ...cards, ...investments, ...pays, ...crypto };

    // 발신자나 메시지에서 서비스 식별
    for (const [keyword, info] of Object.entries(allServices)) {
      if (sender.includes(keyword) || message.includes(keyword)) {
        return info;
      }
    }

    // 식별 실패 시 기본값
    return { name: '알 수 없음', type: 'bank' };
  }

  /**
   * 잔액 정보 저장 (메모리 + 데이터베이스)
   */
  private async saveBalance(balanceInfo: BalanceInfo): Promise<void> {
    const key = `${balanceInfo.accountType}_${balanceInfo.accountName}`;
    
    // 메모리에 저장 (빠른 접근용)
    this.balances.set(key, balanceInfo);

    // 데이터베이스에 저장
    try {
      const { error } = await supabase
        .from('account_balances')
        .upsert({
          account_name: balanceInfo.accountName,
          account_type: balanceInfo.accountType,
          balance: balanceInfo.balance,
          last_updated: new Date(balanceInfo.lastUpdated).toISOString(),
          source: balanceInfo.source
        }, {
          onConflict: 'account_name,account_type'
        });

      if (error) {
        console.error('잔액 정보 저장 실패:', error);
      } else {
        console.log('✅ 잔액 정보 업데이트:', balanceInfo.accountName, balanceInfo.balance.toLocaleString() + '원');
      }
    } catch (error) {
      console.error('잔액 저장 중 예외:', error);
    }
  }

  /**
   * 모든 잔액 정보 조회
   */
  async getAllBalances(): Promise<BalanceInfo[]> {
    try {
      const { data, error } = await supabase
        .from('account_balances')
        .select('*')
        .order('balance', { ascending: false });

      if (error) {
        console.error('잔액 조회 실패:', error);
        return [];
      }

      return (data || []).map(item => ({
        accountName: item.account_name,
        accountType: item.account_type,
        balance: item.balance,
        lastUpdated: new Date(item.last_updated).getTime(),
        source: item.source
      }));
    } catch (error) {
      console.error('잔액 조회 중 예외:', error);
      return [];
    }
  }

  /**
   * 특정 계좌 잔액 조회
   */
  getBalance(accountName: string, accountType: BalanceInfo['accountType']): BalanceInfo | null {
    const key = `${accountType}_${accountName}`;
    return this.balances.get(key) || null;
  }

  /**
   * 총 자산 계산
   */
  async calculateTotalAssets(): Promise<{ total: number; byType: Record<string, number> }> {
    const balances = await this.getAllBalances();
    
    const byType: Record<string, number> = {
      bank: 0,
      card: 0,
      investment: 0,
      pay: 0,
      crypto: 0
    };

    let total = 0;

    for (const balance of balances) {
      // 카드는 마이너스 잔액일 수 있으므로 총 자산에서 제외하거나 별도 처리
      if (balance.accountType !== 'card') {
        total += balance.balance;
      }
      byType[balance.accountType] = (byType[balance.accountType] || 0) + balance.balance;
    }

    return { total, byType };
  }
}

export const balanceTracker = new BalanceTracker();