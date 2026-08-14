export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      calendar_entries: {
        Row: {
          content: string | null
          created_at: string
          entry_date: string
          id: string
          images: string[] | null
          project_id: string
          reference_links: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          entry_date: string
          id?: string
          images?: string[] | null
          project_id: string
          reference_links?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          images?: string[] | null
          project_id?: string
          reference_links?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          author_id: string
          content: string
          created_at: string
          id: string
          is_approved: boolean | null
          issue_id: string
          media_type: string | null
          media_urls: string[] | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_approved?: boolean | null
          issue_id: string
          media_type?: string | null
          media_urls?: string[] | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_approved?: boolean | null
          issue_id?: string
          media_type?: string | null
          media_urls?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_assignees: {
        Row: {
          assigned_at: string
          issue_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          issue_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          issue_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_assignees_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          approval_notes: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          assignee_id: string | null
          backlog_rank: number | null
          board_status: Database["public"]["Enums"]["board_status"]
          calendar_entry_link: string | null
          carried_over_count: number
          created_at: string
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          issue_key: string | null
          issue_type: Database["public"]["Enums"]["issue_type"]
          labels: string[] | null
          logged_hours: number | null
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string
          reporter_id: string
          sprint_id: string | null
          status: Database["public"]["Enums"]["issue_status"]
          story_points: number | null
          title: string
          updated_at: string
        }
        Insert: {
          approval_notes?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assignee_id?: string | null
          backlog_rank?: number | null
          board_status?: Database["public"]["Enums"]["board_status"]
          calendar_entry_link?: string | null
          carried_over_count?: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          issue_key?: string | null
          issue_type?: Database["public"]["Enums"]["issue_type"]
          labels?: string[] | null
          logged_hours?: number | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id: string
          reporter_id: string
          sprint_id?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          story_points?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          approval_notes?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assignee_id?: string | null
          backlog_rank?: number | null
          board_status?: Database["public"]["Enums"]["board_status"]
          calendar_entry_link?: string | null
          carried_over_count?: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          issue_key?: string | null
          issue_type?: Database["public"]["Enums"]["issue_type"]
          labels?: string[] | null
          logged_hours?: number | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string
          reporter_id?: string
          sprint_id?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          story_points?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "issues_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      media_library: {
        Row: {
          created_at: string | null
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          mime_type: string | null
          project_id: string | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          mime_type?: string | null
          project_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          mime_type?: string | null
          project_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_library_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          availability_status: string | null
          avatar_url: string | null
          bio: string | null
          coin_points: number
          created_at: string
          email: string
          full_name: string | null
          id: string
          location: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          skills: string[] | null
          team_department: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_status?: string | null
          avatar_url?: string | null
          bio?: string | null
          coin_points?: number
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          location?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          skills?: string[] | null
          team_department?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_status?: string | null
          avatar_url?: string | null
          bio?: string | null
          coin_points?: number
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          location?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          skills?: string[] | null
          team_department?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          project_id: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          project_id: string
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          project_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string
          description: string | null
          goals: string | null
          id: string
          key: string
          lead_id: string
          name: string
          objectives: string | null
          status: string
          type: Database["public"]["Enums"]["project_type"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          goals?: string | null
          id?: string
          key: string
          lead_id: string
          name: string
          objectives?: string | null
          status?: string
          type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          goals?: string | null
          id?: string
          key?: string
          lead_id?: string
          name?: string
          objectives?: string | null
          status?: string
          type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sprint_issues: {
        Row: {
          issue_id: string
          sprint_id: string
        }
        Insert: {
          issue_id: string
          sprint_id: string
        }
        Update: {
          issue_id?: string
          sprint_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprint_issues_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_issues_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      sprint_task_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          sprint_id: string
          status: Database["public"]["Enums"]["board_status"]
          story_points: number | null
          task_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          sprint_id: string
          status: Database["public"]["Enums"]["board_status"]
          story_points?: number | null
          task_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          sprint_id?: string
          status?: Database["public"]["Enums"]["board_status"]
          story_points?: number | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprint_task_history_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      sprints: {
        Row: {
          capacity_points: number | null
          completed_at: string | null
          created_at: string
          end_date: string
          goal: string | null
          id: string
          is_active: boolean | null
          name: string
          project_id: string
          start_date: string
          status: Database["public"]["Enums"]["sprint_status"]
          updated_at: string
          wip_limits: Json
        }
        Insert: {
          capacity_points?: number | null
          completed_at?: string | null
          created_at?: string
          end_date: string
          goal?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          project_id: string
          start_date: string
          status?: Database["public"]["Enums"]["sprint_status"]
          updated_at?: string
          wip_limits?: Json
        }
        Update: {
          capacity_points?: number | null
          completed_at?: string | null
          created_at?: string
          end_date?: string
          goal?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          project_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["sprint_status"]
          updated_at?: string
          wip_limits?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sprints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_logs: {
        Row: {
          created_at: string
          description: string | null
          hours_logged: number
          id: string
          issue_id: string
          logged_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hours_logged: number
          id?: string
          issue_id: string
          logged_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hours_logged?: number
          id?: string
          issue_id?: string
          logged_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_logs_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          activity_tracking: boolean | null
          calendar_view: string | null
          created_at: string
          deadline_reminders: boolean | null
          default_duration: number | null
          email_notifications: boolean | null
          profile_visibility: string | null
          project_updates: boolean | null
          start_of_week: string | null
          task_assignments: boolean | null
          two_factor_auth: boolean | null
          updated_at: string
          user_id: string
          weekly_digest: boolean | null
          working_hours: number | null
        }
        Insert: {
          activity_tracking?: boolean | null
          calendar_view?: string | null
          created_at?: string
          deadline_reminders?: boolean | null
          default_duration?: number | null
          email_notifications?: boolean | null
          profile_visibility?: string | null
          project_updates?: boolean | null
          start_of_week?: string | null
          task_assignments?: boolean | null
          two_factor_auth?: boolean | null
          updated_at?: string
          user_id: string
          weekly_digest?: boolean | null
          working_hours?: number | null
        }
        Update: {
          activity_tracking?: boolean | null
          calendar_view?: string | null
          created_at?: string
          deadline_reminders?: boolean | null
          default_duration?: number | null
          email_notifications?: boolean | null
          profile_visibility?: string | null
          project_updates?: boolean | null
          start_of_week?: string | null
          task_assignments?: boolean | null
          two_factor_auth?: boolean | null
          updated_at?: string
          user_id?: string
          weekly_digest?: boolean | null
          working_hours?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          note: string | null
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          note?: string | null
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          note?: string | null
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_project_invitation: {
        Args: { invitation_token: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee" | "stakeholder"
      board_status: "todo" | "in_progress" | "review" | "done"
      issue_status: "to_do" | "in_progress" | "review" | "done"
      issue_type:
        | "promotional_post"
        | "event_post"
        | "festive_post"
        | "reels"
        | "content_creation"
        | "ads_campaign"
        | "calendar_content"
        | "profile_image"
        | "cover_image"
        | "logo_design"
        | "website_development"
        | "app_development"
        | "ui_ux_design"
        | "backend"
        | "frontend"
        | "task"
        | "bug"
        | "other"
        | "client_meeting"
        | "team_meeting"
      priority_level: "lowest" | "low" | "medium" | "high" | "highest"
      project_type:
        | "digital_marketing"
        | "website_development"
        | "mobile_app_development"
        | "ui_ux_design"
        | "graphics_design"
        | "video_production"
        | "branding_creative"
        | "it_software_integration"
      sprint_status: "planned" | "active" | "completed"
      user_role: "admin" | "manager" | "employee" | "stakeholder"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "employee", "stakeholder"],
      board_status: ["todo", "in_progress", "review", "done"],
      issue_status: ["to_do", "in_progress", "review", "done"],
      issue_type: [
        "promotional_post",
        "event_post",
        "festive_post",
        "reels",
        "content_creation",
        "ads_campaign",
        "calendar_content",
        "profile_image",
        "cover_image",
        "logo_design",
        "website_development",
        "app_development",
        "ui_ux_design",
        "backend",
        "frontend",
        "task",
        "bug",
        "other",
        "client_meeting",
        "team_meeting",
      ],
      priority_level: ["lowest", "low", "medium", "high", "highest"],
      project_type: [
        "digital_marketing",
        "website_development",
        "mobile_app_development",
        "ui_ux_design",
        "graphics_design",
        "video_production",
        "branding_creative",
        "it_software_integration",
      ],
      sprint_status: ["planned", "active", "completed"],
      user_role: ["admin", "manager", "employee", "stakeholder"],
    },
  },
} as const
