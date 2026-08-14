import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Filter, User, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

interface Issue {
  id: string;
  issue_key: string;
  title: string;
  status: string;
  priority: string;
  issue_type: string;
  assignee_id: string | null;
  reporter_id: string;
  due_date: string | null;
  created_at: string;
  assignee: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
  reporter: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
}

interface IssuesListProps {
  projectId: string;
}

const IssuesList = ({ projectId }: IssuesListProps) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [filteredIssues, setFilteredIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  useEffect(() => {
    fetchIssues();
  }, [projectId]);

  useEffect(() => {
    filterIssues();
  }, [issues, searchTerm, statusFilter, priorityFilter]);

  const fetchIssues = async () => {
    try {
      const { data, error } = await supabase
        .from('issues')
        .select(`
          *,
          assignee:profiles!issues_assignee_id_fkey(full_name, email, avatar_url),
          reporter:profiles!issues_reporter_id_fkey(full_name, email, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIssues(data || []);
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterIssues = () => {
    let filtered = issues;

    if (searchTerm) {
      filtered = filtered.filter(issue =>
        issue.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(issue => issue.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(issue => issue.priority === priorityFilter);
    }

    setFilteredIssues(filtered);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'to_do':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'review':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'done':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'story':
        return <User className="h-4 w-4 text-green-500" />;
      case 'task':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse h-6 bg-muted rounded w-1/4"></div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <span>Issues</span>
            <Badge variant="secondary">{filteredIssues.length}</Badge>
          </CardTitle>
          <Button asChild>
            <Link to={`/projects/${projectId}/issues/new`}>
              <Plus className="mr-2 h-4 w-4" />
              Create Issue
            </Link>
          </Button>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search issues..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="to_do">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        {filteredIssues.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No issues found</p>
            <Button variant="outline" className="mt-4" asChild>
              <Link to={`/projects/${projectId}/issues/new`}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first issue
              </Link>
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Type</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIssues.map((issue) => (
                <TableRow key={issue.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.location.href = `/projects/${projectId}/issues/${issue.id}`}>
                  <TableCell>{getTypeIcon(issue.issue_type)}</TableCell>
                  <TableCell>
                    <span className="font-mono text-sm font-medium text-primary">
                      {issue.issue_key}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{issue.title}</TableCell>
                  <TableCell>
                    <Badge className={`${getStatusColor(issue.status)} text-xs`}>
                      {issue.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getPriorityColor(issue.priority)} text-xs`}>
                      {issue.priority.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {issue.assignee ? (
                      <div className="flex items-center space-x-2">
                        <UserAvatar
                          size="xs"
                          name={issue.assignee.full_name}
                          email={issue.assignee.email}
                          avatarUrl={issue.assignee.avatar_url}
                        />
                        <span className="text-sm">
                          {issue.assignee.full_name || issue.assignee.email}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {issue.reporter && (
                      <div className="flex items-center space-x-2">
                        <UserAvatar
                          size="xs"
                          name={issue.reporter.full_name}
                          email={issue.reporter.email}
                          avatarUrl={issue.reporter.avatar_url}
                        />
                        <span className="text-sm">
                          {issue.reporter.full_name || issue.reporter.email}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {issue.due_date ? (
                      <span className="text-sm">
                        {format(new Date(issue.due_date), 'MMM dd, yyyy')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(issue.created_at), 'MMM dd, yyyy')}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default IssuesList;