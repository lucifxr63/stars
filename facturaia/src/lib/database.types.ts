export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          user_id: string
          rut: string
          razon_social: string
          giro: string | null
          direccion: string | null
          email_contacto: string | null
          telefono: string | null
          es_gran_empresa: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          rut: string
          razon_social: string
          giro?: string | null
          direccion?: string | null
          email_contacto?: string | null
          telefono?: string | null
          es_gran_empresa?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['companies']['Insert']>
      }
      invoices: {
        Row: {
          id: string
          company_id: string
          folio: string
          rut_emisor: string
          rut_receptor: string
          razon_social_receptor: string
          monto_neto: number
          monto_iva: number
          monto_total: number
          fecha_emision: string
          fecha_vencimiento: string
          estado: 'pendiente' | 'en_evaluacion' | 'aprobada' | 'rechazada' | 'liquidada'
          archivo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          folio: string
          rut_emisor: string
          rut_receptor: string
          razon_social_receptor: string
          monto_neto: number
          monto_iva: number
          monto_total: number
          fecha_emision: string
          fecha_vencimiento: string
          estado?: 'pendiente' | 'en_evaluacion' | 'aprobada' | 'rechazada' | 'liquidada'
          archivo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>
      }
      risk_assessments: {
        Row: {
          id: string
          invoice_id: string
          tax_risk_score: number
          score_breakdown: Json
          pagador_es_gran_empresa: boolean
          aprobacion_automatica: boolean
          recomendacion: 'aprobar' | 'revisar' | 'rechazar'
          razon: string
          monto_a_transferir: number
          comision_flat: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          tax_risk_score: number
          score_breakdown?: Json
          pagador_es_gran_empresa?: boolean
          aprobacion_automatica?: boolean
          recomendacion: 'aprobar' | 'revisar' | 'rechazar'
          razon: string
          monto_a_transferir: number
          comision_flat?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['risk_assessments']['Insert']>
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          table_name: string
          record_id: string | null
          old_values: Json | null
          new_values: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          table_name: string
          record_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: never
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
