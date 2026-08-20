import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/** Whether the current user has any unread notification of a given `type` — for a sidebar nav dot. */
export const useUnreadNotificationType = (type: string) => {
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  const check = useCallback(async () => {
    if (!user) {
      setHasUnread(false);
      return;
    }
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('type', type)
      .eq('is_read', false);
    setHasUnread((count || 0) > 0);
  }, [user, type]);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`unread-notifications-${type}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => check(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, type, check]);

  return hasUnread;
};
