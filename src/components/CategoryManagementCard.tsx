import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tag, AlertTriangle, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

export const CategoryManagementCard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uncategorizedTransactions, setUncategorizedTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (user) {
      fetchUncategorizedCount();
      fetchUncategorizedTransactions();
      fetchCategories();
    }
  }, [user]);

  const fetchUncategorizedCount = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user.id)
        .is('category_id', null);

      if (error) throw error;
      
      setUncategorizedCount(data?.length || 0);
    } catch (error) {
      console.error('미분류 거래 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUncategorizedTransactions = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, description, amount, type, date')
        .eq('user_id', user.id)
        .is('category_id', null)
        .order('date', { ascending: false })
        .limit(10);

      if (error) throw error;
      
      setUncategorizedTransactions((data as Transaction[]) || []);
    } catch (error) {
      console.error('미분류 거래 목록 조회 실패:', error);
    }
  };

  const fetchCategories = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, color')
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order('name');

      if (error) throw error;
      
      setCategories(data || []);
    } catch (error) {
      console.error('카테고리 조회 실패:', error);
    }
  };

  const updateTransactionCategory = async (transactionId: string, categoryId: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ category_id: categoryId })
        .eq('id', transactionId);

      if (error) throw error;
      
      toast.success('카테고리가 업데이트되었습니다.');
      fetchUncategorizedCount();
      fetchUncategorizedTransactions();
    } catch (error) {
      console.error('카테고리 업데이트 실패:', error);
      toast.error('카테고리 업데이트에 실패했습니다.');
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          카테고리 관리
          {uncategorizedCount > 0 && (
            <Badge variant="destructive" className="ml-2 animate-pulse">
              <AlertTriangle className="h-3 w-3 mr-1" />
              미분류 {uncategorizedCount}건
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          거래 내역을 카테고리별로 분류하여 관리합니다
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="quick" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick">빠른 분류</TabsTrigger>
            <TabsTrigger value="manage">전체 관리</TabsTrigger>
          </TabsList>
          
          <TabsContent value="quick" className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {uncategorizedCount > 0 ? (
                <span className="text-destructive font-medium">
                  미분류 거래 {uncategorizedCount}건 중 최신 10건을 빠르게 분류할 수 있습니다.
                </span>
              ) : (
                "모든 거래가 분류되었습니다."
              )}
            </div>
            
            {uncategorizedTransactions.length > 0 && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {uncategorizedTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {transaction.type === 'income' ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium truncate">{transaction.description}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {transaction.date} • {transaction.amount.toLocaleString()}원
                      </div>
                    </div>
                    <Select onValueChange={(value) => updateTransactionCategory(transaction.id, value)}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="카테고리 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories
                          .filter(cat => {
                            // 전역 카테고리 또는 해당 타입의 카테고리만 표시
                            return cat.name === '기타' || 
                                   categories.find(c => c.name.includes(transaction.type === 'income' ? '수입' : '지출'))?.id === cat.id ||
                                   !cat.name.includes('수입') && !cat.name.includes('지출');
                          })
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
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="manage" className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              {uncategorizedCount > 0 ? (
                <span className="text-destructive font-medium">
                  미분류 거래 {uncategorizedCount}건이 있습니다. 전체 카테고리 관리에서 처리해주세요.
                </span>
              ) : (
                "모든 거래가 분류되었습니다. 카테고리 관리에서 추가 설정을 할 수 있습니다."
              )}
            </div>
            <Button 
              onClick={() => navigate('/categories')} 
              variant={uncategorizedCount > 0 ? "default" : "outline"}
              className={`w-full ${uncategorizedCount > 0 ? 'bg-red-600 hover:bg-red-700' : ''}`}
            >
              <Tag className="h-4 w-4 mr-2" />
              {uncategorizedCount > 0 ? '지금 분류하기' : '카테고리 관리하기'}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};