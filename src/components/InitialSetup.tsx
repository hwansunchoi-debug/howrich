import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, CheckCircle, ArrowRight, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TransactionUpload } from './TransactionUpload';
import { AccountBalanceForm } from './AccountBalanceForm';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type SetupStep = 'date' | 'transactions' | 'balances' | 'complete';

interface InitialSetupProps {
  onComplete: () => void;
}

export const InitialSetup: React.FC<InitialSetupProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState<SetupStep>('date');
  const [cutoffDate, setCutoffDate] = useState<Date | undefined>(new Date());
  const [completedSteps, setCompletedSteps] = useState<Set<SetupStep>>(new Set());

  const steps = [
    { id: 'date' as SetupStep, title: '기준일 설정', description: '자동 인식을 시작할 날짜를 선택하세요' },
    { id: 'transactions' as SetupStep, title: '과거 거래내역', description: '금융기관 CSV 파일을 업로드하세요' },
    { id: 'balances' as SetupStep, title: '계좌 잔액', description: '현재 계좌 잔액을 입력하세요' },
    { id: 'complete' as SetupStep, title: '설정 완료', description: '모든 설정이 완료되었습니다' }
  ];

  const getStepIndex = (step: SetupStep) => steps.findIndex(s => s.id === step);
  const currentStepIndex = getStepIndex(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const markStepComplete = (step: SetupStep) => {
    setCompletedSteps(prev => new Set([...prev, step]));
  };

  const handleDateNext = () => {
    if (!cutoffDate) {
      toast({
        variant: "destructive",
        title: "날짜 선택 필요",
        description: "기준일을 선택해주세요."
      });
      return;
    }
    
    markStepComplete('date');
    setCurrentStep('transactions');
  };

  const handleTransactionsComplete = () => {
    markStepComplete('transactions');
    setCurrentStep('balances');
  };

  const handleBalancesComplete = () => {
    markStepComplete('balances');
    setCurrentStep('complete');
  };

  const handleSetupComplete = async () => {
    try {
      // 설정 완료 상태를 데이터베이스에 저장
      const { error } = await (supabase as any)
        .from('user_settings')
        .upsert({
          setup_completed: true,
          setup_completion_date: new Date().toISOString(),
          initial_data_cutoff_date: cutoffDate?.toISOString().split('T')[0]
        });

      if (error) {
        throw error;
      }

      toast({
        title: "초기 설정 완료",
        description: "이제 SMS/알림 자동 인식이 활성화됩니다."
      });

      onComplete();
    } catch (error) {
      console.error('설정 저장 실패:', error);
      toast({
        variant: "destructive",
        title: "설정 저장 실패",
        description: "설정을 저장하는 중 오류가 발생했습니다."
      });
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'date':
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                자동 인식 시작 기준일
              </CardTitle>
              <CardDescription>
                이 날짜부터 SMS와 앱 알림을 통해 자동으로 거래내역을 인식합니다.
                과거 데이터는 CSV 업로드로 등록하세요.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>기준일 선택</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !cutoffDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {cutoffDate ? format(cutoffDate, "yyyy년 MM월 dd일", { locale: ko }) : "날짜를 선택하세요"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={cutoffDate}
                      onSelect={setCutoffDate}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>권장:</strong> 오늘 날짜 또는 이번 달 1일을 선택하시면,
                  앞으로 발생하는 모든 거래가 자동으로 기록됩니다.
                </p>
              </div>

              <Button onClick={handleDateNext} className="w-full">
                다음 단계
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        );

      case 'transactions':
        return (
          <TransactionUpload onComplete={handleTransactionsComplete} />
        );

      case 'balances':
        return (
          <AccountBalanceForm onComplete={handleBalancesComplete} />
        );

      case 'complete':
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle>초기 설정 완료!</CardTitle>
              <CardDescription>
                모든 설정이 완료되었습니다. 이제 자동 거래내역 인식이 시작됩니다.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium">기준일</span>
                  <span className="text-sm">
                    {cutoffDate ? format(cutoffDate, "yyyy년 MM월 dd일", { locale: ko }) : "-"}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm font-medium">과거 거래내역</span>
                  <Badge variant={completedSteps.has('transactions') ? 'default' : 'secondary'}>
                    {completedSteps.has('transactions') ? '업로드 완료' : '건너뜀'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <span className="text-sm font-medium">계좌 잔액</span>
                  <Badge variant={completedSteps.has('balances') ? 'default' : 'secondary'}>
                    {completedSteps.has('balances') ? '입력 완료' : '건너뜀'}
                  </Badge>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>자동 인식 활성화:</strong><br />
                  • SMS 거래 알림 자동 파싱<br />
                  • 은행/카드/페이 앱 알림 자동 인식<br />
                  • 중복 거래 자동 제거<br />
                  • 계좌 잔액 자동 업데이트
                </p>
              </div>

              <Button onClick={handleSetupComplete} className="w-full" size="lg">
                <Settings className="mr-2 h-4 w-4" />
                가계부 시작하기
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">초기 설정</h1>
            <p className="text-muted-foreground">
              정확한 가계부 관리를 위한 초기 설정을 진행합니다
            </p>
          </div>
          
          {/* 진행 상태 */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>진행 상황</span>
              <span>{Math.round(progress)}% 완료</span>
            </div>
            <Progress value={progress} className="h-2" />
            
            <div className="flex justify-center">
              <div className="flex items-center gap-2">
                {steps.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                      index <= currentStepIndex 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      {completedSteps.has(step.id) ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    {index < steps.length - 1 && (
                      <div className={cn(
                        "w-12 h-0.5",
                        index < currentStepIndex ? "bg-primary" : "bg-muted"
                      )} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="container mx-auto px-4 py-8">
        {renderStepContent()}
      </div>
    </div>
  );
};