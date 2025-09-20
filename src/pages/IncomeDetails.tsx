import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ArrowLeft, TrendingUp, Calendar, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: {
    name: string;
    color: string;
  };
}

export default function IncomeDetails() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [selectedInstitution, setSelectedInstitution] = useState<string>('all');
  const [totalIncome, setTotalIncome] = useState(0);

  useEffect(() => {
    if (user) {
      fetchIncomeTransactions();
      fetchInstitutions();
    }
  }, [user, selectedMonth, selectedYear, selectedDateRange, selectedInstitution]);

  const fetchInstitutions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('institution')
        .eq('type', 'income')
        .eq('user_id', user?.id)
        .not('institution', 'is', null);

      if (error) throw error;

      const uniqueInstitutions = [...new Set(data?.map(t => t.institution).filter(Boolean))];
      setInstitutions(uniqueInstitutions);
    } catch (error) {
      console.error('금융기관 조회 실패:', error);
    }
  };

  const fetchIncomeTransactions = async () => {
    try {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          categories(id, name, color)
        `)
        .eq('type', 'income')
        .eq('user_id', user?.id);

      // 날짜 범위 필터링
      if (selectedDateRange?.from && selectedDateRange?.to) {
        query = query
          .gte('date', format(selectedDateRange.from, 'yyyy-MM-dd'))
          .lte('date', format(selectedDateRange.to, 'yyyy-MM-dd'));
      } else {
        // 기본 월별 필터링
        const startDate = new Date(selectedYear, selectedMonth - 1, 1);
        const endDate = new Date(selectedYear, selectedMonth, 0);
        query = query
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);
      }

      // 금융기관 필터링
      if (selectedInstitution !== 'all') {
        query = query.eq('institution', selectedInstitution);
      }

      const { data, error } = await query.order('date', { ascending: false });

      if (error) throw error;

      setTransactions(data || []);
      const total = (data || []).reduce((sum, t) => sum + Number(t.amount), 0);
      setTotalIncome(total);
    } catch (error) {
      console.error('수입 내역 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    });
  };

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}월`
  }));

  const years = Array.from({ length: 5 }, (_, i) => ({
    value: new Date().getFullYear() - i,
    label: `${new Date().getFullYear() - i}년`
  }));

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-green-500" />
              <h1 className="text-2xl font-bold">수입 내역</h1>
            </div>
          </div>
        </div>

        {/* 필터 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                <span className="font-medium">필터 옵션</span>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                {/* 기간 선택 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">기간 선택</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select
                      value={selectedYear.toString()}
                      onValueChange={(value) => setSelectedYear(Number(value))}
                    >
                      <SelectTrigger className="w-24">
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
                    
                    <Select
                      value={selectedMonth.toString()}
                      onValueChange={(value) => setSelectedMonth(Number(value))}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month) => (
                          <SelectItem key={month.value} value={month.value.toString()}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Calendar className="h-4 w-4 mr-2" />
                          상세 날짜
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="range"
                          selected={selectedDateRange}
                          onSelect={setSelectedDateRange}
                          numberOfMonths={2}
                          className={cn("p-3 pointer-events-auto")}
                        />
                        <div className="p-3 border-t">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setSelectedDateRange(undefined)}
                            className="w-full"
                          >
                            날짜 범위 초기화
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* 금융기관 선택 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">금융기관</label>
                  <Select
                    value={selectedInstitution}
                    onValueChange={setSelectedInstitution}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="금융기관 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {institutions.map((institution) => (
                        <SelectItem key={institution} value={institution}>
                          {institution}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 총 수입 요약 */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                {selectedDateRange?.from && selectedDateRange?.to 
                  ? `${format(selectedDateRange.from, 'MM/dd')} - ${format(selectedDateRange.to, 'MM/dd')} 총 수입`
                  : `${selectedYear}년 ${selectedMonth}월 총 수입`}
              </p>
              <p className="text-3xl font-bold text-green-600">
                +{totalIncome.toLocaleString()}원
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                총 {transactions.length}건의 수입
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 수입 내역 리스트 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              거래 내역
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">불러오는 중...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">해당 기간에 수입 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">
                          {formatDate(transaction.date)}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        {transaction.category && (
                          <Badge 
                            variant="outline" 
                            className="mt-1"
                            style={{ 
                              borderColor: transaction.category.color,
                              color: transaction.category.color 
                            }}
                          >
                            {transaction.category.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        +{Number(transaction.amount).toLocaleString()}원
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}