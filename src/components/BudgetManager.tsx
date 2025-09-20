import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Target, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

interface Budget {
  id: string;
  amount: number;
  period: 'monthly' | 'yearly';
  year: number;
  month: number | null;
  categories: {
    id: string;
    name: string;
  };
}

interface BudgetData extends Budget {
  spent: number;
  remaining: number;
  percentage: number;
}

export const BudgetManager = () => {
  const [budgets, setBudgets] = useState<BudgetData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    categoryId: '',
    amount: '',
    period: 'monthly' as 'monthly' | 'yearly',
  });
  
  const { toast } = useToast();

  useEffect(() => {
    fetchBudgets();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('type', 'expense')
      .order('name');

    if (error) {
      console.error('카테고리 조회 실패:', error);
      return;
    }

    setCategories((data || []).map(cat => ({
      ...cat,
      type: cat.type as 'income' | 'expense'
    })));
  };

  const fetchBudgets = async () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // 예산 데이터 조회
    const { data: budgetData, error: budgetError } = await supabase
      .from('budgets')
      .select(`
        id,
        amount,
        period,
        year,
        month,
        categories (
          id,
          name
        )
      `)
      .eq('year', currentYear);

    if (budgetError) {
      console.error('예산 조회 실패:', budgetError);
      setLoading(false);
      return;
    }

    // 각 예산에 대한 실제 지출 계산
    const budgetWithSpending: BudgetData[] = [];

    for (const budget of budgetData || []) {
      let startDate: string;
      let endDate: string;

      if (budget.period === 'monthly' && budget.month) {
        startDate = `${budget.year}-${budget.month.toString().padStart(2, '0')}-01`;
        const nextMonth = budget.month === 12 ? 1 : budget.month + 1;
        const nextYear = budget.month === 12 ? budget.year + 1 : budget.year;
        endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
      } else {
        startDate = `${budget.year}-01-01`;
        endDate = `${budget.year + 1}-01-01`;
      }

      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'expense')
        .eq('category_id', budget.categories.id)
        .gte('date', startDate)
        .lt('date', endDate);

      const spent = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const remaining = Number(budget.amount) - spent;
      const percentage = (spent / Number(budget.amount)) * 100;

      budgetWithSpending.push({
        ...budget,
        amount: Number(budget.amount),
        period: budget.period as 'monthly' | 'yearly',
        spent,
        remaining,
        percentage: Math.min(percentage, 100),
      });
    }

    setBudgets(budgetWithSpending);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    const currentYear = new Date().getFullYear();
    const currentMonth = formData.period === 'monthly' ? new Date().getMonth() + 1 : null;

    const { error } = await supabase
      .from('budgets')
      .insert({
        category_id: formData.categoryId,
        amount: parseFloat(formData.amount),
        period: formData.period,
        year: currentYear,
        month: currentMonth,
      });

    if (error) {
      toast({
        title: "오류",
        description: "예산 설정에 실패했습니다.",
        variant: "destructive",
      });
      console.error('예산 설정 실패:', error);
    } else {
      toast({
        title: "성공",
        description: "예산이 설정되었습니다.",
      });
      setOpen(false);
      resetForm();
      fetchBudgets();
    }

    setFormLoading(false);
  };

  const resetForm = () => {
    setFormData({
      categoryId: '',
      amount: '',
      period: 'monthly',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-destructive';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-primary';
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            예산 관리
          </CardTitle>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              예산 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>새 예산 설정</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>카테고리</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>예산 금액</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>기간</Label>
                <Select
                  value={formData.period}
                  onValueChange={(value: 'monthly' | 'yearly') => setFormData({ ...formData, period: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">월간</SelectItem>
                    <SelectItem value="yearly">연간</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  취소
                </Button>
                <Button type="submit" disabled={formLoading}>
                  {formLoading ? '설정 중...' : '설정'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            예산 정보를 불러오는 중...
          </div>
        ) : budgets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            설정된 예산이 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {budgets.map((budget) => (
              <div key={budget.id} className="space-y-2 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{budget.categories.name}</h4>
                    {budget.percentage >= 90 && (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {budget.period === 'monthly' ? '월간' : '연간'}
                  </div>
                </div>
                
                <Progress value={budget.percentage} className="h-2" />
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    사용: {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
                  </span>
                  <span className={budget.remaining >= 0 ? 'text-income' : 'text-destructive'}>
                    {budget.remaining >= 0 ? '남음' : '초과'}: {formatCurrency(Math.abs(budget.remaining))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};