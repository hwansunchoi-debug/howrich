import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, TrendingUp, TrendingDown, Wallet, CreditCard, Smartphone, Bell, Calendar, Tag, Settings, Users, User } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ExpenseChart } from "./ExpenseChart";
import { RecentTransactions } from "./RecentTransactions";
import { TransactionForm } from "./TransactionForm";
import { YearlyChart } from "./YearlyChart";
import { AssetTrendChartEnhanced } from "./AssetTrendChartEnhanced";
import { AssetTrendChart2025Enhanced } from "./AssetTrendChart2025Enhanced";
import { InitialSetup } from "./InitialSetup";
import { UserHeader } from "./UserHeader";
import { CategoryManagementCard } from "./CategoryManagementCard";
import { FamilyAssetChart } from "./FamilyAssetChart";
import { FamilyManagement } from "./FamilyManagement";
import { supabase } from "@/integrations/supabase/client";
import { smsService } from "@/services/smsService";
import { notificationService } from "@/services/notificationService";
import { historicalDataProcessor } from "@/services/historicalDataProcessor";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Capacitor } from "@capacitor/core";

export const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isMaster, loading: roleLoading } = useUserRole();
  const [monthlyData, setMonthlyData] = useState({
    income: 0,
    expense: 0,
    other: 0,
    balance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [isProcessingHistory, setIsProcessingHistory] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);
  const [selectedView, setSelectedView] = useState<'me' | 'spouse' | 'family'>('me');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | string>(new Date().getMonth() + 1);
  const { toast } = useToast();

  useEffect(() => {
    if (user && !roleLoading) {
      checkSetupStatus();
      fetchMonthlyData();
      checkMobilePlatform();
    }
  }, [user, selectedView, isMaster, roleLoading, selectedYear, selectedMonth]);

  const checkMobilePlatform = () => {
    if (Capacitor.isNativePlatform()) {
      setSmsEnabled(true);
    }
  };

  const handleEnableSMS = async () => {
    try {
      await smsService.initializeSMSWatcher();
      toast({
        title: "SMS 자동 인식 활성화됨",
        description: "이제 결제/이체 문자가 자동으로 거래내역에 등록됩니다.",
      });
    } catch (error) {
      toast({
        title: "SMS 권한 필요",
        description: "SMS 읽기 권한을 허용해주세요.",
        variant: "destructive",
      });
    }
  };

  const handleEnableNotifications = async () => {
    try {
      await notificationService.initializeNotificationListener();
      toast({
        title: "푸시 알림 자동 인식 활성화됨",
        description: "이제 네이버페이, 카카오페이 등 앱 알림이 자동으로 거래내역에 등록됩니다.",
      });
    } catch (error) {
      toast({
        title: "알림 접근 권한 필요",
        description: "앱 알림 읽기 권한을 허용해주세요.",
        variant: "destructive",
      });
    }
  };

  const handleProcessHistoricalData = async () => {
    if (isProcessingHistory) return;

    setIsProcessingHistory(true);
    
    toast({
      title: "과거 데이터 처리 시작",
      description: "기존 문자와 알림에서 거래내역을 추출하고 있습니다. 시간이 걸릴 수 있습니다.",
    });

    try {
      await historicalDataProcessor.processHistoricalData();
      
      toast({
        title: "과거 데이터 처리 완료",
        description: "기존 거래내역과 잔액 정보가 모두 등록되었습니다.",
      });
      
      // 데이터 새로고침
      fetchMonthlyData();
      
    } catch (error) {
      toast({
        title: "과거 데이터 처리 실패",
        description: "일부 데이터 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingHistory(false);
    }
  };

  const checkSetupStatus = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('setup_completed')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('설정 상태 확인 실패:', error);
        setSetupCompleted(false);
        return;
      }

      setSetupCompleted(data?.setup_completed || false);
    } catch (error) {
      console.error('설정 상태 확인 중 오류:', error);
      setSetupCompleted(false);
    }
  };

  const fetchMonthlyData = async () => {
    if (!user) return;
    
    const currentYear = selectedYear;
    const currentMonth = typeof selectedMonth === 'number' ? selectedMonth : new Date().getMonth() + 1;
    
    // 권한에 따라 사용자 ID 결정
    let userIds: string[] = [user.id]; // 기본값: 본인만
    
    if (isMaster) {
      // 마스터는 선택된 뷰에 따라 데이터 범위 결정
      if (selectedView === 'spouse') {
        // 배우자 데이터만
        const { data: familyMembers } = await supabase
          .from('family_members')
          .select('member_id')
          .eq('owner_id', user.id)
          .eq('relationship', 'spouse');
        
        if (familyMembers && familyMembers.length > 0) {
          userIds = familyMembers.map(m => m.member_id);
        } else {
          userIds = []; // 배우자 데이터 없음
        }
      } else if (selectedView === 'family') {
        // 나 + 가족 모든 데이터
        const { data: familyMembers } = await supabase
          .from('family_members')
          .select('member_id')
          .eq('owner_id', user.id);
        
        if (familyMembers) {
          userIds = [user.id, ...familyMembers.map(m => m.member_id)];
        }
      }
      // selectedView === 'me'인 경우 userIds는 이미 [user.id]로 설정됨
    }
    // 일반 사용자는 항상 본인 데이터만 (userIds = [user.id])
    
    if (userIds.length === 0) {
      setMonthlyData({ income: 0, expense: 0, other: 0, balance: 0 });
      setLoading(false);
      return;
    }
    
    // 날짜 범위 설정
    let startDate, endDate;
    if (selectedMonth === 'all') {
      startDate = `${currentYear}-01-01`;
      endDate = `${currentYear}-12-31`;
    } else {
      startDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
      endDate = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`;
    }

    // 수입 조회
    const { data: incomeData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'income')
      .in('user_id', userIds)
      .gte('date', startDate)
      .lt('date', endDate);
    
    // 지출 조회
    const { data: expenseData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'expense')
      .in('user_id', userIds)
      .gte('date', startDate)
      .lt('date', endDate);
    
    // 기타 조회
    const { data: otherData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'other')
      .in('user_id', userIds)
      .gte('date', startDate)
      .lt('date', endDate);

    const totalIncome = incomeData?.reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;
    const totalExpense = expenseData?.reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;
    const totalOther = otherData?.reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;

    // 최신 잔액 데이터 조회 - account_balances에서 먼저 조회
    const { data: accountBalances } = await supabase
      .from('account_balances')
      .select('balance')
      .in('user_id', userIds);

    let totalBalance = 0;
    if (accountBalances && accountBalances.length > 0) {
      totalBalance = accountBalances.reduce((sum, account) => sum + Number(account.balance), 0);
    } else {
      // account_balances에 데이터가 없으면 balance_snapshots에서 조회
      const { data: latestBalance } = await supabase
        .from('balance_snapshots')
        .select('total_balance, snapshot_date')
        .in('user_id', userIds)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      totalBalance = latestBalance?.total_balance || 0;
    }

    setMonthlyData({
      income: totalIncome,
      expense: totalExpense,
      other: totalOther,
      balance: totalBalance,
    });
    
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const handleViewChange = (view: 'me' | 'spouse' | 'family') => {
    // 마스터만 뷰 변경 가능
    if (isMaster) {
      setSelectedView(view);
    }
  };
  
  const handleSetupComplete = () => {
    setSetupCompleted(true);
    checkMobilePlatform(); // 설정 완료 후 모바일 기능 활성화
  };

  // 사용자가 로그인하지 않은 경우
  if (!user) {
    return null;
  }

  // 로딩 중이거나 설정 상태를 확인 중인 경우
  if (loading || setupCompleted === null || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 로그인된 사용자만 대시보드에 접근 가능 (초기 설정 여부와 상관없이)
  // 초기 설정은 별도 버튼으로 접근 가능

  return (
    <div className="min-h-screen bg-background">
      <UserHeader 
        selectedView={selectedView}
        onViewChange={handleViewChange}
      />
      
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                {!isMaster ? '내 가계부' :
                 selectedView === 'me' ? '내 가계부' : 
                 selectedView === 'spouse' ? '배우자 가계부' : '가족 가계부'}
              </h1>
              <div className="flex items-center gap-4 flex-wrap">
                <p className="text-muted-foreground">
                  {selectedYear}년 {selectedMonth === 'all' ? '전체' : `${selectedMonth}월`} 재무현황
                </p>
                
                {/* 가계부 필터 및 가족 관리 */}
                <div className="flex items-center gap-2">
                  {isMaster && (
                    <>
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <Select value={selectedView} onValueChange={handleViewChange}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="me">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              내 가계부
                            </div>
                          </SelectItem>
                          <SelectItem value="spouse">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              배우자 가계부
                            </div>
                          </SelectItem>
                          <SelectItem value="family">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              가족 가계부 
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
                
                {/* 연/월 필터 */}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={selectedYear.toString()}
                    onValueChange={(value) => setSelectedYear(Number(value))}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = new Date().getFullYear() - i;
                        return (
                          <SelectItem key={year} value={year.toString()}>
                            {year}년
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Select
                    value={selectedMonth.toString()}
                    onValueChange={(value) => setSelectedMonth(value === 'all' ? 'all' : Number(value))}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {i + 1}월
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            {/* 오른쪽: 가족 관리 + 거래등록 */}
            <div className="flex items-center gap-2">
              {/* 가족 관리 버튼 (마스터만) */}
              {isMaster && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-1" />
                      가족 관리
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>가족 구성원 관리</DialogTitle>
                    </DialogHeader>
                    <FamilyManagement />
                  </DialogContent>
                </Dialog>
              )}
              <TransactionForm onTransactionAdded={fetchMonthlyData} />
            </div>
          </div>

        {/* SMS and Notification Auto Recognition */}
        {smsEnabled && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="bg-gradient-primary text-white shadow-elevated">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white/90">SMS 자동 인식</CardTitle>
                  <Smartphone className="h-4 w-4 text-white/90" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold mb-2">카드/은행 문자 감지</div>
                  <p className="text-xs text-white/80 mb-4">
                    카드 결제, 계좌 이체 문자를 자동으로 인식
                  </p>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={handleEnableSMS}
                    className="w-full"
                  >
                    SMS 자동 인식 활성화
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-gradient-success text-white shadow-elevated">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white/90">푸시 알림 인식</CardTitle>
                  <Bell className="h-4 w-4 text-white/90" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold mb-2">간편결제 알림 감지</div>
                  <p className="text-xs text-white/80 mb-4">
                    네이버페이, 카카오페이 등 앱 알림 자동 인식
                  </p>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={handleEnableNotifications}
                    className="w-full"
                  >
                    푸시 알림 인식 활성화
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Historical Data Processing */}
            <Card className="bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📚 기존 데이터 불러오기
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  휴대폰에 있는 기존 문자와 알림에서 거래내역과 잔액 정보를 자동으로 추출합니다.
                  <br />
                  최근 3개월간의 모든 금융 관련 문자를 분석하여 가계부를 완성합니다.
                </p>
                <Button 
                  onClick={handleProcessHistoricalData}
                  disabled={isProcessingHistory}
                  className="w-full"
                >
                  {isProcessingHistory ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      과거 데이터 처리 중...
                    </>
                  ) : (
                    '📊 기존 거래내역 불러오기'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card 
            className="bg-gradient-success text-white shadow-elevated cursor-pointer hover:shadow-lg transition-all transform hover:scale-[1.02]"
            onClick={() => navigate(`/income?year=${selectedYear}&month=${selectedMonth}`)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/90">이번 달 수입</CardTitle>
              <TrendingUp className="h-4 w-4 text-white/90" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '로딩 중...' : formatCurrency(monthlyData.income)}
              </div>
              <p className="text-xs text-white/80">이번 달 총 수입</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-card shadow-card cursor-pointer hover:shadow-lg transition-all transform hover:scale-[1.02]"
            onClick={() => navigate(`/expense?year=${selectedYear}&month=${selectedMonth}`)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">이번 달 지출</CardTitle>
              <TrendingDown className="h-4 w-4 text-expense" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-expense">
                {loading ? '로딩 중...' : formatCurrency(monthlyData.expense)}
              </div>
              <p className="text-xs text-muted-foreground">이번 달 총 지출</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-subtle shadow-card cursor-pointer hover:shadow-lg transition-all transform hover:scale-[1.02]"
            onClick={() => navigate(`/other?year=${selectedYear}&month=${selectedMonth}`)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">이번 달 기타</CardTitle>
              <Tag className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '로딩 중...' : formatCurrency(monthlyData.other)}
              </div>
              <p className="text-xs text-muted-foreground">이번 달 총 기타</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-primary text-white shadow-elevated cursor-pointer hover:shadow-lg transition-all transform hover:scale-[1.02]"
            onClick={() => navigate('/balance')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/90">잔액</CardTitle>
              <Wallet className="h-4 w-4 text-white/90" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '로딩 중...' : formatCurrency(monthlyData.balance)}
              </div>
              <p className="text-xs text-white/80">최신 계좌 잔액</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Transactions */}
        <div className="grid gap-6 lg:grid-cols-2">
          <YearlyChart />
          <ExpenseChart onDataRefresh={fetchMonthlyData} />
        </div>
        
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentTransactions onDataRefresh={fetchMonthlyData} />
          <CategoryManagementCard />
        </div>

        {/* Additional Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <AssetTrendChartEnhanced />
          <AssetTrendChart2025Enhanced />
        </div>
        

        {/* Initial Setup Access */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              설정
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/initial-setup')}
            >
              <Settings className="mr-2 h-4 w-4" />
              초기 설정 및 데이터 관리
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
};