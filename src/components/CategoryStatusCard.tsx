import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
}

export default function CategoryStatusCard({ categories, transactions, user, onCategoriesChange }: CategoryStatusCardProps) {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);

  const predefinedColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
  ];

  useEffect(() => {
    calculateCategoryStats();
  }, [categories, transactions]);

  const calculateCategoryStats = () => {
    const categorizedTransactions = transactions.filter(t => t.category_id);
    const totalAmount = categorizedTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const stats: CategoryStats[] = categories.map(category => {
      const categoryTransactions = transactions.filter(t => t.category?.id === category.id);
      const count = categoryTransactions.length;
      const categoryTotal = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const percentage = totalAmount > 0 ? (categoryTotal / totalAmount) * 100 : 0;

      return {
        category,
        count,
        totalAmount: categoryTotal,
        percentage
      };
    });

    setCategoryStats(stats.sort((a, b) => b.totalAmount - a.totalAmount));
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
              <p className="text-sm text-muted-foreground mb-2">전체 카테고리</p>
              <p className="text-2xl font-bold">{categories.length}개</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">사용자 정의</p>
              <p className="text-2xl font-bold text-blue-600">
                {categories.filter(c => c.user_id !== null).length}개
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">기본 카테고리</p>
              <p className="text-2xl font-bold text-green-600">
                {categories.filter(c => c.user_id === null).length}개
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
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
                    <p className="text-sm text-muted-foreground">
                      {stat.count}건 • {stat.totalAmount.toLocaleString()}원 
                      {stat.percentage > 0 && ` • ${stat.percentage.toFixed(1)}%`}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {stat.category.user_id !== null && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCategory(stat.category)}
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
                카테고리가 없습니다.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}