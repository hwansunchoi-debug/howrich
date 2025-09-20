import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Wallet, PlusCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AccountBalance {
  id: string;
  account_name: string;
  account_type: string;
  balance: number;
  last_updated: string;
  source: string;
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

export default function BalanceDetails() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalBalance, setTotalBalance] = useState(0);

  useEffect(() => {
    if (user) {
      fetchAccountBalances();
    }
  }, [user]);

  const fetchAccountBalances = async () => {
    try {
      const { data, error } = await supabase
        .from('account_balances')
        .select('*')
        .eq('user_id', user?.id)
        .order('last_updated', { ascending: false });

      if (error) throw error;

      setAccounts(data || []);
      
      // 카드는 제외하고 총 잔액 계산 (마이너스 잔액일 수 있음)
      const total = (data || [])
        .filter(acc => acc.account_type !== 'card')
        .reduce((sum, acc) => sum + Number(acc.balance), 0);
      setTotalBalance(total);
    } catch (error) {
      console.error('계좌 잔액 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatLastUpdated = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAccountTypeColor = (type: string) => {
    return accountTypeColors[type as keyof typeof accountTypeColors] || 'bg-gray-100 text-gray-800';
  };

  const getAccountTypeLabel = (type: string) => {
    return accountTypeLabels[type as keyof typeof accountTypeLabels] || type;
  };

  const groupedAccounts = accounts.reduce((groups, account) => {
    const type = account.account_type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(account);
    return groups;
  }, {} as Record<string, AccountBalance[]>);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Wallet className="h-6 w-6 text-blue-500" />
              <h1 className="text-2xl font-bold">계좌 잔액</h1>
            </div>
          </div>
          <Button variant="outline" onClick={fetchAccountBalances} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>

        {/* 총 자산 요약 */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                총 자산 (카드 제외)
              </p>
              <p className="text-3xl font-bold text-blue-600">
                {totalBalance.toLocaleString()}원
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                총 {accounts.length}개 계좌
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 계좌별 잔액 */}
        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">불러오는 중...</p>
              </div>
            </CardContent>
          </Card>
        ) : accounts.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">등록된 계좌가 없습니다.</p>
                <Button onClick={() => navigate('/')}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  계좌 추가하기
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAccounts).map(([type, accountList]) => (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge className={getAccountTypeColor(type)}>
                      {getAccountTypeLabel(type)}
                    </Badge>
                    <span className="text-sm font-normal text-muted-foreground">
                      {accountList.length}개 계좌
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {accountList.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{account.account_name}</p>
                            <Badge variant="outline" className="text-xs">
                              {account.source === 'manual' ? '수동입력' : 'SMS'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            업데이트: {formatLastUpdated(account.last_updated)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg">
                            {Number(account.balance).toLocaleString()}원
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* 카테고리별 소계 */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-muted-foreground">
                        {getAccountTypeLabel(type)} 소계
                      </span>
                      <span className="font-bold">
                        {accountList.reduce((sum, acc) => sum + Number(acc.balance), 0).toLocaleString()}원
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}