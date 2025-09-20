import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Store, Edit2, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Category {
  id: string;
  name: string;
  color: string;
  type: 'income' | 'expense';
}

interface MerchantMapping {
  id: string;
  merchant_name: string;
  category_id: string;
  category?: Category;
  created_at: string;
  updated_at: string;
}

interface MerchantMappingCardProps {
  user: any;
}

export default function MerchantMappingCard({ user }: MerchantMappingCardProps) {
  const { toast } = useToast();
  const [mappings, setMappings] = useState<MerchantMapping[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMapping, setEditingMapping] = useState<MerchantMapping | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState('');

  useEffect(() => {
    fetchMappings();
    fetchCategories();
  }, []);

  const fetchMappings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('merchant_category_mappings')
        .select(`
          *,
          category:categories(id, name, color, type)
        `)
        .eq('user_id', user?.id)
        .order('merchant_name');

      if (error) throw error;
      setMappings((data || []).map(mapping => ({
        ...mapping,
        category: mapping.category ? {
          ...mapping.category,
          type: mapping.category.type as 'income' | 'expense'
        } : undefined
      })));
    } catch (error) {
      console.error('매핑 조회 실패:', error);
      toast({
        title: "오류",
        description: "가맹점 매핑을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories((data || []).map(cat => ({
        ...cat,
        type: cat.type as 'income' | 'expense'
      })));
    } catch (error) {
      console.error('카테고리 조회 실패:', error);
    }
  };

  const handleEditMapping = async () => {
    if (!editingMapping || !newCategoryId) return;

    try {
      const { error } = await supabase
        .from('merchant_category_mappings')
        .update({ category_id: newCategoryId })
        .eq('id', editingMapping.id);

      if (error) throw error;

      toast({
        title: "수정 완료",
        description: "가맹점 매핑이 수정되었습니다.",
      });

      setShowEditDialog(false);
      setEditingMapping(null);
      setNewCategoryId('');
      fetchMappings();
    } catch (error) {
      console.error('매핑 수정 실패:', error);
      toast({
        title: "오류",
        description: "매핑 수정에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMapping = async (mapping: MerchantMapping) => {
    try {
      const { error } = await supabase
        .from('merchant_category_mappings')
        .delete()
        .eq('id', mapping.id);

      if (error) throw error;

      toast({
        title: "삭제 완료",
        description: `"${mapping.merchant_name}" 매핑이 삭제되었습니다.`,
      });

      fetchMappings();
    } catch (error) {
      console.error('매핑 삭제 실패:', error);
      toast({
        title: "오류",
        description: "매핑 삭제에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const filteredMappings = mappings.filter(mapping =>
    mapping.merchant_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          가맹점-카테고리 매핑 현황
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 검색 */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="가맹점명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* 매핑 목록 */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              로딩 중...
            </div>
          ) : filteredMappings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? '검색 결과가 없습니다.' : '등록된 가맹점 매핑이 없습니다.'}
            </div>
          ) : (
            filteredMappings.map((mapping) => (
              <div
                key={mapping.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: mapping.category?.color }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{mapping.merchant_name}</h3>
                      <Badge variant="outline">
                        {mapping.category?.name}
                      </Badge>
                      <Badge variant={mapping.category?.type === 'income' ? 'default' : 'secondary'}>
                        {mapping.category?.type === 'income' ? '수입' : '지출'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      등록일: {new Date(mapping.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingMapping(mapping);
                      setNewCategoryId(mapping.category_id);
                      setShowEditDialog(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteMapping(mapping)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 편집 다이얼로그 */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>가맹점 매핑 수정</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">가맹점명</Label>
                <Input
                  value={editingMapping?.merchant_name || ''}
                  disabled
                  className="bg-muted"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium mb-2 block">카테고리</Label>
                <Select value={newCategoryId} onValueChange={setNewCategoryId}>
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
                          {category.name} ({category.type === 'income' ? '수입' : '지출'})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  취소
                </Button>
                <Button onClick={handleEditMapping} disabled={!newCategoryId}>
                  수정
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}