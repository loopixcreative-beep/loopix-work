import { useState, useEffect } from 'react';
import { AvatarStack } from '@/components/ui/user-avatar';
import { supabase } from '@/integrations/supabase/client';

interface Assignee {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface AssigneesListProps {
  issueId: string;
  className?: string;
  refreshKey?: number;
}

export const AssigneesList = ({ issueId, className = '', refreshKey = 0 }: AssigneesListProps) => {
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssignees();
  }, [issueId, refreshKey]);


  const fetchAssignees = async () => {
    try {
      const { data: assigneeData, error } = await supabase
        .from('issue_assignees')
        .select('user_id')
        .eq('issue_id', issueId);

      if (error) throw error;

      if (assigneeData && assigneeData.length > 0) {
        const userIds = assigneeData.map(a => a.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .in('user_id', userIds);

        setAssignees(profilesData || []);
      } else {
        setAssignees([]);
      }
    } catch (error) {
      console.error('Error fetching assignees:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  if (loading) {
    return <div className={`flex -space-x-2 ${className}`}>
      <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
    </div>;
  }

  if (assignees.length === 0) {
    return <span className={`text-sm text-muted-foreground ${className}`}>Unassigned</span>;
  }

  return (
    <div className={className}>
      <AvatarStack
        users={assignees.map((a) => ({
          name: a.full_name,
          email: a.email,
          avatarUrl: a.avatar_url,
        }))}
      />
    </div>
  );
};
