import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'admin' | 'manager' | 'employee' | 'stakeholder';

export const useUserRoles = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        if (error) throw error;
        setRoles((data || []).map((r) => r.role as AppRole));
      } catch (e) {
        console.error('Error loading roles:', e);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const isAdmin = roles.includes('admin');
  const isManager = roles.includes('manager');

  return { roles, isAdmin, isManager, canManageAll: isAdmin || isManager, loading };
};
