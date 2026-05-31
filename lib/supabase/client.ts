// 📂 /lib/supabase/client.ts
// Browser-side Supabase client with cookie-based auth (App Router)
// NOTE: env vars accessed INSIDE the function to avoid crashes during SSR/build-time module eval
'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[supabase/client] Missing env vars — running without Supabase');
    return null as unknown as ReturnType<typeof createBrowserClient>;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
