import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserPlus, Mail, Trash2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface FamilyMember {
  id: string;
  member_id: string;
  display_name: string;
  email: string;
  relationship: string;
  can_view_data: boolean;
  can_edit_data: boolean;
  created_at: string;
}

export const FamilyManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRelationship, setInviteRelationship] = useState('spouse');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  useEffect(() => {
    if (user) {
      fetchFamilyMembers();
    }
  }, [user]);

  const fetchFamilyMembers = async () => {
    if (!user) return;

    try {
      // 내가 추가한 가족 구성원들 조회
      const { data: members, error } = await supabase
        .from('family_members')
        .select(`
          id,
          member_id,
          display_name,
          relationship,
          can_view_data,
          can_edit_data,
          created_at,
          profiles!family_members_member_id_fkey (
            email
          )
        `)
        .eq('owner_id', user.id);

      if (error) {
        console.error('가족 구성원 조회 실패:', error);
        return;
      }

      const formattedMembers = members?.map(member => ({
        ...member,
        email: (member.profiles as any)?.email || '이메일 없음'
      })) || [];

      setFamilyMembers(formattedMembers);
    } catch (error) {
      console.error('가족 구성원 조회 중 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!user || !inviteEmail.trim()) {
      toast({
        variant: "destructive",
        title: "이메일 필요",
        description: "초대할 이메일을 입력해주세요."
      });
      return;
    }

    setInviteLoading(true);

    try {
      // 해당 이메일로 가입된 사용자 찾기
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .eq('email', inviteEmail.trim())
        .single();

      if (profileError || !profiles) {
        toast({
          variant: "destructive",
          title: "사용자 없음",
          description: "해당 이메일로 가입된 사용자가 없습니다. 먼저 회원가입을 요청해주세요."
        });
        return;
      }

      // 이미 가족 구성원인지 확인
      const { data: existingMember } = await supabase
        .from('family_members')
        .select('id')
        .eq('owner_id', user.id)
        .eq('member_id', profiles.user_id)
        .single();

      if (existingMember) {
        toast({
          variant: "destructive",
          title: "이미 추가됨",
          description: "이미 가족 구성원으로 추가된 사용자입니다."
        });
        return;
      }

      // 가족 구성원으로 추가
      const { error: insertError } = await supabase
        .from('family_members')
        .insert({
          owner_id: user.id,
          member_id: profiles.user_id,
          display_name: profiles.display_name,
          relationship: inviteRelationship,
          can_view_data: true,
          can_edit_data: false
        });

      if (insertError) {
        console.error('가족 구성원 추가 실패:', insertError);
        toast({
          variant: "destructive",
          title: "추가 실패",
          description: "가족 구성원 추가 중 오류가 발생했습니다."
        });
        return;
      }

      // 상대방도 나를 가족 구성원으로 추가 (양방향)
      await supabase
        .from('family_members')
        .insert({
          owner_id: profiles.user_id,
          member_id: user.id,
          display_name: user.user_metadata?.display_name || 'User',
          relationship: inviteRelationship === 'spouse' ? 'spouse' : 'family',
          can_view_data: true,
          can_edit_data: false
        });

      toast({
        title: "가족 구성원 추가 완료",
        description: `${profiles.display_name}님이 가족 구성원으로 추가되었습니다.`
      });

      setInviteEmail('');
      setShowInviteDialog(false);
      fetchFamilyMembers();

    } catch (error) {
      console.error('초대 처리 중 오류:', error);
      toast({
        variant: "destructive",
        title: "초대 실패",
        description: "초대 처리 중 오류가 발생했습니다."
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const toggleViewPermission = async (memberId: string, currentPermission: boolean) => {
    try {
      const { error } = await supabase
        .from('family_members')
        .update({ can_view_data: !currentPermission })
        .eq('id', memberId);

      if (error) {
        console.error('권한 업데이트 실패:', error);
        return;
      }

      toast({
        title: "권한 업데이트",
        description: `데이터 조회 권한이 ${!currentPermission ? '허용' : '차단'}되었습니다.`
      });

      fetchFamilyMembers();
    } catch (error) {
      console.error('권한 업데이트 중 오류:', error);
    }
  };

  const removeFamilyMember = async (memberId: string, memberName: string) => {
    if (!confirm(`${memberName}님을 가족 구성원에서 제외하시겠습니까?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('id', memberId);

      if (error) {
        console.error('가족 구성원 삭제 실패:', error);
        return;
      }

      toast({
        title: "가족 구성원 제외",
        description: `${memberName}님이 가족 구성원에서 제외되었습니다.`
      });

      fetchFamilyMembers();
    } catch (error) {
      console.error('가족 구성원 삭제 중 오류:', error);
    }
  };

  const relationshipLabels = {
    spouse: '배우자',
    child: '자녀',
    parent: '부모',
    sibling: '형제자매',
    other: '기타'
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">가족 구성원을 불러오는 중...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>가족 구성원 관리</CardTitle>
          </div>
          
          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                구성원 추가
              </Button>
            </DialogTrigger>
            
            <DialogContent>
              <DialogHeader>
                <DialogTitle>가족 구성원 초대</DialogTitle>
                <DialogDescription>
                  이미 가입된 사용자의 이메일을 입력하여 가족 구성원으로 추가하세요.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">이메일</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="example@email.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="relationship">관계</Label>
                  <Select value={inviteRelationship} onValueChange={setInviteRelationship}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(relationshipLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    상대방도 동일한 앱에 가입되어 있어야 합니다. 
                    추가되면 서로의 가계부 데이터를 조회할 수 있습니다.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                    취소
                  </Button>
                  <Button 
                    onClick={handleInviteMember}
                    disabled={inviteLoading || !inviteEmail.trim()}
                  >
                    {inviteLoading ? '추가 중...' : '구성원 추가'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <CardDescription>
          가족 구성원을 추가하여 서로의 가계부 데이터를 함께 관리하세요.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {familyMembers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">가족 구성원이 없습니다</h3>
            <p className="text-muted-foreground mb-4">
              가족 구성원을 추가하여 함께 가계부를 관리해보세요.
            </p>
            <Button onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              첫 번째 구성원 추가
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {familyMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{member.display_name}</h4>
                      <Badge variant="outline">
                        {relationshipLabels[member.relationship as keyof typeof relationshipLabels]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleViewPermission(member.id, member.can_view_data)}
                    title={member.can_view_data ? "데이터 조회 차단" : "데이터 조회 허용"}
                  >
                    {member.can_view_data ? (
                      <Eye className="h-4 w-4 text-green-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-red-600" />
                    )}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFamilyMember(member.id, member.display_name)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{familyMembers.length}명의 가족 구성원</strong>이 연결되었습니다. 
                상단의 뷰 선택에서 개별/통합 가계부를 확인할 수 있습니다.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
};