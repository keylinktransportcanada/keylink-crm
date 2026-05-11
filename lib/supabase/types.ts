export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_json: Json | null
          before_json: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          active: boolean
          address: string | null
          billing_address: string | null
          contact_name: string | null
          created_at: string
          credit_limit_cad: number | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_terms_days: number
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          billing_address?: string | null
          contact_name?: string | null
          created_at?: string
          credit_limit_cad?: number | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms_days?: number
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          billing_address?: string | null
          contact_name?: string | null
          created_at?: string
          credit_limit_cad?: number | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms_days?: number
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inspections: {
        Row: {
          id: string
          truck_id: string
          trailer_id: string | null
          driver_id: string
          load_id: string | null
          inspection_type: Database["public"]["Enums"]["inspection_type"]
          inspection_date: string
          defects_found: boolean
          defects_description: string | null
          severity: Database["public"]["Enums"]["inspection_severity"]
          signed_by_driver: boolean
          corrected_at: string | null
          corrected_by: string | null
          corrected_notes: string | null
          admin_reply: string | null
          admin_reply_at: string | null
          admin_reply_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          truck_id: string
          trailer_id?: string | null
          driver_id: string
          load_id?: string | null
          inspection_type: Database["public"]["Enums"]["inspection_type"]
          inspection_date?: string
          defects_found?: boolean
          defects_description?: string | null
          severity?: Database["public"]["Enums"]["inspection_severity"]
          signed_by_driver?: boolean
          corrected_at?: string | null
          corrected_by?: string | null
          corrected_notes?: string | null
          admin_reply?: string | null
          admin_reply_at?: string | null
          admin_reply_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          truck_id?: string
          trailer_id?: string | null
          driver_id?: string
          load_id?: string | null
          inspection_type?: Database["public"]["Enums"]["inspection_type"]
          inspection_date?: string
          defects_found?: boolean
          defects_description?: string | null
          severity?: Database["public"]["Enums"]["inspection_severity"]
          signed_by_driver?: boolean
          corrected_at?: string | null
          corrected_by?: string | null
          corrected_notes?: string | null
          admin_reply?: string | null
          admin_reply_at?: string | null
          admin_reply_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "trailers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_messages: {
        Row: {
          id: string
          inspection_id: string
          author_id: string
          author_role: Database["public"]["Enums"]["app_role"]
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          inspection_id: string
          author_id: string
          author_role: Database["public"]["Enums"]["app_role"]
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          inspection_id?: string
          author_id?: string
          author_role?: Database["public"]["Enums"]["app_role"]
          message?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_messages_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_profiles: {
        Row: {
          profile_id: string
          licence_number: string | null
          licence_class: string | null
          licence_province: string | null
          licence_expiry: string | null
          medical_cert_expiry: string | null
          fast_card_number: string | null
          fast_card_expiry: string | null
          abstract_last_pulled: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          hire_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          profile_id: string
          licence_number?: string | null
          licence_class?: string | null
          licence_province?: string | null
          licence_expiry?: string | null
          medical_cert_expiry?: string | null
          fast_card_number?: string | null
          fast_card_expiry?: string | null
          abstract_last_pulled?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          hire_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          profile_id?: string
          licence_number?: string | null
          licence_class?: string | null
          licence_province?: string | null
          licence_expiry?: string | null
          medical_cert_expiry?: string | null
          fast_card_number?: string | null
          fast_card_expiry?: string | null
          abstract_last_pulled?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          hire_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          id: string
          load_id: string | null
          truck_id: string | null
          driver_id: string | null
          trailer_id: string | null
          inspection_id: string | null
          inspection_message_id: string | null
          chat_message_id: string | null
          type: Database["public"]["Enums"]["document_type"]
          file_path: string
          file_name: string
          mime_type: string
          size_bytes: number
          expiry_date: string | null
          uploaded_by: string | null
          uploaded_at: string
        }
        Insert: {
          id?: string
          load_id?: string | null
          truck_id?: string | null
          driver_id?: string | null
          trailer_id?: string | null
          inspection_id?: string | null
          inspection_message_id?: string | null
          chat_message_id?: string | null
          type: Database["public"]["Enums"]["document_type"]
          file_path: string
          file_name: string
          mime_type: string
          size_bytes: number
          expiry_date?: string | null
          uploaded_by?: string | null
          uploaded_at?: string
        }
        Update: {
          id?: string
          load_id?: string | null
          truck_id?: string | null
          driver_id?: string | null
          trailer_id?: string | null
          inspection_id?: string | null
          inspection_message_id?: string | null
          chat_message_id?: string | null
          type?: Database["public"]["Enums"]["document_type"]
          file_path?: string
          file_name?: string
          mime_type?: string
          size_bytes?: number
          expiry_date?: string | null
          uploaded_by?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "trailers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_id_counter: {
        Row: {
          id: number
          next_value: number
        }
        Insert: {
          id?: number
          next_value?: number
        }
        Update: {
          id?: number
          next_value?: number
        }
        Relationships: []
      }
      chat_threads: {
        Row: {
          id: string
          type: Database["public"]["Enums"]["chat_thread_type"]
          title: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type?: Database["public"]["Enums"]["chat_thread_type"]
          title?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: Database["public"]["Enums"]["chat_thread_type"]
          title?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_thread_members: {
        Row: {
          thread_id: string
          profile_id: string
          joined_at: string
          last_read_at: string
        }
        Insert: {
          thread_id: string
          profile_id: string
          joined_at?: string
          last_read_at?: string
        }
        Update: {
          thread_id?: string
          profile_id?: string
          joined_at?: string
          last_read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_thread_members_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_thread_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          id: string
          thread_id: string
          author_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          thread_id: string
          author_id: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          thread_id?: string
          author_id?: string
          body?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          id: string
          truck_id: string
          service_type: Database["public"]["Enums"]["maintenance_service_type"]
          service_date: string
          odometer_km: number | null
          cost_cad: number | string | null
          vendor: string | null
          description: string | null
          next_due_date: string | null
          next_due_odometer_km: number | null
          document_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          truck_id: string
          service_type: Database["public"]["Enums"]["maintenance_service_type"]
          service_date: string
          odometer_km?: number | null
          cost_cad?: number | string | null
          vendor?: string | null
          description?: string | null
          next_due_date?: string | null
          next_due_odometer_km?: number | null
          document_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          truck_id?: string
          service_type?: Database["public"]["Enums"]["maintenance_service_type"]
          service_date?: string
          odometer_km?: number | null
          cost_cad?: number | string | null
          vendor?: string | null
          description?: string | null
          next_due_date?: string | null
          next_due_odometer_km?: number | null
          document_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      load_number_counter: {
        Row: {
          next_value: number
          year: number
        }
        Insert: {
          next_value?: number
          year: number
        }
        Update: {
          next_value?: number
          year?: number
        }
        Relationships: []
      }
      load_status_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          latitude: number | null
          load_id: string
          location_note: string | null
          longitude: number | null
          status: Database["public"]["Enums"]["load_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: number
          latitude?: number | null
          load_id: string
          location_note?: string | null
          longitude?: number | null
          status: Database["public"]["Enums"]["load_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: number
          latitude?: number | null
          load_id?: string
          location_note?: string | null
          longitude?: number | null
          status?: Database["public"]["Enums"]["load_status"]
        }
        Relationships: [
          {
            foreignKeyName: "load_status_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_status_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
        ]
      }
      loads: {
        Row: {
          accessorial_charges_cad: number | null
          aci_aces_number: string | null
          commodity: string | null
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["load_currency"]
          customer_id: string
          customs_broker: string | null
          delivery_date: string | null
          delivery_window_end: string | null
          delivery_window_start: string | null
          destination_address: string | null
          destination_city: string | null
          destination_company: string | null
          destination_country: string | null
          destination_province: string | null
          driver_id: string | null
          equipment_required: string | null
          fuel_surcharge_cad: number | null
          fx_rate_to_cad: number
          id: string
          internal_notes: string | null
          is_cross_border: boolean
          load_number: string
          load_type: Database["public"]["Enums"]["load_type"]
          notes: string | null
          origin_address: string | null
          origin_city: string | null
          origin_company: string | null
          origin_country: string | null
          origin_province: string | null
          pars_pass_number: string | null
          pickup_date: string | null
          pickup_window_end: string | null
          pickup_window_start: string | null
          pieces: number | null
          po_number: string | null
          rate_cad: number | null
          reference_number: string | null
          status: Database["public"]["Enums"]["load_status"]
          total_billed_cad: number | null
          trailer_id: string | null
          truck_id: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          accessorial_charges_cad?: number | null
          aci_aces_number?: string | null
          commodity?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["load_currency"]
          customer_id: string
          customs_broker?: string | null
          delivery_date?: string | null
          delivery_window_end?: string | null
          delivery_window_start?: string | null
          destination_address?: string | null
          destination_city?: string | null
          destination_company?: string | null
          destination_country?: string | null
          destination_province?: string | null
          driver_id?: string | null
          equipment_required?: string | null
          fuel_surcharge_cad?: number | null
          fx_rate_to_cad?: number
          id?: string
          internal_notes?: string | null
          is_cross_border?: boolean
          load_number: string
          load_type?: Database["public"]["Enums"]["load_type"]
          notes?: string | null
          origin_address?: string | null
          origin_city?: string | null
          origin_company?: string | null
          origin_country?: string | null
          origin_province?: string | null
          pars_pass_number?: string | null
          pickup_date?: string | null
          pickup_window_end?: string | null
          pickup_window_start?: string | null
          pieces?: number | null
          po_number?: string | null
          rate_cad?: number | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["load_status"]
          total_billed_cad?: number | null
          trailer_id?: string | null
          truck_id?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          accessorial_charges_cad?: number | null
          aci_aces_number?: string | null
          commodity?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["load_currency"]
          customer_id?: string
          customs_broker?: string | null
          delivery_date?: string | null
          delivery_window_end?: string | null
          delivery_window_start?: string | null
          destination_address?: string | null
          destination_city?: string | null
          destination_company?: string | null
          destination_country?: string | null
          destination_province?: string | null
          driver_id?: string | null
          equipment_required?: string | null
          fuel_surcharge_cad?: number | null
          fx_rate_to_cad?: number
          id?: string
          internal_notes?: string | null
          is_cross_border?: boolean
          load_number?: string
          load_type?: Database["public"]["Enums"]["load_type"]
          notes?: string | null
          origin_address?: string | null
          origin_city?: string | null
          origin_company?: string | null
          origin_country?: string | null
          origin_province?: string | null
          pars_pass_number?: string | null
          pickup_date?: string | null
          pickup_window_end?: string | null
          pickup_window_start?: string | null
          pieces?: number | null
          po_number?: string | null
          rate_cad?: number | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["load_status"]
          total_billed_cad?: number | null
          trailer_id?: string | null
          truck_id?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "trailers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          employee_id: string | null
          full_name: string
          hire_date: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          employee_id?: string | null
          full_name?: string
          hire_date?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          employee_id?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      trailers: {
        Row: {
          created_at: string
          id: string
          last_inspection_date: string | null
          next_inspection_due: string | null
          notes: string | null
          plate: string | null
          plate_expiry: string | null
          plate_province: string | null
          status: Database["public"]["Enums"]["equipment_status"]
          trailer_number: string
          type: Database["public"]["Enums"]["trailer_type"]
          updated_at: string
          vin: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_inspection_date?: string | null
          next_inspection_due?: string | null
          notes?: string | null
          plate?: string | null
          plate_expiry?: string | null
          plate_province?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          trailer_number: string
          type?: Database["public"]["Enums"]["trailer_type"]
          updated_at?: string
          vin?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_inspection_date?: string | null
          next_inspection_due?: string | null
          notes?: string | null
          plate?: string | null
          plate_expiry?: string | null
          plate_province?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          trailer_number?: string
          type?: Database["public"]["Enums"]["trailer_type"]
          updated_at?: string
          vin?: string | null
        }
        Relationships: []
      }
      trucks: {
        Row: {
          created_at: string
          current_odometer_km: number | null
          cvor_certificate_expiry: string | null
          id: string
          ifta_decal_expiry: string | null
          ifta_decal_year: number | null
          insurance_expiry: string | null
          insurance_policy: string | null
          make: string | null
          model: string | null
          notes: string | null
          plate: string | null
          plate_expiry: string | null
          plate_province: string | null
          safety_sticker_expiry: string | null
          status: Database["public"]["Enums"]["equipment_status"]
          truck_number: string
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          current_odometer_km?: number | null
          cvor_certificate_expiry?: string | null
          id?: string
          ifta_decal_expiry?: string | null
          ifta_decal_year?: number | null
          insurance_expiry?: string | null
          insurance_policy?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          plate?: string | null
          plate_expiry?: string | null
          plate_province?: string | null
          safety_sticker_expiry?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          truck_number: string
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          current_odometer_km?: number | null
          cvor_certificate_expiry?: string | null
          id?: string
          ifta_decal_expiry?: string | null
          ifta_decal_year?: number | null
          insurance_expiry?: string | null
          insurance_policy?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          plate?: string | null
          plate_expiry?: string | null
          plate_province?: string | null
          safety_sticker_expiry?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          truck_number?: string
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_direct_chat: {
        Args: { p_other_profile_id: string }
        Returns: string
      }
      has_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_dispatcher_or_admin: { Args: never; Returns: boolean }
      next_employee_id: { Args: never; Returns: string }
      next_load_number: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "dispatcher" | "driver" | "accounting"
      chat_thread_type: "direct" | "group"
      document_type:
        | "bol"
        | "pod"
        | "invoice"
        | "rate_con"
        | "customs"
        | "cci"
        | "inspection"
        | "maintenance"
        | "driver_licence"
        | "medical"
        | "fast_card"
        | "insurance"
        | "registration"
        | "other"
      equipment_status: "active" | "maintenance" | "out_of_service" | "retired"
      inspection_type: "pre_trip" | "post_trip" | "en_route"
      inspection_severity: "none" | "minor" | "major"
      load_currency: "CAD" | "USD"
      maintenance_service_type:
        | "oil_change"
        | "tire"
        | "brake"
        | "annual_inspection"
        | "safety"
        | "repair"
        | "preventive"
        | "other"
      load_status:
        | "draft"
        | "assigned"
        | "dispatched"
        | "at_pickup"
        | "loaded"
        | "in_transit"
        | "at_delivery"
        | "delivered"
        | "invoiced"
        | "paid"
        | "cancelled"
      load_type: "ftl" | "ltl" | "partial"
      trailer_type:
        | "dry_van"
        | "reefer"
        | "flatbed"
        | "step_deck"
        | "tank"
        | "other"
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
    Enums: {
      app_role: ["admin", "dispatcher", "driver", "accounting"],
      equipment_status: ["active", "maintenance", "out_of_service", "retired"],
      load_currency: ["CAD", "USD"],
      load_status: [
        "draft",
        "assigned",
        "dispatched",
        "at_pickup",
        "loaded",
        "in_transit",
        "at_delivery",
        "delivered",
        "invoiced",
        "paid",
        "cancelled",
      ],
      load_type: ["ftl", "ltl", "partial"],
      trailer_type: [
        "dry_van",
        "reefer",
        "flatbed",
        "step_deck",
        "tank",
        "other",
      ],
    },
  },
} as const

export type AppRole = Enums<"app_role">
export type LoadStatus = Enums<"load_status">
export type LoadType = Enums<"load_type">
export type LoadCurrency = Enums<"load_currency">
export type EquipmentStatus = Enums<"equipment_status">
export type TrailerType = Enums<"trailer_type">
