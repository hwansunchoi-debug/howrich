import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, TrendingDown, Calendar, Filter, Edit2, X, Search, CheckSquare, Square } from "lucide-react";
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
  type: 'expense' | 'other';
  institution?: string;
  category?: {
    id: string;
    name: string;
    color: string;
    type: 'expense' | 'other';
  };
  category_id?: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
  type: 'expense' | 'other';
  user_id?: string;
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
  const [selectedCategoryType, setSelectedCategoryType] = useState<string>('expense');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [totalExpense, setTotalExpense] = useState(0);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkCategoryType, setBulkCategoryType] = useState<'expense' | 'other'>('other');
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
  
  // URL 파라미터에서 카테고리 필터 읽기
  const categoryFromUrl = searchParams.get('category');
  const selectedCategoryName = categoryFromUrl ? categories.find(c => c.id === categoryFromUrl)?.name : null;

  useEffect(() => {
    if (user) {
      fetchExpenseTransactions();
      fetchCategories();
      fetchInstitutions();
    }
  }, [user, selectedMonth, selectedYear, selectedDateRange, selectedInstitution, selectedCategoryFilter, selectedCategoryType, searchTerm]);

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
        .in('type', ['expense', 'other'])
        .or(`user_id.is.null,user_id.eq.${user?.id}`)
        .order('name');

      if (error) throw error;
      
      // 중복 카테고리 제거 (이름 기준으로, 사용자 카테고리 우선)
      const uniqueCategories = data?.reduce((acc: Category[], current) => {
        const existing = acc.find(cat => cat.name === current.name);
        if (!existing) {
          acc.push(current as Category);
        } else if (current.user_id && !existing.user_id) {
          // 사용자 카테고리가 기본 카테고리보다 우선
          const index = acc.findIndex(cat => cat.name === current.name);
          acc[index] = current as Category;
        }
        return acc;
      }, []) || [];
      
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('카테고리 조회 실패:', error);
    }
  };

  const fetchInstitutions = async () => {
    try {
      // 현재 선택된 년월의 지출 내역에서 금융기관 목록 추출
      const startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('transactions')
        .select('institution')
        .in('type', ['expense', 'other'])
        .eq('user_id', user?.id)
        .gte('date', startDate)
        .lte('date', endDate)
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
          categories(id, name, color, type)
        `)
        .in('type', ['expense', 'other'])
        .eq('user_id', user?.id);

      // 대분류 필터 적용
      if (selectedCategoryType !== 'all') {
        if (selectedCategoryType === 'expense') {
          query = query.eq('type', 'expense');
        } else if (selectedCategoryType === 'other') {
          query = query.eq('type', 'other');
        }
      }

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

      let filteredData = data || [];

      // 검색어 필터 적용
      if (searchTerm.trim()) {
        filteredData = filteredData.filter(t => 
          t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.institution?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.categories?.name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setTransactions(filteredData.map(t => ({
        ...t,
        type: t.type as 'expense' | 'other',
        category: t.categories ? {
          ...t.categories,
          type: t.categories.type as 'expense' | 'other'
        } : undefined
      })));
      
      // 지출 금액은 type이 'expense'인 것만 계산
      const expenseOnly = filteredData.filter(t => t.type === 'expense');
      const total = expenseOnly.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      setTotalExpense(total);
    } catch (error) {
      console.error('거래 내역 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCategoryTypeUpdate = async () => {
    if (selectedTransactions.size === 0) return;

    try {
      // 선택된 거래들이 현재 필터링된 목록에 있는지 확인
      const validTransactionIds = Array.from(selectedTransactions).filter(id => 
        transactions.some(t => t.id === id)
      );

      if (validTransactionIds.length === 0) {
        toast({
          title: "오류",
          description: "선택된 거래가 현재 필터 조건에 맞지 않습니다.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('transactions')
        .update({ type: bulkCategoryType })
        .in('id', validTransactionIds);

      if (error) throw error;

      toast({
        title: "대분류 수정 완료",
        description: `${validTransactionIds.length}건의 거래 대분류가 ${bulkCategoryType === 'expense' ? '지출' : '기타'}로 변경되었습니다.`,
      });

      // 목록 새로고침 및 선택 해제
      fetchExpenseTransactions();
      setSelectedTransactions(new Set());
      setBulkEditDialogOpen(false);
    } catch (error) {
      console.error('대분류 수정 실패:', error);
      toast({
        title: "오류",
        description: "대분류 수정에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleBulkCategoryUpdate = async () => {
    if (selectedTransactions.size === 0 || !bulkCategoryId) return;

    try {
      // 선택된 거래들이 현재 필터링된 목록에 있는지 확인
      const validTransactionIds = Array.from(selectedTransactions).filter(id => 
        transactions.some(t => t.id === id)
      );

      if (validTransactionIds.length === 0) {
        toast({
          title: "오류",
          description: "선택된 거래가 현재 필터 조건에 맞지 않습니다.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('transactions')
        .update({ category_id: bulkCategoryId })
        .in('id', validTransactionIds);

      if (error) throw error;

      const categoryName = categories.find(c => c.id === bulkCategoryId)?.name || '선택된 카테고리';
      toast({
        title: "카테고리 수정 완료",
        description: `${validTransactionIds.length}건의 거래 카테고리가 ${categoryName}로 변경되었습니다.`,
      });

      // 목록 새로고침 및 선택 해제
      fetchExpenseTransactions();
      setSelectedTransactions(new Set());
      setBulkCategoryId('');
    } catch (error) {
      console.error('카테고리 수정 실패:', error);
      toast({
        title: "오류",
        description: "카테고리 수정에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleInlineTypeUpdate = async (transactionId: string, newType: 'expense' | 'other') => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ type: newType })
        .eq('id', transactionId);

      if (error) throw error;

      toast({
        title: "대분류 수정 완료",
        description: `거래 대분류가 ${newType === 'expense' ? '지출' : '기타'}로 변경되었습니다.`,
      });

      // 목록 새로고침
      fetchExpenseTransactions();
    } catch (error) {
      console.error('대분류 수정 실패:', error);
      toast({
        title: "오류",
        description: "대분류 수정에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleInlineCategoryUpdate = async (transactionId: string, categoryId: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ category_id: categoryId })
        .eq('id', transactionId);

      if (error) throw error;

      const categoryName = categories.find(c => c.id === categoryId)?.name || '선택된 카테고리';
      toast({
        title: "카테고리 수정 완료",
        description: `거래 카테고리가 ${categoryName}로 변경되었습니다.`,
      });

      // 목록 새로고침
      fetchExpenseTransactions();
    } catch (error) {
      console.error('카테고리 수정 실패:', error);
      toast({
        title: "오류",
        description: "카테고리 수정에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleSelectAll = () => {
    if (selectedTransactions.size === transactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(transactions.map(t => t.id)));
    }
  };

  const handleSelectTransaction = (transactionId: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedTransactions(newSelected);
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
              
              <div className="grid gap-4 md:grid-cols-5">
                {/* 대분류 필터 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">대분류</label>
                  <Select value={selectedCategoryType} onValueChange={setSelectedCategoryType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="expense">지출</SelectItem>
                      <SelectItem value="other">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                      {categories
                        .filter(cat => selectedCategoryType === 'all' || cat.type === selectedCategoryType)
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

        {/* 검색 및 대량 작업 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="거래내역, 금융기관, 카테고리로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="flex items-center gap-2"
                >
                  {selectedTransactions.size === transactions.length && transactions.length > 0 ? 
                    <CheckSquare className="h-4 w-4" /> : 
                    <Square className="h-4 w-4" />
                  }
                  {selectedTransactions.size === transactions.length && transactions.length > 0 ? '전체 해제' : '전체 선택'}
                </Button>
                
                {selectedTransactions.size > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">대분류:</span>
                      <Select value={bulkCategoryType} onValueChange={(value: 'expense' | 'other') => setBulkCategoryType(value)}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense">지출</SelectItem>
                          <SelectItem value="other">기타</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={handleBulkCategoryTypeUpdate}>
                        수정 ({selectedTransactions.size}건)
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">카테고리:</span>
                      <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories
                            .filter(cat => selectedCategoryType === 'all' || cat.type === selectedCategoryType)
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
                      <Button size="sm" onClick={handleBulkCategoryUpdate} disabled={!bulkCategoryId}>
                        수정 ({selectedTransactions.size}건)
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 통계 요약 */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">총 지출 (지출만)</p>
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
                <p className="text-sm text-muted-foreground mb-2">평균 지출 (지출만)</p>
                <p className="text-2xl font-bold">
                  {transactions.filter(t => t.type === 'expense').length > 0 ? 
                    Math.round(totalExpense / transactions.filter(t => t.type === 'expense').length).toLocaleString() : 0}원
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 거래 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedCategoryType === 'expense' ? '지출' : selectedCategoryType === 'other' ? '기타' : '전체'} 거래 내역
              {selectedTransactions.size > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedTransactions.size}개 선택됨
                </Badge>
              )}
            </CardTitle>
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
                    className={cn(
                      "flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors",
                      selectedTransactions.has(transaction.id) && "bg-blue-50 border-blue-200"
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Checkbox
                        checked={selectedTransactions.has(transaction.id)}
                        onCheckedChange={() => handleSelectTransaction(transaction.id)}
                      />
                      {transaction.category && (
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: transaction.category.color }}
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{transaction.description}</h3>
                          
                          {/* 인라인 카테고리 수정 */}
                          <Select 
                            value={transaction.category_id || ''} 
                            onValueChange={(value) => handleInlineCategoryUpdate(transaction.id, value)}
                          >
                            <SelectTrigger className="w-28 h-6 text-xs">
                              <SelectValue placeholder="카테고리" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories
                                .filter(cat => cat.type === transaction.type)
                                .map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-2 h-2 rounded-full" 
                                      style={{ backgroundColor: category.color }}
                                    />
                                    {category.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {/* 인라인 대분류 수정 */}
                          <Select 
                            value={transaction.type} 
                            onValueChange={(value: 'expense' | 'other') => handleInlineTypeUpdate(transaction.id, value)}
                          >
                            <SelectTrigger className="w-16 h-6 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="expense">지출</SelectItem>
                              <SelectItem value="other">기타</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{transaction.date}</span>
                          {transaction.institution && (
                            <Badge variant="secondary" className="text-xs">
                              {transaction.institution}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "font-bold",
                        transaction.type === 'expense' ? "text-red-600" : "text-gray-600"
                      )}>
                        -{Math.abs(transaction.amount).toLocaleString()}원
                      </span>
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