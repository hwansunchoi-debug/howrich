import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, TrendingUp, TrendingDown, Wallet, CreditCard, Smartphone, Bell } from "lucide-react";
import { ExpenseChart } from "./ExpenseChart";
import { RecentTransactions } from "./RecentTransactions";
import { TransactionForm } from "./TransactionForm";
import { BudgetManager } from "./BudgetManager";
import { InitialSetup } from "./InitialSetup";
import { supabase } from "@/integrations/supabase/client";
import { smsService } from "@/services/smsService";
import { notificationService } from "@/services/notificationService";
import { historicalDataProcessor } from "@/services/historicalDataProcessor";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";

export const Dashboard = () => {
  const [monthlyData, setMonthlyData] = useState({
    income: 0,
    expense: 0,
    balance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [isProcessingHistory, setIsProcessingHistory] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkSetupStatus();
    fetchMonthlyData();
    checkMobilePlatform();
  }, []);

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
    try {
      const { data, error } = await (supabase as any)
        .from('user_settings')
        .select('setup_completed')
        .single();

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
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // 이번 달 수입 조회
    const { data: incomeData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'income')
      .gte('date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
      .lt('date', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`);
    
    // 이번 달 지출 조회
    const { data: expenseData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'expense')
      .gte('date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
      .lt('date', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`);

    const totalIncome = incomeData?.reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;
    const totalExpense = expenseData?.reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;

    setMonthlyData({
      income: totalIncome,
      expense: totalExpense,
      balance: totalIncome - totalExpense,
    });
    
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const handleSetupComplete = () => {
    setSetupCompleted(true);
    checkMobilePlatform(); // 설정 완료 후 모바일 기능 활성화
  };

  // 로딩 중이거나 설정 상태를 확인 중인 경우
  if (loading || setupCompleted === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 초기 설정이 완료되지 않은 경우 설정 화면 표시
  if (!setupCompleted) {
    return <InitialSetup onComplete={handleSetupComplete} />;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              우리 가계부
            </h1>
            <p className="text-muted-foreground">
              {new Date().getFullYear()}년 {new Date().getMonth() + 1}월 재무현황
            </p>
          </div>
          <TransactionForm onTransactionAdded={fetchMonthlyData} />
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
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-success text-white shadow-elevated">
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

          <Card className="bg-gradient-card shadow-card">
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

          <Card className="bg-gradient-primary text-white shadow-elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/90">잔액</CardTitle>
              <Wallet className="h-4 w-4 text-white/90" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '로딩 중...' : formatCurrency(monthlyData.balance)}
              </div>
              <p className="text-xs text-white/80">이번 달 순잔액</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Transactions */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <ExpenseChart onDataRefresh={fetchMonthlyData} />
            <BudgetManager />
          </div>
          <div>
            <RecentTransactions onDataRefresh={fetchMonthlyData} />
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              빠른 작업
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="justify-start">
                <PlusCircle className="mr-2 h-4 w-4 text-income" />
                수입 추가
              </Button>
              <Button variant="outline" className="justify-start">
                <PlusCircle className="mr-2 h-4 w-4 text-expense" />
                지출 추가
              </Button>
              <Button variant="outline" className="justify-start">
                <TrendingUp className="mr-2 h-4 w-4" />
                월별 리포트
              </Button>
              <Button variant="outline" className="justify-start">
                <Wallet className="mr-2 h-4 w-4" />
                예산 설정
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};