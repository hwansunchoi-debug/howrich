import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Trash2, Calendar, Download, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface UploadRecord {
  id: string;
  filename: string;
  upload_date: string;
  record_count: number;
  file_type: 'csv' | 'xlsx';
  status: 'success' | 'partial' | 'failed';
}

export const UploadHistoryManager: React.FC = () => {
  const { user } = useAuth();
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchUploadHistory();
    }
  }, [user]);

  const fetchUploadHistory = async () => {
    if (!user) return;

    try {
      // 사용자의 거래 내역에서 업로드된 파일별로 그룹화
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('source, created_at')
        .eq('user_id', user.id)
        .eq('source', 'csv_upload')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 업로드 기록을 날짜별로 그룹화
      const groupedUploads: Record<string, number> = {};
      transactions?.forEach(transaction => {
        const date = transaction.created_at.split('T')[0];
        groupedUploads[date] = (groupedUploads[date] || 0) + 1;
      });

      const uploadRecords: UploadRecord[] = Object.entries(groupedUploads).map(([date, count]) => ({
        id: date,
        filename: `upload_${date}`,
        upload_date: date,
        record_count: count,
        file_type: 'csv' as const,
        status: 'success' as const
      }));

      setUploads(uploadRecords);
    } catch (error) {
      console.error('업로드 기록 조회 실패:', error);
      toast({
        variant: "destructive",
        title: "업로드 기록 조회 실패",
        description: "업로드 기록을 불러오는 중 오류가 발생했습니다."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (uploadDate: string) => {
    if (!user) return;

    setDeleting(uploadDate);
    
    try {
      // 해당 날짜의 CSV 업로드 거래내역 삭제
      const { error: transactionError } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id)
        .eq('source', 'csv_upload')
        .gte('created_at', `${uploadDate}T00:00:00`)
        .lt('created_at', `${uploadDate}T23:59:59`);

      if (transactionError) throw transactionError;

      // 관련 잔액 스냅샷도 삭제 (필요한 경우)
      const { error: balanceError } = await supabase
        .from('balance_snapshots')
        .delete()
        .eq('user_id', user.id)
        .eq('snapshot_date', uploadDate);

      // 잔액 오류는 무시 (잔액은 다른 소스에서도 올 수 있음)

      toast({
        title: "업로드 데이터 삭제 완료",
        description: `${uploadDate} 업로드된 거래내역이 모두 삭제되었습니다.`
      });

      // 목록 새로고침
      fetchUploadHistory();
    } catch (error) {
      console.error('업로드 데이터 삭제 실패:', error);
      toast({
        variant: "destructive",
        title: "삭제 실패",
        description: "데이터를 삭제하는 중 오류가 발생했습니다."
      });
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            업로드 기록 관리
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (uploads.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            업로드 기록 관리
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">아직 업로드된 파일이 없습니다.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          업로드 기록 관리
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            업로드된 데이터를 삭제하면 해당 거래내역이 모든 화면에서 제거됩니다. 신중하게 선택해주세요.
          </AlertDescription>
        </Alert>

        {uploads.map((upload) => (
          <div
            key={upload.id}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">
                  {formatDate(upload.upload_date)} 업로드
                </div>
                <div className="text-sm text-muted-foreground">
                  {upload.record_count}개 거래내역
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={upload.status === 'success' ? 'default' : 'destructive'}>
                {upload.status === 'success' ? '성공' : '실패'}
              </Badge>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(upload.id)}
                disabled={deleting === upload.id}
              >
                {deleting === upload.id ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};