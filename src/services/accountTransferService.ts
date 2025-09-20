import { supabase } from "@/integrations/supabase/client";

interface FamilyAccountInfo {
  user_id: string;
  account_number: string;
  account_name: string;
  display_name: string;
}

export class AccountTransferService {
  private static familyAccounts: FamilyAccountInfo[] = [];
  private static lastFetch = 0;
  private static CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시

  /**
   * 현재 사용자와 가족 구성원들의 모든 계좌번호를 조회
   */
  static async getFamilyAccounts(userId: string): Promise<FamilyAccountInfo[]> {
    const now = Date.now();
    
    // 캐시가 유효하면 캐시된 데이터 반환
    if (this.familyAccounts.length > 0 && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.familyAccounts;
    }

    try {
      // 현재 사용자의 계좌들
      const { data: userAccounts } = await supabase
        .from('account_balances')
        .select(`
          account_number,
          account_name,
          user_id
        `)
        .eq('user_id', userId)
        .not('account_number', 'is', null);

      // 사용자 프로필 조회
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', userId)
        .single();

      const allAccounts: FamilyAccountInfo[] = [];

      // 현재 사용자 계좌 추가
      if (userAccounts && userProfile) {
        userAccounts.forEach(account => {
          if (account.account_number) {
            allAccounts.push({
              user_id: account.user_id,
              account_number: account.account_number,
              account_name: account.account_name,
              display_name: userProfile.display_name
            });
          }
        });
      }

      // 가족 구성원들의 계좌들 조회
      const { data: familyMembers } = await supabase
        .from('family_members')
        .select('member_id, owner_id')
        .or(`owner_id.eq.${userId},member_id.eq.${userId}`);

      if (familyMembers) {
        for (const member of familyMembers) {
          const memberId = member.member_id === userId ? member.owner_id : member.member_id;
          
          // 가족 구성원 계좌 조회
          const { data: memberAccounts } = await supabase
            .from('account_balances')
            .select('account_number, account_name, user_id')
            .eq('user_id', memberId)
            .not('account_number', 'is', null);

          // 가족 구성원 프로필 조회
          const { data: memberProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', memberId)
            .single();

          if (memberAccounts && memberProfile) {
            memberAccounts.forEach(account => {
              if (account.account_number) {
                allAccounts.push({
                  user_id: account.user_id,
                  account_number: account.account_number,
                  account_name: account.account_name,
                  display_name: memberProfile.display_name
                });
              }
            });
          }
        }
      }

      // 중복 제거
      this.familyAccounts = allAccounts.filter((account, index, self) => 
        index === self.findIndex(a => a.account_number === account.account_number)
      );

      this.lastFetch = now;
      return this.familyAccounts;
    } catch (error) {
      console.error('가족 계좌 조회 실패:', error);
      return [];
    }
  }

  /**
   * 주어진 계좌번호가 가족 계좌인지 확인
   */
  static async isFamilyAccount(accountNumber: string, userId: string): Promise<boolean> {
    const familyAccounts = await this.getFamilyAccounts(userId);
    return familyAccounts.some(account => 
      this.normalizeAccountNumber(account.account_number) === this.normalizeAccountNumber(accountNumber)
    );
  }

  /**
   * SMS 내용에서 계좌번호를 추출
   */
  static extractAccountNumber(smsContent: string): string | null {
    // 계좌번호 패턴들 (은행별로 다를 수 있음)
    const patterns = [
      /계좌\s*(\d{3,4}-\d{2,6}-\d{4,8})/,  // 일반적인 계좌번호 패턴
      /(\d{3,4}-\d{2,6}-\d{4,8})/,          // 계좌번호만
      /받는분계좌\s*(\d{3,4}-\d{2,6}-\d{4,8})/,
      /보내는분계좌\s*(\d{3,4}-\d{2,6}-\d{4,8})/,
      /입금계좌\s*(\d{3,4}-\d{2,6}-\d{4,8})/,
      /출금계좌\s*(\d{3,4}-\d{2,6}-\d{4,8})/
    ];

    for (const pattern of patterns) {
      const match = smsContent.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * 계좌번호 정규화 (비교를 위해)
   */
  private static normalizeAccountNumber(accountNumber: string): string {
    return accountNumber.replace(/[-\s]/g, '');
  }

  /**
   * 거래가 가족간 이체인지 판단
   */
  static async isInternalTransfer(smsContent: string, userId: string): Promise<{
    isInternal: boolean;
    targetAccount?: string;
    targetOwner?: string;
  }> {
    // 이체/송금 키워드 확인
    const transferKeywords = ['이체', '송금', '입금', '받은돈', '보낸돈'];
    const hasTransferKeyword = transferKeywords.some(keyword => smsContent.includes(keyword));
    
    if (!hasTransferKeyword) {
      return { isInternal: false };
    }

    // SMS에서 계좌번호 추출
    const accountNumber = this.extractAccountNumber(smsContent);
    if (!accountNumber) {
      return { isInternal: false };
    }

    // 가족 계좌인지 확인
    const familyAccounts = await this.getFamilyAccounts(userId);
    const targetAccount = familyAccounts.find(account => 
      this.normalizeAccountNumber(account.account_number) === this.normalizeAccountNumber(accountNumber)
    );

    if (targetAccount) {
      return {
        isInternal: true,
        targetAccount: accountNumber,
        targetOwner: targetAccount.display_name
      };
    }

    return { isInternal: false };
  }

  /**
   * 캐시 초기화 (계좌 정보가 변경되었을 때 호출)
   */
  static clearCache(): void {
    this.familyAccounts = [];
    this.lastFetch = 0;
  }
}

export const accountTransferService = AccountTransferService;