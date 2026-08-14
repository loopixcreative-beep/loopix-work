import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { NotificationCenter } from '@/components/Notifications/NotificationCenter';
import { ThemeToggle } from '@/components/Theme/ThemeToggle';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AppSidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                <ThemeToggle compact className="hidden sm:inline-flex" />
                <NotificationCenter />
              </div>
            </div>
          </header>
          <div className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};
