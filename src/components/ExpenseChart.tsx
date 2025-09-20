import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, RefreshCw } from "lucide-react";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface ChartData {
  name: string;
  value: number;
  fill: string;
}

interface ExpenseChartProps {
  onDataRefresh: () => void;
}

export const ExpenseChart = ({ onDataRefresh }: ExpenseChartProps) => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (onDataRefresh) {
      await onDataRefresh();
    }
    // 차트 데이터도 새로고침
    fetchExpenseData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  useEffect(() => {
    fetchExpenseData();
  }, []);

  const fetchExpenseData = async () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        amount,
        categories (
          name,
          color
        )
      `)
      .eq('type', 'expense')
      .gte('date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
      .lt('date', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`);

    if (error) {
      console.error('지출 데이터 조회 실패:', error);
      setLoading(false);
      return;
    }

    // 카테고리별로 데이터 그룹화
    const categoryData: { [key: string]: { amount: number; color: string } } = {};
    
    data?.forEach((transaction) => {
      const categoryName = transaction.categories?.name || '기타';
      const categoryColor = transaction.categories?.color || '#6b7280';
      
      if (!categoryData[categoryName]) {
        categoryData[categoryName] = { amount: 0, color: categoryColor };
      }
      
      categoryData[categoryName].amount += Number(transaction.amount);
    });

    // 차트 데이터 형식으로 변환
    const formattedData: ChartData[] = Object.entries(categoryData)
      .map(([name, data]) => ({
        name,
        value: data.amount,
        fill: data.color,
      }))
      .sort((a, b) => b.value - a.value);

    setChartData(formattedData);
    setLoading(false);
  };

  const chartConfig = {
    value: {
      label: "금액",
    },
  } satisfies ChartConfig;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span>이번 달 카테고리별 지출</span>
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
          지출 내역을 카테고리별로 분석
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {loading ? (
          <div className="flex items-center justify-center h-[300px]">
            <div className="text-muted-foreground">차트를 불러오는 중...</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px]">
            <div className="text-muted-foreground">지출 데이터가 없습니다.</div>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[300px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardContent>
        <div className="space-y-2">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.fill }}
                />
                <span>{item.name}</span>
              </div>
              <span className="font-medium">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};