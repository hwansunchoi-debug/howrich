import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, RefreshCw, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export const YearlyChart = () => {
  const { user } = useAuth();
  const { isMaster } = useUserRole();
  const [data, setData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [refreshing, setRefreshing] = useState(false);
  const [userFilter, setUserFilter] = useState<string>('all');
  const [users, setUsers] = useState<any[]>([]);
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [categories, setCategories] = useState<any[]>([]);
  const [monthlyAverage, setMonthlyAverage] = useState<number>(0);

  const handleRefresh = async () => {
    setRefreshing(true);
    fetchYearlyData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  useEffect(() => {
    if (user) {
      fetchUsers();
      fetchCategories();
      fetchYearlyData();
    }
  }, [user, selectedYear, userFilter, categoryTypeFilter, categoryFilter]);

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

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${user?.id}`)
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      
      // 중복 카테고리 제거 (이름과 타입 기준으로, 사용자 카테고리 우선)
      const uniqueCategories = data?.reduce((acc: any[], current: any) => {
        const existing = acc.find(cat => cat.name === current.name && cat.type === current.type);
        if (!existing) {
          acc.push(current);
        } else if (current.user_id && !existing.user_id) {
          // 사용자 카테고리가 기본 카테고리보다 우선
          const index = acc.findIndex(cat => cat.name === current.name && cat.type === current.type);
          acc[index] = current;
        }
        return acc;
      }, []) || [];
      
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('카테고리 조회 실패:', error);
    }
  };

  const fetchYearlyData = async () => {
    if (!user) return;
    
    setLoading(true);
    
    const monthlyData: MonthlyData[] = [];
    let totalExpenseSum = 0;
    let monthsWithExpenses = 0;
    
    for (let month = 1; month <= 12; month++) {
      const startDate = `${selectedYear}-${month.toString().padStart(2, '0')}-01`;
      const endDate = month === 12 
        ? `${selectedYear + 1}-01-01` 
        : `${selectedYear}-${(month + 1).toString().padStart(2, '0')}-01`;
      
      // 사용자 필터 적용
      const targetUserId = isMaster && userFilter !== 'all' ? userFilter : user.id;
      
      // 월별 수입 조회 (기타 카테고리 제외)
      let incomeQuery = supabase
        .from('transactions')
        .select(`
          amount,
          categories!inner(id, name, type)
        `)
        .eq('type', 'income')
        .neq('categories.type', 'other')
        .gte('date', startDate)
        .lt('date', endDate);

      if (isMaster && userFilter !== 'all') {
        incomeQuery = incomeQuery.eq('user_id', userFilter);
      } else if (!isMaster || userFilter === 'all') {
        incomeQuery = incomeQuery.eq('user_id', user.id);
      }

      // 대분류 필터 적용 (기타 제외)
      if (categoryTypeFilter !== 'all' && categoryTypeFilter !== 'other') {
        incomeQuery = incomeQuery.eq('categories.type', categoryTypeFilter);
      }

      // 카테고리 필터 적용
      if (categoryFilter !== 'all') {
        incomeQuery = incomeQuery.eq('categories.id', categoryFilter);
      }

      const { data: incomeData } = await incomeQuery;
      
      // 월별 지출 조회 (기타 카테고리 제외)
      let expenseQuery = supabase
        .from('transactions')
        .select(`
          amount,
          categories!inner(id, name, type)
        `)
        .eq('type', 'expense')
        .neq('categories.type', 'other')
        .gte('date', startDate)
        .lt('date', endDate);

      if (isMaster && userFilter !== 'all') {
        expenseQuery = expenseQuery.eq('user_id', userFilter);
      } else if (!isMaster || userFilter === 'all') {
        expenseQuery = expenseQuery.eq('user_id', user.id);
      }

      // 대분류 필터 적용 (지출 데이터에만, 기타 제외)
      if (categoryTypeFilter !== 'all' && categoryTypeFilter !== 'income' && categoryTypeFilter !== 'other') {
        expenseQuery = expenseQuery.eq('categories.type', categoryTypeFilter);
      }

      // 카테고리 필터 적용
      if (categoryFilter !== 'all') {
        expenseQuery = expenseQuery.eq('categories.id', categoryFilter);
      }

      const { data: expenseData } = await expenseQuery;
      
      const totalIncome = incomeData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalExpense = expenseData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      
      // 2025년 월 평균 지출액 계산을 위해 누적
      if (selectedYear === 2025 && totalExpense > 0) {
        totalExpenseSum += totalExpense;
        monthsWithExpenses++;
      }
      
      monthlyData.push({
        month: `${month}월`,
        income: totalIncome,
        expense: totalExpense,
        net: totalIncome - totalExpense
      });
    }
    
    // 2025년 월 평균 지출액 계산
    if (selectedYear === 2025) {
      const currentMonth = new Date().getMonth() + 1;
      const monthsToCalculate = currentMonth > 12 ? 12 : currentMonth;
      const averageExpense = monthsWithExpenses > 0 ? totalExpenseSum / monthsToCalculate : 0;
      setMonthlyAverage(averageExpense);
    } else {
      setMonthlyAverage(0);
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
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {selectedYear}년 월별 수입/지출 현황
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
        <div className="flex items-center gap-2">
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
        </div>
      </CardHeader>
      
      {/* 필터 및 월 평균 지출액 */}
      <div className="px-6 pb-4 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">필터 및 검색</span>
        </div>
        
        <div className="grid gap-4 md:grid-cols-4">
          {/* 사용자 필터 (마스터만) */}
          {isMaster && (
            <div className="space-y-2">
              <label className="text-sm font-medium">사용자</label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger>
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

          {/* 대분류 필터 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">대분류</label>
            <Select value={categoryTypeFilter} onValueChange={setCategoryTypeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="income">수입</SelectItem>
                <SelectItem value="expense">지출</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 카테고리 필터 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">카테고리</label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {categories
                  .filter(category => 
                    (categoryTypeFilter === 'all' || category.type === categoryTypeFilter) &&
                    category.type !== 'other'
                  )
                  .map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {selectedYear === 2025 && monthlyAverage > 0 && (
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">2025년 월 평균 지출액</span>
              <span className="text-lg font-bold text-destructive">
                {Math.floor(monthlyAverage).toLocaleString()}원
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              ({formatCurrency(monthlyAverage)})
            </div>
          </div>
        )}
      </div>
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
                  fill="#3B82F6" 
                  name="income"
                  radius={[2, 2, 0, 0]}
                />
                <Bar 
                  dataKey="expense" 
                  fill="#EF4444" 
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