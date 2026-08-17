import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { friendlyErrorMessage } from '@/lib/errors';
import { supabase } from '@/integrations/supabase/client';
import { Shield, UserPlus, Trash2 } from 'lucide-react';

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  profile: {
    full_name: string;
    email: string;
  };
}

export const RoleManagement = () => {
  const { toast } = useToast();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('employee');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUserRoles();
    fetchAvailableUsers();
  }, []);

  const fetchUserRoles = async () => {
    try {
      const { data: rolesData, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('role');

      if (error) throw error;

      // Fetch profiles for each role
      if (rolesData && rolesData.length > 0) {
        const userIds = rolesData.map(r => r.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);

        const rolesWithProfiles = rolesData.map(role => ({
          ...role,
          profile: profilesData?.find(p => p.user_id === role.user_id) || { full_name: '', email: '' }
        }));

        setUserRoles(rolesWithProfiles as any);
      } else {
        setUserRoles([]);
      }
    } catch (error) {
      console.error('Error fetching user roles:', error);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const addRole = async () => {
    if (!selectedUserId || !selectedRole) {
      toast({
        title: 'Error',
        description: 'Please select a user and role',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert([{ user_id: selectedUserId, role: selectedRole as any }]);

      if (error) throw error;

      toast({
        title: 'Role Added',
        description: 'User role has been added successfully',
      });

      fetchUserRoles();
      setSelectedUserId('');
      setSelectedRole('employee');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: friendlyErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const removeRole = async (roleId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      toast({
        title: 'Role Removed',
        description: 'User role has been removed successfully',
      });

      fetchUserRoles();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: friendlyErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-brand-orange/15 text-brand-orange border border-brand-orange/30';
      case 'manager':
        return 'bg-primary/15 text-primary border border-primary/30';
      case 'stakeholder':
        return 'bg-chart-5/15 text-chart-5 border border-chart-5/30';
      default:
        return 'bg-muted text-muted-foreground border border-border';
    }
  };

  const PERMISSIONS: { role: string; label: string; perms: string[] }[] = [
    { role: 'admin', label: 'Admin', perms: ['Manage roles & permissions', 'Create / delete projects', 'Manage all tasks & members', 'Full analytics & reports'] },
    { role: 'manager', label: 'Manager', perms: ['Create projects & tasks', 'Assign work to members', 'Approve content', 'View reports'] },
    { role: 'employee', label: 'Employee', perms: ['Create tasks', 'Update own / assigned tasks', 'Upload media', 'View own analytics'] },
    { role: 'stakeholder', label: 'Stakeholder', perms: ['Read-only project access', 'Comment & approve content', 'View reports'] },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Roles & Permissions
        </CardTitle>
        <CardDescription>
          Assign roles to members — admin, manager, employee or stakeholder. Permissions are enforced at the database level.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Add Role Section */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <div className="flex-1">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:w-44">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="stakeholder">Stakeholder</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addRole} disabled={loading}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Role
          </Button>
        </div>


        {/* Current Roles List */}
        <div className="space-y-2">
          <h4 className="font-medium">Current Roles</h4>
          {userRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No roles assigned yet</p>
          ) : (
            <div className="space-y-2">
              {userRoles.map((userRole) => (
                <div
                  key={userRole.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      {userRole.profile.full_name || userRole.profile.email}
                    </span>
                    <Badge className={getRoleBadgeColor(userRole.role)}>
                      {userRole.role}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRole(userRole.id)}
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Permission matrix */}
        <div className="space-y-3">
          <h4 className="font-medium">What each role can do</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {PERMISSIONS.map((p) => (
              <div key={p.role} className="rounded-xl border bg-gradient-to-br from-muted/40 to-transparent p-4">
                <Badge className={getRoleBadgeColor(p.role)}>{p.label}</Badge>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {p.perms.map((perm) => (
                    <li key={perm} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" />
                      {perm}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </CardContent>

    </Card>
  );
};
