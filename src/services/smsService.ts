import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { smsParser } from './smsParser';

declare global {
  interface Window {
    SMS: {
      listSMS: (filter: any, success: (data: any) => void, error: (error: any) => void) => void;
      startWatch: (success: (data: any) => void, error: (error: any) => void) => void;
      stopWatch: (success: () => void, error: (error: any) => void) => void;
    };
  }
}

export class SMSService {
  private isWatching = false;
  private lastProcessedTime = 0;

  async initializeSMSWatcher(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('SMS 기능은 모바일 환경에서만 사용 가능합니다.');
      return;
    }

    try {
      await this.requestPermissions();
      await this.startWatching();
      await this.processRecentSMS(); // 최근 SMS들을 한 번 처리
    } catch (error) {
      console.error('SMS 서비스 초기화 실패:', error);
      throw error;
    }
  }

  private async requestPermissions(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.SMS) {
        // SMS 권한은 플러그인이 자동으로 요청
        resolve();
      } else {
        reject(new Error('SMS 플러그인이 로드되지 않았습니다.'));
      }
    });
  }

  private async startWatching(): Promise<void> {
    if (this.isWatching) return;

    return new Promise((resolve, reject) => {
      if (!window.SMS) {
        reject(new Error('SMS 플러그인을 사용할 수 없습니다.'));
        return;
      }

      window.SMS.startWatch(
        (data) => {
          console.log('새 SMS 수신:', data);
          this.processSMS(data);
        },
        (error) => {
          console.error('SMS 감시 오류:', error);
          reject(error);
        }
      );

      this.isWatching = true;
      resolve();
    });
  }

  private async processRecentSMS(): Promise<void> {
    if (!window.SMS) return;

    const filter = {
      box: 'inbox',
      maxCount: 50, // 최근 50개 SMS 확인
      indexFrom: 0
    };

    return new Promise((resolve) => {
      window.SMS.listSMS(
        filter,
        (messages) => {
          console.log('최근 SMS 처리 중:', messages.length, '개');
          messages.forEach((message: any) => {
            // 최근 1시간 내의 메시지만 처리
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            if (message.date > oneHourAgo) {
              this.processSMS(message);
            }
          });
          resolve();
        },
        (error) => {
          console.error('최근 SMS 조회 실패:', error);
          resolve(); // 실패해도 계속 진행
        }
      );
    });
  }

  private async processSMS(smsData: any): Promise<void> {
    try {
      // 이미 처리한 SMS인지 확인
      if (smsData.date <= this.lastProcessedTime) {
        return;
      }

      const parsed = smsParser.parseSMS({
        message: smsData.body,
        sender: smsData.address,
        timestamp: smsData.date
      });

      if (!parsed) {
        console.log('금융 관련 SMS가 아님:', smsData.address);
        return;
      }

      console.log('거래내역 파싱됨:', parsed);
      
      // 카테고리 ID 찾기
      const categoryId = await this.findOrCreateCategory(parsed.category || '기타', parsed.type);
      
      // Supabase에 거래내역 저장
      const { error } = await supabase
        .from('transactions')
        .insert({
          amount: parsed.amount,
          type: parsed.type,
          category_id: categoryId,
          description: `${parsed.bank} - ${parsed.merchant}`,
          date: this.formatDate(parsed.timestamp)
        });

      if (error) {
        console.error('거래내역 저장 실패:', error);
        return;
      }

      console.log('거래내역 자동 등록 완료:', parsed);
      this.lastProcessedTime = smsData.date;

      // 알림 표시 (선택적)
      this.showNotification(parsed);

    } catch (error) {
      console.error('SMS 처리 중 오류:', error);
    }
  }

  private async findOrCreateCategory(categoryName: string, type: 'income' | 'expense'): Promise<string> {
    // 기존 카테고리 찾기
    const { data: existingCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('name', categoryName)
      .eq('type', type)
      .single();

    if (existingCategory) {
      return existingCategory.id;
    }

    // 새 카테고리 생성
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

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0];
  }

  private showNotification(transaction: any): void {
    // 간단한 알림 (실제 구현 시 토스트 등 사용)
    console.log(`💰 자동 등록: ${transaction.merchant} ${transaction.amount.toLocaleString()}원`);
  }

  async stopWatching(): Promise<void> {
    if (!this.isWatching || !window.SMS) return;

    return new Promise((resolve) => {
      window.SMS.stopWatch(
        () => {
          this.isWatching = false;
          resolve();
        },
        (error) => {
          console.error('SMS 감시 중단 오류:', error);
          resolve(); // 오류가 있어도 상태는 변경
        }
      );
    });
  }
}

export const smsService = new SMSService();