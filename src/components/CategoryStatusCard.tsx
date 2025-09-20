import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, BarChart3, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from '@/hooks/useUserRole';
import { useNavigate } from 'react-router-dom';

interface Category {
  id: string;
  name: string;
  color: string;
  type: 'income' | 'expense';
  user_id?: string;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: 'income' | 'expense';
  category?: {
    id: string;
    name: string;
    color: string;
  };
  category_id?: string;
  user_id?: string;
}

interface CategoryStatusCardProps {
  categories: Category[];
  transactions: Transaction[];
  user: any;
  onCategoriesChange: () => void;
}

interface CategoryStats {
  category: Category;
  count: number;
  totalAmount: number;
  percentage: number;
  incomeCount: number;
  expenseCount: number;
  incomeAmount: number;
  expenseAmount: number;
}

export default function CategoryStatusCard({ categories, transactions, user, onCategoriesChange }: CategoryStatusCardProps) {
  const { toast } = useToast();
  const { isMaster } = useUserRole();
  const navigate = useNavigate();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  
  // 필터 상태
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [userList, setUserList] = useState<any[]>([]);

  const predefinedColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
  ];

  useEffect(() => {
    calculateCategoryStats();
    if (isMaster) {
      fetchUserList();
    }
  }, [categories, transactions, selectedUserId, selectedYear, selectedMonth, isMaster]);

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

  const calculateCategoryStats = () => {
    // 필터 적용 - 카테고리가 설정된 거래만
    let filteredTransactions = transactions.filter(t => t.category_id);
    
    // 사용자 필터 (마스터 사용자인 경우)
    if (selectedUserId !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => t.user_id === selectedUserId);
    }
    
    // 연도 필터
    if (selectedYear !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => 
        new Date(t.date).getFullYear().toString() === selectedYear
      );
    }
    
    // 월 필터
    if (selectedMonth !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => 
        (new Date(t.date).getMonth() + 1).toString() === selectedMonth
      );
    }
    
    const stats: CategoryStats[] = categories.map(category => {
      const categoryTransactions = filteredTransactions.filter(t => t.category_id === category.id);
      
      // 수입/지출 분리 계산
      const incomeTransactions = categoryTransactions.filter(t => t.type === 'income');
      const expenseTransactions = categoryTransactions.filter(t => t.type === 'expense');
      
      const incomeCount = incomeTransactions.length;
      const expenseCount = expenseTransactions.length;
      const totalCount = categoryTransactions.length;
      
      const incomeAmount = incomeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const expenseAmount = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const totalAmount = incomeAmount + expenseAmount;
      
      const totalFilteredAmount = filteredTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const percentage = totalFilteredAmount > 0 ? (totalAmount / totalFilteredAmount) * 100 : 0;

      return {
        category,
        count: totalCount,
        totalAmount,
        percentage,
        incomeCount,
        expenseCount,
        incomeAmount,
        expenseAmount
      };
    });

    setCategoryStats(stats
      .filter(stat => stat.count > 0) // 거래가 있는 카테고리만 표시
      .sort((a, b) => b.totalAmount - a.totalAmount)
    );
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "오류",
        description: "카테고리명을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .insert({
          name: newCategoryName.trim(),
          type: newCategoryType,
          color: newCategoryColor,
          user_id: user?.id
        });

      if (error) throw error;

      toast({
        title: "카테고리 추가 완료",
        description: `"${newCategoryName}" 카테고리가 추가되었습니다.`,
      });

      // 폼 초기화
      setNewCategoryName('');
      setNewCategoryType('expense');
      setNewCategoryColor('#3b82f6');
      setShowAddDialog(false);
      
      // 카테고리 목록 새로고침
      onCategoriesChange();
    } catch (error) {
      console.error('카테고리 추가 실패:', error);
      toast({
        title: "오류",
        description: "카테고리 추가에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleCategoryClick = (category: Category) => {
    if (category.type === 'income') {
      navigate(`/income?category=${category.id}`);
    } else {
      navigate(`/expense?category=${category.id}`);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (category.user_id === null) {
      toast({
        title: "오류",
        description: "기본 카테고리는 삭제할 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    const categoryTransactions = transactions.filter(t => t.category?.id === category.id);
    
    if (categoryTransactions.length > 0) {
      toast({
        title: "삭제 불가",
        description: `이 카테고리에 ${categoryTransactions.length}개의 거래가 연결되어 있습니다.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: "카테고리 삭제 완료",
        description: `"${category.name}" 카테고리가 삭제되었습니다.`,
      });

      onCategoriesChange();
    } catch (error) {
      console.error('카테고리 삭제 실패:', error);
      toast({
        title: "오류",
        description: "카테고리 삭제에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 카테고리 통계 개요 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">활성 카테고리</p>
              <p className="text-2xl font-bold">{categoryStats.length}개</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">사용자 정의</p>
              <p className="text-2xl font-bold text-blue-600">
                {categoryStats.filter(s => s.category.user_id !== null).length}개
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">기본 카테고리</p>
              <p className="text-2xl font-bold text-green-600">
                {categoryStats.filter(s => s.category.user_id === null).length}개
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            필터 옵션
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {isMaster && (
              <div>
                <label className="text-sm font-medium mb-2 block">사용자</label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="사용자 선택" />
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
            
            <div>
              <label className="text-sm font-medium mb-2 block">연도</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="연도 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="2023">2023년</SelectItem>
                  <SelectItem value="2024">2024년</SelectItem>
                  <SelectItem value="2025">2025년</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">월</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="월 선택" />
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
          </div>
        </CardContent>
      </Card>

      {/* 카테고리 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              카테고리별 사용 현황
            </div>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  카테고리 추가
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>새 카테고리 추가</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">카테고리명</label>
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="카테고리명을 입력하세요"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">유형</label>
                    <Select value={newCategoryType} onValueChange={(value) => setNewCategoryType(value as 'income' | 'expense')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">지출</SelectItem>
                        <SelectItem value="income">수입</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">색상</label>
                    <div className="flex gap-2 flex-wrap">
                      {predefinedColors.map(color => (
                        <button
                          key={color}
                          className={`w-8 h-8 rounded-full border-2 ${
                            newCategoryColor === color ? 'border-gray-800' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewCategoryColor(color)}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                      취소
                    </Button>
                    <Button onClick={handleAddCategory}>
                      추가
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categoryStats.map((stat) => (
              <div
                key={stat.category.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handleCategoryClick(stat.category)}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: stat.category.color }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{stat.category.name}</h3>
                      <Badge variant={stat.category.type === 'income' ? 'default' : 'outline'}>
                        {stat.category.type === 'income' ? '수입' : '지출'}
                      </Badge>
                      {stat.category.user_id === null && (
                        <Badge variant="secondary" className="text-xs">
                          기본
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        총 {stat.count}건 • {stat.totalAmount.toLocaleString()}원 
                        {stat.percentage > 0 && ` • ${stat.percentage.toFixed(1)}%`}
                      </p>
                      {(stat.incomeCount > 0 || stat.expenseCount > 0) && (
                        <div className="flex gap-4 text-xs">
                          {stat.incomeCount > 0 && (
                            <span className="text-green-600">
                              수입: {stat.incomeCount}건 • {stat.incomeAmount.toLocaleString()}원
                            </span>
                          )}
                          {stat.expenseCount > 0 && (
                            <span className="text-red-600">
                              지출: {stat.expenseCount}건 • {stat.expenseAmount.toLocaleString()}원
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {stat.category.user_id !== null && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(stat.category);
                      }}
                      disabled={stat.count > 0}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            
            {categoryStats.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                선택한 조건에 해당하는 카테고리가 없습니다.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}