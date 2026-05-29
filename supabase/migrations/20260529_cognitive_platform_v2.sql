-- 🧠 Mind Games — Schema Completo v2
-- Cognitive metrics, gamification, rankings, time-series history
-- Compatible con Supabase (RLS, auth.users, gen_random_uuid)

-- ═══════════════════════════════════════════════════════════════
-- 1. PROFILES (autocontenido: crea o extiende)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  cerebra_rank TEXT DEFAULT 'Novato del Enfoque',
  display_name VARCHAR(50),
  birth_date DATE,
  gender VARCHAR(1),
  weight_kg DECIMAL(5,1),
  height_cm DECIMAL(5,1),
  education_level VARCHAR(20),
  occupation TEXT,
  country VARCHAR(3),
  city VARCHAR(100),
  timezone VARCHAR(50),
  preferred_language VARCHAR(5) DEFAULT 'es',
  unit_system VARCHAR(10) DEFAULT 'metric',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar columnas faltantes si la tabla ya existía del schema anterior
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name VARCHAR(50);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(1);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(5,1);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height_cm DECIMAL(5,1);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS education_level VARCHAR(20);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country VARCHAR(3);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'es';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unit_system VARCHAR(10) DEFAULT 'metric';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Agregar constraints CHECK (solo si la columna se creó ahora o existe)
-- Usamos DO para evitar error si la columna existe pero el CHECK no
DO $$ BEGIN
  EXECUTE 'ALTER TABLE public.profiles ADD CONSTRAINT profiles_gender_check CHECK (gender IN (''M'',''F'',''O'',''N''))';
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE public.profiles ADD CONSTRAINT profiles_education_check CHECK (education_level IN (''primary'',''secondary'',''university'',''postgraduate''))';
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas viejas y crear nuevas
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles select public" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update owner" ON public.profiles;

DROP POLICY IF EXISTS "Profiles select public" ON public.profiles;
CREATE POLICY "Profiles select public" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Profiles insert owner" ON public.profiles;
CREATE POLICY "Profiles insert owner" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Profiles update owner" ON public.profiles;
CREATE POLICY "Profiles update owner" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ═══════════════════════════════════════════════════════════════
-- 2. CATÁLOGO DE JUEGOS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  cognitive_weights JSONB NOT NULL DEFAULT '{}'
    CHECK (jsonb_typeof(cognitive_weights) = 'object'),
  difficulty_levels INT[] NOT NULL DEFAULT '{1,2,3,4,5}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Games catalog public read" ON public.games;
CREATE POLICY "Games catalog public read"
  ON public.games FOR SELECT
  USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 3. MÉTRICAS COGNITIVAS (snapshot actual por usuario)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cognitive_metrics (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_score SMALLINT NOT NULL DEFAULT 50
    CHECK (memory_score BETWEEN 0 AND 100),
  agility_score SMALLINT NOT NULL DEFAULT 50
    CHECK (agility_score BETWEEN 0 AND 100),
  focus_score SMALLINT NOT NULL DEFAULT 50
    CHECK (focus_score BETWEEN 0 AND 100),
  logic_score SMALLINT NOT NULL DEFAULT 50
    CHECK (logic_score BETWEEN 0 AND 100),
  flexibility_score SMALLINT NOT NULL DEFAULT 50
    CHECK (flexibility_score BETWEEN 0 AND 100),
  processing_speed SMALLINT NOT NULL DEFAULT 50
    CHECK (processing_speed BETWEEN 0 AND 100),
  total_score SMALLINT GENERATED ALWAYS AS (
    ((memory_score + agility_score + focus_score + logic_score + flexibility_score + processing_speed) / 6)::smallint
  ) STORED,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cognitive_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cognitive metrics owner" ON public.cognitive_metrics;
CREATE POLICY "Cognitive metrics owner"
  ON public.cognitive_metrics FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Vista pública para rankings (solo expone total_score, no los detalles)
CREATE OR REPLACE VIEW public.cognitive_leaderboard WITH (security_invoker = true) AS
SELECT
  cm.user_id,
  p.display_name,
  p.country,
  cm.total_score,
  cm.updated_at as last_updated
FROM public.cognitive_metrics cm
JOIN public.profiles p ON p.id = cm.user_id
WHERE cm.total_score > 0;

-- ═══════════════════════════════════════════════════════════════
-- 4. HISTORIAL DE MÉTRICAS (time-series particionado)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.metrics_history (
  id BIGSERIAL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  scores JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (snapshot_date, id)
) PARTITION BY RANGE (snapshot_date);

-- Partición inicial (Q2 2026)
CREATE TABLE IF NOT EXISTS public.metrics_history_2026_q2
  PARTITION OF public.metrics_history
  FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');

-- Partición futura (Q3 2026)
CREATE TABLE IF NOT EXISTS public.metrics_history_2026_q3
  PARTITION OF public.metrics_history
  FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');

ALTER TABLE public.metrics_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Metrics history owner" ON public.metrics_history;
CREATE POLICY "Metrics history owner"
  ON public.metrics_history FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_metrics_history_user_date
  ON public.metrics_history (user_id, snapshot_date DESC);

-- ═══════════════════════════════════════════════════════════════
-- 5. SESIONES DE JUEGO
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  device VARCHAR(20) DEFAULT 'desktop'
    CHECK (device IN ('desktop','mobile','tablet')),
  connection_status VARCHAR(10) DEFAULT 'online'
    CHECK (connection_status IN ('online','offline_sync')),
  duration_seconds INT GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (ended_at - started_at))::int
      ELSE NULL
    END
  ) STORED
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Game sessions owner" ON public.game_sessions;
CREATE POLICY "Game sessions owner"
  ON public.game_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_sessions_user_started
  ON public.game_sessions (user_id, started_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 6. RONDAS DE JUEGO (cada partida individual)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.game_rounds (
  id UUID DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  difficulty_level INT NOT NULL CHECK (difficulty_level BETWEEN 1 AND 5),
  raw_score INT NOT NULL DEFAULT 0,
  time_completed_seconds DECIMAL(8,2),
  errors_count INT DEFAULT 0,
  streak INT DEFAULT 0,
  cognitive_delta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (created_at, id)
)
PARTITION BY RANGE (created_at);

-- Particiones mensuales
CREATE TABLE IF NOT EXISTS public.game_rounds_2026_05
  PARTITION OF public.game_rounds
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS public.game_rounds_2026_06
  PARTITION OF public.game_rounds
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS public.game_rounds_2026_07
  PARTITION OF public.game_rounds
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Game rounds owner" ON public.game_rounds;
CREATE POLICY "Game rounds owner"
  ON public.game_rounds FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Index para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_rounds_user_created
  ON public.game_rounds (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rounds_game_created
  ON public.game_rounds (game_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 7. LOGROS / BADGES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url TEXT,
  criteria JSONB NOT NULL DEFAULT '{}',
  cognitive_category VARCHAR(20)
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Achievements public read" ON public.achievements;
CREATE POLICY "Achievements public read"
  ON public.achievements FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  notified BOOLEAN DEFAULT false,
  PRIMARY KEY (user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User achievements owner" ON public.user_achievements;
CREATE POLICY "User achievements owner"
  ON public.user_achievements FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- 8. HISTORIAL DE LIGAS / TIERS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_tier_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier VARCHAR(10) NOT NULL
    CHECK (tier IN ('unranked','bronze','silver','gold','diamond')),
  total_score_at_assignment INT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_tier_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tier history owner" ON public.user_tier_history;
CREATE POLICY "Tier history owner"
  ON public.user_tier_history FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_tier_history_user
  ON public.user_tier_history (user_id, assigned_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 9. LEADERBOARD SNAPSHOTS (caché de rankings)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id BIGSERIAL PRIMARY KEY,
  leaderboard_type VARCHAR(20) NOT NULL
    CHECK (leaderboard_type IN ('global','country','age_group','education')),
  filter_value TEXT,
  tier VARCHAR(10)
    CHECK (tier IN ('bronze','silver','gold','diamond')),
  rankings JSONB NOT NULL DEFAULT '[]',
  total_players INT NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leaderboard snapshots public read" ON public.leaderboard_snapshots;
CREATE POLICY "Leaderboard snapshots public read"
  ON public.leaderboard_snapshots FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_leaderboard_type_calculated
  ON public.leaderboard_snapshots (leaderboard_type, calculated_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 10. TRIGGERS Y FUNCIONES
-- ═══════════════════════════════════════════════════════════════

-- Al crear un usuario: crear perfil + métricas iniciales
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', '')
  );

  INSERT INTO public.cognitive_metrics (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

-- Vincular trigger al evento de auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Actualizar updated_at en profiles
CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profiles_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 11. SEED DATA: juegos existentes
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.games (slug, name, description, cognitive_weights) VALUES
  ('quantum-trace', 'Quantum Trace', 'Rastreo neural de alta velocidad',
    '{"focus": 0.6, "agility": 0.4}'),
  ('vector-link', 'Vector Link', 'Conexiones semánticas y lógica relacional',
    '{"logic": 0.5, "flexibility": 0.3, "processing_speed": 0.2}'),
  ('semantic-firewall', 'Semantic Firewall', 'Clasificación semántica bajo presión',
    '{"focus": 0.4, "logic": 0.3, "agility": 0.3}'),
  ('chronos-sync', 'Chronos Sync', 'Sincronización temporal y memoria de trabajo',
    '{"memory": 0.5, "processing_speed": 0.3, "focus": 0.2}'),
  ('circuit-forge', 'Circuit Forge', 'Construcción de patrones lógicos',
    '{"logic": 0.5, "flexibility": 0.3, "focus": 0.2}'),
  ('nexus-shift', 'Nexus Shift', 'Flexibilidad cognitiva y cambio de contexto',
    '{"flexibility": 0.5, "agility": 0.3, "memory": 0.2}'),
  ('cafe-expreso', 'Café Expreso', 'Gestión múltiple bajo presión temporal',
    '{"focus": 0.4, "agility": 0.3, "processing_speed": 0.3}'),
  ('lexicon-core', 'Lexicon Core', 'Velocidad de procesamiento léxico',
    '{"processing_speed": 0.5, "memory": 0.3, "focus": 0.2}'),
  ('pattern-recall', 'Pattern Recall', 'Memoria de patrones visuales',
    '{"memory": 0.6, "focus": 0.2, "logic": 0.2}'),
  ('neural-horizon', 'Neural Horizon', 'Planificación estratégica y memoria prospectiva',
    '{"memory": 0.4, "logic": 0.3, "flexibility": 0.3}'),
  ('train-of-thought', 'Train of Thought', 'Secuenciación lógica y atención sostenida',
    '{"focus": 0.5, "logic": 0.3, "processing_speed": 0.2}'),
  ('cipher-flux', 'Cipher Flux', 'Decodificación bajo presión temporal',
    '{"agility": 0.4, "processing_speed": 0.3, "focus": 0.3}'),
  ('vector-core', 'Vector Core', 'Razonamiento espacial y lógica geométrica',
    '{"logic": 0.5, "flexibility": 0.3, "memory": 0.2}')
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 12. SEED DATA: logros iniciales
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.achievements (slug, name, description, criteria) VALUES
  ('first-game', 'Primer Contacto', 'Completá tu primera partida',
    '{"type": "games_played", "threshold": 1}'),
  ('streak-3', 'Racha de 3', 'Ganá 3 partidas seguidas',
    '{"type": "streak", "threshold": 3}'),
  ('streak-7', 'Neurona Persistente', 'Ganá 7 partidas seguidas',
    '{"type": "streak", "threshold": 7}'),
  ('diverse-trainer', 'Entrenamiento Cruzado', 'Jugá 5 juegos diferentes',
    '{"type": "distinct_games", "threshold": 5}'),
  ('score-500', 'Marca de 500', 'Acumulá 500 puntos en una partida',
    '{"type": "single_score", "threshold": 500}'),
  ('score-1000', 'Marca de 1000', 'Acumulá 1000 puntos en una partida',
    '{"type": "single_score", "threshold": 1000}'),
  ('memory-master', 'Maestro de la Memoria', 'Alcanzá 80 de memoria cognitiva',
    '{"type": "cognitive_attribute", "attribute": "memory", "threshold": 80}'),
  ('focus-master', 'Maestro del Enfoque', 'Alcanzá 80 de enfoque',
    '{"type": "cognitive_attribute", "attribute": "focus", "threshold": 80}'),
  ('all-rounder', 'Completo', 'Todos los atributos por encima de 70',
    '{"type": "all_attributes", "threshold": 70}'),
  ('dedication-7', 'Dedicación Semanal', 'Jugá 7 días consecutivos',
    '{"type": "daily_streak", "threshold": 7}')
ON CONFLICT (slug) DO NOTHING;

-- 13. PUBLICACIÓN REALTIME (para leaderboards en vivo)
-- NOTA: supabase_realtime es creada por defecto en proyectos Supabase.
-- ALTER PUBLICATION no soporta IF NOT EXISTS, así que primero verificamos.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rounds;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cognitive_metrics;
  END IF;
END;
$$;
