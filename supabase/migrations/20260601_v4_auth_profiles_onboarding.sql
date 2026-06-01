-- 🧠 Mind Games — Schema v4
-- Auth & Profiles: role, first_name/last_name, gender expand, onboarding
-- Compatible con Supabase (RLS, auth.users, gen_random_uuid)

-- ═══════════════════════════════════════════════════════════════
-- 1. PROFILES — Columnas faltantes
-- ═══════════════════════════════════════════════════════════════

-- Role para diferenciar usuarios comunes vs administradores
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin', 'moderator'));

-- Nombres reales del usuario (para perfil demográfico completo)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name TEXT;

COMMENT ON COLUMN public.profiles.role IS 'Rol del usuario: user (por defecto), admin (acceso total), moderator';
COMMENT ON COLUMN public.profiles.first_name IS 'Nombre real del usuario';
COMMENT ON COLUMN public.profiles.last_name IS 'Apellido real del usuario';

-- ═══════════════════════════════════════════════════════════════
-- 2. GENDER — Expandir de VARCHAR(1) a VARCHAR(20) con más opciones
-- ═══════════════════════════════════════════════════════════════

-- Cambiar tipo de columna
ALTER TABLE public.profiles ALTER COLUMN gender TYPE VARCHAR(20)
  USING CASE
    WHEN gender = 'M' THEN 'male'
    WHEN gender = 'F' THEN 'female'
    WHEN gender = 'O' THEN 'non-binary'
    WHEN gender = 'N' THEN 'prefer-not-to-say'
    ELSE gender
  END;

-- Reemplazar constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_gender_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_gender_check
  CHECK (gender IN ('male', 'female', 'non-binary', 'prefer-not-to-say', 'other'));

-- ═══════════════════════════════════════════════════════════════
-- 3. EDUCATION_LEVEL — Actualizar a valores en español
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_education_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_education_check
  CHECK (education_level IN ('primaria', 'secundaria', 'universidad', 'postgrado'));

-- Migrar valores existentes
UPDATE public.profiles
SET education_level = CASE
  WHEN education_level = 'primary' THEN 'primaria'
  WHEN education_level = 'secondary' THEN 'secundaria'
  WHEN education_level = 'university' THEN 'universidad'
  WHEN education_level = 'postgraduate' THEN 'postgrado'
  ELSE education_level
END
WHERE education_level IN ('primary', 'secondary', 'university', 'postgraduate');

-- ═══════════════════════════════════════════════════════════════
-- 4. UPDATE TRIGGER — handle_new_user mejorado
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'preferred_language', 'es')
  );

  INSERT INTO public.cognitive_metrics (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 5. RLS — Política para administradores
-- ═══════════════════════════════════════════════════════════════

-- Admin puede leer TODOS los perfiles (para analítica global)
DROP POLICY IF EXISTS "Admin can read all profiles" ON public.profiles;
CREATE POLICY "Admin can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admin puede actualizar cualquier perfil
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
CREATE POLICY "Admin can update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 6. CREAR PERFIL ADMINISTRADOR
-- ═══════════════════════════════════════════════════════════════
-- INSTRUCCIÓN: Reemplazá 'TU_EMAIL@EJEMPLO.COM' por tu correo
-- y ejecutá este bloque en el SQL Editor de Supabase Dashboard.
-- ═══════════════════════════════════════════════════════════════

/*
-- DESCOMENTAR Y EJECUTAR DESPUÉS DE REGISTRARTE:
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Buscar el UUID del usuario por su email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'TU_EMAIL@EJEMPLO.COM';

  IF v_user_id IS NOT NULL THEN
    -- Actualizar el perfil existente con role admin + datos personales
    UPDATE public.profiles
    SET
      role = 'admin',
      first_name = 'Esteban',
      last_name = 'Rey'
    WHERE id = v_user_id;

    RAISE NOTICE 'Perfil administrador creado para %', 'TU_EMAIL@EJEMPLO.COM';
  ELSE
    RAISE NOTICE 'No se encontró el usuario con ese email. Registrate primero.';
  END IF;
END;
$$;
*/

-- ═══════════════════════════════════════════════════════════════
-- 7. FUNCIÓN AUXILIAR — Verificar si perfil está completo
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_profile_complete(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  RETURN v_profile.first_name IS NOT NULL AND v_profile.birth_date IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION public.is_profile_complete IS 'Verifica si el perfil tiene los datos mínimos del onboarding';
