import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface WorkSession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  note: string | null;
}

interface WorkTimerContextValue {
  activeSession: WorkSession | null;
  elapsed: number; // seconds of the running session
  running: boolean;
  /** timer was explicitly paused by the user (session ended, resumable) */
  paused: boolean;
  loading: boolean;
  start: (note?: string) => Promise<void>;
  stop: (reason?: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  /** user ids with a currently running timer */
  workingUsers: Set<string>;
  /** user ids currently connected to the app */
  onlineUsers: Set<string>;
  refresh: () => Promise<void>;
}

const WorkTimerContext = createContext<WorkTimerContextValue | null>(null);

export const formatDuration = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

export const formatHours = (totalSeconds: number) => {
  const h = totalSeconds / 3600;
  return `${h.toFixed(h < 10 ? 1 : 0)}h`;
};

export const WorkTimerProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [workingUsers, setWorkingUsers] = useState<Set<string>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setActiveSession(null);
      setWorkingUsers(new Set());
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('work_sessions')
      .select('id, user_id, started_at, ended_at, duration_seconds, note')
      .is('ended_at', null);

    const rows = (data || []) as WorkSession[];
    setWorkingUsers(new Set(rows.map((r) => r.user_id)));
    setActiveSession(rows.find((r) => r.user_id === user.id) || null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: keep the "who is working" set fresh
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('work-sessions-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_sessions' }, () => {
        refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  // Presence: who is currently logged in / has the app open
  useEffect(() => {
    if (!user) {
      setOnlineUsers(new Set());
      return;
    }
    const channel = supabase.channel('online-users', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineUsers(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Ticking clock for the running session
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!activeSession) {
      setElapsed(0);
      return;
    }
    const compute = () =>
      setElapsed((Date.now() - new Date(activeSession.started_at).getTime()) / 1000);
    compute();
    tickRef.current = setInterval(compute, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [activeSession]);

  const start = useCallback(
    async (note?: string) => {
      if (!user || activeSession) return;
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        // Ask while we have a user gesture (the Start click) — needed later so the
        // "are you still working?" prompt can alert the user even if the tab is minimized.
        Notification.requestPermission().catch(() => {});
      }
      const { data, error } = await supabase
        .from('work_sessions')
        .insert({ user_id: user.id, note: note || null })
        .select('id, user_id, started_at, ended_at, duration_seconds, note')
        .single();
      if (error) {
        toast({ title: 'Could not start timer', description: error.message, variant: 'destructive' });
        return;
      }
      setActiveSession(data as WorkSession);
      setPaused(false);
      setWorkingUsers((prev) => new Set(prev).add(user.id));
      toast({ title: 'Timer started', description: 'Your working hours are now being tracked.' });
    },
    [user, activeSession],
  );

  const endActiveSession = useCallback(async (): Promise<number | null> => {
    if (!user || !activeSession) return null;
    const endedAt = new Date();
    const duration = Math.max(
      1,
      Math.round((endedAt.getTime() - new Date(activeSession.started_at).getTime()) / 1000),
    );
    const { error } = await supabase
      .from('work_sessions')
      .update({ ended_at: endedAt.toISOString(), duration_seconds: duration })
      .eq('id', activeSession.id);
    if (error) {
      toast({ title: 'Could not stop timer', description: error.message, variant: 'destructive' });
      return null;
    }
    setActiveSession(null);
    setWorkingUsers((prev) => {
      const next = new Set(prev);
      next.delete(user.id);
      return next;
    });
    return duration;
  }, [user, activeSession]);

  const stop = useCallback(
    async (reason?: string) => {
      const duration = await endActiveSession();
      if (duration === null) return;
      setPaused(false);
      toast({ title: 'Timer stopped', description: reason || `Logged ${formatDuration(duration)} of work.` });
    },
    [endActiveSession],
  );

  const pause = useCallback(async () => {
    const duration = await endActiveSession();
    if (duration === null) return;
    setPaused(true);
    toast({ title: 'Timer paused', description: `Logged ${formatDuration(duration)} so far. Resume anytime.` });
  }, [endActiveSession]);

  const resume = useCallback(async () => {
    await start();
  }, [start]);

  const value = useMemo<WorkTimerContextValue>(
    () => ({
      activeSession,
      elapsed,
      running: !!activeSession,
      paused,
      loading,
      start,
      stop,
      pause,
      resume,
      workingUsers,
      onlineUsers,
      refresh,
    }),
    [activeSession, elapsed, paused, loading, start, stop, pause, resume, workingUsers, onlineUsers, refresh],
  );

  return <WorkTimerContext.Provider value={value}>{children}</WorkTimerContext.Provider>;
};

export const useWorkTimer = () => {
  const ctx = useContext(WorkTimerContext);
  if (!ctx) throw new Error('useWorkTimer must be used within a WorkTimerProvider');
  return ctx;
};

/** Convenience: presence state for any user id */
export const useUserPresence = (userId?: string | null) => {
  const { workingUsers, onlineUsers } = useWorkTimer();
  return {
    working: !!userId && workingUsers.has(userId),
    online: !!userId && (onlineUsers.has(userId) || workingUsers.has(userId)),
  };
};
