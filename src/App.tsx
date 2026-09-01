import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/Layout/MainLayout";
import ProfileSettings from "./pages/ProfileSettings";
import Calendar from "./pages/Calendar";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Projects from "./pages/Projects";
import Teams from "./pages/Teams";
import Announcements from "./pages/Announcements";
import Reports from "./pages/Reports";
import CreateProject from "./pages/CreateProject";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectSettings from "./pages/ProjectSettings";
import CreateIssue from "./pages/CreateIssue";
import IssueDetail from "./pages/IssueDetail";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";

import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import MediaLibrary from "./pages/MediaLibrary";
import ContentCalendar from "./pages/ContentCalendar";
import ContentAnalytics from "./pages/ContentAnalytics";
import Sprints from "./pages/Sprints";
import MyTasks from "./pages/MyTasks";
import TimeLog from "./pages/TimeLog";
import { WorkTimerProvider } from "@/hooks/useWorkTimer";
import { WorkspaceProvider, useWorkspace } from "@/hooks/useWorkspace";
import { IdleActivityMonitor } from "@/components/TimeLog/IdleActivityMonitor";
import WorkspaceSetup from "./pages/WorkspaceSetup";
import RecoverWorkspace from "./pages/RecoverWorkspace";
import PlatformAdmin from "./pages/PlatformAdmin";


const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { needsSetup, loading: workspaceLoading } = useWorkspace();

  if (authLoading || (user && workspaceLoading)) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Signed in but hasn't created/joined a workspace yet — nothing else in
  // the app is reachable until that's resolved.
  if (needsSetup) {
    return <Navigate to="/app/workspace-setup" replace />;
  }

  return <MainLayout>{children}</MainLayout>;
};

// The workspace-setup screen itself needs a lighter guard: authenticated,
// but deliberately reachable *without* a workspace (that's the whole point).
const WorkspaceSetupRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { workspace, loading: workspaceLoading } = useWorkspace();

  if (authLoading || (user && workspaceLoading)) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (workspace) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};

// "/" is the public marketing page for signed-out visitors. Signed-in
// visitors are sent into the workspace at "/app", which has its own
// distinct URL space for every authenticated page.
const RootRoute = () => {
  const { user, loading: authLoading } = useAuth();
  const { needsSetup, loading: workspaceLoading } = useWorkspace();

  if (authLoading || (user && workspaceLoading)) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Landing />;
  }

  if (needsSetup) {
    return <Navigate to="/app/workspace-setup" replace />;
  }

  return <Navigate to="/app" replace />;
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="kaam-theme">
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <BrowserRouter>
        <AuthProvider>
          <WorkspaceProvider>
          <WorkTimerProvider>
          <IdleActivityMonitor />
          <Routes>

            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/" element={<RootRoute />} />
            <Route path="/app/workspace-setup" element={
              <WorkspaceSetupRoute>
                <WorkspaceSetup />
              </WorkspaceSetupRoute>
            } />
            <Route path="/recover-workspace" element={<RecoverWorkspace />} />
            <Route path="/loopix-console" element={<PlatformAdmin />} />

            {/* Everything below is the authenticated workspace, namespaced under /app */}
            <Route path="/app" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/app/projects" element={
              <ProtectedRoute>
                <Projects />
              </ProtectedRoute>
            } />
            <Route path="/app/sprints" element={<Navigate to="/app/sprints/timeline" replace />} />
            <Route path="/app/sprints/:tab" element={
              <ProtectedRoute>
                <Sprints />
              </ProtectedRoute>
            } />
            <Route path="/app/teams" element={
              <ProtectedRoute>
                <Teams />
              </ProtectedRoute>
            } />
            <Route path="/app/announcements" element={
              <ProtectedRoute>
                <Announcements />
              </ProtectedRoute>
            } />
            <Route path="/app/reports" element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="/app/projects/new" element={
              <ProtectedRoute>
                <CreateProject />
              </ProtectedRoute>
            } />
            <Route path="/app/projects/:projectId/:slug?" element={
              <ProtectedRoute>
                <ProjectDetail />
              </ProtectedRoute>
            } />
            <Route path="/app/projects/:projectId/settings" element={
              <ProtectedRoute>
                <ProjectSettings />
              </ProtectedRoute>
            } />
            <Route path="/app/projects/:projectId/issues/new" element={
              <ProtectedRoute>
                <CreateIssue />
              </ProtectedRoute>
            } />
            <Route path="/app/issues/new" element={
              <ProtectedRoute>
                <CreateIssue />
              </ProtectedRoute>
            } />
            <Route path="/app/issues/:issueId" element={
              <ProtectedRoute>
                <IssueDetail />
              </ProtectedRoute>
            } />

            <Route path="/app/projects/:projectId/issues/:issueId" element={
              <ProtectedRoute>
                <IssueDetail />
              </ProtectedRoute>
            } />
            <Route path="/app/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/app/profile-settings" element={
              <ProtectedRoute>
                <ProfileSettings />
              </ProtectedRoute>
            } />
            <Route path="/app/calendar" element={
              <ProtectedRoute>
                <Calendar />
              </ProtectedRoute>
            } />
            <Route path="/app/content-calendar" element={
              <ProtectedRoute>
                <ContentCalendar />
              </ProtectedRoute>
            } />
            <Route path="/app/media-library" element={
              <ProtectedRoute>
                <MediaLibrary />
              </ProtectedRoute>
            } />
            <Route path="/app/analytics" element={
              <ProtectedRoute>
                <ContentAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/app/my-tasks" element={
              <ProtectedRoute>
                <MyTasks />
              </ProtectedRoute>
            } />
            <Route path="/app/time-log" element={
              <ProtectedRoute>
                <TimeLog />
              </ProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </WorkTimerProvider>
          </WorkspaceProvider>
        </AuthProvider>

      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);


export default App;
