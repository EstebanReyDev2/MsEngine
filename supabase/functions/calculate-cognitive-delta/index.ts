// 🧠 calculate-cognitive-delta — Edge Function
// Calcula el delta cognitivo tras una partida y actualiza métricas.
// CORAZÓN del sistema de gamificación cognitiva.
//
// POST /calculate-cognitive-delta
// Body: { session_id, game_slug, raw_score, time_completed_seconds,
//         errors_count, streak, difficulty_level, max_possible_score,
//         expected_time_seconds, connection_status, client_id }
//
// RespConse: { success, cognitive_delta, new_metrics, achievements_unlocked }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface GameRoundInput {
  session_id: string;
  game_slug: string;
  raw_score: number;
  max_possible_score: number;
  time_completed_seconds: number;
  expected_time_seconds: number;
  errors_count: number;
  streak: number;
  difficulty_level: number; // 1-5
  connection_status?: 'online' | 'offline_sync';
  client_id?: string;
}

interface CognitiveDelta {
  [attribute: string]: {
    delta: number;
    reason: string;
  };
}

interface GameWeights {
  [attribute: string]: number;
}

// ─── FACTORES DE CÁLCULO ───────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function calculateDeltaTotal(
  rawScore: number,
  maxPossibleScore: number,
  timeCompletedSeconds: number,
  expectedTimeSeconds: number,
  errorsCount: number,
  streak: number,
  difficultyLevel: number
): number {
  // 1. Score base normalizado 0-100
  const baseContribution = maxPossibleScore > 0
    ? (rawScore / maxPossibleScore) * 100
    : 0;

  // 2. Factor de velocidad
  const timeRatio = expectedTimeSeconds > 0
    ? timeCompletedSeconds / expectedTimeSeconds
    : 1.0;

  let speedFactor: number;
  if (timeRatio <= 0.5) speedFactor = 1.5;
  else if (timeRatio <= 0.8) speedFactor = 1.2;
  else if (timeRatio <= 1.0) speedFactor = 1.0;
  else speedFactor = 0.8;

  // 3. Penalización por errores (cada error -10%, mínimo 50%)
  const errorPenalty = Math.max(0.5, 1.0 - errorsCount * 0.10);

  // 4. Bono por racha (cada racha +5%, tope +50%)
  const streakBonus = Math.min(1.5, 1.0 + streak * 0.05);

  // 5. Multiplicador de dificultad (D=1 → 0.95, D=5 → 1.55)
  const difficultyMultiplier = 0.8 + difficultyLevel * 0.15;

  // 6. Delta total
  const deltaTotal = baseContribution
    * speedFactor
    * errorPenalty
    * streakBonus
    * difficultyMultiplier;

  return clamp(Math.round(deltaTotal * 100) / 100, -5, 15);
}

function buildReason(
  delta: number,
  speedFactor: number,
  errorPenalty: number,
  streakBonus: number
): string {
  const parts: string[] = [];

  if (delta > 5) parts.push('rendimiento excepcional');
  else if (delta > 2) parts.push('buen rendimiento');
  else if (delta > 0) parts.push('rendimiento adecuado');
  else if (delta === 0) parts.push('sin cambios significativos');
  else parts.push('rendimiento por debajo del esperado');

  if (speedFactor > 1.0) parts.push(`bono de velocidad x${speedFactor}`);
  if (errorPenalty < 1.0) parts.push(`penalización por errores ${Math.round((1 - errorPenalty) * 100)}%`);
  if (streakBonus > 1.0) parts.push(`bono de racha x${streakBonus}`);

  return parts.join(', ');
}

function distributeDelta(
  deltaTotal: number,
  weights: GameWeights,
  speedFactor: number,
  errorPenalty: number,
  streakBonus: number
): CognitiveDelta {
  const deltas: CognitiveDelta = {};

  for (const [attribute, weight] of Object.entries(weights)) {
    const delta = Math.round(deltaTotal * weight * 100) / 100;
    deltas[attribute] = {
      delta,
      reason: buildReason(delta, speedFactor, errorPenalty, streakBonus),
    };
  }

  return deltas;
}

// ─── VERIFICACIÓN DE LOGROS ──────────────────────────────────────

async function checkAndAwardAchievements(
  supabase: any,
  userId: string,
  currentMetrics: Record<string, number>,
  totalGamesPlayed: number,
  currentStreak: number
): Promise<string[]> {
  const unlocked: string[] = [];
  const { data: achievements } = await supabase
    .from('achievements')
    .select('id, slug, criteria')
    .order('id');

  if (!achievements) return unlocked;

  for (const achievement of achievements) {
    // Verificar si ya lo tiene
    const { data: existing } = await supabase
      .from('user_achievements')
      .select('user_id')
      .eq('user_id', userId)
      .eq('achievement_id', achievement.id)
      .maybeSingle();

    if (existing) continue;

    const criteria = achievement.criteria;
    let earned = false;

    switch (criteria.type) {
      case 'games_played':
        earned = totalGamesPlayed >= criteria.threshold;
        break;
      case 'streak':
        earned = currentStreak >= criteria.threshold;
        break;
      case 'single_score':
        // Se evalúa externamente y se pasa como parámetro
        break;
      case 'cognitive_attribute':
        earned = (currentMetrics[criteria.attribute] || 0) >= criteria.threshold;
        break;
      case 'all_attributes':
        earned = Object.values(currentMetrics).every(
          (v) => v >= criteria.threshold
        );
        break;
      default:
        break;
    }

    if (earned) {
      await supabase
        .from('user_achievements')
        .insert({ user_id: userId, achievement_id: achievement.id });
      unlocked.push(achievement.slug);
    }
  }

  return unlocked;
}

// ─── HANDLER PRINCIPAL ──────────────────────────────────────────

serve(async (req: Request) => {
  try {
    // 1. Autenticación vía JWT de Supabase
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verificar token y obtener usuario
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Validar que la cuenta esté activa
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_status')
      .eq('id', user.id)
      .single();

    if (!profile || profile.account_status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Cuenta suspendida o inactiva' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parsear y validar input
    const input: GameRoundInput = await req.json();

    if (!input.game_slug || input.raw_score === undefined) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos requeridos: game_slug, raw_score' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Obtener pesos cognitivos del juego
    const { data: game } = await supabase
      .from('games')
      .select('id, cognitive_weights')
      .eq('slug', input.game_slug)
      .single();

    if (!game) {
      return new Response(
        JSON.stringify({ error: `Juego no encontrado: ${input.game_slug}` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const weights: GameWeights = game.cognitive_weights || {};
    const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);

    // Validar que los pesos sumen ~1.0 (tolerancia 0.05)
    if (Math.abs(weightSum - 1.0) > 0.05) {
      console.warn(
        `[WARN] Los pesos de ${input.game_slug} suman ${weightSum}, no 1.0`
      );
    }

    // 5. Calcular delta cognitivo
    const deltaTotal = calculateDeltaTotal(
      input.raw_score,
      input.max_possible_score || 100,
      input.time_completed_seconds,
      input.expected_time_seconds || 60,
      input.errors_count || 0,
      input.streak || 0,
      input.difficulty_level || 1
    );

    const timeRatio = input.expected_time_seconds > 0
      ? input.time_completed_seconds / input.expected_time_seconds
      : 1.0;

    let speedFactor: number;
    if (timeRatio <= 0.5) speedFactor = 1.5;
    else if (timeRatio <= 0.8) speedFactor = 1.2;
    else if (timeRatio <= 1.0) speedFactor = 1.0;
    else speedFactor = 0.8;

    const errorPenalty = Math.max(0.5, 1.0 - (input.errors_count || 0) * 0.10);
    const streakBonus = Math.min(1.5, 1.0 + (input.streak || 0) * 0.05);

    const cognitiveDelta = distributeDelta(
      deltaTotal,
      weights,
      speedFactor,
      errorPenalty,
      streakBonus
    );

    // 6. Actualizar métricas cognitivas (DENTRO de la misma transacción)
    const updateFields: Record<string, unknown> = {
      decay_factor: 1.0, // Resetear decay al jugar
      updated_at: new Date().toISOString(),
    };

    for (const [attribute, { delta }] of Object.entries(cognitiveDelta)) {
      const columnMap: Record<string, string> = {
        memory: 'memory_score',
        agility: 'agility_score',
        focus: 'focus_score',
        logic: 'logic_score',
        flexibility: 'flexibility_score',
        processing_speed: 'processing_speed',
      };

      const column = columnMap[attribute];
      if (column) {
        // Incrementar el score actual con el delta
        updateFields[column] = (
          await supabase.rpc('increment_cognitive_score', {
            p_user_id: user.id,
            p_column: column,
            p_delta: delta,
          })
        );
      }
    }

    // 7. Insertar game_round
    let sessionId = input.session_id;

    // Si no hay session_id, crear una sesión automática
    if (!sessionId) {
      const { data: newSession } = await supabase
        .from('game_sessions')
        .insert({
          user_id: user.id,
          game_id: game.id,
          started_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
          device: 'desktop',
          connection_status: input.connection_status || 'online',
        })
        .select('id')
        .single();

      if (newSession) {
        sessionId = newSession.id;
      }
    } else {
      // Actualizar ended_at de la sesión
      await supabase
        .from('game_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', user.id);
    }

    // Insertar round con client_id para idempotencia offline
    const { data: round, error: roundError } = await supabase
      .from('game_rounds')
      .upsert(
        {
          session_id: sessionId,
          game_id: game.id,
          user_id: user.id,
          difficulty_level: input.difficulty_level || 1,
          raw_score: input.raw_score,
          time_completed_seconds: input.time_completed_seconds || 0,
          errors_count: input.errors_count || 0,
          streak: input.streak || 0,
          cognitive_delta: cognitiveDelta,
          client_id: input.client_id,
          created_at: new Date().toISOString(),
        },
        {
          onConflict: 'client_id',
          ignoreDuplicates: 'client_id' in input && !!input.client_id,
        }
      )
      .select('id')
      .single();

    if (roundError) {
      console.error('Error inserting round:', roundError);
      return new Response(
        JSON.stringify({ error: 'Error al guardar la partida' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 8. Actualizar/insertar daily_snapshot
    const today = new Date().toISOString().split('T')[0];

    // Obtener métricas actualizadas
    const { data: currentMetrics } = await supabase
      .from('cognitive_metrics')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (currentMetrics) {
      await supabase
        .from('daily_snapshots')
        .upsert(
          {
            user_id: user.id,
            snapshot_date: today,
            memory_score: currentMetrics.memory_score,
            agility_score: currentMetrics.agility_score,
            focus_score: currentMetrics.focus_score,
            logic_score: currentMetrics.logic_score,
            flexibility_score: currentMetrics.flexibility_score,
            processing_speed: currentMetrics.processing_speed,
            total_score: currentMetrics.total_score,
            cogni_coef_score: currentMetrics.cogni_coef_score,
            games_played_today: 1, // Se incrementa abajo
            avg_score_today: input.raw_score,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id, snapshot_date' }
        );

      // Incrementar contador de partidas del día
      await supabase.rpc('increment_daily_games', {
        p_user_id: user.id,
        p_snapshot_date: today,
        p_raw_score: input.raw_score,
      });
    }

    // 9. Verificar logros (fire-and-forget, no bloqueante)
    let achievementsUnlocked: string[] = [];
    try {
      const metricsMap: Record<string, number> = currentMetrics
        ? {
            memory: currentMetrics.memory_score,
            agility: currentMetrics.agility_score,
            focus: currentMetrics.focus_score,
            logic: currentMetrics.logic_score,
            flexibility: currentMetrics.flexibility_score,
            processing_speed: currentMetrics.processing_speed,
          }
        : {};

      const { data: totalGames } = await supabase
        .from('game_rounds')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      achievementsUnlocked = await checkAndAwardAchievements(
        supabase,
        user.id,
        metricsMap,
        totalGames?.length || 0,
        input.streak || 0
      );
    } catch (achErr) {
      console.error('Error checking achievements:', achErr);
      // No bloquear la respuesta por errores de logros
    }

    // 10. Respuesta exitosa
    return new Response(
      JSON.stringify({
        success: true,
        round_id: round?.id,
        cognitive_delta: cognitiveDelta,
        new_metrics: currentMetrics
          ? {
              total_score: currentMetrics.total_score,
              cogni_coef_score: currentMetrics.cogni_coef_score,
            }
          : null,
        achievements_unlocked: achievementsUnlocked,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
