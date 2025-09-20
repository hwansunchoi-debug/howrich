import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Wallet, RefreshCw, DollarSign, Plus, Calendar, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AccountBalance {
  id: string;
  account_name: string;
  account_type: string;
  balance: number;
  last_updated: string;
  source: string;
}

const accountTypeLabels = {
  bank: '은행',
  card: '카드',
  investment: '투자/증권',
  pay: '간편결제',
  crypto: '암호화폐'
};

const accountTypeColors = {
  bank: 'bg-blue-100 text-blue-800',
  card: 'bg-purple-100 text-purple-800', 
  investment: 'bg-green-100 text-green-800',
  pay: 'bg-orange-100 text-orange-800',
  crypto: 'bg-yellow-100 text-yellow-800'
};

export default function BalanceDetails() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalBalance, setTotalBalance] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAccountBalances();
      fetchBalanceSnapshots();
    }
  }, [user, selectedDate]);

  const fetchAccountBalances = async () => {
    if (!user) return;

    try {
      // 선택된 날짜의 스냅샷 조회
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data: snapshot } = await supabase
        .from('balance_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .eq('snapshot_date', selectedDateStr)
        .maybeSingle();

      if (snapshot) {
        // 스냅샷 데이터가 있으면 사용
        setBalances((snapshot.account_details as unknown as AccountBalance[]) || []);
        setTotalBalance(Number(snapshot.total_balance));
      } else {
        // 스냅샷이 없으면 최신 계좌 잔액 조회
        const { data, error } = await supabase
          .from('account_balances')
          .select('*')
          .eq('user_id', user.id)
          .order('last_updated', { ascending: false });

        if (error) throw error;

        setBalances(data || []);
        
        // 카드가 아닌 계좌들의 잔액 합계 계산
        const total = (data || [])
          .filter(balance => balance.account_type !== 'card')
          .reduce((sum, balance) => sum + Number(balance.balance), 0);
        
        setTotalBalance(total);
      }
    } catch (error) {
      console.error('계좌 잔액 조회 실패:', error);
      toast({
        title: "오류",
        description: "계좌 정보를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBalanceSnapshots = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('balance_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSnapshots(data || []);
    } catch (error) {
      console.error('잔액 스냅샷 조회 실패:', error);
    }
  };

  const deleteAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from('account_balances')
        .delete()
        .eq('id', accountId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: "계좌 삭제 완료",
        description: "선택한 계좌가 삭제되었습니다.",
      });

      fetchAccountBalances();
    } catch (error) {
      console.error('계좌 삭제 실패:', error);
      toast({
        title: "오류",
        description: "계좌 삭제에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const formatLastUpdated = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAccountTypeColor = (type: string) => {
    return accountTypeColors[type as keyof typeof accountTypeColors] || 'bg-gray-100 text-gray-800';
  };

  const getAccountTypeLabel = (type: string) => {
    return accountTypeLabels[type as keyof typeof accountTypeLabels] || type;
  };

  const groupedAccounts = balances.reduce((groups, account) => {
    const type = account.account_type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(account);
    return groups;
  }, {} as Record<string, AccountBalance[]>);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
            <div className="flex items-center gap-2">
              <Wallet className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">잔액 관리</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowHistoryDialog(true)} variant="outline" size="sm">
              <History className="h-4 w-4 mr-1" />
              기록 보기
            </Button>
            <Button onClick={() => setShowAddDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              잔액 등록
            </Button>
            <Button onClick={fetchAccountBalances} disabled={loading} size="sm">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* 날짜 선택 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span className="font-medium">기준 날짜</span>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    {format(selectedDate, 'yyyy년 MM월 dd일')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
        </Card>

        {/* 총 잔액 요약 */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                {format(selectedDate, 'yyyy년 MM월 dd일')} 기준 총 잔액
              </p>
              <p className="text-3xl font-bold text-primary">
                {totalBalance.toLocaleString()}원
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                총 {balances.filter(b => b.account_type !== 'card').length}개 계좌
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 계좌별 잔액 */}
        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">불러오는 중...</p>
              </div>
            </CardContent>
          </Card>
        ) : balances.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">등록된 계좌가 없습니다.</p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  잔액 등록하기
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAccounts).map(([type, accountList]) => (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge className={getAccountTypeColor(type)}>
                      {getAccountTypeLabel(type)}
                    </Badge>
                    <span className="text-sm font-normal text-muted-foreground">
                      {accountList.length}개 계좌
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {accountList.map((account) => (
                        <div
                        key={account.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{account.account_name}</p>
                            <Badge variant="outline" className="text-xs">
                              {account.source === 'manual' ? '수동입력' : 'SMS'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            업데이트: {formatLastUpdated(account.last_updated)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="font-semibold text-lg">
                              {Number(account.balance).toLocaleString()}원
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteAccount(account.id)}
                            className="text-destructive hover:text-destructive/90"
                          >
                            삭제
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* 카테고리별 소계 */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-muted-foreground">
                        {getAccountTypeLabel(type)} 소계
                      </span>
                      <span className="font-bold">
                        {accountList.reduce((sum, acc) => sum + Number(acc.balance), 0).toLocaleString()}원
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 잔액 등록 다이얼로그 */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>계좌 잔액 등록</DialogTitle>
            </DialogHeader>
            <AddBalanceForm
              onSuccess={() => {
                setShowAddDialog(false);
                fetchAccountBalances();
                fetchBalanceSnapshots();
                toast({
                  title: "잔액 등록 완료",
                  description: "계좌 잔액이 성공적으로 등록되었습니다.",
                });
              }}
            />
          </DialogContent>
        </Dialog>

        {/* 잔액 기록 보기 다이얼로그 */}
        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>잔액 변동 기록</DialogTitle>
            </DialogHeader>
            <BalanceHistory snapshots={snapshots} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// 잔액 등록 폼 컴포넌트
const AddBalanceForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState([
    { name: '', institution: '', type: 'bank', balance: 0 }
  ]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [saving, setSaving] = useState(false);

  const addAccount = () => {
    setAccounts([...accounts, { name: '', institution: '', type: 'bank', balance: 0 }]);
  };

  const removeAccount = (index: number) => {
    setAccounts(accounts.filter((_, i) => i !== index));
  };

  const updateAccount = (index: number, field: string, value: any) => {
    const updated = [...accounts];
    updated[index] = { ...updated[index], [field]: value };
    setAccounts(updated);
  };

  const saveBalances = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
      
      // 잔액 스냅샷 저장
      const { error: snapshotError } = await supabase
        .from('balance_snapshots')
        .upsert({
          user_id: user.id,
          snapshot_date: format(selectedDate, 'yyyy-MM-dd'),
          total_balance: totalBalance,
          account_details: accounts as any
        });

      if (snapshotError) throw snapshotError;

      // 개별 계좌 잔액 업데이트
      for (const account of accounts) {
        if (account.name && account.balance > 0) {
          await supabase
            .from('account_balances')
            .upsert({
              user_id: user.id,
              account_name: account.name,
              account_type: account.type,
              balance: account.balance,
              source: 'manual',
              last_updated: new Date().toISOString()
            });
        }
      }

      onSuccess();
    } catch (error) {
      console.error('잔액 저장 실패:', error);
      toast({
        title: "오류",
        description: "잔액 저장에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="date">기준 날짜</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start">
              <Calendar className="mr-2 h-4 w-4" />
              {format(selectedDate, 'yyyy년 MM월 dd일')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">계좌 정보</h3>
          <Button onClick={addAccount} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            계좌 추가
          </Button>
        </div>

        {accounts.map((account, index) => (
          <Card key={index} className="p-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <Label>계좌명</Label>
                <Input
                  value={account.name}
                  onChange={(e) => updateAccount(index, 'name', e.target.value)}
                  placeholder="예: 신한은행 주거래"
                />
              </div>
              <div>
                <Label>금융기관</Label>
                <Input
                  value={account.institution}
                  onChange={(e) => updateAccount(index, 'institution', e.target.value)}
                  placeholder="예: 신한은행"
                />
              </div>
              <div>
                <Label>계좌 유형</Label>
                <Select
                  value={account.type}
                  onValueChange={(value) => updateAccount(index, 'type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">은행 계좌</SelectItem>
                    <SelectItem value="savings">적금</SelectItem>
                    <SelectItem value="investment">투자 계좌</SelectItem>
                    <SelectItem value="card">카드</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>잔액 (원)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={account.balance}
                    onChange={(e) => updateAccount(index, 'balance', Number(e.target.value))}
                    placeholder="0"
                  />
                  {accounts.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeAccount(index)}
                    >
                      삭제
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => {}}>
          취소
        </Button>
        <Button onClick={saveBalances} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  );
};

// 잔액 기록 보기 컴포넌트
const BalanceHistory = ({ snapshots }: { snapshots: any[] }) => {
  return (
    <div className="space-y-4">
      {snapshots.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">아직 잔액 기록이 없습니다.</p>
        </div>
      ) : (
        snapshots.map((snapshot, index) => (
          <Card key={snapshot.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">
                {new Date(snapshot.snapshot_date).toLocaleDateString('ko-KR')}
              </h3>
              <div className="text-lg font-bold text-primary">
                {Number(snapshot.total_balance).toLocaleString()}원
              </div>
            </div>
            
            {snapshot.account_details && snapshot.account_details.length > 0 && (
              <div className="space-y-2">
                {snapshot.account_details.map((account: any, accIndex: number) => (
                  <div key={accIndex} className="flex justify-between text-sm">
                    <span>{account.name} ({account.institution})</span>
                    <span>{Number(account.balance).toLocaleString()}원</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
};