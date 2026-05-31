// 📂 /lib/supabase/types.ts
// Database type definitions matching the Supabase schema
// These should be regenerated with `npx supabase gen types typescript --linked` for production

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          birth_date: string | null;
          gender: string | null;
          weight_kg: number | null;
          height_cm: number | null;
          education_level: string | null;
          occupation: string | null;
          country: string | null;
          city: string | null;
          timezone: string | null;
          preferred_language: string | null;
          unit_system: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          birth_date?: string | null;
          gender?: string | null;
          weight_kg?: number | null;
          height_cm?: number | null;
          education_level?: string | null;
          occupation?: string | null;
          country?: string | null;
          city?: string | null;
          timezone?: string | null;
          preferred_language?: string | null;
          unit_system?: string | null;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          birth_date?: string | null;
          gender?: string | null;
          weight_kg?: number | null;
          height_cm?: number | null;
          education_level?: string | null;
          occupation?: string | null;
          country?: string | null;
          city?: string | null;
          timezone?: string | null;
          preferred_language?: string | null;
          unit_system?: string | null;
        };
      };
      cognitive_metrics: {
        Row: {
          user_id: string;
          total_score: number;
          games_played: number;
          current_streak: number;
          max_streak: number;
          last_played_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          total_score?: number;
          games_played?: number;
          current_streak?: number;
          max_streak?: number;
          last_played_at?: string | null;
        };
        Update: {
          user_id?: string;
          total_score?: number;
          games_played?: number;
          current_streak?: number;
          max_streak?: number;
          last_played_at?: string | null;
        };
      };
      game_rounds: {
        Row: {
          id: string;
          user_id: string;
          game_type: string;
          score: number;
          level_reached: number;
          metadata: Record<string, unknown> | null;
          started_at: string;
          completed_at: string;
          partition_date: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          game_type: string;
          score: number;
          level_reached: number;
          metadata?: Record<string, unknown> | null;
          started_at?: string;
          completed_at?: string;
          partition_date?: string;
        };
      };
    };
  };
}
