import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, TrendingUp, TrendingDown, Wallet, CreditCard } from "lucide-react";
import { ExpenseChart } from "./ExpenseChart";
import { RecentTransactions } from "./RecentTransactions";

export const Dashboard = () => {
  // 임시 데이터 - 실제 구현시 Supabase에서 가져올 예정
  const monthlyData = {
    income: 4500000,
    expense: 3200000,
    balance: 1300000,
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

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
          <Button className="bg-gradient-primary hover:opacity-90 transition-opacity">
            <PlusCircle className="mr-2 h-4 w-4" />
            거래내역 추가
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-success text-white shadow-elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/90">이번 달 수입</CardTitle>
              <TrendingUp className="h-4 w-4 text-white/90" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(monthlyData.income)}</div>
              <p className="text-xs text-white/80">전월 대비 +5.2%</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">이번 달 지출</CardTitle>
              <TrendingDown className="h-4 w-4 text-expense" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-expense">{formatCurrency(monthlyData.expense)}</div>
              <p className="text-xs text-muted-foreground">전월 대비 -2.1%</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-primary text-white shadow-elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/90">잔액</CardTitle>
              <Wallet className="h-4 w-4 text-white/90" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(monthlyData.balance)}</div>
              <p className="text-xs text-white/80">목표 대비 87%</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Transactions */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ExpenseChart />
          </div>
          <div>
            <RecentTransactions />
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