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
    PostgrestVersion: "14.5"
  }
  cashflow: {
    Tables: {
      bank_account: {
        Row: {
          created_at: string
          currency: string
          current_balance: number
          id: string
          name: string
          owner_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          current_balance?: number
          id?: string
          name: string
          owner_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          current_balance?: number
          id?: string
          name?: string
          owner_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_account_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      expense: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          funded_by: string
          id: string
          net_amount: number
          owner_id: string
          provider: string | null
          record_date: string
          tenant_id: string
          total_amount: number
          updated_at: string
          vat_amount: number
          vat_status: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          funded_by?: string
          id?: string
          net_amount: number
          owner_id: string
          provider?: string | null
          record_date?: string
          tenant_id: string
          total_amount: number
          updated_at?: string
          vat_amount?: number
          vat_status?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          funded_by?: string
          id?: string
          net_amount?: number
          owner_id?: string
          provider?: string | null
          record_date?: string
          tenant_id?: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice: {
        Row: {
          contact_name: string | null
          created_at: string
          currency: string
          due_date: string
          external_id: string | null
          id: string
          issue_date: string
          owner_id: string
          source_system: string
          status: string
          tenant_id: string
          total_amount: number
          type: string
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          currency?: string
          due_date: string
          external_id?: string | null
          id?: string
          issue_date?: string
          owner_id: string
          source_system?: string
          status?: string
          tenant_id: string
          total_amount: number
          type: string
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          currency?: string
          due_date?: string
          external_id?: string | null
          id?: string
          issue_date?: string
          owner_id?: string
          source_system?: string
          status?: string
          tenant_id?: string
          total_amount?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_contributions: {
        Row: {
          amount_clp: number
          created_at: string
          description: string | null
          financial_item: string | null
          id: string
          owner_id: string
          partner_name: string
          record_date: string
          tenant_id: string
          transaction_reference: string | null
          updated_at: string
        }
        Insert: {
          amount_clp: number
          created_at?: string
          description?: string | null
          financial_item?: string | null
          id?: string
          owner_id: string
          partner_name: string
          record_date?: string
          tenant_id: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Update: {
          amount_clp?: number
          created_at?: string
          description?: string | null
          financial_item?: string | null
          id?: string
          owner_id?: string
          partner_name?: string
          record_date?: string
          tenant_id?: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_contributions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_usage: {
        Row: {
          count: number
          owner_id: string
          period: string
          updated_at: string
        }
        Insert: {
          count?: number
          owner_id: string
          period: string
          updated_at?: string
        }
        Update: {
          count?: number
          owner_id?: string
          period?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_transaction: {
        Row: {
          amount: number
          created_at: string
          currency: string
          frequency: string
          id: string
          name: string
          next_date: string
          owner_id: string
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          frequency: string
          id?: string
          name: string
          next_date: string
          owner_id: string
          tenant_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          frequency?: string
          id?: string
          name?: string
          next_date?: string
          owner_id?: string
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expense_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue: {
        Row: {
          client_name: string | null
          created_at: string
          exchange_rate: number
          gateway_commission: number
          gross_amount_clp: number
          gross_amount_usd: number
          id: string
          net_income_clp: number
          owner_id: string
          plan_name: string | null
          record_date: string
          tenant_id: string
          updated_at: string
          vat_amount: number
          vat_status: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          exchange_rate?: number
          gateway_commission?: number
          gross_amount_clp?: number
          gross_amount_usd?: number
          id?: string
          net_income_clp?: number
          owner_id: string
          plan_name?: string | null
          record_date?: string
          tenant_id: string
          updated_at?: string
          vat_amount?: number
          vat_status?: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          exchange_rate?: number
          gateway_commission?: number
          gross_amount_clp?: number
          gross_amount_usd?: number
          id?: string
          net_income_clp?: number
          owner_id?: string
          plan_name?: string | null
          record_date?: string
          tenant_id?: string
          updated_at?: string
          vat_amount?: number
          vat_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant: {
        Row: {
          created_at: string
          default_tax_rate: number
          id: string
          name: string
          owner_id: string
          updated_at: string
          weekly_alerts_enabled: boolean
        }
        Insert: {
          created_at?: string
          default_tax_rate?: number
          id?: string
          name?: string
          owner_id: string
          updated_at?: string
          weekly_alerts_enabled?: boolean
        }
        Update: {
          created_at?: string
          default_tax_rate?: number
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
          weekly_alerts_enabled?: boolean
        }
        Relationships: []
      }
      transaction: {
        Row: {
          account_id: string
          amount: number
          category: string | null
          created_at: string
          id: string
          owner_id: string
          transaction_date: string
          type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          category?: string | null
          created_at?: string
          id?: string
          owner_id: string
          transaction_date?: string
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          transaction_date?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_account"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_increment_pdf_usage: {
        Args: { p_limit?: number }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  cashflow: {
    Enums: {},
  },
} as const
