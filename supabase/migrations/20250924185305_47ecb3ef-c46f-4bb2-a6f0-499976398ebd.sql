-- Create enum types for various statuses and priorities
CREATE TYPE public.project_type AS ENUM ('scrum', 'kanban', 'business', 'it_service');
CREATE TYPE public.issue_type AS ENUM ('task', 'bug', 'story', 'epic', 'ticket');
CREATE TYPE public.issue_status AS ENUM ('to_do', 'in_progress', 'review', 'done');
CREATE TYPE public.priority_level AS ENUM ('lowest', 'low', 'medium', 'high', 'highest');
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'employee', 'stakeholder');

-- Create profiles table for user information
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'employee',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    description TEXT,
    type project_type NOT NULL DEFAULT 'kanban',
    lead_id UUID NOT NULL REFERENCES public.profiles(user_id),
    created_by UUID NOT NULL REFERENCES public.profiles(user_id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create issues table
CREATE TABLE public.issues (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    issue_type issue_type NOT NULL DEFAULT 'task',
    status issue_status NOT NULL DEFAULT 'to_do',
    priority priority_level NOT NULL DEFAULT 'medium',
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES public.profiles(user_id),
    reporter_id UUID NOT NULL REFERENCES public.profiles(user_id),
    due_date TIMESTAMP WITH TIME ZONE,
    estimated_hours INTEGER,
    logged_hours INTEGER DEFAULT 0,
    labels TEXT[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sprints table for scrum projects
CREATE TABLE public.sprints (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    goal TEXT,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sprint_issues junction table
CREATE TABLE public.sprint_issues (
    sprint_id UUID NOT NULL REFERENCES public.sprints(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    PRIMARY KEY (sprint_id, issue_id)
);

-- Create comments table for issues
CREATE TABLE public.comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(user_id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create time_logs table for tracking work
CREATE TABLE public.time_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id),
    hours_logged DECIMAL(5,2) NOT NULL,
    description TEXT,
    logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policies for projects (authenticated users can view all, admins/managers can create/update)
CREATE POLICY "Users can view all projects" ON public.projects FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Project leads and admins can update projects" ON public.projects FOR UPDATE USING (
    lead_id = auth.uid() OR 
    created_by = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Create policies for issues
CREATE POLICY "Users can view issues in accessible projects" ON public.issues FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create issues" ON public.issues FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Assignees and reporters can update issues" ON public.issues FOR UPDATE USING (
    assignee_id = auth.uid() OR 
    reporter_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Create policies for sprints
CREATE POLICY "Users can view sprints" ON public.sprints FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Project managers can manage sprints" ON public.sprints FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = project_id AND (
            p.lead_id = auth.uid() OR 
            EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
        )
    )
);

-- Create policies for other tables
CREATE POLICY "Users can view sprint issues" ON public.sprint_issues FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Project managers can manage sprint issues" ON public.sprint_issues FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.sprints s 
        JOIN public.projects p ON s.project_id = p.id 
        WHERE s.id = sprint_id AND (
            p.lead_id = auth.uid() OR 
            EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
        )
    )
);

CREATE POLICY "Users can view comments" ON public.comments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update their comments" ON public.comments FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can view time logs" ON public.time_logs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create their own time logs" ON public.time_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own time logs" ON public.time_logs FOR UPDATE USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_issues_updated_at BEFORE UPDATE ON public.issues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sprints_updated_at BEFORE UPDATE ON public.sprints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto profile creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();