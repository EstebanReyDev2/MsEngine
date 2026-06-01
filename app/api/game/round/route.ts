// 📂 /app/api/game/round/route.ts
// POST /api/game/round — Save a completed game round
// Integra con cognitive_weights, calcula delta, actualiza métricas + daily_snapshots
// Soporta offline-sync via client_id (idempotente)

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGameSlug } from '@/lib/gameUtils';

// ─── ALGORITMO DE CÁLCULO COGNITIVO ───────────────────────────

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
  const baseContribution = maxPossibleScore > 0
    ? (rawScore / maxPossibleScore) * 100
    : 0;

  const timeRatio = expectedTimeSeconds > 0
    ? timeCompletedSeconds / expectedTimeSeconds
    : 1.0;

  let speedFactor: number;
  if (timeRatio <= 0.5) speedFactor = 1.5;
  else if (timeRatio <= 0.8) speedFactor = 1.2;
  else if (timeRatio <= 1.0) speedFactor = 1.0;
  else speedFactor = 0.8;

  const errorPenalty = Math.max(0.5, 1.0 - errorsCount * 0.10);
  const streakBonus = Math.min(1.5, 1.0 + streak * 0.05);
  const difficultyMultiplier = 0.8 + difficultyLevel * 0.15;

  const deltaTotal = baseContribution
    * speedFactor
    * errorPenalty
    * streakBonus
    * difficultyMultiplier;

  return clamp(Math.round(deltaTotal * 100) / 100, -5, 15);
}

function buildReason(speedFactor: number, errorPenalty: number, streakBonus: number): string {
  const parts: string[] = [];
  if (speedFactor > 1.0) parts.push(`bono velocidad x${speedFactor}`);
  if (errorPenalty < 1.0) parts.push(`penalización errores ${Math.round((1 - errorPenalty) * 100)}%`);
  if (streakBonus > 1.0) parts.push(`bono racha x${streakBonus}`);
  return parts.join(', ') || 'rendimiento estándar';
}

function distributeDelta(
  deltaTotal: number,
  weights: Record<string, number>,
  speedFactor: number,
  errorPenalty: number,
  streakBonus: number
): Record<string, { delta: number; reason: string }> {
  const result: Record<string, { delta: number; reason: string }> = {};
  for (const [attribute, weight] of Object.entries(weights)) {
    result[attribute] = {
      delta: Math.round(deltaTotal * weight * 100) / 100,
      reason: buildReason(speedFactor, errorPenalty, streakBonus),
    };
  }
  return result;
}

// Columnas de la tabla cognitive_metrics para cada atributo
const ATTRIBUTE_COLUMNS: Record<string, string> = {
  memory: 'memory_score',
  agility: 'agility_score',
  focus: 'focus_score',
  logic: 'logic_score',
  flexibility: 'flexibility_score',
  processing_speed: 'processing_speed',
};

// ─── HANDLER ───────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // 2. Verificar que la cuenta esté activa
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_status')
      .eq('id', user.id)
      .single();

    if (profile && profile.account_status !== 'active') {
      return NextResponse.json({ error: 'Cuenta suspendida' }, { status: 403 });
    }

    // 3. Parsear body
    const body = await request.json();
    const {
      gameName,
      raw_score,
      score,           // alias para compatibilidad con juegos existentes
      max_possible_score = 100,
      time_completed_seconds = 0,
      expected_time_seconds = 60,
      errors_count = 0,
      streak = 0,
      difficulty_level = 1,
      session_id,
      client_id,
      connection_status = 'online',
    } = body;

    const finalScore = raw_score ?? score;
    if (!gameName || typeof finalScore !== 'number') {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: gameName, score' },
        { status: 400 }
      );
    }

    // 4. Obtener game_id y cognitive_weights del catálogo
    const slug = getGameSlug(gameName);
    if (!slug) {
      return NextResponse.json({ error: `Juego desconocido: ${gameName}` }, { status: 400 });
    }

    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, cognitive_weights')
      .eq('slug', slug)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: `Juego no encontrado: ${slug}` }, { status: 404 });
    }

    const weights: Record<string, number> = (game.cognitive_weights as Record<string, number>) || {};

    // 5. Calcular delta cognitivo
    const deltaTotal = calculateDeltaTotal(
      finalScore,
      max_possible_score,
      time_completed_seconds,
      expected_time_seconds,
      errors_count,
      streak,
      difficulty_level
    );

    const timeRatio = expected_time_seconds > 0
      ? time_completed_seconds / expected_time_seconds
      : 1.0;

    let speedFactor: number;
    if (timeRatio <= 0.5) speedFactor = 1.5;
    else if (timeRatio <= 0.8) speedFactor = 1.2;
    else if (timeRatio <= 1.0) speedFactor = 1.0;
    else speedFactor = 0.8;

    const errorPenalty = Math.max(0.5, 1.0 - errors_count * 0.10);
    const streakBonus = Math.min(1.5, 1.0 + streak * 0.05);

    const cognitiveDelta = distributeDelta(
      deltaTotal, weights, speedFactor, errorPenalty, streakBonus
    );

    // 6. Actualizar métricas cognitivas (una query por atributo)
    for (const [attribute, { delta }] of Object.entries(cognitiveDelta)) {
      const column = ATTRIBUTE_COLUMNS[attribute];
      if (column) {
        // Actualizar con clamp 0-100 usando raw SQL vía rpc (o fallback a query directa)
        const { error: updateError } = await supabase.rpc('increment_cognitive_score', {
          p_user_id: user.id,
          p_column: column,
          p_delta: Math.round(delta),
        });

        if (updateError) {
          // Fallback: update directo
          await supabase.from('cognitive_metrics').update({
            [column]: supabase.rpc('clamp_score', {
              p_user_id: user.id,
              p_column: column,
              p_delta: Math.round(delta),
            }),
          }).eq('user_id', user.id);
        }
      }
    }

    // 7. Manejar sesión (crear o actualizar)
    let activeSessionId = session_id;
    if (!activeSessionId) {
      const { data: newSession } = await supabase
        .from('game_sessions')
        .insert({
          user_id: user.id,
          game_id: game.id,
          started_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
          device: 'desktop',
          connection_status,
        })
        .select('id')
        .single();
      activeSessionId = newSession?.id;
    } else {
      // Actualizar ended_at de la sesión existente
      await supabase
        .from('game_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', activeSessionId)
        .eq('user_id', user.id);
    }

    // 8. Insertar game_round (con client_id para idempotencia offline)
    // Usamos tabla auxiliar game_round_client_ids porque las UNIQUE
    // constraints en tablas particionadas requieren el partition key.
    const now = new Date().toISOString();

    // Si viene client_id, verificar duplicado primero
    if (client_id) {
      const { data: existing } = await supabase
        .from('game_round_client_ids')
        .select('round_id')
        .eq('client_id', client_id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          round_id: existing.round_id,
          message: 'Partida ya registrada (idempotencia offline)',
        });
      }
    }

    const roundPayload: Record<string, unknown> = {
      session_id: activeSessionId,
      game_id: game.id,
      user_id: user.id,
      difficulty_level: Math.max(1, Math.min(5, difficulty_level)),
      raw_score: finalScore,
      time_completed_seconds,
      errors_count,
      streak,
      cognitive_delta: cognitiveDelta,
      created_at: now,
    };

    if (client_id) {
      roundPayload.client_id = client_id;
    }

    const { data: round, error: roundError } = await supabase
      .from('game_rounds')
      .insert(roundPayload)
      .select('id')
      .single();

    if (roundError) {
      // Si es error de unique en client_id (por race condition) → ok
      if (roundError.message?.includes('client_id') && client_id) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          message: 'Partida ya registrada (race condition)',
        });
      }
      return NextResponse.json(
        { error: 'Error al guardar ronda: ' + roundError.message },
        { status: 500 }
      );
    }

    // Registrar client_id en la tabla auxiliar
    if (client_id && round?.id) {
      await supabase
        .from('game_round_client_ids')
        .insert({
          client_id,
          round_id: round.id,
          created_at: now,
        });
    }

    // 9. Actualizar/insertar daily_snapshot
    const today = new Date().toISOString().split('T')[0];

    const { data: currentMetrics } = await supabase
      .from('cognitive_metrics')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (currentMetrics) {
      const { error: upsertError } = await supabase
        .from('daily_snapshots')
        .upsert({
          user_id: user.id,
          snapshot_date: today,
          memory_score: currentMetrics.memory_score,
          agility_score: currentMetrics.agility_score,
          focus_score: currentMetrics.focus_score,
          logic_score: currentMetrics.logic_score,
          flexibility_score: currentMetrics.flexibility_score,
          processing_speed: currentMetrics.processing_speed,
          total_score: currentMetrics.total_score,
          cogni_coef_score: currentMetrics.cogni_coef_score ?? currentMetrics.total_score,
          games_played_today: 1,
          avg_score_today: finalScore,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id, snapshot_date' });

      if (!upsertError) {
        // Incrementar contadores en el snapshot existente (fire-and-forget)
        try {
          await supabase.rpc('increment_daily_games', {
            p_user_id: user.id,
            p_snapshot_date: today,
            p_raw_score: finalScore,
          });
        } catch {
          // Fire-and-forget — no bloquea la respuesta
        }
      }
    }

    // 10. Verificar logros (fire-and-forget)
    const metricsMap: Record<string, number> = currentMetrics ? {
      memory: currentMetrics.memory_score,
      agility: currentMetrics.agility_score,
      focus: currentMetrics.focus_score,
      logic: currentMetrics.logic_score,
      flexibility: currentMetrics.flexibility_score,
      processing_speed: currentMetrics.processing_speed,
    } : {};

    const { count: totalGames } = await supabase
      .from('game_rounds')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const unlockedAchievements: string[] = [];
    const { data: achievements } = await supabase
      .from('achievements')
      .select('id, slug, criteria')
      .order('id');

    if (achievements) {
      for (const ach of achievements) {
        const criteria = ach.criteria as Record<string, unknown>;
        if (!criteria || typeof criteria.type !== 'string') continue;

        const { data: existing } = await supabase
          .from('user_achievements')
          .select('user_id')
          .eq('user_id', user.id)
          .eq('achievement_id', ach.id)
          .maybeSingle();

        if (existing) continue;

        let earned = false;
        switch (criteria.type) {
          case 'games_played':
            earned = (totalGames ?? 0) >= (criteria.threshold as number);
            break;
          case 'streak':
            earned = streak >= (criteria.threshold as number);
            break;
          case 'cognitive_attribute':
            earned = (metricsMap[criteria.attribute as string] ?? 0) >= (criteria.threshold as number);
            break;
          case 'all_attributes':
            earned = Object.values(metricsMap).length > 0 &&
              Object.values(metricsMap).every(v => v >= (criteria.threshold as number));
            break;
          case 'daily_streak':
          case 'distinct_games':
          case 'single_score':
            // Estos requieren lógica más compleja → futuro
            break;
        }

        if (earned) {
          await supabase
            .from('user_achievements')
            .insert({ user_id: user.id, achievement_id: ach.id });
          unlockedAchievements.push(ach.slug);
        }
      }
    }

    // 11. Respuesta
    return NextResponse.json({
      success: true,
      round_id: round?.id,
      session_id: activeSessionId,
      cognitive_delta: cognitiveDelta,
      achievements_unlocked: unlockedAchievements,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('Error saving game round:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + message },
      { status: 500 }
    );
  }
}
