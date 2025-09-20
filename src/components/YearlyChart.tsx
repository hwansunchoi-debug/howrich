import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Calendar, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export const YearlyChart = () => {
  const { user } = useAuth();
  const [data, setData] = useState<MonthlyData[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchYearlyData();
    }
  }, [user, selectedYear]);

  const fetchYearlyData = async () => {
    if (!user) return;
    
    setLoading(true);
    
    const monthlyData: MonthlyData[] = [];
    
    for (let month = 1; month <= 12; month++) {
      const startDate = `${selectedYear}-${month.toString().padStart(2, '0')}-01`;
      const endDate = month === 12 
        ? `${selectedYear + 1}-01-01` 
        : `${selectedYear}-${(month + 1).toString().padStart(2, '0')}-01`;
      
      // 월별 수입 조회
      const { data: incomeData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'income')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lt('date', endDate);
      
      // 월별 지출 조회
      const { data: expenseData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'expense')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lt('date', endDate);
      
      const totalIncome = incomeData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalExpense = expenseData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      
      monthlyData.push({
        month: `${month}월`,
        income: totalIncome,
        expense: totalExpense,
        net: totalIncome - totalExpense
      });
    }
    
    setData(monthlyData);
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return `${(value / 10000).toFixed(0)}만원`;
  };

  const years = Array.from({ length: 5 }, (_, i) => ({
    value: new Date().getFullYear() - i,
    label: `${new Date().getFullYear() - i}년`
  }));

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            연간 수입/지출 현황
          </CardTitle>
        </div>
        <Select
          value={selectedYear.toString()}
          onValueChange={(value) => setSelectedYear(Number(value))}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year.value} value={year.value.toString()}>
                {year.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            데이터를 불러오는 중...
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  className="text-muted-foreground"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  className="text-muted-foreground"
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatCurrency}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString()}원`,
                    name === 'income' ? '수입' : name === 'expense' ? '지출' : '순수익'
                  ]}
                  labelFormatter={(label) => `${selectedYear}년 ${label}`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend 
                  formatter={(value) => 
                    value === 'income' ? '수입' : value === 'expense' ? '지출' : '순수익'
                  }
                />
                <Bar 
                  dataKey="income" 
                  fill="hsl(var(--chart-1))" 
                  name="income"
                  radius={[2, 2, 0, 0]}
                />
                <Bar 
                  dataKey="expense" 
                  fill="hsl(var(--chart-2))" 
                  name="expense"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};