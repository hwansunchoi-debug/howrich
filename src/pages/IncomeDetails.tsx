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
import { ArrowLeft, TrendingUp, Calendar, Filter, Edit2, X, Search, CheckSquare, Square } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { TransactionForm } from "../components/TransactionForm";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income';
  institution?: string;
  category?: {
    id: string;
    name: string;
    color: string;
    type: string;
  };
  category_id?: string;
  user_id?: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
  type: string;
  user_id?: string;
}

export default function IncomeDetails() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isMaster } = useUserRole();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [userList, setUserList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<number | string>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [selectedInstitution, setSelectedInstitution] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedCategoryType, setSelectedCategoryType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [totalIncome, setTotalIncome] = useState(0);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
  
  // URL 파라미터에서 필터 읽기
  const categoryFromUrl = searchParams.get('category');
  const yearFromUrl = searchParams.get('year');
  const monthFromUrl = searchParams.get('month');
  const selectedCategoryName = categoryFromUrl ? categories.find(c => c.id === categoryFromUrl)?.name : null;

  useEffect(() => {
    if (user) {
      fetchIncomeTransactions();
      fetchCategories();
      fetchInstitutions();
      if (isMaster) {
        fetchUserList();
      }
    }
  }, [user, selectedUserId, selectedMonth, selectedYear, selectedDateRange, selectedInstitution, selectedCategoryFilter, selectedCategoryType, searchTerm, isMaster]);

  useEffect(() => {
    // URL에서 파라미터 변경시 필터 업데이트
    if (categoryFromUrl) {
      setSelectedCategoryFilter(categoryFromUrl);
    }
    if (yearFromUrl) {
      setSelectedYear(parseInt(yearFromUrl));
    }
    if (monthFromUrl) {
      setSelectedMonth(parseInt(monthFromUrl));
    }
  }, [categoryFromUrl, yearFromUrl, monthFromUrl]);

  const fetchUserList = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .order('display_name');
      
      if (error) throw error;
      setUserList(data || []);
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
      const uniqueCategories = data?.reduce((acc: Category[], current: any) => {
        const existing = acc.find(cat => cat.name === current.name && cat.type === current.type);
        if (!existing) {
          acc.push(current as Category);
        } else if (current.user_id && !existing.user_id) {
          // 사용자 카테고리가 기본 카테고리보다 우선
          const index = acc.findIndex(cat => cat.name === current.name && cat.type === current.type);
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
      // 현재 선택된 년월의 수입 내역에서 금융기관 목록 추출
      let startDate, endDate;
      if (selectedMonth === 'all') {
        startDate = `${selectedYear}-01-01`;
        endDate = `${selectedYear}-12-31`;
      } else {
        startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
        endDate = new Date(selectedYear, selectedMonth as number, 0).toISOString().split('T')[0];
      }
      
      let query = supabase
        .from('transactions')
        .select('institution')
        .eq('type', 'income')
        .gte('date', startDate)
        .lte('date', endDate)
        .not('institution', 'is', null);

      // 사용자 필터 적용
      if (selectedUserId !== 'all') {
        query = query.eq('user_id', selectedUserId);
      } else if (!isMaster) {
        query = query.eq('user_id', user?.id);
      }

      const { data, error } = await query;
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
          categories(id, name, color, type)
        `)
        .eq('type', 'income');

      // 사용자 권한에 따른 필터링
      if (selectedUserId !== 'all') {
        query = query.eq('user_id', selectedUserId);
      } else if (!isMaster) {
        query = query.eq('user_id', user?.id);
      }

      // 카테고리 필터 적용
      if (selectedCategoryFilter !== 'all') {
        query = query.eq('category_id', selectedCategoryFilter);
      }

      // 대분류 필터 적용
      if (selectedCategoryType !== 'all') {
        query = query.eq('categories.type', selectedCategoryType);
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
      } else if (selectedMonth === 'all') {
        // 전체 월 선택시 해당 연도 전체
        const startDate = `${selectedYear}-01-01`;
        const endDate = `${selectedYear}-12-31`;
        query = query.gte('date', startDate).lte('date', endDate);
      } else {
        // 기본적으로 선택된 년월로 필터링
        const startDate = `${selectedYear}-${(selectedMonth as number).toString().padStart(2, '0')}-01`;
        const endDate = new Date(selectedYear, selectedMonth as number, 0).toISOString().split('T')[0];
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
        type: 'income' as const,
        category: t.categories ? {
          ...t.categories,
          type: t.categories.type
        } : undefined
      })));
      
      const total = filteredData.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      setTotalIncome(total);
    } catch (error) {
      console.error('수입 내역 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearCategoryFilter = () => {
    setSelectedCategoryFilter('all');
    setSearchParams(params => {
      params.delete('category');
      return params;
    });
  };

  const handleTransactionSelect = (transactionId: string, checked: boolean) => {
    const newSelected = new Set(selectedTransactions);
    if (checked) {
      newSelected.add(transactionId);
    } else {
      newSelected.delete(transactionId);
    }
    setSelectedTransactions(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTransactions(new Set(transactions.map(t => t.id)));
    } else {
      setSelectedTransactions(new Set());
    }
  };

  const handleBulkCategoryUpdate = async () => {
    if (selectedTransactions.size === 0 || !bulkCategoryId) {
      toast({
        title: "오류",
        description: "선택된 거래와 카테고리를 확인해주세요.",
        variant: "destructive",
      });
      return;
    }

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
      fetchIncomeTransactions();
      setSelectedTransactions(new Set());
      setBulkCategoryId('');
      setBulkEditDialogOpen(false);
    } catch (error) {
      console.error('카테고리 수정 실패:', error);
      toast({
        title: "오류",
        description: "카테고리 수정에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const updateTransactionCategory = async (transactionId: string, categoryId: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ category_id: categoryId })
        .eq('id', transactionId);

      if (error) throw error;
      
      fetchIncomeTransactions();
      toast({
        title: "카테고리 변경 완료",
        description: "거래의 카테고리가 성공적으로 변경되었습니다.",
      });
    } catch (error) {
      console.error('카테고리 변경 실패:', error);
      toast({
        title: "오류",
        description: "카테고리 변경에 실패했습니다.",
        variant: "destructive",
      });
    }
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
              <TrendingUp className="h-6 w-6 text-green-500" />
              <h1 className="text-2xl font-bold">수입 내역</h1>
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
          <TransactionForm onTransactionAdded={fetchIncomeTransactions} />
        </div>

        {/* 필터 및 검색 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                <span className="font-medium">필터 및 검색</span>
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
                      <SelectItem value="income">수입</SelectItem>
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
                  <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(value === 'all' ? 'all' : parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
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
                        .filter(category => selectedCategoryType === 'all' || category.type === selectedCategoryType)
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

              {/* 사용자 필터 (마스터만) */}
              {isMaster && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">사용자</label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="md:w-1/4">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {userList.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 검색 */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="거래 내용, 금융기관, 카테고리 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleSelectAll(selectedTransactions.size === 0)}
                  className="shrink-0"
                >
                  {selectedTransactions.size === 0 ? (
                    <>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      전체 선택
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      선택 해제
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 선택된 항목 일괄 편집 */}
        {selectedTransactions.size > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedTransactions.size}개 항목이 선택됨
                </span>
                <Dialog open={bulkEditDialogOpen} onOpenChange={setBulkEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Edit2 className="h-4 w-4 mr-2" />
                      일괄 카테고리 변경
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>일괄 카테고리 변경</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">카테고리</label>
                        <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
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
                        <Button variant="outline" onClick={() => setBulkEditDialogOpen(false)}>
                          취소
                        </Button>
                        <Button onClick={handleBulkCategoryUpdate}>
                          변경
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 통계 요약 */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">총 수입</p>
                <p className="text-2xl font-bold text-green-600">
                  +{totalIncome.toLocaleString()}원
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">거래 건수</p>
                <p className="text-2xl font-bold">
                  {transactions.length}건
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">평균 수입</p>
                <p className="text-2xl font-bold">
                  {transactions.length > 0 ? Math.round(totalIncome / transactions.length).toLocaleString() : 0}원
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 거래 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>수입 거래 내역</CardTitle>
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
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedTransactions.has(transaction.id)}
                      onCheckedChange={(checked) => handleTransactionSelect(transaction.id, checked as boolean)}
                    />
                    
                    <div className="flex items-center gap-3 flex-1">
                      {transaction.category && (
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: transaction.category.color }}
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{transaction.description}</h3>
                          {transaction.institution && (
                            <Badge variant="secondary" className="text-xs">
                              {transaction.institution}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{transaction.date}</span>
                          
                          {/* 대분류 드롭다운 */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs">대분류:</span>
                            <Select
                              value={transaction.category?.type || 'income'}
                              onValueChange={(value) => {
                                // 대분류 변경시 해당하는 첫 번째 카테고리로 변경
                                const firstCategory = categories.find(c => c.type === value);
                                if (firstCategory) {
                                  updateTransactionCategory(transaction.id, firstCategory.id);
                                }
                              }}
                            >
                              <SelectTrigger className="w-20 h-6 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="income">수입</SelectItem>
                                <SelectItem value="expense">지출</SelectItem>
                                <SelectItem value="other">기타</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* 카테고리 드롭다운 */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs">카테고리:</span>
                            <Select
                              value={transaction.category_id || ''}
                              onValueChange={(value) => updateTransactionCategory(transaction.id, value)}
                            >
                              <SelectTrigger className="w-32 h-6 text-xs">
                                <SelectValue placeholder="카테고리" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories
                                  .filter(category => category.type === (transaction.category?.type || 'income'))
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
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-lg font-semibold text-green-600">
                        +{transaction.amount.toLocaleString()}원
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