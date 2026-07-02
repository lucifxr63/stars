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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      ai_interactions: {
        Row: {
          created_at: string | null
          id: string
          input_data: Json
          model: string | null
          output_data: Json
          prompt_type: string
          step: number
          tokens_used: number | null
          user_id: string | null
          validation_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          input_data: Json
          model?: string | null
          output_data: Json
          prompt_type: string
          step: number
          tokens_used?: number | null
          user_id?: string | null
          validation_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          input_data?: Json
          model?: string | null
          output_data?: Json
          prompt_type?: string
          step?: number
          tokens_used?: number | null
          user_id?: string | null
          validation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_interactions_validation_id_fkey"
            columns: ["validation_id"]
            isOneToOne: false
            referencedRelation: "validations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          profile_id: string
          revoked_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          profile_id: string
          revoked_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          profile_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_logs: {
        Row: {
          api_key_id: string
          created_at: string | null
          endpoint: string
          id: string
          ip_address: string | null
          requests_count: number | null
          tokens_used: number | null
        }
        Insert: {
          api_key_id: string
          created_at?: string | null
          endpoint: string
          id?: string
          ip_address?: string | null
          requests_count?: number | null
          tokens_used?: number | null
        }
        Update: {
          api_key_id?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: string | null
          requests_count?: number | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      cached_analyses: {
        Row: {
          analysis_data: Json | null
          created_at: string | null
          expires_at: string | null
          geography: string | null
          id: string
          idea_embedding: string | null
          industry: string | null
          prompt_type: string | null
          usage_count: number | null
        }
        Insert: {
          analysis_data?: Json | null
          created_at?: string | null
          expires_at?: string | null
          geography?: string | null
          id?: string
          idea_embedding?: string | null
          industry?: string | null
          prompt_type?: string | null
          usage_count?: number | null
        }
        Update: {
          analysis_data?: Json | null
          created_at?: string | null
          expires_at?: string | null
          geography?: string | null
          id?: string
          idea_embedding?: string | null
          industry?: string | null
          prompt_type?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      competitors: {
        Row: {
          created_at: string | null
          description: string | null
          embedding: string | null
          geography: string[] | null
          id: string
          industries: string[] | null
          market: string | null
          name: string
          pricing: string | null
          strengths: string[] | null
          updated_at: string | null
          url: string | null
          weaknesses: string[] | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          geography?: string[] | null
          id?: string
          industries?: string[] | null
          market?: string | null
          name: string
          pricing?: string | null
          strengths?: string[] | null
          updated_at?: string | null
          url?: string | null
          weaknesses?: string[] | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          geography?: string[] | null
          id?: string
          industries?: string[] | null
          market?: string | null
          name?: string
          pricing?: string | null
          strengths?: string[] | null
          updated_at?: string | null
          url?: string | null
          weaknesses?: string[] | null
        }
        Relationships: []
      }
      consent_logs: {
        Row: {
          consent_type: string
          consented_at: string
          flagged: boolean
          id: string
          ip_address: string | null
          rut_hash: string | null
          user_id: string
        }
        Insert: {
          consent_type?: string
          consented_at?: string
          flagged?: boolean
          id?: string
          ip_address?: string | null
          rut_hash?: string | null
          user_id: string
        }
        Update: {
          consent_type?: string
          consented_at?: string
          flagged?: boolean
          id?: string
          ip_address?: string | null
          rut_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_campaigns: {
        Row: {
          created_at: string | null
          id: string
          platform: string
          slides: Json
          theme: string
          title: string | null
          updated_at: string | null
          user_id: string
          validation_id: string
          version: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          platform: string
          slides?: Json
          theme?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
          validation_id: string
          version?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          platform?: string
          slides?: Json
          theme?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
          validation_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_campaigns_validation_id_fkey"
            columns: ["validation_id"]
            isOneToOne: false
            referencedRelation: "validations"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_knowledge: {
        Row: {
          context_text: string | null
          data_json: Json
          id: string
          indicator: string
          provider: string
          updated_at: string
        }
        Insert: {
          context_text?: string | null
          data_json: Json
          id?: string
          indicator: string
          provider: string
          updated_at?: string
        }
        Update: {
          context_text?: string | null
          data_json?: Json
          id?: string
          indicator?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_leads: {
        Row: {
          created_at: string | null
          email: string
          id: string
          plan: string | null
          source: string | null
          validation_id: string | null
          validation_score: number | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          plan?: string | null
          source?: string | null
          validation_id?: string | null
          validation_score?: number | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          plan?: string | null
          source?: string | null
          validation_id?: string | null
          validation_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_leads_validation_id_fkey"
            columns: ["validation_id"]
            isOneToOne: false
            referencedRelation: "validations"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_jobs: {
        Row: {
          attempts: number
          context: Json
          created_at: string
          id: string
          is_premium: boolean
          last_error: string | null
          mode: string
          status: string
          tasks: Json
          tier: string
          updated_at: string
          user_id: string
          validation_id: string
        }
        Insert: {
          attempts?: number
          context?: Json
          created_at?: string
          id?: string
          is_premium?: boolean
          last_error?: string | null
          mode?: string
          status?: string
          tasks?: Json
          tier?: string
          updated_at?: string
          user_id: string
          validation_id: string
        }
        Update: {
          attempts?: number
          context?: Json
          created_at?: string
          id?: string
          is_premium?: boolean
          last_error?: string | null
          mode?: string
          status?: string
          tasks?: Json
          tier?: string
          updated_at?: string
          user_id?: string
          validation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_validation_id_fkey"
            columns: ["validation_id"]
            isOneToOne: false
            referencedRelation: "validations"
            referencedColumns: ["id"]
          },
        ]
      }
      figma_connections: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string | null
          figma_handle: string | null
          figma_user_id: string | null
          id: string
          refresh_token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at?: string | null
          figma_handle?: string | null
          figma_user_id?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string | null
          figma_handle?: string | null
          figma_user_id?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      figma_navigation_maps: {
        Row: {
          ai_insights: Json | null
          created_at: string | null
          edges: Json
          file_key: string
          file_name: string | null
          id: string
          nodes: Json
          page_id: string | null
          page_name: string | null
          updated_at: string | null
          user_id: string
          validation_id: string
          version_id: string | null
        }
        Insert: {
          ai_insights?: Json | null
          created_at?: string | null
          edges?: Json
          file_key: string
          file_name?: string | null
          id?: string
          nodes?: Json
          page_id?: string | null
          page_name?: string | null
          updated_at?: string | null
          user_id: string
          validation_id: string
          version_id?: string | null
        }
        Update: {
          ai_insights?: Json | null
          created_at?: string | null
          edges?: Json
          file_key?: string
          file_name?: string | null
          id?: string
          nodes?: Json
          page_id?: string | null
          page_name?: string | null
          updated_at?: string | null
          user_id?: string
          validation_id?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "figma_navigation_maps_validation_id_fkey"
            columns: ["validation_id"]
            isOneToOne: false
            referencedRelation: "validations"
            referencedColumns: ["id"]
          },
        ]
      }
      figma_sync_logs: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          edges_count: number | null
          error_message: string | null
          id: string
          map_id: string | null
          nodes_count: number | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          edges_count?: number | null
          error_message?: string | null
          id?: string
          map_id?: string | null
          nodes_count?: number | null
          status: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          edges_count?: number | null
          error_message?: string | null
          id?: string
          map_id?: string | null
          nodes_count?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "figma_sync_logs_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "figma_navigation_maps"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_profiles: {
        Row: {
          ai_inference_metadata: Json | null
          competency_scores: Json | null
          education: Json
          extraction_status: string
          full_name: string | null
          headline: string | null
          id: string
          industry_expertise_years: number
          linkedin_member_id: string | null
          linkedin_url: string | null
          photo_url: string | null
          raw_scraped_data: Json | null
          skills: Json
          summary_bio: string | null
          updated_at: string
          work_experience: Json
        }
        Insert: {
          ai_inference_metadata?: Json | null
          competency_scores?: Json | null
          education?: Json
          extraction_status?: string
          full_name?: string | null
          headline?: string | null
          id: string
          industry_expertise_years?: number
          linkedin_member_id?: string | null
          linkedin_url?: string | null
          photo_url?: string | null
          raw_scraped_data?: Json | null
          skills?: Json
          summary_bio?: string | null
          updated_at?: string
          work_experience?: Json
        }
        Update: {
          ai_inference_metadata?: Json | null
          competency_scores?: Json | null
          education?: Json
          extraction_status?: string
          full_name?: string | null
          headline?: string | null
          id?: string
          industry_expertise_years?: number
          linkedin_member_id?: string | null
          linkedin_url?: string | null
          photo_url?: string | null
          raw_scraped_data?: Json | null
          skills?: Json
          summary_bio?: string | null
          updated_at?: string
          work_experience?: Json
        }
        Relationships: [
          {
            foreignKeyName: "founder_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string
          embedding: string | null
          id: string
          source: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          source: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          source?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_edges: {
        Row: {
          created_at: string | null
          id: string
          relation_type: string
          source_title: string
          target_title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          relation_type?: string
          source_title: string
          target_title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          relation_type?: string
          source_title?: string
          target_title?: string
        }
        Relationships: []
      }
      knowledge_nodes: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          document_title: string
          embedding: string | null
          header_path: string
          id: string
          metadata: Json
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          document_title: string
          embedding?: string | null
          header_path?: string
          id?: string
          metadata?: Json
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          document_title?: string
          embedding?: string | null
          header_path?: string
          id?: string
          metadata?: Json
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      market_ai_insights: {
        Row: {
          caenes_code: string | null
          generated_at: string | null
          id: string
          insights_json: Json | null
          raw_series: Json | null
          validation_id: string | null
          zone: string | null
        }
        Insert: {
          caenes_code?: string | null
          generated_at?: string | null
          id?: string
          insights_json?: Json | null
          raw_series?: Json | null
          validation_id?: string | null
          zone?: string | null
        }
        Update: {
          caenes_code?: string | null
          generated_at?: string | null
          id?: string
          insights_json?: Json | null
          raw_series?: Json | null
          validation_id?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_ai_insights_validation_id_fkey"
            columns: ["validation_id"]
            isOneToOne: true
            referencedRelation: "validations"
            referencedColumns: ["id"]
          },
        ]
      }
      market_bde_data: {
        Row: {
          fetched_at: string | null
          id: string
          obs_date: string
          series_desc: string | null
          series_id: string
          value: number | null
        }
        Insert: {
          fetched_at?: string | null
          id?: string
          obs_date: string
          series_desc?: string | null
          series_id: string
          value?: number | null
        }
        Update: {
          fetched_at?: string | null
          id?: string
          obs_date?: string
          series_desc?: string | null
          series_id?: string
          value?: number | null
        }
        Relationships: []
      }
      market_ine_classifications: {
        Row: {
          caenes_code: string
          caenes_prob: number | null
          ciuo_code: string | null
          ciuo_prob: number | null
          classified_at: string | null
          id: string
          input_text: string
        }
        Insert: {
          caenes_code: string
          caenes_prob?: number | null
          ciuo_code?: string | null
          ciuo_prob?: number | null
          classified_at?: string | null
          id?: string
          input_text: string
        }
        Update: {
          caenes_code?: string
          caenes_prob?: number | null
          ciuo_code?: string | null
          ciuo_prob?: number | null
          classified_at?: string | null
          id?: string
          input_text?: string
        }
        Relationships: []
      }
      mentors: {
        Row: {
          availability: string
          bio: string
          calendly_url: string | null
          created_at: string | null
          embedding: string | null
          expertise: string[]
          id: string
          languages: string[] | null
          linkedin_url: string | null
          name: string
          photo_url: string | null
          session_price_clp: number | null
        }
        Insert: {
          availability: string
          bio: string
          calendly_url?: string | null
          created_at?: string | null
          embedding?: string | null
          expertise: string[]
          id?: string
          languages?: string[] | null
          linkedin_url?: string | null
          name: string
          photo_url?: string | null
          session_price_clp?: number | null
        }
        Update: {
          availability?: string
          bio?: string
          calendly_url?: string | null
          created_at?: string | null
          embedding?: string | null
          expertise?: string[]
          id?: string
          languages?: string[] | null
          linkedin_url?: string | null
          name?: string
          photo_url?: string | null
          session_price_clp?: number | null
        }
        Relationships: []
      }
      moe_routing_log: {
        Row: {
          created_at: string
          experts_activated: string[]
          graph_hits: number
          id: number
          query_preview: string
          routing_method: string
          routing_reason: string
          total_hits: number
          vector_hits: number
        }
        Insert: {
          created_at?: string
          experts_activated?: string[]
          graph_hits?: number
          id?: number
          query_preview: string
          routing_method: string
          routing_reason: string
          total_hits?: number
          vector_hits?: number
        }
        Update: {
          created_at?: string
          experts_activated?: string[]
          graph_hits?: number
          id?: number
          query_preview?: string
          routing_method?: string
          routing_reason?: string
          total_hits?: number
          vector_hits?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          founder_pitch: string | null
          full_name: string | null
          id: string
          kyc_status: string | null
          onboarding_completed: boolean
          role: string | null
          rut_hash: string | null
          startup_name: string | null
          startup_sector: string | null
          tier: string | null
          tier_expires_at: string | null
          training_consent: boolean | null
          training_consent_at: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          founder_pitch?: string | null
          full_name?: string | null
          id: string
          kyc_status?: string | null
          onboarding_completed?: boolean
          role?: string | null
          rut_hash?: string | null
          startup_name?: string | null
          startup_sector?: string | null
          tier?: string | null
          tier_expires_at?: string | null
          training_consent?: boolean | null
          training_consent_at?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          founder_pitch?: string | null
          full_name?: string | null
          id?: string
          kyc_status?: string | null
          onboarding_completed?: boolean
          role?: string | null
          rut_hash?: string | null
          startup_name?: string | null
          startup_sector?: string | null
          tier?: string | null
          tier_expires_at?: string | null
          training_consent?: boolean | null
          training_consent_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pyme_financials: {
        Row: {
          avg_ticket_clp: number | null
          cogs_clp: number | null
          company_rut: string
          created_at: string
          days_credit_granted: number | null
          id: string
          inventory_variation_pct: number | null
          monthly_volume_clp: number | null
          net_cash_flow_clp: number | null
          period: string
          source: string
          updated_at: string
        }
        Insert: {
          avg_ticket_clp?: number | null
          cogs_clp?: number | null
          company_rut: string
          created_at?: string
          days_credit_granted?: number | null
          id?: string
          inventory_variation_pct?: number | null
          monthly_volume_clp?: number | null
          net_cash_flow_clp?: number | null
          period: string
          source?: string
          updated_at?: string
        }
        Update: {
          avg_ticket_clp?: number | null
          cogs_clp?: number | null
          company_rut?: string
          created_at?: string
          days_credit_granted?: number | null
          id?: string
          inventory_variation_pct?: number | null
          monthly_volume_clp?: number | null
          net_cash_flow_clp?: number | null
          period?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      radar_signals: {
        Row: {
          affected_industries: string[]
          analyst_notes: string | null
          analyst_rating: number | null
          classified_by: string
          created_at: string
          expires_at: string | null
          headline_preview: string
          id: string
          is_false_positive: boolean | null
          rated_at: string | null
          rated_by: string | null
          sector: string
          severity: number
          signal_type: string
          source: string
        }
        Insert: {
          affected_industries?: string[]
          analyst_notes?: string | null
          analyst_rating?: number | null
          classified_by?: string
          created_at?: string
          expires_at?: string | null
          headline_preview: string
          id?: string
          is_false_positive?: boolean | null
          rated_at?: string | null
          rated_by?: string | null
          sector: string
          severity: number
          signal_type: string
          source: string
        }
        Update: {
          affected_industries?: string[]
          analyst_notes?: string | null
          analyst_rating?: number | null
          classified_by?: string
          created_at?: string
          expires_at?: string | null
          headline_preview?: string
          id?: string
          is_false_positive?: boolean | null
          rated_at?: string | null
          rated_by?: string | null
          sector?: string
          severity?: number
          signal_type?: string
          source?: string
        }
        Relationships: []
      }
      rag_audit_logs: {
        Row: {
          answer: string | null
          category: string
          chunks_retrieved: number
          created_at: string
          error: string | null
          expected_keyword: string | null
          has_sources: boolean
          id: string
          keyword_found: boolean
          latency_ms: number
          model_used: string | null
          precision_score: number
          query: string
          run_id: string
          sources_count: number
        }
        Insert: {
          answer?: string | null
          category: string
          chunks_retrieved?: number
          created_at?: string
          error?: string | null
          expected_keyword?: string | null
          has_sources?: boolean
          id?: string
          keyword_found?: boolean
          latency_ms: number
          model_used?: string | null
          precision_score?: number
          query: string
          run_id: string
          sources_count?: number
        }
        Update: {
          answer?: string | null
          category?: string
          chunks_retrieved?: number
          created_at?: string
          error?: string | null
          expected_keyword?: string | null
          has_sources?: boolean
          id?: string
          keyword_found?: boolean
          latency_ms?: number
          model_used?: string | null
          precision_score?: number
          query?: string
          run_id?: string
          sources_count?: number
        }
        Relationships: []
      }
      rag_playbooks: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          source_file: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          source_file: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          source_file?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      pilots: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          id: string
          objective: string | null
          plan_interes: string | null
          segment: string
          source: string
          stage: string | null
          status: string
          updated_at: string
          user_id: string
          validation_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          id?: string
          objective?: string | null
          plan_interes?: string | null
          segment: string
          source?: string
          stage?: string | null
          status?: string
          updated_at?: string
          user_id: string
          validation_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          id?: string
          objective?: string | null
          plan_interes?: string | null
          segment?: string
          source?: string
          stage?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          validation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pilots_validation_id_fkey"
            columns: ["validation_id"]
            isOneToOne: false
            referencedRelation: "validations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_feedback: {
        Row: {
          created_at: string
          dimensions_wrong: Json
          free_text: string | null
          id: string
          rating: number | null
          section: string
          user_id: string
          validation_id: string
        }
        Insert: {
          created_at?: string
          dimensions_wrong?: Json
          free_text?: string | null
          id?: string
          rating?: number | null
          section?: string
          user_id: string
          validation_id: string
        }
        Update: {
          created_at?: string
          dimensions_wrong?: Json
          free_text?: string | null
          id?: string
          rating?: number | null
          section?: string
          user_id?: string
          validation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_feedback_validation_id_fkey"
            columns: ["validation_id"]
            isOneToOne: false
            referencedRelation: "validations"
            referencedColumns: ["id"]
          },
        ]
      }
      sii_empresa_cache: {
        Row: {
          cached_at: string
          data: Json
          rut: string
        }
        Insert: {
          cached_at?: string
          data: Json
          rut: string
        }
        Update: {
          cached_at?: string
          data?: Json
          rut?: string
        }
        Relationships: []
      }
      survey_anonymized_data: {
        Row: {
          anonymized_at: string
          central_problem: string
          current_solutions: Json
          form_id: string
          friction_bucket: string
          generalized_industry: string | null
          generalized_role: string | null
          generalized_tech_family: string | null
          id: string
          k_class_size: number
          key_quotes: Json
          l_diversity_score: number
          mom_test_signals: Json
          severity: string
          week_bucket: string
          willingness_to_pay: boolean
        }
        Insert: {
          anonymized_at?: string
          central_problem: string
          current_solutions?: Json
          form_id: string
          friction_bucket: string
          generalized_industry?: string | null
          generalized_role?: string | null
          generalized_tech_family?: string | null
          id?: string
          k_class_size: number
          key_quotes?: Json
          l_diversity_score: number
          mom_test_signals?: Json
          severity: string
          week_bucket: string
          willingness_to_pay: boolean
        }
        Update: {
          anonymized_at?: string
          central_problem?: string
          current_solutions?: Json
          form_id?: string
          friction_bucket?: string
          generalized_industry?: string | null
          generalized_role?: string | null
          generalized_tech_family?: string | null
          id?: string
          k_class_size?: number
          key_quotes?: Json
          l_diversity_score?: number
          mom_test_signals?: Json
          severity?: string
          week_bucket?: string
          willingness_to_pay?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "survey_anonymized_data_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "survey_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_forms: {
        Row: {
          client_id: string
          consent_text: string
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          schema_json: Json
          title: string
          ui_schema: Json
          unique_slug: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          consent_text?: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          schema_json?: Json
          title: string
          ui_schema?: Json
          unique_slug?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          consent_text?: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          schema_json?: Json
          title?: string
          ui_schema?: Json
          unique_slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      survey_submissions: {
        Row: {
          analysis_result: Json | null
          anonymization_status: string
          consent_given: boolean
          consent_timestamp: string | null
          created_at: string
          form_id: string
          id: string
          metadata: Json
          response_data: Json
        }
        Insert: {
          analysis_result?: Json | null
          anonymization_status?: string
          consent_given?: boolean
          consent_timestamp?: string | null
          created_at?: string
          form_id: string
          id?: string
          metadata?: Json
          response_data?: Json
        }
        Update: {
          analysis_result?: Json | null
          anonymization_status?: string
          consent_given?: boolean
          consent_timestamp?: string | null
          created_at?: string
          form_id?: string
          id?: string
          metadata?: Json
          response_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "survey_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "survey_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_vectors: {
        Row: {
          api_key_id: string
          content: string
          created_at: string | null
          embedding: string
          embedding_version: string
          id: string
          metadata: Json | null
          profile_id: string
        }
        Insert: {
          api_key_id: string
          content: string
          created_at?: string | null
          embedding: string
          embedding_version?: string
          id?: string
          metadata?: Json | null
          profile_id: string
        }
        Update: {
          api_key_id?: string
          content?: string
          created_at?: string | null
          embedding?: string
          embedding_version?: string
          id?: string
          metadata?: Json | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_vectors_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_vectors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      traction_events: {
        Row: {
          created_at: string
          event_date: string
          event_type: string
          id: string
          notes: string | null
          title: string
          user_id: string
          validation_id: string
          value: number | null
          value_unit: string | null
        }
        Insert: {
          created_at?: string
          event_date?: string
          event_type: string
          id?: string
          notes?: string | null
          title: string
          user_id: string
          validation_id: string
          value?: number | null
          value_unit?: string | null
        }
        Update: {
          created_at?: string
          event_date?: string
          event_type?: string
          id?: string
          notes?: string | null
          title?: string
          user_id?: string
          validation_id?: string
          value?: number | null
          value_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traction_events_validation_id_fkey"
            columns: ["validation_id"]
            isOneToOne: false
            referencedRelation: "validations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_data: {
        Row: {
          created_at: string | null
          geography: string | null
          id: string
          idea_summary: string | null
          industry: string | null
          outcome: string | null
          scores: Json | null
        }
        Insert: {
          created_at?: string | null
          geography?: string | null
          id?: string
          idea_summary?: string | null
          industry?: string | null
          outcome?: string | null
          scores?: Json | null
        }
        Update: {
          created_at?: string | null
          geography?: string | null
          id?: string
          idea_summary?: string | null
          industry?: string | null
          outcome?: string | null
          scores?: Json | null
        }
        Relationships: []
      }
      training_data_audit: {
        Row: {
          contributed_at: string
          id: string
          training_data_id: string
          user_id: string
        }
        Insert: {
          contributed_at?: string
          id?: string
          training_data_id: string
          user_id: string
        }
        Update: {
          contributed_at?: string
          id?: string
          training_data_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_data_audit_training_data_id_fkey"
            columns: ["training_data_id"]
            isOneToOne: false
            referencedRelation: "training_data"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          expensive: number
          period: string
          total: number
          user_id: string
        }
        Insert: {
          expensive?: number
          period: string
          total?: number
          user_id: string
        }
        Update: {
          expensive?: number
          period?: string
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      validation_agents_log: {
        Row: {
          agents_completed_at: string | null
          created_at: string
          error_details: Json | null
          executive_summary: string | null
          id: string
          reddit_data: Json | null
          reddit_status: string
          synthesis_completed_at: string | null
          trends_data: Json | null
          trends_status: string
          updated_at: string
          user_id: string
          validation_id: string
        }
        Insert: {
          agents_completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          executive_summary?: string | null
          id?: string
          reddit_data?: Json | null
          reddit_status?: string
          synthesis_completed_at?: string | null
          trends_data?: Json | null
          trends_status?: string
          updated_at?: string
          user_id: string
          validation_id: string
        }
        Update: {
          agents_completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          executive_summary?: string | null
          id?: string
          reddit_data?: Json | null
          reddit_status?: string
          synthesis_completed_at?: string | null
          trends_data?: Json | null
          trends_status?: string
          updated_at?: string
          user_id?: string
          validation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_agents_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_agents_log_validation_id_fkey"
            columns: ["validation_id"]
            isOneToOne: false
            referencedRelation: "validations"
            referencedColumns: ["id"]
          },
        ]
      }
      validations: {
        Row: {
          acquisition_channel: string | null
          ai_feedback: string | null
          business_model: string | null
          business_stage: string | null
          competitive_analysis: Json | null
          completed_at: string | null
          compliance_roadmap: Json | null
          created_at: string | null
          current_solution: string | null
          current_step: number | null
          customer_context: string | null
          customer_pain_points: string[] | null
          customer_segment: string | null
          differentiator: string | null
          due_diligence_score: Json | null
          financial_projection: Json | null
          founder_context: Json | null
          founder_fit: Json | null
          fundraising_roadmap: Json | null
          generation_progress: Json | null
          governance_assessment: Json | null
          id: string
          idea_description: string | null
          idea_industry: string | null
          idea_name: string | null
          idea_problem: string | null
          known_competitors: string[] | null
          lean_roadmap: Json | null
          market_signals: Json | null
          market_sizing: Json | null
          mvp_features: Json | null
          mvp_type: string | null
          mvp_user_flow: string | null
          parent_id: string | null
          pitch_deck_content: Json | null
          pivot_reason: string | null
          playbook_analysis: Json | null
          pricing_range: string | null
          questions_answers: Json | null
          quick_icp: string | null
          risk_analysis: Json | null
          score_breakdown: Json | null
          share_token: string | null
          share_visibility: Json | null
          status: string | null
          summary_json: Json | null
          target_country: string | null
          target_region: string | null
          team_composition: string | null
          tech_level: string | null
          traction_status: string | null
          unit_economics: Json | null
          updated_at: string | null
          user_id: string | null
          validation_mode: string | null
          validation_score: number | null
          value_proposition: string | null
          version: number | null
        }
        Insert: {
          acquisition_channel?: string | null
          ai_feedback?: string | null
          business_model?: string | null
          business_stage?: string | null
          competitive_analysis?: Json | null
          completed_at?: string | null
          compliance_roadmap?: Json | null
          created_at?: string | null
          current_solution?: string | null
          current_step?: number | null
          customer_context?: string | null
          customer_pain_points?: string[] | null
          customer_segment?: string | null
          differentiator?: string | null
          due_diligence_score?: Json | null
          financial_projection?: Json | null
          founder_context?: Json | null
          founder_fit?: Json | null
          fundraising_roadmap?: Json | null
          generation_progress?: Json | null
          governance_assessment?: Json | null
          id?: string
          idea_description?: string | null
          idea_industry?: string | null
          idea_name?: string | null
          idea_problem?: string | null
          known_competitors?: string[] | null
          lean_roadmap?: Json | null
          market_signals?: Json | null
          market_sizing?: Json | null
          mvp_features?: Json | null
          mvp_type?: string | null
          mvp_user_flow?: string | null
          parent_id?: string | null
          pitch_deck_content?: Json | null
          pivot_reason?: string | null
          playbook_analysis?: Json | null
          pricing_range?: string | null
          questions_answers?: Json | null
          quick_icp?: string | null
          risk_analysis?: Json | null
          score_breakdown?: Json | null
          share_token?: string | null
          share_visibility?: Json | null
          status?: string | null
          summary_json?: Json | null
          target_country?: string | null
          target_region?: string | null
          team_composition?: string | null
          tech_level?: string | null
          traction_status?: string | null
          unit_economics?: Json | null
          updated_at?: string | null
          user_id?: string | null
          validation_mode?: string | null
          validation_score?: number | null
          value_proposition?: string | null
          version?: number | null
        }
        Update: {
          acquisition_channel?: string | null
          ai_feedback?: string | null
          business_model?: string | null
          business_stage?: string | null
          competitive_analysis?: Json | null
          completed_at?: string | null
          compliance_roadmap?: Json | null
          created_at?: string | null
          current_solution?: string | null
          current_step?: number | null
          customer_context?: string | null
          customer_pain_points?: string[] | null
          customer_segment?: string | null
          differentiator?: string | null
          due_diligence_score?: Json | null
          financial_projection?: Json | null
          founder_context?: Json | null
          founder_fit?: Json | null
          fundraising_roadmap?: Json | null
          generation_progress?: Json | null
          governance_assessment?: Json | null
          id?: string
          idea_description?: string | null
          idea_industry?: string | null
          idea_name?: string | null
          idea_problem?: string | null
          known_competitors?: string[] | null
          lean_roadmap?: Json | null
          market_signals?: Json | null
          market_sizing?: Json | null
          mvp_features?: Json | null
          mvp_type?: string | null
          mvp_user_flow?: string | null
          parent_id?: string | null
          pitch_deck_content?: Json | null
          pivot_reason?: string | null
          playbook_analysis?: Json | null
          pricing_range?: string | null
          questions_answers?: Json | null
          quick_icp?: string | null
          risk_analysis?: Json | null
          score_breakdown?: Json | null
          share_token?: string | null
          share_visibility?: Json | null
          status?: string | null
          summary_json?: Json | null
          target_country?: string | null
          target_region?: string | null
          team_composition?: string | null
          tech_level?: string | null
          traction_status?: string | null
          unit_economics?: Json | null
          updated_at?: string | null
          user_id?: string | null
          validation_mode?: string | null
          validation_score?: number | null
          value_proposition?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "validations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "validations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      moe_routing_summary: {
        Row: {
          avg_graph_hits: number | null
          avg_total_hits: number | null
          avg_vector_hits: number | null
          calls: number | null
          expert_id: string | null
          first_call: string | null
          last_call: string | null
          routing_method: string | null
        }
        Relationships: []
      }
      radar_dashboard: {
        Row: {
          active_now: number | null
          avg_severity: number | null
          first_detected: string | null
          last_detected: string | null
          sector: string | null
          signal_type: string | null
          total_signals: number | null
        }
        Relationships: []
      }
      rag_audit_summary: {
        Row: {
          avg_latency_ms: number | null
          avg_precision: number | null
          errors: number | null
          hit_rate_pct: number | null
          keyword_hits: number | null
          queries_with_sources: number | null
          run_id: string | null
          started_at: string | null
          total_queries: number | null
        }
        Relationships: []
      }
      validation_tree: {
        Row: {
          completed_at: string | null
          created_at: string | null
          depth: number | null
          id: string | null
          idea_name: string | null
          parent_id: string | null
          pivot_reason: string | null
          root_id: string | null
          status: string | null
          user_id: string | null
          validation_score: number | null
          version: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      anonymize_ip: { Args: { ip: string }; Returns: string }
      check_and_increment_usage: {
        Args: {
          p_is_expensive: boolean
          p_prompt_type: string
          p_tier: string
          p_user_id: string
        }
        Returns: Json
      }
      fn_hash_rut_value: { Args: { plain_rut: string }; Returns: string }
      get_feedback_digest: { Args: never; Returns: Json }
      get_industry_stats: {
        Args: never
        Returns: {
          avg_score: number
          industry: string
          launched_pct: number
          total_ideas: number
        }[]
      }
      get_my_pilot_status: { Args: never; Returns: Json }
      get_usage_summary: { Args: { p_user_id: string }; Returns: Json }
      increment_cache_usage: { Args: { cache_id: string }; Returns: undefined }
      insert_radar_signal: {
        Args: {
          p_headline: string
          p_industries: string[]
          p_sector: string
          p_severity: number
          p_signal_type: string
          p_source?: string
          p_ttl_hours?: number
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      match_mentors: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          availability: string
          bio: string
          calendly_url: string
          expertise: string[]
          id: string
          languages: string[]
          linkedin_url: string
          name: string
          photo_url: string
          session_price_clp: number
          similarity: number
        }[]
      }
      merge_generation_progress: {
        Args: { p_id: string; p_key: string; p_status: string }
        Returns: undefined
      }
      search_cached_analyses: {
        Args: {
          filter_type?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          analysis_data: Json
          id: string
          similarity: number
        }[]
      }
      search_competitors: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          description: string
          id: string
          market: string
          name: string
          pricing: string
          similarity: number
          strengths: string[]
          url: string
          weaknesses: string[]
        }[]
      }
      search_hybrid_graphrag: {
        Args: {
          extracted_entities: string[]
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          document_title: string
          relevance: number
          source_type: string
        }[]
      }
      search_inapi_brands: {
        Args: { p_brand_name: string; p_limit?: number }
        Returns: {
          applicants: string
          application_number: string
          brand_name: string
          niza_classes: string[]
          similarity_score: number
          status: string
        }[]
      }
      search_knowledge_base: {
        Args: {
          filter_category?: string
          filter_tags?: string[]
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          id: string
          similarity: number
          source: string
          tags: string[]
          title: string
        }[]
      }
      search_rag_playbooks: {
        Args: {
          filter_tags?: string[]
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          tags: string[]
          title: string
        }[]
      }
      search_tenant_vectors: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
          target_profile_id: string
          target_version?: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      tier_limit: { Args: { p_kind: string; p_tier: string }; Returns: number }
      update_my_rut_hash: { Args: { plain_rut: string }; Returns: undefined }
      vector_search_direct: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          document_title: string
          metadata: Json
          relevance: number
        }[]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
