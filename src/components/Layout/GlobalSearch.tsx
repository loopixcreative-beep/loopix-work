import { useState, useEffect } from 'react';
import { Search, X, FolderKanban, CheckSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SearchResult {
  id: string;
  type: 'project' | 'task';
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  projectName?: string;
}

export const GlobalSearch = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (searchQuery.length >= 2) {
      performSearch();
    } else {
      setResults([]);
    }
  }, [searchQuery]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const searchTerm = `%${searchQuery}%`;

      // Search projects
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, description, type')
        .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .limit(5);

      // Search issues/tasks
      const { data: issues } = await supabase
        .from('issues')
        .select('id, title, description, status, priority, project:projects(name, id)')
        .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .limit(10);

      const projectResults: SearchResult[] = projects?.map(p => ({
        id: p.id,
        type: 'project' as const,
        title: p.name,
        description: p.description || undefined,
      })) || [];

      const taskResults: SearchResult[] = issues?.map(i => ({
        id: i.id,
        type: 'task' as const,
        title: i.title,
        description: i.description || undefined,
        status: i.status,
        priority: i.priority,
        projectName: i.project?.name,
      })) || [];

      setResults([...projectResults, ...taskResults]);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'project') {
      navigate(`/projects/${result.id}`);
    } else {
      navigate(`/projects/${result.id}`); // You may need to adjust this to navigate to issue detail
    }
    onOpenChange(false);
    setSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0">
        <div className="flex items-center border-b px-4 py-3">
          <Search className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            placeholder="Search projects and tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="ml-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Searching...
            </div>
          ) : results.length > 0 ? (
            <div className="p-2">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full text-left p-3 hover:bg-muted rounded-lg transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {result.type === 'project' ? (
                        <FolderKanban className="h-4 w-4 text-primary" />
                      ) : (
                        <CheckSquare className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{result.title}</p>
                        <Badge variant="secondary" className="text-xs">
                          {result.type}
                        </Badge>
                      </div>
                      {result.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                          {result.description}
                        </p>
                      )}
                      {result.type === 'task' && (
                        <div className="flex items-center gap-2 mt-1">
                          {result.status && (
                            <Badge variant="outline" className="text-xs">
                              {result.status}
                            </Badge>
                          )}
                          {result.priority && (
                            <Badge
                              variant={result.priority === 'high' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {result.priority}
                            </Badge>
                          )}
                          {result.projectName && (
                            <span className="text-xs text-muted-foreground">
                              in {result.projectName}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery.length >= 2 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>No results found for "{searchQuery}"</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <p>Type at least 2 characters to search</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
