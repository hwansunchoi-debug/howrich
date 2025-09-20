import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Settings, 
  FileText, 
  Upload, 
  Trash2, 
  BarChart3, 
  CheckCircle,
  AlertCircle,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TransactionUpload } from './TransactionUpload';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface UploadFile {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  file_type: string;
  upload_date: string;
  processed_records_count: number;
  status: 'processing' | 'success' | 'failed' | 'partial';
  error_message?: string;
}

interface SystemStats {
  totalTransactions: number;
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  uploadedFiles: number;
  categorizedTransactions: number;
}

interface InitialSetupProps {
  onComplete?: () => void;
  onBack?: () => void;
}

export const InitialSetup: React.FC<InitialSetupProps> = ({ onComplete, onBack }) => {
  const { user } = useAuth();
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalTransactions: 0,
    totalIncome: 0,
    totalExpense: 0,
    totalBalance: 0,
    uploadedFiles: 0,
    categorizedTransactions: 0
  });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [cutoffDate, setCutoffDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await Promise.all([
        fetchUploadFiles(),
        fetchSystemStats(),
        checkSetupStatus()
      ]);
    } catch (error) {
      console.error('데이터 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUploadFiles = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('upload_files')
        .select('*')
        .eq('user_id', user.id)
        .order('upload_date', { ascending: false });

      if (error) throw error;
      setUploadFiles((data || []).map(file => ({
        ...file,
        status: file.status as 'processing' | 'success' | 'failed' | 'partial'
      })));
    } catch (error) {
      console.error('업로드 파일 조회 실패:', error);
    }
  };

  const fetchSystemStats = async () => {
    if (!user) return;

    try {
      // 거래내역 통계
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('amount, type, category_id')
        .eq('user_id', user.id);

      if (txError) throw txError;

      // 잔액 조회
      const { data: balances, error: balanceError } = await supabase
        .from('account_balances')
        .select('balance')
        .eq('user_id', user.id);

      if (balanceError && balanceError.code !== 'PGRST116') throw balanceError;

      const totalIncome = transactions?.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalExpense = transactions?.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalBalance = balances?.reduce((sum, b) => sum + Number(b.balance), 0) || 0;
      const categorizedTransactions = transactions?.filter(t => t.category_id).length || 0;

      setStats({
        totalTransactions: transactions?.length || 0,
        totalIncome,
        totalExpense,
        totalBalance,
        uploadedFiles: uploadFiles.length,
        categorizedTransactions
      });
    } catch (error) {
      console.error('통계 조회 실패:', error);
    }
  };

  const checkSetupStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('setup_completed, initial_data_cutoff_date')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setSetupCompleted(data?.setup_completed || false);
      
      // 기존 기준일 불러오기
      if (data?.initial_data_cutoff_date) {
        setCutoffDate(new Date(data.initial_data_cutoff_date));
      }
    } catch (error) {
      console.error('설정 상태 확인 실패:', error);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!user) return;

    setDeleting(fileId);
    
    try {
      // 해당 파일로 업로드된 거래내역 삭제
      const { error: txError } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id)
        .eq('file_upload_id', fileId);

      if (txError) throw txError;

      // 업로드 파일 기록 삭제
      const { error: fileError } = await supabase
        .from('upload_files')
        .delete()
        .eq('id', fileId)
        .eq('user_id', user.id);

      if (fileError) throw fileError;

      toast({
        title: "파일 삭제 완료",
        description: "업로드된 파일과 관련 거래내역이 모두 삭제되었습니다.",
      });

      // 데이터 새로고침
      fetchData();
    } catch (error) {
      console.error('파일 삭제 실패:', error);
      toast({
        title: "삭제 실패",
        description: "파일 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleCompleteSetup = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          setup_completed: true,
          setup_completion_date: new Date().toISOString(),
          initial_data_cutoff_date: cutoffDate?.toISOString().split('T')[0]
        });

      if (error) throw error;

      toast({
        title: "설정 완료",
        description: "초기 설정이 완료되었습니다.",
      });

      setSetupCompleted(true);
      if (onComplete) onComplete();
    } catch (error) {
      console.error('설정 완료 실패:', error);
      toast({
        title: "설정 실패",
        description: "설정 완료 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button variant="ghost" size="icon" onClick={onBack}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <div>
                <h1 className="text-3xl font-bold">초기 설정 및 데이터 관리</h1>
                <p className="text-muted-foreground mt-2">
                  과거 거래내역 업로드 및 시스템 현황을 관리합니다
                </p>
              </div>
            </div>
            
            {setupCompleted ? (
              <Badge variant="default" className="text-sm px-3 py-1">
                <CheckCircle className="h-4 w-4 mr-1" />
                설정 완료
              </Badge>
            ) : (
              <Button onClick={handleCompleteSetup}>
                <Settings className="h-4 w-4 mr-2" />
                설정 완료
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* 기준일 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              자동 인식 시작 기준일
            </CardTitle>
            <CardDescription>
              이 날짜부터 SMS와 앱 알림을 통해 자동으로 거래내역을 인식합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>기준일 선택</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full max-w-md justify-start text-left font-normal",
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
            </div>
          </CardContent>
        </Card>

        {/* 시스템 현황 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">총 거래내역</p>
                  <p className="text-2xl font-bold">{stats.totalTransactions}건</p>
                </div>
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">총 수입</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalIncome)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">총 지출</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalExpense)}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">카테고리 분류율</p>
                  <p className="text-2xl font-bold">
                    {stats.totalTransactions > 0 
                      ? Math.round((stats.categorizedTransactions / stats.totalTransactions) * 100)
                      : 0}%
                  </p>
                </div>
                <div className="w-8 h-8 flex items-center justify-center">
                  <Progress 
                    value={stats.totalTransactions > 0 ? (stats.categorizedTransactions / stats.totalTransactions) * 100 : 0} 
                    className="w-8 h-2" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 새 파일 업로드 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              과거 거래내역 업로드
            </CardTitle>
            <CardDescription>
              은행, 카드사에서 다운로드한 거래내역 파일(CSV, Excel)을 업로드하여 과거 데이터를 가져올 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionUpload onComplete={fetchData} />
          </CardContent>
        </Card>

        {/* 업로드된 파일 목록 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              업로드된 파일 목록
            </CardTitle>
            <CardDescription>
              현재까지 업로드된 파일들을 관리합니다. 파일을 삭제하면 관련된 모든 거래내역도 삭제됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {uploadFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">아직 업로드된 파일이 없습니다.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  위의 업로드 섹션을 사용해 과거 거래내역을 가져오세요.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    파일을 삭제하면 해당 파일로 가져온 모든 거래내역이 삭제됩니다. 신중하게 선택해주세요.
                  </AlertDescription>
                </Alert>

                {uploadFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{file.original_filename}</div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>업로드: {formatDate(file.upload_date)}</p>
                          <p>크기: {formatFileSize(file.file_size)} • 처리된 기록: {file.processed_records_count}건</p>
                          {file.error_message && (
                            <p className="text-red-600">오류: {file.error_message}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={
                          file.status === 'success' ? 'default' : 
                          file.status === 'failed' ? 'destructive' : 
                          file.status === 'partial' ? 'secondary' : 'outline'
                        }
                      >
                        {file.status === 'success' ? '성공' : 
                         file.status === 'failed' ? '실패' : 
                         file.status === 'partial' ? '부분성공' : '처리중'}
                      </Badge>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteFile(file.id)}
                        disabled={deleting === file.id}
                      >
                        {deleting === file.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 완료 안내 */}
        {!setupCompleted && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">초기 설정을 완료하세요</h3>
                  <p className="text-muted-foreground mt-2">
                    기준일 설정과 과거 거래내역 업로드가 완료되면 상단의 "설정 완료" 버튼을 눌러 초기 설정을 마무리하세요.
                  </p>
                </div>
                <Button onClick={handleCompleteSetup} size="lg" className="mt-4">
                  <Settings className="h-4 w-4 mr-2" />
                  초기 설정 완료
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};