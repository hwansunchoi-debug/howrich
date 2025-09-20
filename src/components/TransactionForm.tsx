import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
}

interface TransactionFormProps {
  onTransactionAdded: () => void;
}

export const TransactionForm = ({ onTransactionAdded }: TransactionFormProps) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, [type]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('type', type)
      .or(`user_id.is.null,user_id.eq.${(await supabase.auth.getUser()).data.user?.id}`)
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

  const extractMerchantName = (description: string): string => {
    // 간단한 가맹점명 추출 로직 (실제로는 더 복잡할 수 있음)
    const cleanedDescription = description
      .replace(/[0-9]+[.*]?/g, '') // 숫자 제거
      .replace(/승인|결제|구매|카드|체크|신용/g, '') // 결제 관련 단어 제거
      .replace(/[^\w\s가-힣]/g, '') // 특수문자 제거
      .trim();
    
    return cleanedDescription.split(' ')[0] || cleanedDescription;
  };

  const getMappedCategory = async (merchantName: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('merchant_category_mappings')
        .select('category_id')
        .eq('merchant_name', merchantName)
        .maybeSingle();
      
      if (error) throw error;
      return data?.category_id || null;
    } catch (error) {
      console.error('매핑 조회 실패:', error);
      return null;
    }
  };

  const saveMerchantMapping = async (merchantName: string, categoryId: string) => {
    try {
      const { error } = await supabase
        .from('merchant_category_mappings')
        .upsert({
          merchant_name: merchantName,
          category_id: categoryId,
          user_id: (await supabase.auth.getUser()).data.user?.id
        }, {
          onConflict: 'merchant_name,user_id'
        });
      
      if (error) throw error;
    } catch (error) {
      console.error('매핑 저장 실패:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 가맹점명 추출
      let finalCategoryId = categoryId;
      
      if (description && !categoryId) {
        const merchantName = extractMerchantName(description);
        if (merchantName) {
          const mappedCategoryId = await getMappedCategory(merchantName);
          if (mappedCategoryId) {
            finalCategoryId = mappedCategoryId;
            toast({
              title: "자동 분류 완료",
              description: `"${merchantName}" 가맹점이 자동으로 분류되었습니다.`,
            });
          }
        }
      }

      const { error } = await supabase
        .from('transactions')
        .insert({
          amount: parseFloat(amount),
          type,
          category_id: finalCategoryId || null,
          description: description || null,
          date
        });

      if (error) throw error;

      // 새로운 가맹점-카테고리 매핑 저장 (수동으로 카테고리를 선택한 경우)
      if (description && categoryId) {
        const merchantName = extractMerchantName(description);
        if (merchantName) {
          await saveMerchantMapping(merchantName, categoryId);
        }
      }

      toast({
        title: "성공",
        description: "거래내역이 추가되었습니다.",
      });
      setOpen(false);
      resetForm();
      onTransactionAdded();
    } catch (error: any) {
      toast({
        title: "오류",
        description: "거래내역 추가에 실패했습니다.",
        variant: "destructive",
      });
      console.error('거래내역 추가 실패:', error);
    }

    setLoading(false);
  };

  const resetForm = () => {
    setAmount('');
    setCategoryId('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary hover:opacity-90 transition-opacity">
          <PlusCircle className="mr-2 h-4 w-4" />
          거래내역 추가
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>새 거래내역 추가</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>거래 유형</Label>
            <Select value={type} onValueChange={(value: 'income' | 'expense') => setType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">수입</SelectItem>
                <SelectItem value="expense">지출</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>금액</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>카테고리</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="카테고리 선택 (자동 분류 가능)" />
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
            <Label>날짜</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>설명 (선택사항)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="거래내역에 대한 설명을 입력하세요 (가맹점명 포함시 자동 분류됩니다)"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '추가 중...' : '추가'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};