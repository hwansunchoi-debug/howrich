import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { smsParser } from './smsParser';

interface NotificationData {
  title: string;
  text: string;
  packageName: string;
  timestamp: number;
}

export class NotificationService {
  private isListening = false;
  private supportedApps = [
    'com.nhn.android.naverpay',     // 네이버페이
    'com.kakao.talk',               // 카카오톡 (카카오페이)
    'viva.republica.toss',          // 토스
    'com.nhnent.payapp',            // 페이코
    'com.samsung.android.spay',     // 삼성페이
    'com.lguplus.paynow',          // LG페이
    'com.wooricard.wpay',          // 우리페이
    'com.kbcard.cxh.appcard',      // KB페이
    'com.shinhancard.smartshinhan', // 신한 페이판
    'com.hyundaicard.appcard'       // 현대카드 앱카드
  ];

  private paymentPatterns = {
    네이버페이: {
      titlePattern: /네이버페이|NAVER Pay/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    카카오페이: {
      titlePattern: /카카오페이|KakaoPay/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    토스: {
      titlePattern: /토스|Toss/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제|([^\d\s]+)에서\s+([\d,]+)원/,
      type: 'expense' as const
    },
    페이코: {
      titlePattern: /페이코|PAYCO/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    삼성페이: {
      titlePattern: /삼성페이|Samsung Pay/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    }
  };

  async initializeNotificationListener(): Promise<void> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'ios') {
      console.log('알림 읽기는 안드로이드에서만 지원됩니다.');
      return;
    }

    try {
      await this.requestNotificationAccess();
      await this.startListening();
      console.log('푸시 알림 감지가 시작되었습니다.');
    } catch (error) {
      console.error('알림 서비스 초기화 실패:', error);
      throw error;
    }
  }

  private async requestNotificationAccess(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 커스텀 네이티브 플러그인 호출 (실제 구현 시 필요)
      if (window.NotificationListener) {
        window.NotificationListener.requestPermission(
          () => resolve(),
          (error: any) => reject(error)
        );
      } else {
        reject(new Error('알림 접근 플러그인이 설치되지 않았습니다.'));
      }
    });
  }

  private async startListening(): Promise<void> {
    if (this.isListening) return;

    return new Promise((resolve, reject) => {
      if (!window.NotificationListener) {
        reject(new Error('알림 리스너를 사용할 수 없습니다.'));
        return;
      }

      window.NotificationListener.startListening(
        (notification: NotificationData) => {
          console.log('새 알림 수신:', notification);
          this.processNotification(notification);
        },
        (error: any) => {
          console.error('알림 감시 오류:', error);
          reject(error);
        }
      );

      this.isListening = true;
      resolve();
    });
  }

  private async processNotification(notification: NotificationData): Promise<void> {
    try {
      // 지원되는 결제 앱인지 확인
      if (!this.supportedApps.includes(notification.packageName)) {
        return;
      }

      const parsed = this.parsePaymentNotification(notification);
      if (!parsed) {
        console.log('결제 관련 알림이 아님:', notification.title);
        return;
      }

      console.log('결제 알림 파싱됨:', parsed);
      
      // 카테고리 ID 찾기
      const categoryId = await this.findOrCreateCategory(parsed.category || '기타', parsed.type);
      
      // Supabase에 거래내역 저장
      const { error } = await supabase
        .from('transactions')
        .insert({
          amount: parsed.amount,
          type: parsed.type,
          category_id: categoryId,
          description: `${parsed.service} - ${parsed.merchant}`,
          date: this.formatDate(parsed.timestamp)
        });

      if (error) {
        console.error('거래내역 저장 실패:', error);
        return;
      }

      console.log('푸시 알림에서 거래내역 자동 등록 완료:', parsed);
      this.showSuccessNotification(parsed);

    } catch (error) {
      console.error('알림 처리 중 오류:', error);
    }
  }

  private parsePaymentNotification(notification: NotificationData): any {
    for (const [serviceName, config] of Object.entries(this.paymentPatterns)) {
      // 제목으로 서비스 식별
      if (config.titlePattern.test(notification.title)) {
        const textMatch = notification.text.match(config.textPattern);
        
        if (textMatch) {
          const merchant = textMatch[1] || textMatch[3] || '알 수 없음';
          const amountStr = textMatch[2] || textMatch[4];
          const amount = parseInt(amountStr.replace(/,/g, ''));
          
          // 카테고리 자동 분류
          const category = this.categorizeByMerchant(merchant);
          
          return {
            service: serviceName,
            merchant: merchant.trim(),
            amount,
            type: config.type,
            category,
            timestamp: notification.timestamp
          };
        }
      }
    }
    
    return null;
  }

  private categorizeByMerchant(merchant: string): string {
    // SMS 파서의 카테고리 매핑 재사용
    const categoryMap = {
      '스타벅스': '식비', '맥도날드': '식비', '버거킹': '식비',
      '배달의민족': '식비', '요기요': '식비', '쿠팡이츠': '식비',
      '이마트': '식비', '홈플러스': '식비', '편의점': '식비',
      'GS25': '식비', 'CU': '식비', '세븐일레븐': '식비',
      
      '쿠팡': '쇼핑', '11번가': '쇼핑', '네이버': '쇼핑',
      '무신사': '쇼핑', '29CM': '쇼핑', '브랜디': '쇼핑',
      
      'CGV': '문화생활', '롯데시네마': '문화생활', '메가박스': '문화생활',
      '넷플릭스': '문화생활', '유튜브': '문화생활', '스포티파이': '문화생활',
      
      '지하철': '교통비', '버스': '교통비', '택시': '교통비',
      '주유소': '교통비', 'GS칼텍스': '교통비', 'SK에너지': '교통비'
    };
    
    const normalizedMerchant = merchant.toLowerCase();
    
    for (const [keyword, category] of Object.entries(categoryMap)) {
      if (normalizedMerchant.includes(keyword.toLowerCase()) || 
          merchant.includes(keyword)) {
        return category;
      }
    }
    
    return '기타';
  }

  private async findOrCreateCategory(categoryName: string, type: 'income' | 'expense'): Promise<string> {
    // SMS 서비스와 동일한 로직
    const { data: existingCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('name', categoryName)
      .eq('type', type)
      .single();

    if (existingCategory) {
      return existingCategory.id;
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

  private showSuccessNotification(transaction: any): void {
    console.log(`🔔 푸시알림 자동등록: ${transaction.service} ${transaction.merchant} ${transaction.amount.toLocaleString()}원`);
  }

  async stopListening(): Promise<void> {
    if (!this.isListening || !window.NotificationListener) return;

    return new Promise((resolve) => {
      window.NotificationListener.stopListening(
        () => {
          this.isListening = false;
          resolve();
        },
        (error: any) => {
          console.error('알림 감시 중단 오류:', error);
          resolve();
        }
      );
    });
  }
}

// 전역 타입 선언
declare global {
  interface Window {
    NotificationListener: {
      requestPermission: (success: () => void, error: (error: any) => void) => void;
      startListening: (success: (data: any) => void, error: (error: any) => void) => void;
      stopListening: (success: () => void, error: (error: any) => void) => void;
    };
  }
}

export const notificationService = new NotificationService();