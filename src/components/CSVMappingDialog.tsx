import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { FileText, ArrowRight, CheckCircle } from 'lucide-react';
import { bankTemplates, getBankTemplate, detectBankTemplate, BankTemplate } from '@/services/bankTemplates';

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
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [detectedTemplate, setDetectedTemplate] = useState<BankTemplate | null>(null);
  const [customMapping, setCustomMapping] = useState<{[key: string]: number}>({});
  const [previewData, setPreviewData] = useState<any[]>([]);

  useEffect(() => {
    if (csvData.length > 0) {
      // 첫 번째 행을 헤더로 가정하고 자동 감지 시도
      const headers = csvData[0];
      const detected = detectBankTemplate(headers);
      
      if (detected) {
        setDetectedTemplate(detected);
        setSelectedTemplate(detected.id);
      }
      
      generatePreview();
    }
  }, [csvData]);

  useEffect(() => {
    generatePreview();
  }, [selectedTemplate, customMapping]);

  const generatePreview = () => {
    if (!csvData.length || !selectedTemplate) return;

    const template = getBankTemplate(selectedTemplate);
    if (!template) return;

    const startRow = template.hasHeader ? 1 : 0;
    const sampleRows = csvData.slice(startRow, startRow + 5);
    
    const preview = sampleRows.map((row, index) => {
      const result: any = { 원본: row };
      
      // 날짜
      if (template.columns.date !== undefined) {
        result.날짜 = row[template.columns.date] || '';
      }
      
      // 내용/설명
      if (template.columns.description !== undefined) {
        result.내용 = row[template.columns.description] || '';
      } else if (template.columns.merchant !== undefined) {
        result.내용 = row[template.columns.merchant] || '';
      }
      
      // 금액 처리
      if (template.columns.amount !== undefined) {
        const amount = parseFloat((row[template.columns.amount] || '').replace(/[^0-9.-]/g, ''));
        result.금액 = isNaN(amount) ? 0 : amount;
        result.구분 = amount < 0 ? '지출' : '수입';
      } else if (template.columns.withdrawal !== undefined && template.columns.deposit !== undefined) {
        const withdrawal = parseFloat((row[template.columns.withdrawal] || '').replace(/[^0-9.-]/g, ''));
        const deposit = parseFloat((row[template.columns.deposit] || '').replace(/[^0-9.-]/g, ''));
        
        if (!isNaN(withdrawal) && withdrawal > 0) {
          result.금액 = withdrawal;
          result.구분 = '지출';
        } else if (!isNaN(deposit) && deposit > 0) {
          result.금액 = deposit;
          result.구분 = '수입';
        }
      }
      
      return result;
    });
    
    setPreviewData(preview);
  };

  const handleConfirm = () => {
    const template = getBankTemplate(selectedTemplate);
    if (template) {
      onConfirm(template, customMapping);
      onOpenChange(false);
    }
  };

  const categoryLabels = {
    bank: '은행',
    card: '카드',
    securities: '증권',
    other: '기타'
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CSV 데이터 형식 선택
          </DialogTitle>
          <DialogDescription>
            업로드한 CSV 파일의 형식을 선택하고 데이터 매핑을 확인하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 자동 감지 결과 */}
          {detectedTemplate && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>자동 감지됨:</strong> {detectedTemplate.name} 형식으로 추정됩니다.
                확인 후 수정하시거나 다른 템플릿을 선택하세요.
              </AlertDescription>
            </Alert>
          )}

          {/* 템플릿 선택 */}
          <div className="space-y-4">
            <Label>금융기관 선택</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(categoryLabels).map(([category, label]) => (
                <div key={category} className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">{label}</h4>
                  <div className="space-y-1">
                    {bankTemplates
                      .filter(t => t.category === category)
                      .map(template => (
                        <Button
                          key={template.id}
                          variant={selectedTemplate === template.id ? "default" : "outline"}
                          className="w-full justify-start text-sm"
                          onClick={() => setSelectedTemplate(template.id)}
                        >
                          {template.name}
                          {detectedTemplate?.id === template.id && (
                            <Badge variant="secondary" className="ml-2">자동감지</Badge>
                          )}
                        </Button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 선택된 템플릿 정보 */}
          {selectedTemplate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{getBankTemplate(selectedTemplate)?.name} 형식</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <strong>예상 컬럼:</strong> {getBankTemplate(selectedTemplate)?.sampleColumns.join(', ')}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 미리보기 */}
          {previewData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">데이터 미리보기</h3>
                <Badge variant="outline">{previewData.length}개 행 표시</Badge>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left">날짜</th>
                        <th className="px-3 py-2 text-left">내용</th>
                        <th className="px-3 py-2 text-left">금액</th>
                        <th className="px-3 py-2 text-left">구분</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-3 py-2">{row.날짜}</td>
                          <td className="px-3 py-2">{row.내용}</td>
                          <td className="px-3 py-2 font-mono">
                            {typeof row.금액 === 'number' ? row.금액.toLocaleString() + '원' : '-'}
                          </td>
                          <td className="px-3 py-2">
                            {row.구분 && (
                              <Badge variant={row.구분 === '수입' ? 'default' : 'destructive'}>
                                {row.구분}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <Alert>
                <AlertDescription>
                  <strong>확인사항:</strong> 위 미리보기가 정확한지 확인하세요. 
                  날짜, 내용, 금액이 올바르게 매핑되었다면 '데이터 업로드' 버튼을 클릭하세요.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* 버튼들 */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!selectedTemplate || previewData.length === 0}
              className="flex-1"
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              이 형식으로 데이터 업로드
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};