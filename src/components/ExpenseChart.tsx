import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const monthlyData = [
  { month: "1월", income: 4200000, expense: 3100000 },
  { month: "2월", income: 4300000, expense: 2900000 },
  { month: "3월", income: 4400000, expense: 3300000 },
  { month: "4월", income: 4200000, expense: 3000000 },
  { month: "5월", income: 4600000, expense: 3400000 },
  { month: "6월", income: 4500000, expense: 3200000 },
];

const categoryData = [
  { name: "식비", value: 800000, color: "#3B82F6" },
  { name: "교통비", value: 300000, color: "#10B981" },
  { name: "쇼핑", value: 600000, color: "#F59E0B" },
  { name: "문화생활", value: 400000, color: "#EF4444" },
  { name: "의료비", value: 200000, color: "#8B5CF6" },
  { name: "기타", value: 900000, color: "#6B7280" },
];

const formatCurrency = (value: number) => {
  return `${(value / 10000).toFixed(0)}만원`;
};

export const ExpenseChart = () => {
  return (
    <div className="space-y-6">
      {/* Monthly Trend */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>월별 수입/지출 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="income" fill="hsl(var(--income))" name="수입" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="hsl(var(--expense))" name="지출" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>카테고리별 지출</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {categoryData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};