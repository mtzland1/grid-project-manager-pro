export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      custom_roles: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      message_read_status: {
        Row: {
          created_at: string
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_read_status_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "project_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      project_chat_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_columns: {
        Row: {
          column_key: string
          column_label: string
          column_order: number | null
          column_type: string | null
          column_width: string | null
          created_at: string | null
          id: string
          is_calculated: boolean | null
          is_system_column: boolean | null
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          column_key: string
          column_label: string
          column_order?: number | null
          column_type?: string | null
          column_width?: string | null
          created_at?: string | null
          id?: string
          is_calculated?: boolean | null
          is_system_column?: boolean | null
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          column_key?: string
          column_label?: string
          column_order?: number | null
          column_type?: string | null
          column_width?: string | null
          created_at?: string | null
          id?: string
          is_calculated?: boolean | null
          is_system_column?: boolean | null
          project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_columns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_items: {
        Row: {
          a_comprar: string | null
          cc_encargos_valor: number
          cc_icms_pr: number
          cc_icms_revenda: number
          cc_lucro_porcentagem: number
          cc_lucro_valor: number
          cc_mat_total: number
          cc_mat_uni: number
          cc_mo_total: number
          cc_mo_uni: number
          cc_pis_cofins: number
          cc_total: number
          comprado: string | null
          conferencia_estoque: string | null
          created_at: string
          cronograma_inicio: string | null
          data_conclusao: string | null
          data_medicoes: string | null
          desconto: number
          descricao: string
          distribuidor: string | null
          dynamic_data: Json | null
          expedicao: string | null
          id: string
          ipi: number
          manutencao: string | null
          mat_uni_pr: number
          previsao_chegada: string | null
          prioridade_compra: string | null
          project_id: string
          qtd: number
          reanalise_escopo: string | null
          reanalise_mo: string | null
          status_global: string | null
          unidade: string
          updated_at: string
          vlr_total_estimado: number
          vlr_total_venda: number
        }
        Insert: {
          a_comprar?: string | null
          cc_encargos_valor?: number
          cc_icms_pr?: number
          cc_icms_revenda?: number
          cc_lucro_porcentagem?: number
          cc_lucro_valor?: number
          cc_mat_total?: number
          cc_mat_uni?: number
          cc_mo_total?: number
          cc_mo_uni?: number
          cc_pis_cofins?: number
          cc_total?: number
          comprado?: string | null
          conferencia_estoque?: string | null
          created_at?: string
          cronograma_inicio?: string | null
          data_conclusao?: string | null
          data_medicoes?: string | null
          desconto?: number
          descricao: string
          distribuidor?: string | null
          dynamic_data?: Json | null
          expedicao?: string | null
          id?: string
          ipi?: number
          manutencao?: string | null
          mat_uni_pr?: number
          previsao_chegada?: string | null
          prioridade_compra?: string | null
          project_id: string
          qtd?: number
          reanalise_escopo?: string | null
          reanalise_mo?: string | null
          status_global?: string | null
          unidade?: string
          updated_at?: string
          vlr_total_estimado?: number
          vlr_total_venda?: number
        }
        Update: {
          a_comprar?: string | null
          cc_encargos_valor?: number
          cc_icms_pr?: number
          cc_icms_revenda?: number
          cc_lucro_porcentagem?: number
          cc_lucro_valor?: number
          cc_mat_total?: number
          cc_mat_uni?: number
          cc_mo_total?: number
          cc_mo_uni?: number
          cc_pis_cofins?: number
          cc_total?: number
          comprado?: string | null
          conferencia_estoque?: string | null
          created_at?: string
          cronograma_inicio?: string | null
          data_conclusao?: string | null
          data_medicoes?: string | null
          desconto?: number
          descricao?: string
          distribuidor?: string | null
          dynamic_data?: Json | null
          expedicao?: string | null
          id?: string
          ipi?: number
          manutencao?: string | null
          mat_uni_pr?: number
          previsao_chegada?: string | null
          prioridade_compra?: string | null
          project_id?: string
          qtd?: number
          reanalise_escopo?: string | null
          reanalise_mo?: string | null
          status_global?: string | null
          unidade?: string
          updated_at?: string
          vlr_total_estimado?: number
          vlr_total_venda?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived: boolean
          archived_at: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      role_column_permissions: {
        Row: {
          column_key: string
          created_at: string | null
          id: string
          permission_level: Database["public"]["Enums"]["permission_level"]
          project_id: string | null
          role_name: string
          updated_at: string | null
        }
        Insert: {
          column_key: string
          created_at?: string | null
          id?: string
          permission_level?: Database["public"]["Enums"]["permission_level"]
          project_id?: string | null
          role_name: string
          updated_at?: string | null
        }
        Update: {
          column_key?: string
          created_at?: string | null
          id?: string
          permission_level?: Database["public"]["Enums"]["permission_level"]
          project_id?: string | null
          role_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_column_permissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_project_roles: {
        Row: {
          assigned_by: string
          created_at: string | null
          id: string
          project_id: string | null
          role_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string | null
          id?: string
          project_id?: string | null
          role_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string | null
          id?: string
          project_id?: string | null
          role_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_project_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_emails: {
        Row: {
          email: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          email?: string | null
          full_name?: never
          id?: string | null
        }
        Update: {
          email?: string | null
          full_name?: never
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_by_email: {
        Args: { user_email: string }
        Returns: {
          user_id: string
          email: string
          full_name: string
        }[]
      }
      is_valid_role: {
        Args: { role_name: string }
        Returns: boolean
      }
    }
    Enums: {
      permission_level: "none" | "view" | "edit"
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
      permission_level: ["none", "view", "edit"],
    },
  },
} as const
