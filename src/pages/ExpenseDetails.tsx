import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ArrowLeft, TrendingDown, Calendar, Filter, Edit2, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { TransactionForm } from "../components/TransactionForm";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  institution?: string;
  category?: {
    id: string;
    name: string;
    color: string;
  };
  category_id?: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

export default function ExpenseDetails() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [selectedInstitution, setSelectedInstitution] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [totalExpense, setTotalExpense] = useState(0);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  
  // URL 파라미터에서 카테고리 필터 읽기
  const categoryFromUrl = searchParams.get('category');
  const selectedCategoryName = categoryFromUrl ? categories.find(c => c.id === categoryFromUrl)?.name : null;

  useEffect(() => {
    if (user) {
      fetchExpenseTransactions();
      fetchCategories();
      fetchInstitutions();
    }
  }, [user, selectedMonth, selectedYear, selectedDateRange, selectedInstitution, selectedCategoryFilter]);

  useEffect(() => {
    // URL에서 카테고리 파라미터 변경시 필터 업데이트
    if (categoryFromUrl) {
      setSelectedCategoryFilter(categoryFromUrl);
    }
  }, [categoryFromUrl]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('type', 'expense')
        .or(`user_id.is.null,user_id.eq.${user?.id}`)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('카테고리 조회 실패:', error);
    }
  };

  const fetchInstitutions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('institution')
        .eq('type', 'expense')
        .eq('user_id', user?.id)
        .not('institution', 'is', null);

      if (error) throw error;

      const uniqueInstitutions = [...new Set(data?.map(t => t.institution).filter(Boolean))];
      setInstitutions(uniqueInstitutions);
    } catch (error) {
      console.error('금융기관 조회 실패:', error);
    }
  };

  const fetchExpenseTransactions = async () => {
    try {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          categories(id, name, color)
        `)
        .eq('type', 'expense')
        .eq('user_id', user?.id);

      // 카테고리 필터 적용
      if (selectedCategoryFilter !== 'all') {
        query = query.eq('category_id', selectedCategoryFilter);
      }

      // 기관 필터 적용
      if (selectedInstitution !== 'all') {
        query = query.eq('institution', selectedInstitution);
      }

      // 날짜 범위 필터 적용
      if (selectedDateRange?.from && selectedDateRange?.to) {
        query = query
          .gte('date', format(selectedDateRange.from, 'yyyy-MM-dd'))
          .lte('date', format(selectedDateRange.to, 'yyyy-MM-dd'));
      } else {
        // 기본적으로 선택된 년월로 필터링
        const startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
        const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
        query = query.gte('date', startDate).lte('date', endDate);
      }

      const { data, error } = await query.order('date', { ascending: false });

      if (error) throw error;

      setTransactions(data || []);
      const total = data?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
      setTotalExpense(total);
    } catch (error) {
      console.error('지출 내역 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryUpdate = async () => {
    if (!editingTransaction || !selectedCategoryId) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ category_id: selectedCategoryId })
        .eq('id', editingTransaction.id);

      if (error) throw error;

      toast({
        title: "카테고리 수정 완료",
        description: "거래 카테고리가 성공적으로 변경되었습니다.",
      });

      // 목록 새로고침
      fetchExpenseTransactions();
      setEditingTransaction(null);
      setSelectedCategoryId('');
    } catch (error) {
      console.error('카테고리 수정 실패:', error);
      toast({
        title: "오류",
        description: "카테고리 수정에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const clearCategoryFilter = () => {
    setSelectedCategoryFilter('all');
    setSearchParams(params => {
      params.delete('category');
      return params;
    });
  };

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
              <TrendingDown className="h-6 w-6 text-red-500" />
              <h1 className="text-2xl font-bold">지출 내역</h1>
              {selectedCategoryName && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-sm">
                    {selectedCategoryName}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearCategoryFilter}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <TransactionForm onTransactionAdded={fetchExpenseTransactions} />
        </div>

        {/* 필터 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                <span className="font-medium">필터 옵션</span>
              </div>
              
              <div className="grid gap-4 md:grid-cols-4">
                {/* 년도 선택 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">년도</label>
                  <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2023">2023년</SelectItem>
                      <SelectItem value="2024">2024년</SelectItem>
                      <SelectItem value="2025">2025년</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 월 선택 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">월</label>
                  <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({length: 12}, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {i + 1}월
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 카테고리 필터 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">카테고리</label>
                  <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {categories.map((category) => (
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

                {/* 금융기관 필터 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">금융기관</label>
                  <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
                    <SelectTrigger>
                      <SelectValue />
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

        {/* 통계 요약 */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">총 지출</p>
                <p className="text-2xl font-bold text-red-600">
                  {totalExpense.toLocaleString()}원
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">거래 건수</p>
                <p className="text-2xl font-bold">
                  {transactions.length}건
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">평균 지출</p>
                <p className="text-2xl font-bold">
                  {transactions.length > 0 ? Math.round(totalExpense / transactions.length).toLocaleString() : 0}원
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 거래 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>지출 거래 내역</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">로딩 중...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">선택한 조건에 해당하는 거래가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {transaction.category && (
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: transaction.category.color }}
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{transaction.description}</h3>
                          {transaction.category && (
                            <Badge variant="outline" className="text-xs">
                              {transaction.category.name}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{transaction.date}</span>
                          {transaction.institution && (
                            <span>{transaction.institution}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-red-600">
                        -{Math.abs(transaction.amount).toLocaleString()}원
                      </span>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingTransaction(transaction);
                              setSelectedCategoryId(transaction.category_id || '');
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>카테고리 수정</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium mb-2 block">거래내역</label>
                              <p className="text-sm text-muted-foreground">{transaction.description}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-2 block">카테고리</label>
                              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="카테고리 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories.map((category) => (
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
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setEditingTransaction(null)}>
                                취소
                              </Button>
                              <Button onClick={handleCategoryUpdate} disabled={!selectedCategoryId}>
                                수정
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
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