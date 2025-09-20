import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LogOut, Users, Download, Upload, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  display_name: string;
  email: string;
  avatar_url?: string;
}

interface FamilyMember {
  id: string;
  member_id: string; 
  display_name: string;
  relationship: string;
  can_view_data: boolean;
}

interface UserHeaderProps {
  selectedView: 'me' | 'spouse' | 'family';
  onViewChange: (view: 'me' | 'spouse' | 'family') => void;
  onDataExport: () => void;
  onDataImport: () => void;
}

export const UserHeader: React.FC<UserHeaderProps> = ({
  selectedView,
  onViewChange,
  onDataExport,
  onDataImport
}) => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchFamilyMembers();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('프로필 조회 실패:', error);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('프로필 조회 중 오류:', error);
    }
  };

  const fetchFamilyMembers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('owner_id', user.id)
        .eq('can_view_data', true);

      if (error) {
        console.error('가족 구성원 조회 실패:', error);
        return;
      }

      setFamilyMembers(data || []);
    } catch (error) {
      console.error('가족 구성원 조회 중 오류:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "로그아웃 완료",
        description: "안전하게 로그아웃되었습니다."
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "로그아웃 실패",
        description: "로그아웃 중 오류가 발생했습니다."
      });
    }
  };

  const getViewLabel = (view: string) => {
    switch (view) {
      case 'me': return '내 가계부';
      case 'spouse': return '아내 가계부';
      case 'family': return '가족 가계부';
      default: return '내 가계부';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* 왼쪽: 사용자 정보 */}
          <div className="flex items-center gap-4">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {profile ? getInitials(profile.display_name) : 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{profile?.display_name || 'User'}</h2>
                <Badge variant="outline" className="text-xs">
                  {user?.email}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {getViewLabel(selectedView)}
              </p>
            </div>
          </div>

          {/* 중앙: 뷰 선택 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedView} onValueChange={onViewChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      내 가계부
                    </div>
                  </SelectItem>
                  <SelectItem value="spouse">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      아내 가계부
                    </div>
                  </SelectItem>
                  <SelectItem value="family">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      가족 가계부 
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 데이터 관리 버튼들 */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onDataExport}>
                <Download className="h-4 w-4 mr-1" />
                내보내기
              </Button>
              <Button variant="outline" size="sm" onClick={onDataImport}>
                <Upload className="h-4 w-4 mr-1" />
                가져오기
              </Button>
            </div>
          </div>

          {/* 오른쪽: 로그아웃 */}
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            로그아웃
          </Button>
        </div>

        {/* 가족 구성원 표시 */}
        {familyMembers.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>가족 구성원:</span>
              {familyMembers.map((member, index) => (
                <Badge key={member.id} variant="secondary">
                  {member.display_name} ({member.relationship})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};