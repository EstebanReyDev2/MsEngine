-- 🧠 Mind Games — Schema v5
-- Fix: RLS infinite recursion en policies de admin
-- Causa: Las policies de admin consultaban public.profiles,
-- lo que disparaba las mismas policies → loop infinito.
-- Solución: helper SECURITY DEFINER que bypassea RLS.

-- ═══════════════════════════════════════════════════════════════
-- 1. Helper function is_admin() — bypassea RLS
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin IS 'Verifica si el usuario autenticado es admin. SECURITY DEFINER rompe el loop de RLS.';

-- ═══════════════════════════════════════════════════════════════
-- 2. Reemplazar policies problemáticas
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admin can read all profiles" ON public.profiles;
CREATE POLICY "Admin can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
CREATE POLICY "Admin can update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin());
