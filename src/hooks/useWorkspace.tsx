import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { friendlyErrorMessage } from '@/lib/errors';

export type WorkspaceRole = 'superadmin' | 'admin' | 'manager' | 'employee';

export interface WorkspaceMember {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  code: string;
}

interface WorkspaceContextValue {
  workspace: Workspace | null;
  role: WorkspaceRole | null;
  loading: boolean;
  /** true once we know the user has no workspace yet (vs. still loading) */
  needsSetup: boolean;
  members: WorkspaceMember[];
  membersLoading: boolean;
  refresh: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  createWorkspace: (name: string) => Promise<{ error: string | null }>;
  joinWorkspace: (code: string) => Promise<{ error: string | null }>;
  deleteWorkspace: () => Promise<{ error: string | null }>;
  updateMemberRole: (memberId: string, role: WorkspaceRole) => Promise<{ error: string | null }>;
  removeMember: (memberId: string) => Promise<{ error: string | null }>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const WorkspaceProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setWorkspace(null);
      setRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: wsId } = await supabase.rpc('current_workspace_id');
    if (!wsId) {
      setWorkspace(null);
      setRole(null);
      setLoading(false);
      return;
    }

    const [{ data: ws }, { data: membership }] = await Promise.all([
      supabase.from('workspaces').select('id, name, code').eq('id', wsId).maybeSingle(),
      supabase.from('workspace_members').select('role').eq('user_id', user.id).maybeSingle(),
    ]);

    setWorkspace(ws ?? null);
    setRole((membership?.role as WorkspaceRole) ?? null);
    setLoading(false);

    // Best-effort: renew the workspace's inactivity clock now that we know
    // someone with access actually opened the app.
    supabase.rpc('touch_workspace_activity').then(() => {});
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const refreshMembers = useCallback(async () => {
    if (!workspace) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    const { data: memberRows } = await supabase
      .from('workspace_members')
      .select('id, user_id, role, joined_at')
      .eq('workspace_id', workspace.id)
      .order('joined_at', { ascending: true });

    const userIds = (memberRows ?? []).map((m) => m.user_id);
    const { data: profileRows } = userIds.length
      ? await supabase.from('profiles').select('user_id, full_name, email, avatar_url').in('user_id', userIds)
      : { data: [] };

    const profileByUserId = new Map((profileRows ?? []).map((p) => [p.user_id, p]));
    setMembers(
      (memberRows ?? []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role as WorkspaceRole,
        joined_at: m.joined_at,
        full_name: profileByUserId.get(m.user_id)?.full_name ?? null,
        email: profileByUserId.get(m.user_id)?.email ?? '',
        avatar_url: profileByUserId.get(m.user_id)?.avatar_url ?? null,
      })),
    );
    setMembersLoading(false);
  }, [workspace]);

  const createWorkspace = useCallback(
    async (name: string) => {
      const { error } = await supabase.rpc('create_workspace', { _name: name });
      if (error) return { error: friendlyErrorMessage(error) };
      await refresh();
      return { error: null };
    },
    [refresh],
  );

  const joinWorkspace = useCallback(
    async (code: string) => {
      const { error } = await supabase.rpc('join_workspace', { _code: code });
      if (error) return { error: friendlyErrorMessage(error) };
      await refresh();
      return { error: null };
    },
    [refresh],
  );

  const deleteWorkspace = useCallback(async () => {
    const { error } = await supabase.rpc('delete_workspace');
    if (error) return { error: friendlyErrorMessage(error) };
    return { error: null };
  }, []);

  const updateMemberRole = useCallback(
    async (memberId: string, newRole: WorkspaceRole) => {
      const { error } = await supabase.from('workspace_members').update({ role: newRole }).eq('id', memberId);
      if (error) return { error: friendlyErrorMessage(error) };
      await refreshMembers();
      return { error: null };
    },
    [refreshMembers],
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      const { error } = await supabase.from('workspace_members').delete().eq('id', memberId);
      if (error) return { error: friendlyErrorMessage(error) };
      await refreshMembers();
      return { error: null };
    },
    [refreshMembers],
  );

  const value: WorkspaceContextValue = {
    workspace,
    role,
    loading,
    needsSetup: !loading && !!user && !workspace,
    members,
    membersLoading,
    refresh,
    refreshMembers,
    createWorkspace,
    joinWorkspace,
    deleteWorkspace,
    updateMemberRole,
    removeMember,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return ctx;
};
