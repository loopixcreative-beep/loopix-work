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
import Projects from "./pages/Projects";
import Teams from "./pages/Teams";
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
import { IdleActivityMonitor } from "@/components/TimeLog/IdleActivityMonitor";


const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <MainLayout>{children}</MainLayout>;
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="kaam-theme">
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <BrowserRouter>
        <AuthProvider>
          <WorkTimerProvider>
          <IdleActivityMonitor />
          <Routes>

            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/projects" element={
              <ProtectedRoute>
                <Projects />
              </ProtectedRoute>
            } />
            <Route path="/sprints" element={<Navigate to="/sprints/timeline" replace />} />
            <Route path="/sprints/:tab" element={
              <ProtectedRoute>
                <Sprints />
              </ProtectedRoute>
            } />
            <Route path="/teams" element={
              <ProtectedRoute>
                <Teams />
              </ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="/projects/new" element={
              <ProtectedRoute>
                <CreateProject />
              </ProtectedRoute>
            } />
            <Route path="/projects/:projectId" element={
              <ProtectedRoute>
                <ProjectDetail />
              </ProtectedRoute>
            } />
            <Route path="/projects/:projectId/settings" element={
              <ProtectedRoute>
                <ProjectSettings />
              </ProtectedRoute>
            } />
            <Route path="/projects/:projectId/issues/new" element={
              <ProtectedRoute>
                <CreateIssue />
              </ProtectedRoute>
            } />
            <Route path="/issues/new" element={
              <ProtectedRoute>
                <CreateIssue />
              </ProtectedRoute>
            } />
            <Route path="/issues/:issueId" element={
              <ProtectedRoute>
                <IssueDetail />
              </ProtectedRoute>
            } />

            <Route path="/projects/:projectId/issues/:issueId" element={
              <ProtectedRoute>
                <IssueDetail />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/profile-settings" element={
              <ProtectedRoute>
                <ProfileSettings />
              </ProtectedRoute>
            } />
            <Route path="/calendar" element={
              <ProtectedRoute>
                <Calendar />
              </ProtectedRoute>
            } />
            <Route path="/content-calendar" element={
              <ProtectedRoute>
                <ContentCalendar />
              </ProtectedRoute>
            } />
            <Route path="/media-library" element={
              <ProtectedRoute>
                <MediaLibrary />
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute>
                <ContentAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/my-tasks" element={
              <ProtectedRoute>
                <MyTasks />
              </ProtectedRoute>
            } />
            <Route path="/time-log" element={
              <ProtectedRoute>
                <TimeLog />
              </ProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </WorkTimerProvider>
        </AuthProvider>

      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);


export default App;
