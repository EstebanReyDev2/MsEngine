// 📂 /app/api/game/round/route.ts
// POST /api/game/round — Save a completed game round to Supabase
// Creates a game_session + game_round + updates cognitive_metrics

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGameSlug } from '@/lib/gameUtils';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // 2. Parse body
    const body = await request.json();
    const { gameName, score, level } = body as {
      gameName: string;
      score: number;
      level: number;
    };

    if (!gameName || typeof score !== 'number') {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: gameName, score' },
        { status: 400 }
      );
    }

    // 3. Look up game_id from catalog
    const slug = getGameSlug(gameName);
    if (!slug) {
      return NextResponse.json(
        { error: `Juego desconocido: ${gameName}` },
        { status: 400 }
      );
    }

    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id')
      .eq('slug', slug)
      .single();

    if (gameError || !game) {
      return NextResponse.json(
        { error: `Juego no encontrado en catálogo: ${slug}` },
        { status: 404 }
      );
    }

    // 4. Create a game_session
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .insert({
        user_id: user.id,
        game_id: game.id,
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        device: 'desktop', // Could detect from user-agent
        connection_status: 'online',
      })
      .select('id')
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Error al crear sesión: ' + sessionError?.message },
        { status: 500 }
      );
    }

    // 5. Insert game_round
    const { data: round, error: roundError } = await supabase
      .from('game_rounds')
      .insert({
        session_id: session.id,
        game_id: game.id,
        user_id: user.id,
        difficulty_level: Math.max(1, Math.min(5, Math.ceil(level / 2))),
        raw_score: score,
        streak: 1,
        cognitive_delta: {},
      })
      .select('id')
      .single();

    if (roundError) {
      return NextResponse.json(
        { error: 'Error al guardar ronda: ' + roundError.message },
        { status: 500 }
      );
    }

    // 6. Update cognitive_metrics — increment total_score/games_played
    // First try via RPC (if created)
    const { error: rpcError } = await supabase.rpc(
      'upsert_game_metrics',
      { p_user_id: user.id, p_score: score }
    );

    if (rpcError?.message?.includes('function "upsert_game_metrics" does not exist')) {
      // Fallback: direct upsert
      const { data: existing } = await supabase
        .from('cognitive_metrics')
        .select('user_id')
        .eq('user_id', user.id)
        .single();

      if (!existing) {
        // Row should already exist from the on_auth_user_created trigger
        // If not, insert it
        await supabase.from('cognitive_metrics').insert({
          user_id: user.id,
          memory_score: 50,
          agility_score: 50,
          focus_score: 50,
          logic_score: 50,
          flexibility_score: 50,
          processing_speed: 50,
        });
      }
    }

    return NextResponse.json({
      success: true,
      round_id: round?.id,
      session_id: session.id,
    });
  } catch (err: any) {
    console.error('Error saving game round:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
