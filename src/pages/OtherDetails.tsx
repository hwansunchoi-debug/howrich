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
import { ArrowLeft, Info, Calendar, Filter, Edit2, X, Search, CheckSquare, Square } from "lucide-react";
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
  type: 'other';
  institution?: string;
  category?: {
    id: string;
    name: string;
    color: string;
    type: 'other';
  };
  category_id?: string;
  user_id?: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
  type: 'other';
  user_id?: string;
}

export default function OtherDetails() {
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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [selectedInstitution, setSelectedInstitution] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [totalOther, setTotalOther] = useState(0);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
  
  // URL 파라미터에서 카테고리 필터 읽기
  const categoryFromUrl = searchParams.get('category');
  const selectedCategoryName = categoryFromUrl ? categories.find(c => c.id === categoryFromUrl)?.name : null;

  useEffect(() => {
    if (user) {
      fetchOtherTransactions();
      fetchCategories();
      fetchInstitutions();
      if (isMaster) {
        fetchUserList();
      }
    }
  }, [user, selectedUserId, selectedMonth, selectedYear, selectedDateRange, selectedInstitution, selectedCategoryFilter, searchTerm, isMaster]);

  useEffect(() => {
    // URL에서 카테고리 파라미터 변경시 필터 업데이트
    if (categoryFromUrl) {
      setSelectedCategoryFilter(categoryFromUrl);
    }
  }, [categoryFromUrl]);

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
        .eq('type', 'other')
        .or(`user_id.is.null,user_id.eq.${user?.id}`)
        .order('name');

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
      // 현재 선택된 년월의 기타 거래에서 금융기관 목록 추출
      const startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
      
      let query = supabase
        .from('transactions')
        .select('institution')
        .eq('type', 'other')
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

  const fetchOtherTransactions = async () => {
    try {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          categories(id, name, color, type)
        `)
        .eq('type', 'other');

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
        const startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
        const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
        query = query.gte('date', startDate).lte('date', endDate);
      }

      // 검색 필터 적용
      if (searchTerm) {
        query = query.ilike('description', `%${searchTerm}%`);
      }

      const { data, error } = await query.order('date', { ascending: false });
      if (error) throw error;

      setTransactions((data as Transaction[]) || []);
      const total = data?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
      setTotalOther(total);
    } catch (error) {
      console.error('기타 거래 내역 조회 실패:', error);
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
      const { error } = await supabase
        .from('transactions')
        .update({ category_id: bulkCategoryId })
        .in('id', Array.from(selectedTransactions));

      if (error) throw error;

      toast({
        title: "카테고리 일괄 변경 완료",
        description: `${selectedTransactions.size}건의 거래 카테고리가 변경되었습니다.`,
      });

      setBulkEditDialogOpen(false);
      setSelectedTransactions(new Set());
      setBulkCategoryId('');
      fetchOtherTransactions();
    } catch (error) {
      console.error('일괄 카테고리 변경 실패:', error);
      toast({
        title: "오류",
        description: "카테고리 변경에 실패했습니다.",
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
      
      fetchOtherTransactions();
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
              <Info className="h-6 w-6 text-muted-foreground" />
              <h1 className="text-2xl font-bold">기타 내역</h1>
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
          <TransactionForm onTransactionAdded={fetchOtherTransactions} />
        </div>

        {/* 필터 및 검색 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                <span className="font-medium">필터 및 검색</span>
              </div>
              
              <div className="grid gap-4 md:grid-cols-4">
                {/* 년도 선택 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">연도</label>
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

              {/* 검색 및 전체 선택 */}
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium">검색</label>
                  <Input
                    placeholder="거래내역 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">전체 선택</label>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => handleSelectAll(!transactions.every(t => selectedTransactions.has(t.id)))}
                    >
                      {transactions.every(t => selectedTransactions.has(t.id)) ? (
                        <>
                          <CheckSquare className="h-4 w-4 mr-2" />
                          전체 해제
                        </>
                      ) : (
                        <>
                          <Square className="h-4 w-4 mr-2" />
                          전체 선택
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 선택된 항목 일괄 작업 */}
        {selectedTransactions.size > 0 && (
          <Card className="border-primary">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
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
                <p className="text-sm text-muted-foreground mb-2">총 기타</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {totalOther.toLocaleString()}원
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">거래 건수</p>
                <p className="text-2xl font-bold">
                  {transactions.length}건
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">평균 금액</p>
                <p className="text-2xl font-bold">
                  {transactions.length > 0 ? Math.round(totalOther / transactions.length).toLocaleString() : 0}원
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 거래 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>기타 거래 내역</CardTitle>
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
                          <div className="flex items-center gap-2">
                            <Select
                              value={transaction.category_id || ''}
                              onValueChange={(value) => updateTransactionCategory(transaction.id, value)}
                            >
                              <SelectTrigger className="w-32 h-6">
                                <SelectValue placeholder="카테고리" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((category) => (
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
                    
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-muted-foreground">
                        {Math.abs(transaction.amount).toLocaleString()}원
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