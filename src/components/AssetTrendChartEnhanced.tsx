import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, RefreshCw, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

interface AssetData {
  date: string;
  balance: number;
  formattedDate: string;
}

interface AssetTrendChartEnhancedProps {
  onDataRefresh?: () => void;
}

export const AssetTrendChartEnhanced = ({ onDataRefresh }: AssetTrendChartEnhancedProps) => {
  const { user } = useAuth();
  const { isMaster } = useUserRole();
  const [data, setData] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);  
  const [userFilter, setUserFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [users, setUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchUsers();
      fetchAccounts();
      fetchAssetTrend();
    }
  }, [user, userFilter, accountFilter]);

  const fetchUsers = async () => {
    if (!user || !isMaster) return;

    try {
      const { data: familyMembers } = await supabase
        .from('family_members')
        .select(`
          member_id,
          display_name,
          profiles!family_members_member_id_fkey(display_name, email)
        `)
        .eq('owner_id', user.id);

      const usersList = [
        { id: user.id, name: '나' },
        ...(familyMembers || []).map(member => ({
          id: member.member_id,
          name: member.display_name || 'Unknown'
        }))
      ];
      
      setUsers(usersList);
    } catch (error) {
      console.error('사용자 목록 조회 실패:', error);
    }
  };

  const fetchAccounts = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('account_balances')
        .select('account_name');

      if (isMaster && userFilter !== 'all') {
        query = query.eq('user_id', userFilter);
      } else if (!isMaster) {
        query = query.eq('user_id', user.id);
      }

      const { data } = await query;
      const uniqueAccounts = [...new Set(data?.map(item => item.account_name) || [])];
      setAccounts(uniqueAccounts);
    } catch (error) {
      console.error('계좌 목록 조회 실패:', error);
    }
  };

  const fetchAssetTrend = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // 계좌 잔액 조회
      let accountQuery = supabase
        .from('account_balances')
        .select('*')
        .order('last_updated', { ascending: false });

      if (isMaster && userFilter !== 'all') {
        accountQuery = accountQuery.eq('user_id', userFilter);
      } else if (!isMaster) {
        accountQuery = accountQuery.eq('user_id', user.id);
      }

      if (accountFilter !== 'all') {
        accountQuery = accountQuery.eq('account_name', accountFilter);
      }

      const { data: accountBalances, error: accountError } = await accountQuery;
      if (accountError) throw accountError;

      // 잔액 스냅샷 조회 (최근 30일)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      let snapshotQuery = supabase
        .from('balance_snapshots')
        .select('*')
        .gte('snapshot_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('snapshot_date', { ascending: true });

      if (isMaster && userFilter !== 'all') {
        snapshotQuery = snapshotQuery.eq('user_id', userFilter);
      } else if (!isMaster) {
        snapshotQuery = snapshotQuery.eq('user_id', user.id);
      }

      const { data: snapshots, error: snapshotError } = await snapshotQuery;
      if (snapshotError) throw snapshotError;

      const chartData: AssetData[] = [];
      
      // 스냅샷 데이터 처리
      snapshots?.forEach(snapshot => {
        let totalBalance = Number(snapshot.total_balance);
        
        // 계좌 필터가 적용된 경우 해당 계좌만 합산
        if (accountFilter !== 'all') {
          const accountDetails = snapshot.account_details as any[] || [];
          totalBalance = accountDetails
            .filter(account => account.account_name === accountFilter)
            .reduce((sum, account) => sum + Number(account.balance || 0), 0);
        }
        
        const formattedDate = new Date(snapshot.snapshot_date).toLocaleDateString('ko-KR', {
          year: '2-digit',
          month: 'short',
          day: 'numeric'
        });
        
        chartData.push({
          date: snapshot.snapshot_date,
          balance: totalBalance,
          formattedDate
        });
      });

      // 최신 계좌 잔액도 추가 (스냅샷에 없는 경우)
      if (accountBalances && accountBalances.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const hasToday = chartData.some(item => item.date === today);
        
        if (!hasToday) {
          const totalBalance = accountBalances
            .filter(account => account.account_type !== 'card')
            .reduce((sum, account) => sum + Number(account.balance), 0);
          
          chartData.push({
            date: today,
            balance: totalBalance,
            formattedDate: new Date().toLocaleDateString('ko-KR', {
              year: '2-digit',
              month: 'short',
              day: 'numeric'
            })
          });
        }
      }

      // 날짜순으로 정렬
      chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setData(chartData);
      onDataRefresh?.();
    } catch (error) {
      console.error('자산 변동 추이 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAssetTrend();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            자산 변동 추이
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {/* 필터 */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          {isMaster && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">사용자:</span>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {!isMaster && <Filter className="h-4 w-4 text-muted-foreground" />}
            <span className="text-sm text-muted-foreground">계좌:</span>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="계좌 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 계좌</SelectItem>
                {accounts.map(account => (
                  <SelectItem key={account} value={account}>
                    {account}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-[200px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              아직 잔액 기록이 없습니다.
              <br />
              잔액 화면에서 계좌 잔액을 등록해보세요.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="formattedDate" 
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), '잔액']}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="balance" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2, fill: 'hsl(var(--background))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};