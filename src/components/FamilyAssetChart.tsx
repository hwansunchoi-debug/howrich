import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface FamilyAssetData {
  name: string;
  총자산: number;
  display_name: string;
}

export const FamilyAssetChart = () => {
  const { user } = useAuth();
  const [chartData, setChartData] = useState<FamilyAssetData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFamilyAssetData();
    }
  }, [user]);

  const fetchFamilyAssetData = async () => {
    if (!user) return;

    try {
      // 가족 구성원 조회 (멤버 역할 제외)
      const { data: familyMembers, error: familyError } = await supabase
        .from('family_members')
        .select('member_id, display_name')
        .eq('owner_id', user.id);

      if (familyError) throw familyError;

      const familyData: FamilyAssetData[] = [];

      // 나의 자산 추가
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      const { data: myBalance } = await supabase
        .from('balance_snapshots')
        .select('total_balance')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (myBalance) {
        familyData.push({
          name: '나',
          총자산: Number(myBalance.total_balance),
          display_name: myProfile?.display_name || '나'
        });
      }

      // 각 가족 구성원의 자산 조회
      for (const member of familyMembers || []) {
        // 멤버의 역할 확인
        const { data: memberProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', member.member_id)
          .single();

        // 멤버 역할인 사용자는 제외
        if (memberProfile?.role === 'member') continue;

        const { data: memberBalance } = await supabase
          .from('balance_snapshots')
          .select('total_balance')
          .eq('user_id', member.member_id)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (memberBalance) {
          familyData.push({
            name: member.display_name,
            총자산: Number(memberBalance.total_balance),
            display_name: member.display_name
          });
        }
      }

      setChartData(familyData);
    } catch (error) {
      console.error('가족 자산 데이터 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    총자산: {
      label: "총자산",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      notation: 'compact',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            가족 구성원별 자산 현황
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px]">
            <div className="text-muted-foreground">차트를 불러오는 중...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            가족 구성원별 자산 현황
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px]">
            <div className="text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>가족 구성원의 자산 데이터가 없습니다.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          가족 구성원별 자산 현황
        </CardTitle>
        <CardDescription>
          가족 구성원별 최신 자산 현황
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent />}
              formatter={(value) => [formatCurrency(Number(value)), "총자산"]}
            />
            <Bar
              dataKey="총자산"
              fill="var(--color-총자산)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};