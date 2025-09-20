import { useState, useEffect } from "react";
import { TrendingUp, Calendar, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AssetData {
  date: string;
  balance: number;
  formattedDate: string;
}

export const AssetTrendChart = () => {
  const { user } = useAuth();
  const [data, setData] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    fetchAssetTrend();
    setTimeout(() => setRefreshing(false), 1000);
  };

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
          name: member.display_name || member.profiles?.display_name || member.profiles?.email
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
      // 먼저 account_balances에서 데이터 조회
      const { data: accountBalances, error: accountError } = await supabase
        .from('account_balances')
        .select('balance, last_updated, account_name')
        .eq('user_id', user.id)
        .order('last_updated', { ascending: true });

      // balance_snapshots에서도 데이터 조회
      const { data: snapshots, error: snapshotError } = await supabase
        .from('balance_snapshots')
        .select('snapshot_date, total_balance')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: true })
        .limit(12);

      if (accountError && snapshotError) {
        throw accountError;
      }

      let chartData: AssetData[] = [];

      // account_balances 데이터가 있으면 사용
      if (accountBalances && accountBalances.length > 0) {
        const groupedByDate = accountBalances.reduce((acc, balance) => {
          const date = balance.last_updated.split('T')[0];
          if (!acc[date]) {
            acc[date] = 0;
          }
          acc[date] += Number(balance.balance);
          return acc;
        }, {} as Record<string, number>);

        chartData = Object.entries(groupedByDate).map(([date, totalBalance]) => ({
          date,
          balance: totalBalance,
          formattedDate: new Date(date).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric'
          })
        }));
      } 
      // 없으면 balance_snapshots 사용
      else if (snapshots && snapshots.length > 0) {
        chartData = snapshots.map(snapshot => ({
          date: snapshot.snapshot_date,
          balance: Number(snapshot.total_balance),
          formattedDate: new Date(snapshot.snapshot_date).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric'
          })
        }));
      }

      setData(chartData);
    } catch (error) {
      console.error('자산 변동 데이터 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            자산 변동 추이
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            자산 변동 추이
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              아직 잔액 기록이 없습니다.
              <br />
              잔액 화면에서 계좌 잔액을 등록해보세요.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            자산 변동 추이
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
};