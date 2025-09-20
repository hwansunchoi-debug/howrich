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
      fetchAssetTrend();
    }
  }, [user]);

  const fetchAssetTrend = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: snapshots, error } = await supabase
        .from('balance_snapshots')
        .select('snapshot_date, total_balance')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: true })
        .limit(12); // 최근 12개 데이터포인트

      if (error) throw error;

      const chartData = (snapshots || []).map(snapshot => ({
        date: snapshot.snapshot_date,
        balance: Number(snapshot.total_balance),
        formattedDate: new Date(snapshot.snapshot_date).toLocaleDateString('ko-KR', {
          month: 'short',
          day: 'numeric'
        })
      }));

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