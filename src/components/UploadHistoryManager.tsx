import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Trash2, AlertCircle } from 'lucide-react';
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

export const UploadHistoryManager: React.FC = () => {
  const { user } = useAuth();
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchUploadFiles();
    }
  }, [user]);

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
      toast({
        variant: "destructive",
        title: "업로드 기록 조회 실패",
        description: "업로드 기록을 불러오는 중 오류가 발생했습니다."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
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
        title: "업로드 데이터 삭제 완료",
        description: "업로드된 파일과 관련 거래내역이 모두 삭제되었습니다."
      });

      // 목록 새로고침
      fetchUploadFiles();
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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  if (uploadFiles.length === 0) {
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

        {uploadFiles.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">{file.original_filename}</div>
                <div className="text-sm text-muted-foreground">
                  업로드: {formatDate(file.upload_date)} • 
                  크기: {formatFileSize(file.file_size)} • 
                  처리된 기록: {file.processed_records_count}건
                </div>
                {file.error_message && (
                  <div className="text-sm text-red-600 mt-1">
                    오류: {file.error_message}
                  </div>
                )}
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
                onClick={() => handleDelete(file.id)}
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
      </CardContent>
    </Card>
  );
};