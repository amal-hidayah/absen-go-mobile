export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      company_attendance: {
        Row: {
          attend_date: string;
          clock_in: string | null;
          clock_out: string | null;
          created_at: string;
          employee_id: string;
          id: string;
          late_minutes: number;
          note: string | null;
          recorded_by: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          attend_date?: string;
          clock_in?: string | null;
          clock_out?: string | null;
          created_at?: string;
          employee_id: string;
          id?: string;
          late_minutes?: number;
          note?: string | null;
          recorded_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attend_date?: string;
          clock_in?: string | null;
          clock_out?: string | null;
          created_at?: string;
          employee_id?: string;
          id?: string;
          late_minutes?: number;
          note?: string | null;
          recorded_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_attendance_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      company_settings: {
        Row: {
          company_name: string;
          id: number;
          late_tolerance_minutes: number;
          qr_secret: string;
          updated_at: string;
          work_end_time: string;
          work_start_time: string;
        };
        Insert: {
          company_name?: string;
          id?: number;
          late_tolerance_minutes?: number;
          qr_secret?: string;
          updated_at?: string;
          work_end_time?: string;
          work_start_time?: string;
        };
        Update: {
          company_name?: string;
          id?: number;
          late_tolerance_minutes?: number;
          qr_secret?: string;
          updated_at?: string;
          work_end_time?: string;
          work_start_time?: string;
        };
        Relationships: [];
      };
      employees: {
        Row: {
          active: boolean;
          created_at: string;
          daily_salary: number;
          department: string;
          email: string | null;
          full_name: string;
          id: string;
          nik: string;
          position: string;
          role: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          daily_salary?: number;
          department?: string;
          email?: string | null;
          full_name: string;
          id?: string;
          nik: string;
          position?: string;
          role?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          daily_salary?: number;
          department?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          nik?: string;
          position?: string;
          role?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "login_accounts_employee_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "login_accounts";
            referencedColumns: ["employee_id"];
          },
        ];
      };
      login_accounts: {
        Row: {
          active: boolean;
          created_at: string;
          email: string;
          employee_id: string | null;
          id: string;
          role: string;
          updated_at: string;
          user_id: string | null;
          username: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          email: string;
          employee_id?: string | null;
          id?: string;
          role?: string;
          updated_at?: string;
          user_id?: string | null;
          username: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          email?: string;
          employee_id?: string | null;
          id?: string;
          role?: string;
          updated_at?: string;
          user_id?: string | null;
          username?: string;
        };
        Relationships: [
          {
            foreignKeyName: "login_accounts_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: true;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_employee_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      resolve_login_email: {
        Args: { _username: string };
        Returns: string | null;
      };
      touch_updated_at: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Tables"]["employees"]["Row"];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicSchemaEnumNameOrOptions extends
    | keyof (DefaultSchema["Enums"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (PublicSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[PublicSchemaEnumNameOrOptions["schema"]]["Enums"] &
        DatabaseWithoutInternals[PublicSchemaEnumNameOrOptions["schema"]]["Views"])
    : never) = never,
> = PublicSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[PublicSchemaEnumNameOrOptions["schema"]]["Enums"] &
      DatabaseWithoutInternals[PublicSchemaEnumNameOrOptions["schema"]]["Views"])[EnumName] extends {
      Enum: infer E;
    }
    ? E
    : never
  : PublicSchemaEnumNameOrOptions extends keyof (DefaultSchema["Enums"] & DefaultSchema["Views"])
    ? (DefaultSchema["Enums"] & DefaultSchema["Views"])[PublicSchemaEnumNameOrOptions] extends {
        Enum: infer E;
      }
      ? E
      : never
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName] extends {
      composite_type: infer C;
    }
    ? C
    : never
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions] extends {
        composite_type: infer C;
      }
      ? C
      : never
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

export type CompanySettingsRow = Tables<"company_settings">;
export type EmployeeRow = Tables<"employees">;
export type CompanyAttendanceRow = Tables<"company_attendance">;
