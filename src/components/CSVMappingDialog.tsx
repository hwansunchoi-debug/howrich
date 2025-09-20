import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle } from 'lucide-react';
import { getBankTemplate, BankTemplate } from '@/services/bankTemplates';

interface CSVMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  csvData: string[][];
  onConfirm: (template: BankTemplate, customMapping?: any) => void;
}

export const CSVMappingDialog: React.FC<CSVMappingDialogProps> = ({
  open,
  onOpenChange,
  csvData,
  onConfirm
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('excel_standard');
  const [previewData, setPreviewData] = useState<any[]>([]);

  useEffect(() => {
    if (csvData.length > 0) {
      // 권장 엑셀 양식을 자동으로 선택
      setSelectedTemplate('excel_standard');
      generatePreview();
    }
  }, [csvData]);

  useEffect(() => {
    generatePreview();
  }, [selectedTemplate]);

  const generatePreview = () => {
    if (!csvData.length || !selectedTemplate) return;

    const template = getBankTemplate(selectedTemplate);
    if (!template) return;

    const preview: any[] = [];
    const startIndex = template.hasHeader ? 1 : 0;

    for (let i = startIndex; i < Math.min(csvData.length, startIndex + 5); i++) {
      const row = csvData[i];
      if (!row || row.length === 0) continue;

      try {
        // 날짜 추출
        const dateValue = template.columns.date !== undefined ? row[template.columns.date] : '';
        
        // 내용 추출
        let description = '';
        if (template.columns.description !== undefined) {
          description = row[template.columns.description] || '';
        } else if (template.columns.merchant !== undefined) {
          description = row[template.columns.merchant] || '';
        }

        // 금액 및 타입 추출
        let amount = 0;
        let type: 'income' | 'expense' = 'expense';

        if (template.columns.withdrawal !== undefined && template.columns.deposit !== undefined) {
          const withdrawalStr = row[template.columns.withdrawal] || '';
          const depositStr = row[template.columns.deposit] || '';
          
          const withdrawalAmount = parseFloat(withdrawalStr.replace(/[^\d.-]/g, '')) || 0;
          const depositAmount = parseFloat(depositStr.replace(/[^\d.-]/g, '')) || 0;
          
          if (withdrawalAmount > 0) {
            amount = withdrawalAmount;
            type = 'expense';
          } else if (depositAmount > 0) {
            amount = depositAmount;
            type = 'income';
          }
        }

        if (dateValue && description && amount > 0) {
          preview.push({
            date: dateValue,
            description: description.trim(),
            amount,
            type
          });
        }
      } catch (error) {
        console.error('미리보기 생성 오류:', error);
      }
    }

    setPreviewData(preview);
  };

  const handleConfirm = () => {
    const template = getBankTemplate(selectedTemplate);
    if (template) {
      onConfirm(template);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>CSV 파일 형식 확인</DialogTitle>
          <DialogDescription>
            권장 엑셀 양식에 맞춰 데이터를 확인하고 업로드하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 권장 양식 정보 */}
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              <strong>사용 중인 양식:</strong> 권장 엑셀 양식<br />
              <strong>컬럼 구성:</strong> 금융기관 | 날짜 | 내용(가맹점명) | 수입금액 | 지출금액 | 구분(수입/지출)
            </AlertDescription>
          </Alert>

          {/* 데이터 미리보기 */}
          {previewData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  데이터 미리보기 (처음 5개 항목)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-2 py-1 text-left">날짜</th>
                        <th className="border border-gray-300 px-2 py-1 text-left">내용</th>
                        <th className="border border-gray-300 px-2 py-1 text-right">금액</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">구분</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(0, 5).map((item, index) => (
                        <tr key={index}>
                          <td className="border border-gray-300 px-2 py-1">{item.date}</td>
                          <td className="border border-gray-300 px-2 py-1">{item.description}</td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {item.amount?.toLocaleString()}원
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-center">
                            <Badge variant={item.type === 'income' ? 'default' : 'destructive'}>
                              {item.type === 'income' ? '수입' : '지출'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  총 {previewData.length}개의 거래내역이 파싱되었습니다.
                </p>
              </CardContent>
            </Card>
          )}

          {previewData.length === 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                데이터를 파싱할 수 없습니다. 권장 엑셀 양식에 맞는지 확인해주세요.
              </AlertDescription>
            </Alert>
          )}

          {/* 액션 버튼 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={previewData.length === 0}
            >
              데이터 업로드
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};