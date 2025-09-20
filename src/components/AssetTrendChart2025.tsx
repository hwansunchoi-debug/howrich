import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { TrendingUp, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AssetData {
  date: string;
  총자산: number;
}

interface AssetTrendChart2025Props {
  onDataRefresh?: () => void;
}

export const AssetTrendChart2025 = ({ onDataRefresh }: AssetTrendChart2025Props) => {
  const { user } = useAuth();
  const [chartData, setChartData] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (onDataRefresh) {
      await onDataRefresh();
    }
    fetchAssetData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  useEffect(() => {
    if (user) {
      fetchAssetData();
    }
  }, [user]);

  const fetchAssetData = async () => {
    if (!user) return;

    try {
      // 먼저 account_balances에서 2025년 데이터 조회
      const { data: accountBalances, error: accountError } = await supabase
        .from('account_balances')
        .select('balance, last_updated, account_name')
        .eq('user_id', user.id)
        .gte('last_updated', '2025-01-01')
        .lt('last_updated', '2026-01-01')
        .order('last_updated', { ascending: true });

      // balance_snapshots에서도 데이터 조회
      const { data: snapshots, error: snapshotError } = await supabase
        .from('balance_snapshots')
        .select('snapshot_date, total_balance')
        .eq('user_id', user.id)
        .gte('snapshot_date', '2025-01-01')
        .lt('snapshot_date', '2026-01-01')
        .order('snapshot_date', { ascending: true });

      if (accountError && snapshotError) {
        throw accountError;
      }

      let formattedData: AssetData[] = [];

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

        formattedData = Object.entries(groupedByDate).map(([date, totalBalance]) => ({
          date: new Date(date).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric'
          }),
          총자산: totalBalance
        }));
      }
      // 없으면 balance_snapshots 사용
      else if (snapshots && snapshots.length > 0) {
        formattedData = snapshots.map(snapshot => ({
          date: new Date(snapshot.snapshot_date).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric'
          }),
          총자산: Number(snapshot.total_balance)
        }));
      }

      setChartData(formattedData);
    } catch (error) {
      console.error('자산 데이터 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    총자산: {
      label: "총자산",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      notation: 'compact',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span>2025년 자산 현황</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          시점별 자산 현황 추이
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-[300px]">
            <div className="text-muted-foreground">차트를 불러오는 중...</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px]">
            <div className="text-center text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>자산 데이터가 없습니다.</p>
              <p className="text-sm">잔액 관리에서 데이터를 추가해주세요.</p>
            </div>
          </div>
        ) : (
          <ChartContainer config={chartConfig}>
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={formatCurrency}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent />}
                formatter={(value) => [formatCurrency(Number(value)), "총자산"]}
              />
              <Bar
                dataKey="총자산"
                fill="var(--color-총자산)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};