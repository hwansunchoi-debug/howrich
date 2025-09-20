import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { CSVParser } from '@/services/csvParser';
import { toast } from '@/hooks/use-toast';

interface TransactionUploadProps {
  onComplete: () => void;
}

export const TransactionUpload: React.FC<TransactionUploadProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{
    success: number;
    errors: string[];
  } | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast({
          variant: "destructive",
          title: "잘못된 파일 형식",
          description: "CSV 파일만 업로드 가능합니다."
        });
        return;
      }
      setFile(selectedFile);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // CSV 파싱
      setUploadProgress(30);
      const parseResult = await CSVParser.parseTransactionCSV(file);
      
      if (parseResult.errors.length > 0 && parseResult.transactions.length === 0) {
        toast({
          variant: "destructive",
          title: "CSV 파싱 실패",
          description: "파일 형식을 확인해주세요."
        });
        setUploadResult({ success: 0, errors: parseResult.errors });
        setIsUploading(false);
        return;
      }

      // 데이터베이스에 저장
      setUploadProgress(70);
      const saveResult = await CSVParser.saveTransactions(parseResult.transactions);
      
      setUploadProgress(100);
      setUploadResult({
        success: saveResult.success,
        errors: [...parseResult.errors, ...saveResult.errors]
      });

      if (saveResult.success > 0) {
        toast({
          title: "업로드 완료",
          description: `${saveResult.success}개의 거래내역이 성공적으로 업로드되었습니다.`
        });
        
        // 성공적으로 업로드되면 완료 처리
        setTimeout(onComplete, 1000);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "업로드 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      });
      setUploadResult({ success: 0, errors: [error instanceof Error ? error.message : "알 수 없는 오류"] });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          과거 거래내역 업로드
        </CardTitle>
        <CardDescription>
          금융기관에서 다운로드한 CSV 파일을 업로드하여 과거 거래내역을 일괄 등록하세요.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            <strong>CSV 파일 형식 안내:</strong><br />
            • 컬럼 순서: 날짜, 내용, 금액, 분류(선택)<br />
            • 날짜 형식: YYYY-MM-DD, YYYY.MM.DD, YYYYMMDD 등<br />
            • 금액은 양수/음수로 수입/지출 구분 (음수면 지출)<br />
            • 첫 번째 행이 헤더인 경우 자동으로 건너뜁니다.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
          </div>

          {file && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              
              {!isUploading && (
                <Button onClick={handleUpload} size="sm">
                  업로드 시작
                </Button>
              )}
            </div>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>업로드 중...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {uploadResult && (
            <div className="space-y-3">
              {uploadResult.success > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{uploadResult.success}개의 거래내역</strong>이 성공적으로 업로드되었습니다.
                  </AlertDescription>
                </Alert>
              )}

              {uploadResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>오류 발생:</strong>
                    <ul className="mt-2 list-disc list-inside text-xs">
                      {uploadResult.errors.slice(0, 10).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {uploadResult.errors.length > 10 && (
                        <li>...외 {uploadResult.errors.length - 10}개 오류</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={onComplete}
              className="w-full"
            >
              나중에 업로드하기
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};