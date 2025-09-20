import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreVertical, ArrowUpRight, ArrowDownRight } from "lucide-react";

const recentTransactions = [
  {
    id: 1,
    type: "income" as const,
    category: "급여",
    description: "월급",
    amount: 3000000,
    date: "2024-01-15",
    account: "우리은행",
  },
  {
    id: 2,
    type: "expense" as const,
    category: "식비",
    description: "마트 장보기",
    amount: 127000,
    date: "2024-01-14",
    account: "신한카드",
  },
  {
    id: 3,
    type: "expense" as const,
    category: "교통비",
    description: "지하철 정기권",
    amount: 62000,
    date: "2024-01-13",
    account: "카카오뱅크",
  },
  {
    id: 4,
    type: "income" as const,
    category: "부수입",
    description: "프리랜서 작업",
    amount: 500000,
    date: "2024-01-12",
    account: "토스뱅크",
  },
  {
    id: 5,
    type: "expense" as const,
    category: "쇼핑",
    description: "온라인 쇼핑",
    amount: 89000,
    date: "2024-01-11",
    account: "현대카드",
  },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(amount);
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

export const RecentTransactions = () => {
  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>최근 거래내역</CardTitle>
        <Button variant="ghost" size="sm">
          전체보기
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {recentTransactions.map((transaction) => (
          <div
            key={transaction.id}
            className="flex items-center justify-between p-3 rounded-lg bg-gradient-card hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  transaction.type === "income"
                    ? "bg-income-light text-income"
                    : "bg-expense-light text-expense"
                }`}
              >
                {transaction.type === "income" ? (
                  <ArrowDownRight className="h-4 w-4" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{transaction.description}</p>
                  <Badge variant="secondary" className="text-xs">
                    {transaction.category}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{transaction.account}</span>
                  <span>•</span>
                  <span>{formatDate(transaction.date)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p
                  className={`font-semibold ${
                    transaction.type === "income" ? "text-income" : "text-expense"
                  }`}
                >
                  {transaction.type === "income" ? "+" : "-"}
                  {formatCurrency(transaction.amount)}
                </p>
              </div>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};