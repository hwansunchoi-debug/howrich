import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'master' | 'member';

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  role: UserRole;
  family_id?: string;
}

export const useUserRole = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user]);

  const fetchUserProfile = async () => {
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

      setProfile(data as UserProfile);
    } catch (error) {
      console.error('프로필 조회 중 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const isMaster = profile?.role === 'master';
  const isMember = profile?.role === 'member';

  return {
    profile,
    loading,
    isMaster,
    isMember,
    role: profile?.role || 'member',
    refreshProfile: fetchUserProfile
  };
};