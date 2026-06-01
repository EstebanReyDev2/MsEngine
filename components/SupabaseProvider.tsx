// 📂 /components/SupabaseProvider.tsx
'use client';

import { createClient } from '@/lib/supabase/client';
import type { Session, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

// ──────────────────────────────────────────────
// Profile shape — espejo exacto de public.profiles
// ──────────────────────────────────────────────
export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin' | 'moderator';
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  age: number | null;
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
  account_status: string | null;
  is_verified: boolean;
  consent_data_at: string | null;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// Auth context contract
// ──────────────────────────────────────────────
interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  needsOnboarding: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, options?: { data?: Record<string, unknown> }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Record<string, unknown>) => Promise<{ error: string | null }>;
}

const SupabaseContext = createContext<AuthState>({
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  isAdmin: false,
  needsOnboarding: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
  updateProfile: async () => ({ error: null }),
});

export function useSupabase() {
  return useContext(SupabaseContext);
}

// Columnas que necesita el frontend del perfil
const PROFILE_SELECT = `
  id, username, display_name, avatar_url, role,
  first_name, last_name, birth_date, age, gender,
  weight_kg, height_cm, education_level, occupation,
  country, city, timezone, preferred_language, unit_system,
  account_status, is_verified, consent_data_at,
  created_at, updated_at
`;

export default function SupabaseProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const isAvailable = !!supabase;

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Fetch full profile ──
  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data as unknown as Profile);
    } else {
      console.warn('[SupabaseProvider] fetchProfile error:', error?.message);
      setProfile(null);
    }
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (!user?.id || !supabase) return;
    await fetchProfile(user.id);
  }, [user, fetchProfile, supabase]);

  // ── Auth helpers ──
  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: 'Supabase no disponible' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    router.refresh();
    return { error: null };
  }, [supabase, router]);

  const signUp = useCallback(
    async (email: string, password: string, options?: { data?: Record<string, unknown> }) => {
      if (!supabase) return { error: 'Supabase no disponible' };

      // Detectar idioma del navegador automáticamente
      const browserLang = typeof navigator !== 'undefined'
        ? (navigator.language || 'es').split('-')[0]
        : 'es';

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            preferred_language: browserLang,
            ...options?.data,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/onboarding`,
        },
      });
      if (error) return { error: error.message };
      return { error: null };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    router.refresh();
  }, [supabase, router]);

  const updateProfile = useCallback(async (updates: Record<string, unknown>) => {
    console.log('[SupabaseProvider] updateProfile llamado. user?.id:', user?.id, 'updates keys:', Object.keys(updates));
    if (!supabase) return { error: 'Supabase no disponible' };
    if (!user?.id) return { error: 'No authenticated user' };

    try {
      console.log('[SupabaseProvider] Enviando UPDATE a Supabase profiles...');
      const response = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      console.log('[SupabaseProvider] Respuesta de Supabase:', response);

      const { error } = response;
      if (!error) {
        console.log('[SupabaseProvider] UPDATE exitoso, actualizando estado local');
        setProfile(prev => prev ? { ...prev, ...updates } as Profile : null);
      } else {
        console.error('[SupabaseProvider] UPDATE falló:', error);
      }

      return { error: error?.message ?? null };
    } catch (err) {
      console.error('[SupabaseProvider] updateProfile EXCEPCIÓN:', err);
      return { error: err instanceof Error ? err.message : 'Error desconocido al actualizar perfil' };
    }
  }, [supabase, user]);

  // ── Derived state ──
  const isAdmin = profile?.role === 'admin';
  const needsOnboarding = !!user && !!profile && !profile.first_name && !profile.birth_date;

  // ── Init: force loading false if Supabase unavailable ──
  useEffect(() => {
    if (!isAvailable) {
      setIsLoading(false);
    }
  }, [isAvailable]);

  // ── Listen to auth state changes ──
  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: string, _session: Session | null) => {
        setSession(_session);
        setUser(_session?.user ?? null);

        if (_session?.user) {
          await fetchProfile(_session.user.id);
        } else {
          setProfile(null);
        }

        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SupabaseContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        isAdmin,
        needsOnboarding,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </SupabaseContext.Provider>
  );
}
