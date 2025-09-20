import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Tag, Filter, Search, AlertCircle, CheckCircle, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

interface Category {
  id: string;
  name: string;
  color: string;
  type: 'income' | 'expense';
}

interface MerchantGroup {
  merchant: string;
  transactions: Transaction[];
  suggestedCategory?: string;
}

export default function CategoryManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchantGroups, setMerchantGroups] = useState<MerchantGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantGroup | null>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState('');

  useEffect(() => {
    if (user) {
      fetchTransactions();
      fetchCategories();
    }
  }, [user]);

  useEffect(() => {
    groupTransactionsByMerchant();
  }, [transactions, selectedCategory, searchTerm]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');

      if (error) throw error;
      setCategories((data || []) as Category[]);
    } catch (error) {
      console.error('카테고리 조회 실패:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          categories(id, name, color)
        `)
        .eq('user_id', user?.id)
        .order('date', { ascending: false })
        .limit(1000);

      if (error) throw error;

      setTransactions((data || []) as Transaction[]);
      
      // 미분류 거래 수 계산
      const uncategorized = (data || []).filter(t => !t.category_id).length;
      setUncategorizedCount(uncategorized);
    } catch (error) {
      console.error('거래내역 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupTransactionsByMerchant = () => {
    let filteredTransactions = transactions;

    // 카테고리 필터링
    if (selectedCategory === 'uncategorized') {
      filteredTransactions = transactions.filter(t => !t.category_id);
    } else if (selectedCategory !== 'all') {
      filteredTransactions = transactions.filter(t => t.category?.id === selectedCategory);
    }

    // 검색어 필터링
    if (searchTerm) {
      filteredTransactions = filteredTransactions.filter(t =>
        t.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 가맹점별 그룹화
    const groups: { [key: string]: Transaction[] } = {};
    
    filteredTransactions.forEach(transaction => {
      const merchant = extractMerchantName(transaction.description);
      if (!groups[merchant]) {
        groups[merchant] = [];
      }
      groups[merchant].push(transaction);
    });

    // MerchantGroup 배열로 변환하고 거래 수 기준으로 정렬
    const merchantGroups = Object.entries(groups)
      .map(([merchant, txs]) => ({
        merchant,
        transactions: txs,
        suggestedCategory: suggestCategory(merchant)
      }))
      .sort((a, b) => b.transactions.length - a.transactions.length);

    setMerchantGroups(merchantGroups);
  };

  const extractMerchantName = (description: string): string => {
    // "토스 - 스타벅스" -> "스타벅스"
    // "카카오페이 - 맥도날드" -> "맥도날드"
    const parts = description.split(' - ');
    if (parts.length > 1) {
      return parts[1].trim();
    }
    
    // 기타 패턴 처리
    return description
      .replace(/^(카드|체크|이체|송금)\s*/i, '')
      .replace(/\s*\d+원.*$/, '')
      .trim()
      .substring(0, 20); // 최대 20자로 제한
  };

  const suggestCategory = (merchant: string): string => {
    const keywords = {
      '식비': ['스타벅스', '맥도날드', '버거킹', 'KFC', '카페', '치킨', '피자', '음식점', '식당', '커피'],
      '교통비': ['지하철', '버스', '택시', '주유소', 'GS칼텍스', 'SK에너지', '현대오일뱅크'],
      '쇼핑': ['마트', '편의점', '이마트', '롯데마트', 'GS25', 'CU', '세븐일레븐', '쿠팡', '11번가'],
      '의료비': ['병원', '약국', '치과', '한의원', '의원'],
      '문화/여가': ['영화관', 'CGV', '롯데시네마', '메가박스', '노래방', 'PC방', '게임'],
    };

    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => merchant.includes(word))) {
        return category;
      }
    }

    return '기타';
  };

  const findSimilarMerchants = (targetMerchant: string): string[] => {
    const similar: string[] = [];
    
    merchantGroups.forEach(group => {
      if (group.merchant !== targetMerchant) {
        const similarity = calculateSimilarity(targetMerchant, group.merchant);
        if (similarity > 0.7) { // 70% 이상 유사도
          similar.push(group.merchant);
        }
      }
    });

    return similar;
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const normalize = (str: string) => 
      str.toLowerCase()
         .replace(/[\s\-_\(\)\[\]\.]/g, '')
         .replace(/[가-힣]+점/g, ''); // "스타벅스 강남점" -> "스타벅스"

    const norm1 = normalize(str1);
    const norm2 = normalize(str2);

    if (norm1 === norm2) return 1.0;
    if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.8;

    // 레벤슈타인 거리 기반 유사도
    const maxLen = Math.max(norm1.length, norm2.length);
    const distance = levenshteinDistance(norm1, norm2);
    return (maxLen - distance) / maxLen;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  const handleBulkCategoryUpdate = async () => {
    if (!selectedMerchant || !newCategoryId) return;

    try {
      const similarMerchants = findSimilarMerchants(selectedMerchant.merchant);
      const allMerchants = [selectedMerchant.merchant, ...similarMerchants];
      
      // 모든 유사한 가맹점의 거래들 찾기
      const transactionsToUpdate = merchantGroups
        .filter(group => allMerchants.includes(group.merchant))
        .flatMap(group => group.transactions)
        .map(t => t.id);

      // 일괄 업데이트
      const { error } = await supabase
        .from('transactions')
        .update({ category_id: newCategoryId })
        .in('id', transactionsToUpdate);

      if (error) throw error;

      toast({
        title: "카테고리 일괄 적용 완료",
        description: `${transactionsToUpdate.length}개의 거래에 카테고리가 적용되었습니다.`,
      });

      // 데이터 새로고침
      fetchTransactions();
      setShowCategoryDialog(false);
      setSelectedMerchant(null);
      setNewCategoryId('');
    } catch (error) {
      console.error('카테고리 일괄 적용 실패:', error);
      toast({
        title: "오류",
        description: "카테고리 적용에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const getFilteredCount = () => {
    if (selectedCategory === 'uncategorized') {
      return uncategorizedCount;
    } else if (selectedCategory === 'all') {
      return transactions.length;
    } else {
      return transactions.filter(t => t.category?.id === selectedCategory).length;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Tag className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">카테고리 관리</h1>
            </div>
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">전체 거래</p>
                <p className="text-2xl font-bold">{transactions.length.toLocaleString()}건</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">미분류 거래</p>
                <p className="text-2xl font-bold text-orange-600">{uncategorizedCount.toLocaleString()}건</p>
                {uncategorizedCount > 0 && (
                  <p className="text-xs text-orange-600 mt-1">분류가 필요합니다</p>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">분류 완료율</p>
                <p className="text-2xl font-bold text-green-600">
                  {transactions.length > 0 ? Math.round(((transactions.length - uncategorizedCount) / transactions.length) * 100) : 0}%
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 필터 및 검색 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              필터 및 검색
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-2 block">카테고리 필터</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 ({transactions.length}건)</SelectItem>
                    <SelectItem value="uncategorized">
                      미분류 ({uncategorizedCount}건)
                    </SelectItem>
                    {categories.map(category => {
                      const count = transactions.filter(t => t.category?.id === category.id).length;
                      return (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name} ({count}건)
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">가맹점 검색</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="가맹점명 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              현재 필터: {getFilteredCount()}건의 거래, {merchantGroups.length}개의 가맹점
            </div>
          </CardContent>
        </Card>

        {/* 가맹점별 거래 리스트 */}
        <Card>
          <CardHeader>
            <CardTitle>가맹점별 거래 현황</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">불러오는 중...</p>
              </div>
            ) : merchantGroups.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">조건에 맞는 거래가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {merchantGroups.map((group, index) => (
                  <div
                    key={group.merchant}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium">{group.merchant}</h3>
                        <Badge variant="outline">
                          {group.transactions.length}건
                        </Badge>
                        {group.transactions[0]?.category ? (
                          <Badge 
                            style={{ 
                              backgroundColor: group.transactions[0].category.color + '20',
                              color: group.transactions[0].category.color,
                              borderColor: group.transactions[0].category.color
                            }}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {group.transactions[0].category.name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600 border-orange-600">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            미분류
                          </Badge>
                        )}
                        {group.suggestedCategory && !group.transactions[0]?.category && (
                          <Badge variant="secondary" className="text-xs">
                            추천: {group.suggestedCategory}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        총 {group.transactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}원
                      </p>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedMerchant(group);
                        setShowCategoryDialog(true);
                      }}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      분류
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 카테고리 설정 다이얼로그 */}
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>카테고리 설정</DialogTitle>
            </DialogHeader>
            
            {selectedMerchant && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">{selectedMerchant.merchant}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedMerchant.transactions.length}건의 거래
                  </p>
                  
                  {findSimilarMerchants(selectedMerchant.merchant).length > 0 && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 mb-1">유사한 가맹점 발견</p>
                      <p className="text-xs text-blue-700">
                        {findSimilarMerchants(selectedMerchant.merchant).join(', ')}도 함께 분류됩니다.
                      </p>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">카테고리 선택</label>
                  <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="카테고리를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories
                        .filter(cat => cat.type === selectedMerchant.transactions[0]?.type)
                        .map(category => (
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
                  <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
                    취소
                  </Button>
                  <Button onClick={handleBulkCategoryUpdate} disabled={!newCategoryId}>
                    적용
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}