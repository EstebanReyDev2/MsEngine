-- 🧠 Mind Games — Schema v3
-- Extensiones: account status, age calculada, cogni_coef, daily snapshots,
-- offline sync, rankings optimizer, sistema de decaimiento
-- Compatible con Supabase (RLS, auth.users, gen_random_uuid)

-- ═══════════════════════════════════════════════════════════════
-- 1. PROFILES — Columnas faltantes + age GENERATED
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status VARCHAR(10)
  NOT NULL DEFAULT 'active'
  CHECK (account_status IN ('active', 'suspended', 'banned', 'deleted'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN
  NOT NULL DEFAULT false;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_data_at TIMESTAMPTZ;

-- Edad calculada por trigger (AGE() no es immutable, no puede ser GENERATED STORED)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INT;

COMMENT ON COLUMN public.profiles.account_status IS 'Estado de la cuenta: active, suspended, banned, deleted';
COMMENT ON COLUMN public.profiles.is_verified IS 'Email verificado / OAuth vinculado';
COMMENT ON COLUMN public.profiles.age IS 'Calculado automáticamente desde birth_date';
COMMENT ON COLUMN public.profiles.consent_data_at IS 'Timestamp del último consentimiento de datos personales';

-- Función y trigger para mantener age actualizado
CREATE OR REPLACE FUNCTION public.update_profile_age()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  NEW.age := CASE
    WHEN NEW.birth_date IS NOT NULL
    THEN EXTRACT(YEAR FROM AGE(NEW.birth_date))::int
    ELSE NULL
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_profiles_age ON public.profiles;
CREATE TRIGGER trigger_profiles_age
  BEFORE INSERT OR UPDATE OF birth_date ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_age();

-- ═══════════════════════════════════════════════════════════════
-- 2. COGNITIVE METRICS — cogni_coef_score + decay_factor
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.cognitive_metrics ADD COLUMN IF NOT EXISTS
  decay_factor DECIMAL(3,2) NOT NULL DEFAULT 1.00
  CHECK (decay_factor BETWEEN 0.50 AND 1.00);

-- cogni_coef = weighted average para ranking
-- Pesos: memory 20%, agility 20%, focus 15%, logic 15%, flexibility 15%, processing_speed 15%
ALTER TABLE public.cognitive_metrics ADD COLUMN IF NOT EXISTS
  cogni_coef_score SMALLINT GENERATED ALWAYS AS (
    GREATEST(0, LEAST(100, (
      (COALESCE(memory_score::numeric, 50) * 0.20) +
      (COALESCE(agility_score::numeric, 50) * 0.20) +
      (COALESCE(focus_score::numeric, 50) * 0.15) +
      (COALESCE(logic_score::numeric, 50) * 0.15) +
      (COALESCE(flexibility_score::numeric, 50) * 0.15) +
      (COALESCE(processing_speed::numeric, 50) * 0.15)
    )::smallint)
  )
) STORED;

COMMENT ON COLUMN public.cognitive_metrics.decay_factor IS 'Factor de decaimiento por inactividad (1.00 = sin decay)';
COMMENT ON COLUMN public.cognitive_metrics.cogni_coef_score IS 'Score compuesto ponderado para rankings y tiers';

-- ═══════════════════════════════════════════════════════════════
-- 3. DAILY SNAPSHOTS — Para dashboard sin recalcular historial
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.daily_snapshots (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  memory_score SMALLINT NOT NULL,
  agility_score SMALLINT NOT NULL,
  focus_score SMALLINT NOT NULL,
  logic_score SMALLINT NOT NULL,
  flexibility_score SMALLINT NOT NULL,
  processing_speed SMALLINT NOT NULL,
  total_score SMALLINT NOT NULL,
  cogni_coef_score SMALLINT NOT NULL,
  games_played_today INT NOT NULL DEFAULT 0,
  avg_score_today DECIMAL(8,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, snapshot_date)
);

ALTER TABLE public.daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Daily snapshots — select owner"
  ON public.daily_snapshots FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Daily snapshots — insert owner"
  ON public.daily_snapshots FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Daily snapshots — update owner"
  ON public.daily_snapshots FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Daily snapshots — delete owner"
  ON public.daily_snapshots FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_daily_snapshots_user_date
  ON public.daily_snapshots (user_id, snapshot_date DESC);

COMMENT ON TABLE public.daily_snapshots IS 'Snapshot diario de métricas para evitar recalcular historial en el dashboard';

-- ═══════════════════════════════════════════════════════════════
-- 4. GAME ROUNDS — client_id para idempotencia offline
-- ═══════════════════════════════════════════════════════════════
-- NOTA: No podemos usar UNIQUE constraint en tablas particionadas
-- sin incluir el partition key (created_at). La idempotencia se
-- maneja vía tabla auxiliar no particionada.

ALTER TABLE public.game_rounds ADD COLUMN IF NOT EXISTS
  client_id UUID DEFAULT gen_random_uuid();

-- Tabla auxiliar para garantizar unicidad de client_id
-- (no particionada, porque las constraints UNIQUE en tablas
--  particionadas deben incluir el partition key)
CREATE TABLE IF NOT EXISTS public.game_round_client_ids (
  client_id UUID PRIMARY KEY,
  round_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.game_round_client_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client IDs — insert owner"
  ON public.game_round_client_ids FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Client IDs — select owner"
  ON public.game_round_client_ids FOR SELECT
  TO authenticated
  USING (true);

-- Índice no-unique para búsqueda por client_id en la tabla particionada
CREATE INDEX IF NOT EXISTS idx_game_rounds_client_id
  ON public.game_rounds (client_id)
  WHERE client_id IS NOT NULL;

COMMENT ON COLUMN public.game_rounds.client_id IS 'ID generado por el cliente para idempotencia en sync offline';
COMMENT ON TABLE public.game_round_client_ids IS 'Garantiza unicidad de client_id offline (las UNIQUE constraints no funcionan en tablas particionadas sin el partition key)';

-- ═══════════════════════════════════════════════════════════════
-- 5. ÍNDICES PARA RANKINGS Y CONSULTAS FRECUENTES
-- ═══════════════════════════════════════════════════════════════

-- Ranking global: orden descendente por cogni_coef_score (más preciso que total_score)
CREATE INDEX IF NOT EXISTS idx_cognitive_metrics_cogni_coef_desc
  ON public.cognitive_metrics (cogni_coef_score DESC)
  WHERE cogni_coef_score > 0;

-- Rankings por país con INCLUDE para evitar lookup a profiles
CREATE INDEX IF NOT EXISTS idx_profiles_country_id_include_name
  ON public.profiles (country, id)
  INCLUDE (display_name);

-- Rankings por edad (bucketizado)
CREATE INDEX IF NOT EXISTS idx_profiles_age
  ON public.profiles (age)
  WHERE age IS NOT NULL;

-- Tier history: última asignación por usuario
CREATE INDEX IF NOT EXISTS idx_tier_history_user_recent
  ON public.user_tier_history (user_id, assigned_at DESC);

-- Leaderboard snapshots: filtrar por tipo + fecha
CREATE INDEX IF NOT EXISTS idx_leaderboard_type_tier_calculated
  ON public.leaderboard_snapshots (leaderboard_type, tier, calculated_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 6. FUNCIONES HELPER
-- ═══════════════════════════════════════════════════════════════

-- Verificar si un usuario puede jugar (cuenta activa)
CREATE OR REPLACE FUNCTION public.is_account_active(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT account_status = 'active'
     FROM public.profiles
     WHERE id = check_user_id),
    false
  );
END;
$$;

COMMENT ON FUNCTION public.is_account_active IS 'Verifica si la cuenta del usuario está activa. Usa SECURITY INVOKER para respetar RLS.';

-- Obtener el tier de un usuario según su cogni_coef_score
CREATE OR REPLACE FUNCTION public.get_user_tier(p_score INT)
RETURNS VARCHAR(10)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE
    WHEN p_score < 25 THEN 'unranked'
    WHEN p_score < 45 THEN 'bronze'
    WHEN p_score < 65 THEN 'silver'
    WHEN p_score < 85 THEN 'gold'
    ELSE 'diamond'
  END;
END;
$$;

COMMENT ON FUNCTION public.get_user_tier IS 'Calcula el tier (liga) según el puntaje cognitivo. Immutable para permitir indexación.';

-- ═══════════════════════════════════════════════════════════════
-- 7. TRIGGER: Registrar cambio de tier automáticamente
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_and_record_tier_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  old_tier VARCHAR(10);
  new_tier VARCHAR(10);
BEGIN
  old_tier := public.get_user_tier(OLD.cogni_coef_score);
  new_tier := public.get_user_tier(NEW.cogni_coef_score);

  IF old_tier <> new_tier THEN
    INSERT INTO public.user_tier_history (user_id, tier, total_score_at_assignment)
    VALUES (NEW.user_id, new_tier, NEW.cogni_coef_score);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_cognitive_metrics_tier_change ON public.cognitive_metrics;
CREATE TRIGGER trigger_cognitive_metrics_tier_change
  AFTER UPDATE OF cogni_coef_score ON public.cognitive_metrics
  FOR EACH ROW
  WHEN (OLD.cogni_coef_score IS DISTINCT FROM NEW.cogni_coef_score)
  EXECUTE FUNCTION public.check_and_record_tier_change();

-- ═══════════════════════════════════════════════════════════════
-- 8. FUNCIÓN: Refresh leaderboard snapshots (para pg_cron)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.refresh_leaderboard_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_total INT;
BEGIN
  -- === GLOBAL ===
  SELECT COUNT(*) INTO v_total FROM public.cognitive_metrics WHERE cogni_coef_score > 0;

  INSERT INTO public.leaderboard_snapshots
    (leaderboard_type, filter_value, tier, rankings, total_players)
  SELECT
    'global',
    NULL,
    NULL,
    COALESCE(
      (SELECT jsonb_agg(sub)
       FROM (
         SELECT
           row_number() OVER (ORDER BY cm.cogni_coef_score DESC) AS rank,
           cm.user_id,
           p.display_name,
           cm.cogni_coef_score AS total_score,
           public.get_user_tier(cm.cogni_coef_score) AS tier
         FROM public.cognitive_metrics cm
         JOIN public.profiles p ON p.id = cm.user_id
         WHERE cm.cogni_coef_score > 0
         ORDER BY cm.cogni_coef_score DESC
         LIMIT 1000
       ) sub
      ),
      '[]'::jsonb
    ),
    v_total;

  -- === POR PAÍS ===
  INSERT INTO public.leaderboard_snapshots
    (leaderboard_type, filter_value, tier, rankings, total_players)
  SELECT
    'country',
    p.country,
    NULL,
    COALESCE(
      (SELECT jsonb_agg(sub)
       FROM (
         SELECT
           row_number() OVER (ORDER BY cm.cogni_coef_score DESC) AS rank,
           cm.user_id,
           p2.display_name,
           cm.cogni_coef_score AS total_score,
           public.get_user_tier(cm.cogni_coef_score) AS tier
         FROM public.cognitive_metrics cm
         JOIN public.profiles p2 ON p2.id = cm.user_id
         WHERE cm.cogni_coef_score > 0 AND p2.country = p.country
         ORDER BY cm.cogni_coef_score DESC
         LIMIT 500
       ) sub
      ),
      '[]'::jsonb
    ),
    (SELECT COUNT(*) FROM public.cognitive_metrics cm
     JOIN public.profiles p2 ON p2.id = cm.user_id
     WHERE cm.cogni_coef_score > 0 AND p2.country = p.country)
  FROM (SELECT DISTINCT country FROM public.profiles WHERE country IS NOT NULL) p;

  -- Limpiar snapshots viejos (mantener últimos 100 de cada tipo)
  DELETE FROM public.leaderboard_snapshots
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
        row_number() OVER (PARTITION BY leaderboard_type, COALESCE(filter_value, ''), COALESCE(tier, '')
                           ORDER BY calculated_at DESC) AS rn
      FROM public.leaderboard_snapshots
    ) sub
    WHERE sub.rn > 100
  );
END;
$$;

COMMENT ON FUNCTION public.refresh_leaderboard_snapshots IS 'Job que recalcula rankings globales y por país. Ejecutar via pg_cron cada 15 min.';

-- ═══════════════════════════════════════════════════════════════
-- 9. FUNCIÓN: Aplicar decaimiento por inactividad
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.apply_cognitive_decay()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_days_inactive INT;
BEGIN
  -- Decaimiento para usuarios que no jugaron en 7+ días
  UPDATE public.cognitive_metrics cm
  SET
    memory_score = GREATEST(30,
      memory_score - CASE
        WHEN v_days_inactive >= 30 THEN 1
        WHEN v_days_inactive >= 7 THEN 0.5
        ELSE 0
      END
    ),
    agility_score = GREATEST(30,
      agility_score - CASE
        WHEN v_days_inactive >= 30 THEN 1
        WHEN v_days_inactive >= 7 THEN 0.5
        ELSE 0
      END
    ),
    focus_score = GREATEST(30,
      focus_score - CASE
        WHEN v_days_inactive >= 30 THEN 1
        WHEN v_days_inactive >= 7 THEN 0.5
        ELSE 0
      END
    ),
    logic_score = GREATEST(30,
      logic_score - CASE
        WHEN v_days_inactive >= 30 THEN 1
        WHEN v_days_inactive >= 7 THEN 0.5
        ELSE 0
      END
    ),
    flexibility_score = GREATEST(30,
      flexibility_score - CASE
        WHEN v_days_inactive >= 30 THEN 1
        WHEN v_days_inactive >= 7 THEN 0.5
        ELSE 0
      END
    ),
    processing_speed = GREATEST(30,
      processing_speed - CASE
        WHEN v_days_inactive >= 30 THEN 1
        WHEN v_days_inactive >= 7 THEN 0.5
        ELSE 0
      END
    ),
    decay_factor = GREATEST(0.50, 1.0 - (v_days_inactive * 0.01)),
    updated_at = NOW()
  FROM (
    SELECT
      p.id AS user_id,
      COALESCE(
        EXTRACT(DAY FROM NOW() - (
          SELECT MAX(created_at) FROM public.game_rounds gr WHERE gr.user_id = p.id
        )),
        999
      )::int AS days_inactive
    FROM public.profiles p
    WHERE p.account_status = 'active'
  ) inactive
  WHERE cm.user_id = inactive.user_id
    AND inactive.days_inactive >= 7;
END;
$$;

COMMENT ON FUNCTION public.apply_cognitive_decay IS 'Aplica decaimiento cognitivo diario. Ejecutar via pg_cron una vez al día.';

-- ═══════════════════════════════════════════════════════════════
-- 10. VISTA: Leaderboard público ampliado (con tier)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.cognitive_leaderboard_extended
WITH (security_invoker = true)
AS
SELECT
  cm.user_id,
  p.display_name,
  p.country,
  p.age,
  cm.total_score,
  cm.cogni_coef_score,
  public.get_user_tier(cm.cogni_coef_score) AS tier,
  cm.updated_at AS last_updated
FROM public.cognitive_metrics cm
JOIN public.profiles p ON p.id = cm.user_id
WHERE cm.cogni_coef_score > 0 AND p.account_status = 'active';

COMMENT ON VIEW public.cognitive_leaderboard_extended IS 'Leaderboard público extendido con tier calculado. Usa security_invoker para respetar RLS.';

-- ═══════════════════════════════════════════════════════════════
-- 11. FUNCIONES RPC (para Edge Function calculate-cognitive-delta)
-- ═══════════════════════════════════════════════════════════════

-- Incrementar un score cognitivo específico (con clamp 0-100)
CREATE OR REPLACE FUNCTION public.increment_cognitive_score(
  p_user_id UUID,
  p_column TEXT,
  p_delta DECIMAL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  EXECUTE format(
    'UPDATE public.cognitive_metrics
     SET %I = GREATEST(0, LEAST(100, %I + %L::int)),
         decay_factor = 1.00,
         updated_at = NOW()
     WHERE user_id = %L',
    p_column, p_column, p_delta, p_user_id
  );
END;
$$;

COMMENT ON FUNCTION public.increment_cognitive_score IS 'RPC para Edge Function: incrementa un atributo cognitivo con clamp 0-100. SECURITY INVOKER respeta RLS.';

-- Incrementar contador diario de partidas y actualizar promedio
CREATE OR REPLACE FUNCTION public.increment_daily_games(
  p_user_id UUID,
  p_snapshot_date TEXT,
  p_raw_score DECIMAL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE public.daily_snapshots
  SET
    games_played_today = games_played_today + 1,
    avg_score_today = CASE
      WHEN games_played_today = 0 THEN p_raw_score
      ELSE (avg_score_today * games_played_today + p_raw_score) / (games_played_today + 1)
    END,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND snapshot_date = p_snapshot_date::date;
END;
$$;

COMMENT ON FUNCTION public.increment_daily_games IS 'RPC para Edge Function: incrementa contador diario y recalcula promedio. SECURITY INVOKER respeta RLS.';

-- ═══════════════════════════════════════════════════════════════
-- 12. PUBLICACIÓN REALTIME — daily_snapshots
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_snapshots;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 13. VERIFICACIÓN DE SEGURIDAD (post-migración)
-- ═══════════════════════════════════════════════════════════════

-- Verificar que RLS esté habilitado en todas las tablas públicas
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('schema_migrations')
      AND rowsecurity = false
  LOOP
    RAISE WARNING 'RLS NO habilitado en: public.%', tbl;
  END LOOP;
END;
$$;
