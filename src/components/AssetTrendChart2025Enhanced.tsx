import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { TrendingUp, RefreshCw, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

interface AssetData {
  name: string;
  value: number;
  color: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

export const AssetTrendChart2025Enhanced = () => {
  const { user } = useAuth();
  const { isMaster } = useUserRole();
  const [chartData, setChartData] = useState<AssetData[]>([]);
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
      fetchAssetData();
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

  const fetchAssetData = async () => {
    if (!user) return;

    setLoading(true);
    
    try {
      let query = supabase
        .from('balance_snapshots')
        .select('*')
        .gte('snapshot_date', '2025-01-01')
        .lte('snapshot_date', '2025-12-31')
        .order('snapshot_date', { ascending: false })
        .limit(1);

      if (isMaster && userFilter !== 'all') {
        query = query.eq('user_id', userFilter);
      } else if (!isMaster) {
        query = query.eq('user_id', user.id);
      }

      const { data: snapshots } = await query;

      if (snapshots && snapshots.length > 0) {
        const latestSnapshot = snapshots[0];
        let accountDetails = latestSnapshot.account_details as any[] || [];

        // 계좌 필터 적용
        if (accountFilter !== 'all') {
          accountDetails = accountDetails.filter(account => account.account_name === accountFilter);
        }

        // 계좌 유형별로 그룹화
        const groupedData = accountDetails.reduce((acc, account) => {
          const type = account.account_type || 'bank';
          const typeName = getAccountTypeLabel(type);
          
          if (!acc[typeName]) {
            acc[typeName] = 0;
          }
          acc[typeName] += Number(account.balance || 0);
          return acc;
        }, {} as Record<string, number>);

        const chartData = Object.entries(groupedData)
          .filter(([_, value]) => value > 0)
          .map(([name, value], index) => ({
            name,
            value,
            color: COLORS[index % COLORS.length]
          }));

        setChartData(chartData);
      } else {
        // 스냅샷이 없으면 최신 잔액 조회
        let balanceQuery = supabase
          .from('account_balances')
          .select('*');

        if (isMaster && userFilter !== 'all') {
          balanceQuery = balanceQuery.eq('user_id', userFilter);
        } else if (!isMaster) {
          balanceQuery = balanceQuery.eq('user_id', user.id);
        }

        if (accountFilter !== 'all') {
          balanceQuery = balanceQuery.eq('account_name', accountFilter);
        }

        const { data: balances } = await balanceQuery;

        const groupedData = (balances || []).reduce((acc, account) => {
          const type = account.account_type || 'bank';
          const typeName = getAccountTypeLabel(type);
          
          if (!acc[typeName]) {
            acc[typeName] = 0;
          }
          acc[typeName] += Number(account.balance || 0);
          return acc;
        }, {} as Record<string, number>);

        const chartData = Object.entries(groupedData)
          .filter(([_, value]) => value > 0)
          .map(([name, value], index) => ({
            name,
            value,
            color: COLORS[index % COLORS.length]
          }));

        setChartData(chartData);
      }
    } catch (error) {
      console.error('자산 데이터 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAccountTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      bank: '은행',
      card: '카드',
      investment: '투자/증권',
      pay: '간편결제',
      crypto: '암호화폐'
    };
    return labels[type] || type;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAssetData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatCurrency = (value: number) => {
    return `${(value / 10000).toFixed(0)}만원`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-primary font-semibold">
            {data.value.toLocaleString()}원
          </p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(data.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            2025년 자산 현황
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        {/* 필터 */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          {isMaster && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
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
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-80">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mb-4" />
            <p>표시할 자산 데이터가 없습니다.</p>
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  formatter={(value, entry: any) => 
                    `${value} (${formatCurrency(entry.payload.value)})`
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};