import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Tag, Filter, Search, AlertCircle, CheckCircle, Edit2, Plus, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import CategoryStatusCard from "@/components/CategoryStatusCard";
import MerchantMappingCard from "@/components/MerchantMappingCard";

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
  const [selectedMerchants, setSelectedMerchants] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'merchants' | 'categories'>('merchants');
  const [bulkCategoryId, setBulkCategoryId] = useState('');

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
        .or(`user_id.is.null,user_id.eq.${user?.id}`)
        .order('name');

      if (error) throw error;
      
      // 중복 제거 로직 추가
      const uniqueCategories = (data || []).reduce((acc, cat) => {
        const existing = acc.find(c => c.name === cat.name && c.type === cat.type);
        if (!existing) {
          acc.push(cat);
        } else if (cat.user_id === null && existing.user_id !== null) {
          // 기본 카테고리를 우선순위로 선택
          const index = acc.findIndex(c => c.id === existing.id);
          acc[index] = cat;
        }
        return acc;
      }, [] as any[]);
      
      setCategories(uniqueCategories as Category[]);
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

  const groupTransactionsByMerchant = async () => {
    let filteredTransactions = transactions;

    // 기본적으로 미분류 거래만 보여주기 (카테고리 분류가 완료된 가맹점은 숨기기)
    if (selectedCategory === 'all') {
      filteredTransactions = transactions.filter(t => !t.category_id);
    } else if (selectedCategory === 'uncategorized') {
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
    const merchantGroups = await Promise.all(
      Object.entries(groups).map(async ([merchant, txs]) => ({
        merchant,
        transactions: txs,
        suggestedCategory: await suggestCategory(merchant)
      }))
    );

    setMerchantGroups(merchantGroups.sort((a, b) => b.transactions.length - a.transactions.length));
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

  const suggestCategory = async (merchant: string): Promise<string> => {
    // 먼저 학습된 카테고리가 있는지 확인
    const learnedCategoryId = await getLearnedCategory(merchant);
    if (learnedCategoryId) {
      const category = categories.find(c => c.id === learnedCategoryId);
      if (category) return category.name;
    }

    // 새로운 카테고리 분류 체계 적용
    const categoryKeywords = {
      '교육': ['학원', '과외', '교육', '학습', '강의', '도서', '책'],
      '식비': ['음식', '식당', '외식', '레스토랑', '한식', '중식', '일식', '양식', '분식', '치킨', '피자'],
      '경조사': ['경조사', '축의', '부의', '결혼', '장례', '돌잔치', '선물', '꽃'],
      '취미&여가': ['영화', 'CGV', '롯데시네마', '메가박스', '노래방', 'PC방', '볼링', '골프', '공연'],
      '교통&자동차': ['지하철', '버스', '택시', '주유', '기름', 'SK에너지', 'GS칼텍스', '주차'],
      '쇼핑': ['백화점', '아울렛', '쿠팡', '11번가', 'G마켓', '옥션', '의류', '옷', '신발'],
      '여행&숙박': ['호텔', '모텔', '펜션', '여행', '항공', '기차', 'KTX'],
      '보험&세금&기타금융': ['보험', '세금', '적금', '저축', '펀드', '투자', '대출'],
      '편의점&마트&잡화': ['편의점', '마트', 'GS25', 'CU', '세븐일레븐', '이마트', '롯데마트'],
      '유흥&술': ['술', '소주', '맥주', '와인', '주점', '호프', '바', '클럽'],
      '의료&건강&피트니스': ['병원', '의원', '치과', '약국', '헬스장', '요가', '수영장'],
      '미용': ['미용실', '헤어샵', '네일샵', '화장품', '에스테틱', '마사지'],
      '생활': ['세제', '화장지', '세탁', '청소', '생필품', '일용품'],
      '주거&통신': ['월세', '관리비', '전기', '가스', '수도', '인터넷', '핸드폰', 'SKT', 'KT'],
      '카페&간식': ['카페', '커피', '스타벅스', '이디야', '빽다방', '투썸', '디저트', '케이크']
    };

    const merchantLower = merchant.toLowerCase();
    
    // 카테고리 이름 자체가 포함되어 있는지 먼저 확인
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const categoryWords = category.split('&').map(word => word.trim());
      for (const categoryWord of categoryWords) {
        if (merchantLower.includes(categoryWord.toLowerCase())) {
          return category;
        }
      }
    }

    // 키워드 매칭
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => merchantLower.includes(keyword.toLowerCase()))) {
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

      // 가맹점별 카테고리 매핑 저장 (전역으로 저장)
      for (const merchant of allMerchants) {
        const { error: mappingError } = await supabase
          .from('merchant_category_mappings')
          .upsert({
            merchant_name: merchant,
            category_id: newCategoryId
          });
        
        if (mappingError) {
          console.error('가맹점 매핑 저장 실패:', mappingError);
        }
      }

      toast({
        title: "카테고리 일괄 적용 완료",
        description: `${transactionsToUpdate.length}개의 거래에 카테고리가 적용되었습니다.`,
      });

      // 데이터 새로고침 및 검색어 초기화 (미분류 항목들이 바로 보이도록)
      fetchTransactions();
      setShowCategoryDialog(false);
      setSelectedMerchant(null);
      setNewCategoryId('');
      setSearchTerm('');
    } catch (error) {
      console.error('카테고리 일괄 적용 실패:', error);
      toast({
        title: "오류",
        description: "카테고리 적용에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleSuggestedCategoryClick = async (merchant: MerchantGroup, suggestedCategory: string) => {
    // 추천 카테고리명으로 실제 카테고리 ID 찾기
    const category = categories.find(c => c.name === suggestedCategory && c.type === merchant.transactions[0]?.type);
    if (!category) {
      toast({
        title: "오류",
        description: "해당 카테고리를 찾을 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      const similarMerchants = findSimilarMerchants(merchant.merchant);
      const allMerchants = [merchant.merchant, ...similarMerchants];
      
      // 모든 유사한 가맹점의 거래들 찾기
      const transactionsToUpdate = merchantGroups
        .filter(group => allMerchants.includes(group.merchant))
        .flatMap(group => group.transactions)
        .map(t => t.id);

      // 일괄 업데이트
      const { error } = await supabase
        .from('transactions')
        .update({ category_id: category.id })
        .in('id', transactionsToUpdate);

      if (error) throw error;

      // 가맹점별 카테고리 매핑 저장 (전역으로 저장)
      for (const merchantName of allMerchants) {
        const { error: mappingError } = await supabase
          .from('merchant_category_mappings')
          .upsert({
            merchant_name: merchantName,
            category_id: category.id
          });
        
        if (mappingError) {
          console.error('가맹점 매핑 저장 실패:', mappingError);
        }
      }

      toast({
        title: "카테고리 자동 적용 완료",
        description: `${transactionsToUpdate.length}개의 거래에 "${suggestedCategory}" 카테고리가 적용되었습니다.`,
      });

      // 데이터 새로고침 및 검색어 초기화 (미분류 항목들이 바로 보이도록)
      fetchTransactions();
      setSearchTerm('');
    } catch (error) {
      console.error('카테고리 자동 적용 실패:', error);
      toast({
        title: "오류",
        description: "카테고리 적용에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleBulkSelectedUpdate = async () => {
    if (selectedMerchants.size === 0 || !bulkCategoryId) return;

    try {
      // 선택된 모든 가맹점의 거래들 수집
      const selectedGroups = merchantGroups.filter(group => selectedMerchants.has(group.merchant));
      const transactionsToUpdate = selectedGroups.flatMap(group => group.transactions.map(t => t.id));

      // 일괄 업데이트
      const { error } = await supabase
        .from('transactions')
        .update({ category_id: bulkCategoryId })
        .in('id', transactionsToUpdate);

      if (error) throw error;

      // 가맹점별 카테고리 매핑 저장 (전역으로 저장)
      for (const group of selectedGroups) {
        const { error: mappingError } = await supabase
          .from('merchant_category_mappings')
          .upsert({
            merchant_name: group.merchant,
            category_id: bulkCategoryId
          });
        
        if (mappingError) {
          console.error('가맹점 매핑 저장 실패:', mappingError);
        }
      }

      toast({
        title: "일괄 분류 완료",
        description: `${transactionsToUpdate.length}개의 거래에 카테고리가 적용되었습니다.`,
      });

      // 데이터 새로고침 및 선택 초기화
      fetchTransactions();
      setSelectedMerchants(new Set());
      setBulkMode(false);
      setBulkCategoryId('');
      setSearchTerm('');
    } catch (error) {
      console.error('일괄 분류 실패:', error);
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

  const getLearnedCategory = async (merchant: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('merchant_category_mappings')
        .select('category_id')
        .eq('merchant_name', merchant)
        .single();

      if (error || !data) return null;
      return data.category_id;
    } catch (error) {
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
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

        {/* 탭 네비게이션 */}
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="transactions">가맹점별 거래 현황</TabsTrigger>
            <TabsTrigger value="categories">카테고리별 사용 현황</TabsTrigger>
            <TabsTrigger value="mappings">가맹점 매핑 현황</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-6">
            {/* 가맹점별 거래 리스트 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  가맹점별 거래 현황
              <div className="flex items-center gap-2">
                <Button
                  variant={bulkMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setBulkMode(!bulkMode);
                    setSelectedMerchants(new Set());
                  }}
                >
                  {bulkMode ? "완료" : "대량 선택"}
                </Button>
                {bulkMode && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const allMerchants = new Set(merchantGroups.map(g => g.merchant));
                        setSelectedMerchants(allMerchants);
                      }}
                    >
                      전체 선택
                    </Button>
                    {selectedMerchants.size > 0 && (
                      <div className="flex items-center gap-2">
                        <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="카테고리 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories
                              .filter(cat => cat.type === 'expense') // 대부분의 거래가 지출이므로
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
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleBulkSelectedUpdate}
                          disabled={!bulkCategoryId}
                        >
                          선택된 {selectedMerchants.size}개 분류
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardTitle>
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
                    {bulkMode && (
                      <input
                        type="checkbox"
                        checked={selectedMerchants.has(group.merchant)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedMerchants);
                          if (e.target.checked) {
                            newSelected.add(group.merchant);
                          } else {
                            newSelected.delete(group.merchant);
                          }
                          setSelectedMerchants(newSelected);
                        }}
                        className="mr-3"
                      />
                    )}
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
                          <Badge 
                            variant="secondary" 
                            className="text-xs cursor-pointer hover:bg-blue-200 transition-colors"
                            onClick={() => handleSuggestedCategoryClick(group, group.suggestedCategory!)}
                          >
                            추천: {group.suggestedCategory}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-muted-foreground">
                          총 {group.transactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}원
                        </p>
                        <p className="text-sm text-muted-foreground">
                          최근: {new Date(group.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
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
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <CategoryStatusCard categories={categories} transactions={transactions} user={user} onCategoriesChange={fetchCategories} />
          </TabsContent>
          
          <TabsContent value="mappings" className="space-y-6">
            <MerchantMappingCard user={user} />
          </TabsContent>
        </Tabs>

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