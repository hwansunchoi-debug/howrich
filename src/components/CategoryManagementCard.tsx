import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const CategoryManagementCard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUncategorizedCount();
    }
  }, [user]);

  const fetchUncategorizedCount = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user.id)
        .is('category_id', null);

      if (error) throw error;
      
      setUncategorizedCount(data?.length || 0);
    } catch (error) {
      console.error('미분류 거래 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          카테고리 관리
          {uncategorizedCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              <AlertTriangle className="h-3 w-3 mr-1" />
              미분류 {uncategorizedCount}건
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          거래 내역을 카테고리별로 분류하여 관리합니다
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              {uncategorizedCount > 0 ? (
                <span className="text-destructive font-medium">
                  미분류 거래 {uncategorizedCount}건이 있습니다. 카테고리를 설정해주세요.
                </span>
              ) : (
                "모든 거래가 분류되었습니다."
              )}
            </p>
            <Button 
              onClick={() => navigate('/categories')} 
              variant={uncategorizedCount > 0 ? "default" : "outline"}
              className="w-full md:w-auto"
            >
              <Tag className="h-4 w-4 mr-2" />
              카테고리 관리하기
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};