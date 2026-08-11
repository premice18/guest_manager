// Types générés manuellement à partir du schéma de migration
// Référence : supabase/migrations/20260720_initial_schema.sql

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          name: string;
          event_date: string;
          location: string | null;
          description: string | null;
          owner_id: string;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          event_date: string;
          location?: string | null;
          description?: string | null;
          owner_id: string;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          event_date?: string;
          location?: string | null;
          description?: string | null;
          owner_id?: string;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_owner_id_fkey",
            columns: ["owner_id"],
            isOneToOne: false,
            referencedRelation: "auth.users",
            referencedColumns: ["id"],
          },
        ];
      };
      zones: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "zones_event_id_fkey",
            columns: ["event_id"],
            isOneToOne: false,
            referencedRelation: "events",
            referencedColumns: ["id"],
          },
        ];
      };
      tables: {
        Row: {
          id: string;
          event_id: string;
          zone_id: string | null;
          name: string;
          capacity: number;
          shape: "round" | "rectangular" | "imperial";
          is_locked: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          zone_id?: string | null;
          name: string;
          capacity: number;
          shape?: "round" | "rectangular" | "imperial";
          is_locked?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          zone_id?: string | null;
          name?: string;
          capacity?: number;
          shape?: "round" | "rectangular" | "imperial";
          is_locked?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tables_event_id_fkey",
            columns: ["event_id"],
            isOneToOne: false,
            referencedRelation: "events",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "tables_zone_id_fkey",
            columns: ["zone_id"],
            isOneToOne: false,
            referencedRelation: "zones",
            referencedColumns: ["id"],
          },
        ];
      };
      guests: {
        Row: {
          id: string;
          event_id: string;
          table_id: string | null;
          first_name: string;
          last_name: string;
          category: string | null;
          age_type: "adult" | "child" | "baby";
          dietary_notes: string | null;
          needs_accessibility: boolean;
          is_present: boolean;
          checked_in_at: string | null;
          group_id: string | null;
          group_name: string | null;
          notes: string | null;
          guest_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          table_id?: string | null;
          first_name: string;
          last_name: string;
          guest_count?: number;
          category?: string | null;
          age_type?: "adult" | "child" | "baby";
          dietary_notes?: string | null;
          needs_accessibility?: boolean;
          is_present?: boolean;
          checked_in_at?: string | null;
          group_id?: string | null;
          group_name?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          table_id?: string | null;
          first_name?: string;
          last_name?: string;
          category?: string | null;
          age_type?: "adult" | "child" | "baby";
          dietary_notes?: string | null;
          needs_accessibility?: boolean;
          is_present?: boolean;
          checked_in_at?: string | null;
          group_id?: string | null;
          group_name?: string | null;
          notes?: string | null;
          guest_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guests_event_id_fkey",
            columns: ["event_id"],
            isOneToOne: false,
            referencedRelation: "events",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "guests_table_id_fkey",
            columns: ["table_id"],
            isOneToOne: false,
            referencedRelation: "tables",
            referencedColumns: ["id"],
          },
        ];
      };
      event_staff: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          role: "admin" | "host";
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          role: "admin" | "host";
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          role?: "admin" | "host";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_staff_event_id_fkey",
            columns: ["event_id"],
            isOneToOne: false,
            referencedRelation: "events",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "event_staff_user_id_fkey",
            columns: ["user_id"],
            isOneToOne: false,
            referencedRelation: "auth.users",
            referencedColumns: ["id"],
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      reorder_tables: {
        Args: {
          target_event_id: string;
          table_ids: string[];
        };
        Returns: undefined;
      };
    };
    Enums: {
      age_category: "adult" | "child" | "baby";
      table_shape: "round" | "rectangular" | "imperial";
    };
  };
};
