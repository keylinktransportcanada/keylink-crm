// Hand-rolled to match the Phase 1 schema. Replace with `npm run gen-types`
// once a Supabase project is connected — the structure mirrors the output of
// `supabase gen types typescript`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          full_name: string
          phone: string | null
          employee_id: string | null
          hire_date: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          full_name?: string
          phone?: string | null
          employee_id?: string | null
          hire_date?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          full_name?: string
          phone?: string | null
          employee_id?: string | null
          hire_date?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          id: number
          actor_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          before_json: Json | null
          after_json: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          actor_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          before_json?: Json | null
          after_json?: Json | null
          created_at?: string
        }
        Update: {
          id?: number
          actor_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          before_json?: Json | null
          after_json?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_id_counter: {
        Row: { id: number; next_value: number }
        Insert: { id?: number; next_value?: number }
        Update: { id?: number; next_value?: number }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      next_employee_id: {
        Args: Record<string, never>
        Returns: string
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "dispatcher" | "driver" | "accounting"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T]

export type AppRole = Enums<"app_role">
