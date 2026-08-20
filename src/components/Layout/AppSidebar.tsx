import { Home, FolderKanban, Users, BarChart3, Calendar as CalendarIcon, Settings, Plus, Search, ImageIcon, CalendarDays, TrendingUp, ChevronRight, Archive, Gauge, ListChecks, Timer, Megaphone } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlobalSearch } from '@/components/Layout/GlobalSearch';
import { useUnreadNotificationType } from '@/hooks/useUnreadNotificationType';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'My Tasks', href: '/my-tasks', icon: ListChecks },
  { name: 'Sprints', href: '/sprints/timeline', icon: Gauge },
  { name: 'Time Log', href: '/time-log', icon: Timer },
  { name: 'Teams', href: '/teams', icon: Users },
  { name: 'Announcements', href: '/announcements', icon: Megaphone },
  { name: 'Calendar', href: '/calendar', icon: CalendarIcon },
  { name: 'Content Calendar', href: '/content-calendar', icon: CalendarDays },
  { name: 'Media Library', href: '/media-library', icon: ImageIcon },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];



export const AppSidebar = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string; key: string | null; status: string | null }[]>([]);
  const [projectsOpen, setProjectsOpen] = useState(location.pathname.startsWith('/projects'));
  const [closedOpen, setClosedOpen] = useState(false);
  const [noActiveSprint, setNoActiveSprint] = useState(false);
  const hasUnreadAnnouncements = useUnreadNotificationType('announcement');

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchProjects();
      checkActiveSprint();
    }
  }, [user]);

  const checkActiveSprint = async () => {
    const { count } = await supabase
      .from('sprints')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    setNoActiveSprint((count || 0) === 0);
  };

  useEffect(() => {
    if (location.pathname.startsWith('/projects')) setProjectsOpen(true);
  }, [location.pathname]);

  const fetchProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name, key, status')
      .order('created_at', { ascending: false });
    setProjects(data || []);
  };


  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url, full_name')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      
      if (data) {
        setAvatarUrl(data.avatar_url || '');
        setFullName(data.full_name || '');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const activeProjects = projects.filter((p) => p.status !== 'closed');
  const closedProjects = projects.filter((p) => p.status === 'closed');

  const handleSignOut = () => {
    signOut();
  };

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="https://res.cloudinary.com/dkk7zqgnz/image/upload/v1785424794/Loopix_final_ibeklc.png"
            alt="Loopix Kaam logo"
            className="h-9 w-9 rounded-lg object-contain"
          />
          <span className="text-xl font-bold">Kaam</span>
        </Link>
      </SidebarHeader>


      <SidebarContent className="px-2">
        <div className="px-2 pb-4">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="mr-2 h-4 w-4" />
            <span>Search...</span>
          </Button>
          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item, index) => {
                const isActive = item.href === '/sprints/timeline'
                  ? location.pathname.startsWith('/sprints')
                  : location.pathname === item.href;
                const showSprintDot = item.name === 'Sprints' && noActiveSprint;
                const showAnnouncementDot = item.name === 'Announcements' && hasUnreadAnnouncements;
                const navItem = (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.href} className="flex items-center space-x-3">
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                        {showSprintDot && (
                          <span
                            title="No active sprint"
                            className="ml-auto h-2 w-2 rounded-full bg-chart-2"
                          />
                        )}
                        {showAnnouncementDot && (
                          <span
                            title="New announcement"
                            className="ml-auto h-2 w-2 rounded-full bg-primary animate-pulse"
                          />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );

                if (index !== 0) return navItem;

                // Dashboard, then the collapsible Projects section
                return (
                  <div key="dashboard-and-projects">
                    {navItem}
                    <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton isActive={location.pathname === '/projects'}>
                            <FolderKanban className="h-4 w-4" />
                            <span className="flex-1 text-left">Projects</span>
                            <ChevronRight
                              className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
                                projectsOpen ? 'rotate-90' : ''
                              }`}
                            />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                          <SidebarMenuSub className="mt-1">
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                asChild
                                isActive={location.pathname === '/projects'}
                              >
                                <Link to="/projects">All projects</Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            {activeProjects.map((project, i) => (
                              <SidebarMenuSubItem
                                key={project.id}
                                className="animate-fade-in"
                                style={{ animationDelay: `${i * 30}ms` }}
                              >
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={location.pathname === `/projects/${project.id}`}
                                >
                                  <Link to={`/projects/${project.id}`} className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-chart-2" />
                                    <span className="truncate">{project.name}</span>
                                    {project.key && (
                                      <span className="ml-auto text-xs text-muted-foreground">
                                        {project.key}
                                      </span>
                                    )}
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                            {activeProjects.length === 0 && (
                              <p className="px-2 py-1 text-xs text-muted-foreground">
                                No active projects
                              </p>
                            )}

                            <Collapsible open={closedOpen} onOpenChange={setClosedOpen}>
                              <SidebarMenuSubItem>
                                <CollapsibleTrigger asChild>
                                  <SidebarMenuSubButton className="cursor-pointer">
                                    <Archive className="h-3.5 w-3.5" />
                                    <span className="flex-1 text-left">Closed projects</span>
                                    <span className="text-xs text-muted-foreground">
                                      {closedProjects.length}
                                    </span>
                                    <ChevronRight
                                      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-300 ${
                                        closedOpen ? 'rotate-90' : ''
                                      }`}
                                    />
                                  </SidebarMenuSubButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                                  <SidebarMenuSub className="mt-1">
                                    {closedProjects.map((project, i) => (
                                      <SidebarMenuSubItem
                                        key={project.id}
                                        className="animate-fade-in"
                                        style={{ animationDelay: `${i * 30}ms` }}
                                      >
                                        <SidebarMenuSubButton
                                          asChild
                                          isActive={location.pathname === `/projects/${project.id}`}
                                        >
                                          <Link
                                            to={`/projects/${project.id}`}
                                            className="flex items-center gap-2 opacity-70"
                                          >
                                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                                            <span className="truncate">{project.name}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    ))}
                                    {closedProjects.length === 0 && (
                                      <p className="px-2 py-1 text-xs text-muted-foreground">
                                        Nothing closed yet
                                      </p>
                                    )}
                                  </SidebarMenuSub>
                                </CollapsibleContent>
                              </SidebarMenuSubItem>
                            </Collapsible>
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  </div>
                );
              })}
            </SidebarMenu>

          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Quick Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/projects/new" className="flex items-center space-x-3">
                    <Plus className="h-4 w-4" />
                    <span>Create Project</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback>
                  {fullName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start overflow-hidden">
                <span className="truncate text-sm font-medium">
                  {fullName || user?.user_metadata?.full_name || user?.email}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link to="/profile-settings">
                <Settings className="mr-2 h-4 w-4" />
                Profile Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
};