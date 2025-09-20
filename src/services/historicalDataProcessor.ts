import { smsService } from './smsService';
import { notificationService } from './notificationService';
import { balanceTracker } from './balanceTracker';
import { supabase } from '@/integrations/supabase/client';

export class HistoricalDataProcessor {
  private isProcessing = false;

  /**
   * 앱 시작 시 기존 SMS/알림 내역을 모두 처리
   */
  async processHistoricalData(): Promise<void> {
    if (this.isProcessing) {
      console.log('이미 과거 데이터 처리 중입니다.');
      return;
    }

    this.isProcessing = true;
    console.log('📚 과거 데이터 처리 시작...');

    try {
      // 1. 기존 SMS 처리 (최근 3개월)
      await this.processHistoricalSMS();
      
      // 2. 기존 알림 처리 (Android만 가능)
      await this.processHistoricalNotifications();
      
      // 3. 잔액 정보 추출
      await this.extractBalanceInformation();
      
      console.log('✅ 과거 데이터 처리 완료');
    } catch (error) {
      console.error('❌ 과거 데이터 처리 실패:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 과거 SMS 내역 처리
   */
  private async processHistoricalSMS(): Promise<void> {
    if (!window.SMS) {
      console.log('SMS 플러그인 없음, SMS 처리 스킵');
      return;
    }

    console.log('📱 과거 SMS 내역 처리 중...');

    const threeMonthsAgo = Date.now() - (90 * 24 * 60 * 60 * 1000); // 3개월 전

    return new Promise((resolve) => {
      const filter = {
        box: 'inbox',
        maxCount: 1000, // 최근 1000개 SMS
        indexFrom: 0
      };

      window.SMS.listSMS(
        filter,
        async (messages: any[]) => {
          console.log(`📨 총 ${messages.length}개 SMS 발견`);
          
          let processedCount = 0;
          let financialCount = 0;

          // 시간 순으로 정렬 (오래된 것부터)
          const sortedMessages = messages
            .filter(msg => msg.date > threeMonthsAgo)
            .sort((a, b) => a.date - b.date);

          console.log(`📅 최근 3개월 SMS: ${sortedMessages.length}개`);

          for (const message of sortedMessages) {
            try {
              // SMS에서 거래내역 파싱 시도
              const parsed = await this.processSingleSMS(message);
              if (parsed) {
                financialCount++;
              }
              
              // 잔액 정보 추출
              balanceTracker.extractAndSaveBalance(
                message.body, 
                message.address, 
                message.date
              );
              
              processedCount++;
              
              // 진행 상황 로그 (100개마다)
              if (processedCount % 100 === 0) {
                console.log(`📈 SMS 처리 진행: ${processedCount}/${sortedMessages.length}`);
              }
              
            } catch (error) {
              console.error('SMS 처리 중 오류:', message.address, error);
            }
          }

          console.log(`✅ SMS 처리 완료: ${financialCount}개 금융 거래 발견`);
          resolve();
        },
        (error: any) => {
          console.error('SMS 조회 실패:', error);
          resolve(); // 오류가 있어도 계속 진행
        }
      );
    });
  }

  /**
   * 개별 SMS 처리
   */
  private async processSingleSMS(smsData: any): Promise<boolean> {
    // SMS 서비스의 파서 재사용
    const { smsParser } = await import('./smsParser');
    
    const parsed = smsParser.parseSMS({
      message: smsData.body,
      sender: smsData.address,
      timestamp: smsData.date
    });

    if (!parsed) {
      return false; // 금융 관련 SMS가 아님
    }

    // 중복 체크 (과거 데이터이므로 덜 엄격하게)
    const { duplicateDetector } = await import('./duplicateDetector');
    
    const isDuplicate = await duplicateDetector.isDuplicate({
      amount: parsed.amount,
      merchant: parsed.merchant,
      type: parsed.type,
      timestamp: parsed.timestamp,
      source: 'sms'
    });

    if (isDuplicate) {
      return false; // 중복이므로 스킵
    }

    // 카테고리 찾기/생성
    const categoryId = await this.findOrCreateCategory(parsed.category || '기타', parsed.type);

    // 데이터베이스에 저장
    const { error } = await supabase
      .from('transactions')
      .insert({
        amount: parsed.amount,
        type: parsed.type,
        category_id: categoryId,
        description: `${parsed.bank} - ${parsed.merchant}`,
        date: this.formatDate(parsed.timestamp),
        created_at: new Date(parsed.timestamp).toISOString()
      });

    if (error) {
      console.error('과거 거래내역 저장 실패:', error);
      return false;
    }

    return true; // 성공적으로 처리됨
  }

  /**
   * 과거 알림 내역 처리 (Android만)
   */
  private async processHistoricalNotifications(): Promise<void> {
    // Android 알림 내역은 시스템 제한으로 인해 접근이 어려움
    // 대신 앱이 설치된 이후의 알림만 캐치 가능
    console.log('📔 알림 내역 처리는 앱 설치 이후부터 가능합니다.');
  }

  /**
   * 잔액 정보 추출
   */
  private async extractBalanceInformation(): Promise<void> {
    console.log('💰 잔액 정보 추출 중...');
    
    try {
      const balances = await balanceTracker.getAllBalances();
      console.log(`💳 발견된 계좌: ${balances.length}개`);
      
      for (const balance of balances) {
        console.log(`📊 ${balance.accountName}: ${balance.balance.toLocaleString()}원`);
      }

      const totalAssets = await balanceTracker.calculateTotalAssets();
      console.log(`💎 총 자산: ${totalAssets.total.toLocaleString()}원`);
      
    } catch (error) {
      console.error('잔액 정보 추출 실패:', error);
    }
  }

  /**
   * 카테고리 찾기 또는 생성
   */
  private async findOrCreateCategory(categoryName: string, type: 'income' | 'expense'): Promise<string> {
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('name', categoryName)
      .eq('type', type)
      .single();

    if (existing) {
      return existing.id;
    }

    const { data: newCategory, error } = await supabase
      .from('categories')
      .insert({
        name: categoryName,
        type: type,
        color: type === 'income' ? '#22c55e' : '#ef4444',
        icon: 'circle'
      })
      .select('id')
      .single();

    if (error) {
      console.error('카테고리 생성 실패:', error);
      // 기본 카테고리 반환
      const { data: defaultCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('name', '기타')
        .eq('type', type)
        .single();
      
      return defaultCategory?.id || '';
    }

    return newCategory.id;
  }

  /**
   * 날짜 포맷팅
   */
  private formatDate(timestamp: number): string {
    return new Date(timestamp).toISOString().split('T')[0];
  }

  /**
   * 처리 상태 확인
   */
  isProcessingHistoricalData(): boolean {
    return this.isProcessing;
  }
}

export const historicalDataProcessor = new HistoricalDataProcessor();