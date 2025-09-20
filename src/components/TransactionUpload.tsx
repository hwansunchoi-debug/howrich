import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, AlertCircle, X, RotateCcw } from 'lucide-react';
import { CSVParser } from '@/services/csvParser';
import { CSVMappingDialog } from './CSVMappingDialog';
import { BankTemplate } from '@/services/bankTemplates';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';

interface TransactionUploadProps {
  onComplete: () => void;
}

export const TransactionUpload: React.FC<TransactionUploadProps> = ({ onComplete }) => {
  const { user } = useAuth();
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
      const isCSV = selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv');
      const isXLSX = selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || selectedFile.name.endsWith('.xlsx');
      
      if (!isCSV && !isXLSX) {
        toast({
          variant: "destructive",
          title: "잘못된 파일 형식",
          description: "CSV 또는 XLSX 파일만 업로드 가능합니다."
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
      let parsedData: string[][] = [];
      
      const isXLSX = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx');
      
      console.log('파일 업로드 시작:', file.name, '형식:', isXLSX ? 'XLSX' : 'CSV');
      
      if (isXLSX) {
        // XLSX 파일 처리
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 시트를 배열로 변환
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        parsedData = jsonData.map(row => (row as any[]).map(cell => String(cell || '')));
        
        console.log('XLSX 파싱 완료, 행 수:', parsedData.length);
        console.log('첫 번째 행 (헤더):', parsedData[0]);
        console.log('두 번째 행 (첫 데이터):', parsedData[1]);
      } else {
        // CSV 파일 처리
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        // CSV 데이터를 파싱 (쉼표로 분리)
        parsedData = lines.map(line => {
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
      }
      
      if (parsedData.length === 0) {
        console.log('오류: 빈 파일 감지됨');
        toast({
          variant: "destructive",
          title: "빈 파일",
          description: "파일에 데이터가 없습니다."
        });
        return;
      }

      console.log('파싱 완료, 매핑 다이얼로그 표시');
      setCsvData(parsedData);
      setShowMappingDialog(true);
      
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      toast({
        variant: "destructive",
        title: "파일 읽기 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      });
    }
  };

  const resetUpload = () => {
    setFile(null);
    setUploadResult(null);
    setCsvData([]);
    setShowMappingDialog(false);
    setUploadProgress(0);
    setIsUploading(false);
    
    // 파일 입력 필드 초기화
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleMappingConfirm = async (template: BankTemplate, customMapping?: any) => {
    if (!file || !user) return;

    setIsUploading(true);
    
    try {
      // 1. 파일 정보를 upload_files 테이블에 저장
      const { data: uploadFileData, error: uploadError } = await supabase
        .from('upload_files')
        .insert({
          user_id: user.id,
          filename: `upload_${Date.now()}_${file.name}`,
          original_filename: file.name,
          file_size: file.size,
          file_type: file.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv',
          status: 'processing'
        })
        .select('id')
        .single();

      if (uploadError || !uploadFileData) {
        throw new Error('파일 업로드 기록 저장 실패');
      }

      const fileUploadId = uploadFileData.id;

      // 2. 템플릿을 사용해서 데이터 파싱
      setUploadProgress(30);
      const parseResult = await CSVParser.parseTransactionCSVWithTemplate(csvData, template);
      
      if (parseResult.errors.length > 0 && parseResult.transactions.length === 0) {
        // 실패 상태로 업데이트
        await supabase
          .from('upload_files')
          .update({ 
            status: 'failed',
            error_message: parseResult.errors.join('; '),
            processed_records_count: 0
          })
          .eq('id', fileUploadId);

        toast({
          variant: "destructive",
          title: "데이터 파싱 실패",
          description: "선택한 형식으로 데이터를 처리할 수 없습니다."
        });
        setUploadResult({ success: 0, errors: parseResult.errors });
        setIsUploading(false);
        return;
      }

      // 3. 데이터베이스에 저장
      setUploadProgress(70);
      const saveResult = await CSVParser.saveTransactions(parseResult.transactions, fileUploadId);
      
      // 4. 파일 상태 업데이트
      const finalStatus = saveResult.errors.length === 0 ? 'success' : 
                         saveResult.success > 0 ? 'partial' : 'failed';
      
      await supabase
        .from('upload_files')
        .update({ 
          status: finalStatus,
          processed_records_count: saveResult.success,
          error_message: saveResult.errors.length > 0 ? saveResult.errors.join('; ') : null
        })
        .eq('id', fileUploadId);

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
        
        // 성공적으로 업로드되면 완료 처리 및 즉시 반영
        setTimeout(() => {
          onComplete();
          // 부모 컴포넌트에서 목록을 새로고침하도록 호출
          if (typeof onComplete === 'function') {
            onComplete();
          }
        }, 1000);
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
          금융기관에서 다운로드한 CSV 또는 Excel(XLSX) 파일을 업로드하여 과거 거래내역을 일괄 등록하세요.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                <strong>권장 엑셀 양식:</strong><br />
                금융기관 | 날짜 | 내용(가맹점명) | 수입금액 | 지출금액 | 구분(수입/지출)<br /><br />
                
                <strong>자동 카테고리 분류:</strong> 내용을 기반으로 식비, 교통비, 쇼핑 등 카테고리가 자동으로 분류됩니다.
              </AlertDescription>
            </Alert>

        <div className="space-y-4">
          <div>
            <Input
              type="file"
              accept=".csv,.xlsx"
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
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetUpload}
                  disabled={isUploading}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
                
                {!isUploading && (
                  <Button onClick={handleUpload} size="sm">
                    형식 확인 및 업로드
                  </Button>
                )}
              </div>
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
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {uploadResult.success > 0 && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{uploadResult.success}개의 거래내역</strong>이 성공적으로 업로드되었습니다.
                      </AlertDescription>
                    </Alert>
                  )}

                  {uploadResult.errors.length > 0 && (
                    <Alert variant="destructive" className="mt-3">
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
                
                {uploadResult.errors.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetUpload}
                    className="ml-3 shrink-0"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    다시 업로드
                  </Button>
                )}
              </div>
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