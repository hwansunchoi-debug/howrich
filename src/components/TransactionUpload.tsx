import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { CSVParser } from '@/services/csvParser';
import { CSVMappingDialog } from './CSVMappingDialog';
import { BankTemplate } from '@/services/bankTemplates';
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
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [showMappingDialog, setShowMappingDialog] = useState(false);

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

    try {
      // CSV 파일을 읽어서 파싱
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        toast({
          variant: "destructive",
          title: "빈 파일",
          description: "CSV 파일에 데이터가 없습니다."
        });
        return;
      }

      // CSV 데이터를 파싱 (쉼표로 분리)
      const parsedData = lines.map(line => {
        const columns: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if ((char === ',' || char === '\t') && !inQuotes) {
            columns.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        
        columns.push(current.trim());
        return columns.map(col => col.replace(/^"|"$/g, '')); // 따옴표 제거
      });

      setCsvData(parsedData);
      setShowMappingDialog(true);
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "파일 읽기 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      });
    }
  };

  const handleMappingConfirm = async (template: BankTemplate, customMapping?: any) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 템플릿을 사용해서 데이터 파싱
      setUploadProgress(30);
      const parseResult = await CSVParser.parseTransactionCSVWithTemplate(csvData, template);
      
      if (parseResult.errors.length > 0 && parseResult.transactions.length === 0) {
        toast({
          variant: "destructive",
          title: "데이터 파싱 실패",
          description: "선택한 형식으로 데이터를 처리할 수 없습니다."
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
                <strong>지원되는 금융기관:</strong><br />
                • <strong>은행:</strong> KB국민, 신한, 우리, 하나, NH농협<br />
                • <strong>카드:</strong> 우리카드, 삼성카드, 현대카드, 신한카드, KB국민카드<br />
                • <strong>증권:</strong> 키움증권, 미래에셋증권<br />
                • <strong>범용:</strong> 모든 CSV 형식 (컬럼 수동 매핑)<br /><br />
                파일 업로드 후 자동으로 형식을 감지하고 데이터 매핑을 확인할 수 있습니다.
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
                  형식 확인 및 업로드
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

          <CSVMappingDialog
            open={showMappingDialog}
            onOpenChange={setShowMappingDialog}
            csvData={csvData}
            onConfirm={handleMappingConfirm}
          />
        </div>
      </CardContent>
    </Card>
  );
};