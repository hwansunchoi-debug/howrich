import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { smsParser } from './smsParser';
import { duplicateDetector } from './duplicateDetector';

interface NotificationData {
  title: string;
  text: string;
  packageName: string;
  timestamp: number;
}

export class NotificationService {
  private isListening = false;
  private supportedApps = [
    // 페이 서비스
    'com.nhn.android.naverpay',         // 네이버페이
    'com.kakao.talk',                   // 카카오톡 (카카오페이)
    'viva.republica.toss',              // 토스
    'com.nhnent.payapp',                // 페이코
    'com.samsung.android.spay',         // 삼성페이
    'com.lguplus.paynow',              // LG페이
    'com.wooricard.wpay',              // 우리페이
    'com.kbcard.cxh.appcard',          // KB페이
    'com.shinhancard.smartshinhan',    // 신한 페이판
    'com.hyundaicard.appcard',         // 현대카드 앱카드
    'com.nhcard.nhappcard',            // NH페이
    'com.lottecard.lottepay',          // 롯데페이
    'com.hanacard.app',                // 하나페이
    'com.citimobilekorea.citipay',     // 시티페이
    'com.sccard.smartpay',             // SC제일은행 페이
    
    // 은행 앱
    'com.nh.cashcardapp',              // NH농협스마트뱅킹
    'com.kbstar.kbbank',               // KB스타뱅킹
    'com.shinhan.sbanking',            // 신한 쏠(SOL)
    'com.wooribank.smart.npib',        // 우리원뱅킹
    'com.hanafn.mobile.android',       // 하나원큐
    'kr.co.ibk.ibkbank',               // IBK기업은행
    'com.keb.smart',                   // KEB하나은행
    'kr.co.standardchartered.mobile',   // SC제일은행
    'com.epost.psf.sdsi',              // 우체국스마트뱅킹
    'com.dgb.mobile.android.smart',    // DGB대구은행
    'com.busanbank.mobile.android',    // BNK부산은행
    'com.gwangju.mobile.android',      // 광주은행
    'com.kjbank.mobile.android',       // 광주은행
    'com.jbbank.mobile.android',       // 전북은행
    'com.knbank.mobile.android',       // 경남은행
    'com.cu.mobile.android',           // 저축은행 중앙회
    'com.suhyup.sbank.mobile',         // 수협은행
    'com.nonghyup.mobile.android',     // 농협은행
    'com.kfcc.mobile.android',         // 새마을금고
    'com.kodit.android.kodit',         // 신용보증기금
    
    // 카드사 앱
    'com.shinhancard.smartshinhan',    // 신한카드
    'com.kbcard.cxh.appcard',          // KB국민카드
    'com.wooricard.smartapp',          // 우리카드
    'com.hyundaicard.appcard',         // 현대카드
    'com.lottecard.lottecardapp',      // 롯데카드
    'com.hanafn.mobile.android',       // 하나카드
    'com.nhcard.nhappcard',            // NH농협카드
    'com.citimobilekorea.citibank',    // 씨티카드
    'com.sccard.smartpay',             // SC제일은행카드
    'com.samsungcard.webapp',          // 삼성카드
    'com.bccard.bcpay',                // BC카드
    'com.koreapost.mobile',            // 우체국카드
    'com.kdb.mobile.android',          // KDB산업은행
    
    // 증권사 앱
    'com.nhqv.app',                    // NH투자증권
    'com.kbsec.mobile.android',        // KB증권
    'com.shinhan.alphasecurities',     // 신한투자증권
    'com.miraeasset.trade',            // 미래에셋증권
    'com.daishin.mobile.android',      // 대신증권
    'com.yuantakorea.mobile',          // 유안타증권
    'com.kiwoom.hero2.mobile.android', // 키움증권
    'com.ibks.mobile.android',         // IBK투자증권
    'com.truefriend.mobile.android',   // 한국투자증권
    'com.hdsec.mobile.android',        // 현대차증권
    
    // 간편결제 앱
    'com.sktelecom.tmap.pay',          // 티맵페이
    'com.cjhelloworld.cjpay',          // CJ페이
    'com.mobilians.paypin',            // 페이핀
    'com.ssgpay.mobile.android',       // SSG페이
    'com.elevenst.pay',                // 11번가 페이
    'com.interpark.smartpay',          // 인터파크 페이
    'com.gmarket.gmoney',              // 지마켓 G페이
    'com.auction.aucpay'               // 옥션페이
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
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제|([^\d\s]+)에서\s+([\d,]+)원.*?결제|([^\d\s]+)\s+([\d,]+)원\s+결제/,
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
    },
    LG페이: {
      titlePattern: /LG페이|LG Pay/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    우리페이: {
      titlePattern: /우리페이|Woori Pay/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    KB페이: {
      titlePattern: /KB페이|KB Pay/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    신한페이판: {
      titlePattern: /신한|페이판/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    현대카드: {
      titlePattern: /현대카드|Hyundai Card/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    NH페이: {
      titlePattern: /NH페이|NH Pay|농협페이/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    롯데페이: {
      titlePattern: /롯데페이|Lotte Pay/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    하나페이: {
      titlePattern: /하나페이|Hana Pay/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    시티페이: {
      titlePattern: /시티|Citi/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    삼성카드: {
      titlePattern: /삼성카드|Samsung Card/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제|([^\d\s]+)에서\s+([\d,]+)원.*?승인/,
      type: 'expense' as const
    },
    BC카드: {
      titlePattern: /BC카드|BC Card/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제|([^\d\s]+)에서\s+([\d,]+)원.*?승인/,
      type: 'expense' as const
    },
    농협스마트뱅킹: {
      titlePattern: /농협|NH|스마트뱅킹/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?(?:입금|출금)|(?:입금|출금).*?([\d,]+)원.*?([^\d\s]+)/,
      type: 'expense' as const // 입금/출금 별도 판단 필요
    },
    KB스타뱅킹: {
      titlePattern: /KB|스타뱅킹/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?(?:입금|출금)|(?:입금|출금).*?([\d,]+)원/,
      type: 'expense' as const
    },
    신한쏠: {
      titlePattern: /신한|SOL|쏠/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?(?:입금|출금)|(?:입금|출금).*?([\d,]+)원/,
      type: 'expense' as const
    },
    우리원뱅킹: {
      titlePattern: /우리|원뱅킹/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?(?:입금|출금)|(?:입금|출금).*?([\d,]+)원/,
      type: 'expense' as const
    },
    하나원큐: {
      titlePattern: /하나|원큐|1Q/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?(?:입금|출금)|(?:입금|출금).*?([\d,]+)원/,
      type: 'expense' as const
    },
    IBK기업은행: {
      titlePattern: /IBK|기업은행/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?(?:입금|출금)|(?:입금|출금).*?([\d,]+)원/,
      type: 'expense' as const
    },
    SC제일은행: {
      titlePattern: /SC|제일은행/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?(?:입금|출금)|(?:입금|출금).*?([\d,]+)원/,
      type: 'expense' as const
    },
    우체국스마트뱅킹: {
      titlePattern: /우체국|포스트|epost/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?(?:입금|출금)|(?:입금|출금).*?([\d,]+)원/,
      type: 'expense' as const
    },
    DGB대구은행: {
      titlePattern: /DGB|대구은행/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?(?:입금|출금)|(?:입금|출금).*?([\d,]+)원/,
      type: 'expense' as const
    },
    BNK부산은행: {
      titlePattern: /BNK|부산은행/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?(?:입금|출금)|(?:입금|출금).*?([\d,]+)원/,
      type: 'expense' as const
    },
    수협은행: {
      titlePattern: /수협|SUHYUP/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?(?:입금|출금)|(?:입금|출금).*?([\d,]+)원/,
      type: 'expense' as const
    },
    새마을금고: {
      titlePattern: /새마을|KFCC/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?(?:입금|출금)|(?:입금|출금).*?([\d,]+)원/,
      type: 'expense' as const
    },
    티맵페이: {
      titlePattern: /티맵|TMAP/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    SSG페이: {
      titlePattern: /SSG|신세계/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?결제/,
      type: 'expense' as const
    },
    증권사알림: {
      titlePattern: /증권|투자|주식|매수|매도/i,
      textPattern: /([^\d\s]+).*?([\d,]+)원.*?(?:매수|매도)|(?:매수|매도).*?([\d,]+)원/,
      type: 'income' as const
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
      
      // 중복 체크
      const isDuplicate = await duplicateDetector.isDuplicate({
        amount: parsed.amount,
        merchant: parsed.merchant,
        type: parsed.type,
        timestamp: parsed.timestamp,
        source: 'notification'
      });

      if (isDuplicate) {
        console.log('중복 거래 감지됨, 스킵:', parsed.merchant, parsed.amount);
        return;
      }
      
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
          let merchant = '';
          let amountStr = '';
          
          // 토스의 다양한 패턴 처리
          if (serviceName === '토스') {
            if (textMatch[1] && textMatch[2]) {
              merchant = textMatch[1];
              amountStr = textMatch[2];
            } else if (textMatch[3] && textMatch[4]) {
              merchant = textMatch[3];
              amountStr = textMatch[4];
            } else if (textMatch[5] && textMatch[6]) {
              merchant = textMatch[5];
              amountStr = textMatch[6];
            }
          }
          // 농협, KB, 신한, 우리은행 패턴 처리
          else if (serviceName.includes('뱅킹') || serviceName.includes('스타') || serviceName.includes('쏠') || serviceName.includes('원뱅킹')) {
            if (textMatch[1] && textMatch[2]) {
              merchant = textMatch[1];
              amountStr = textMatch[2];
            } else if (textMatch[3] && textMatch[4]) {
              amountStr = textMatch[3];
              merchant = textMatch[4];
            }
          }
          // 일반 결제 서비스 패턴
          else {
            merchant = textMatch[1] || '알 수 없음';
            amountStr = textMatch[2];
          }
          
          if (!merchant || !amountStr) {
            continue; // 파싱 실패 시 다음 패턴 시도
          }
          
          const amount = parseInt(amountStr.replace(/,/g, ''));
          
          // 입금/출금 구분 (은행 앱의 경우)
          let type: 'income' | 'expense' = config.type;
          if (notification.text.includes('입금') || notification.text.includes('받은돈')) {
            type = 'income';
          } else if (notification.text.includes('출금') || notification.text.includes('결제') || notification.text.includes('송금')) {
            type = 'expense';
          }
          
          // 카테고리 자동 분류
          const category = this.categorizeByMerchant(merchant);
          
          return {
            service: serviceName,
            merchant: merchant.trim(),
            amount,
            type,
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