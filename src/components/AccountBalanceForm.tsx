import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Wallet, Plus, Trash2, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AccountBalance {
  id: string;
  accountName: string;
  accountType: 'bank' | 'card' | 'investment' | 'pay' | 'crypto';
  balance: number;
}

interface AccountBalanceFormProps {
  onComplete: () => void;
}

const accountTypeLabels = {
  bank: '은행',
  card: '카드',
  investment: '투자/증권',
  pay: '간편결제',
  crypto: '암호화폐'
};

const accountTypeColors = {
  bank: 'bg-blue-100 text-blue-800',
  card: 'bg-purple-100 text-purple-800', 
  investment: 'bg-green-100 text-green-800',
  pay: 'bg-orange-100 text-orange-800',
  crypto: 'bg-yellow-100 text-yellow-800'
};

export const AccountBalanceForm: React.FC<AccountBalanceFormProps> = ({ onComplete }) => {
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [newAccount, setNewAccount] = useState({
    accountName: '',
    accountType: '' as AccountBalance['accountType'],
    balance: 0
  });
  const [isSaving, setIsSaving] = useState(false);

  const addAccount = () => {
    if (!newAccount.accountName || !newAccount.accountType) {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "계좌명과 계좌 종류를 모두 입력해주세요."
      });
      return;
    }

    // 중복 계좌 확인
    const duplicate = accounts.find(
      acc => acc.accountName === newAccount.accountName && acc.accountType === newAccount.accountType
    );
    
    if (duplicate) {
      toast({
        variant: "destructive",
        title: "중복 계좌",
        description: "이미 등록된 계좌입니다."
      });
      return;
    }

    const account: AccountBalance = {
      id: Date.now().toString(),
      ...newAccount
    };

    setAccounts([...accounts, account]);
    setNewAccount({
      accountName: '',
      accountType: '' as AccountBalance['accountType'],
      balance: 0
    });

    toast({
      title: "계좌 추가됨",
      description: `${account.accountName}이 추가되었습니다.`
    });
  };

  const removeAccount = (id: string) => {
    setAccounts(accounts.filter(acc => acc.id !== id));
  };

  const saveAllAccounts = async () => {
    if (accounts.length === 0) {
      toast({
        variant: "destructive",
        title: "계좌 없음",
        description: "최소 1개 이상의 계좌를 등록해주세요."
      });
      return;
    }

    setIsSaving(true);
    
    try {
      // 현재 사용자 ID 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('사용자가 로그인되어 있지 않습니다.');
      }

      // 모든 계좌 정보를 데이터베이스에 저장
      const accountData = accounts.map(account => ({
        user_id: user.id,  // 현재 사용자 ID 추가
        account_name: account.accountName,
        account_type: account.accountType,
        balance: account.balance,
        source: 'manual'
      }));

      const { error } = await supabase
        .from('account_balances')
        .insert(accountData);

      if (error) {
        throw error;
      }

      toast({
        title: "저장 완료",
        description: `${accounts.length}개 계좌의 잔액 정보가 저장되었습니다.`
      });

      onComplete();
    } catch (error) {
      console.error('계좌 정보 저장 실패:', error);
      toast({
        variant: "destructive",
        title: "저장 실패",
        description: error instanceof Error ? error.message : "계좌 정보 저장 중 오류가 발생했습니다."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getTotalBalance = () => {
    return accounts
      .filter(acc => acc.accountType !== 'card') // 카드는 제외 (마이너스 잔액일 수 있음)
      .reduce((sum, acc) => sum + acc.balance, 0);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          계좌 잔액 입력
        </CardTitle>
        <CardDescription>
          현재 보유하고 있는 모든 계좌의 잔액을 입력하여 정확한 자산 현황을 파악하세요.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* 새 계좌 추가 폼 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/50">
          <div>
            <Label htmlFor="accountName">계좌명</Label>
            <Input
              id="accountName"
              placeholder="예: 우리은행 주거래"
              value={newAccount.accountName}
              onChange={(e) => setNewAccount({...newAccount, accountName: e.target.value})}
            />
          </div>
          
          <div>
            <Label htmlFor="accountType">계좌 종류</Label>
            <Select
              value={newAccount.accountType}
              onValueChange={(value: AccountBalance['accountType']) => 
                setNewAccount({...newAccount, accountType: value})
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(accountTypeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="balance">잔액 (원)</Label>
            <Input
              id="balance"
              type="number"
              placeholder="0"
              value={newAccount.balance || ''}
              onChange={(e) => setNewAccount({...newAccount, balance: Number(e.target.value)})}
            />
          </div>
          
          <div className="flex items-end">
            <Button onClick={addAccount} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              추가
            </Button>
          </div>
        </div>

        {/* 등록된 계좌 목록 */}
        {accounts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">등록된 계좌 ({accounts.length}개)</h3>
              <div className="text-sm text-muted-foreground">
                총 자산: <span className="font-semibold text-primary">
                  {getTotalBalance().toLocaleString()}원
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge className={accountTypeColors[account.accountType]}>
                      {accountTypeLabels[account.accountType]}
                    </Badge>
                    <span className="font-medium">{account.accountName}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      {account.balance.toLocaleString()}원
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAccount(account.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {accounts.length === 0 && (
          <Alert>
            <Wallet className="h-4 w-4" />
            <AlertDescription>
              현재 등록된 계좌가 없습니다. 위 폼을 사용하여 계좌를 추가해주세요.
            </AlertDescription>
          </Alert>
        )}

        {/* 저장 버튼 */}
        <div className="flex gap-3 pt-4 border-t">
          <Button 
            onClick={saveAllAccounts}
            disabled={isSaving || accounts.length === 0}
            className="flex-1"
          >
            {isSaving ? (
              "저장 중..."
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                {accounts.length}개 계좌 저장
              </>
            )}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={onComplete}
            disabled={isSaving}
          >
            나중에 입력하기
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};