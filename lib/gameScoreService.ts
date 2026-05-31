// 📂 /lib/gameScoreService.ts
// Unified game score persistence:
//   Authenticated users → POST /api/game/round (Supabase)
//   Guest users → localStorage (mock supabaseClient)

import { supabaseClient } from './supabaseClient';

export interface SaveScoreResult {
  success: boolean;
  source: 'supabase' | 'localstorage';
  round_id?: string;
  error?: string;
}

/**
 * Save a game score.
 * - If userId looks like a real Supabase UUID → send to API
 * - If guest (prefix 'guest_' or falsy) → save to localStorage
 *
 * @param userId  The current user's ID
 * @param gameName  Display name (e.g. "Neural Horizon")
 * @param score  The final score
 * @param level  Level reached
 */
export async function saveGameScore(
  userId: string | undefined | null,
  gameName: string,
  score: number,
  level: number
): Promise<SaveScoreResult> {
  // Guard: no user → silently ignore
  if (!userId) {
    return { success: false, source: 'localstorage', error: 'No user' };
  }

  // Guest user → localStorage
  if (userId.startsWith('guest_')) {
    try {
      supabaseClient.db.saveScore(userId, gameName, score, level);
      return { success: true, source: 'localstorage' };
    } catch (err: any) {
      return { success: false, source: 'localstorage', error: err.message };
    }
  }

  // Authenticated user → send to API
  try {
    const res = await fetch('/api/game/round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameName, score, level }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Error de red' }));
      // Fallback to localStorage if API fails
      supabaseClient.db.saveScore(userId, gameName, score, level);
      return {
        success: true,
        source: 'localstorage',
        error: `API error (${res.status}), saved locally: ${errData.error}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      source: 'supabase',
      round_id: data.round_id,
    };
  } catch (err: any) {
    // Network error → fallback to localStorage
    supabaseClient.db.saveScore(userId, gameName, score, level);
    return {
      success: true,
      source: 'localstorage',
      error: `Network error, saved locally: ${err.message}`,
    };
  }
}

/**
 * Get scores for a user (always from localStorage for now).
 * Eventually this will also fetch from Supabase.
 */
export function getGameScores(userId: string | undefined | null) {
  if (!userId) return [];
  return supabaseClient.db.getScores(userId);
}

/**
 * Get streak for a user (always from localStorage for now).
 */
export function getGameStreak(userId: string | undefined | null) {
  if (!userId) return { current_streak: 0 };
  return supabaseClient.db.getStreak(userId);
}
