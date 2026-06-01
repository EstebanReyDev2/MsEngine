// 📂 /hooks/useCognitiveMetrics.ts
// Hook unificado para obtener métricas cognitivas desde Supabase
// Usa daily_snapshots para evolución y cognitive_metrics para estado actual

'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface CognitiveMetrics {
  memory_score: number;
  agility_score: number;
  focus_score: number;
  logic_score: number;
  flexibility_score: number;
  processing_speed: number;
  total_score: number;
  cogni_coef_score: number;
  decay_factor: number;
  updated_at: string;
}

export interface DailySnapshot {
  snapshot_date: string;
  memory_score: number;
  agility_score: number;
  focus_score: number;
  logic_score: number;
  flexibility_score: number;
  processing_speed: number;
  total_score: number;
  cogni_coef_score: number;
  games_played_today: number;
  avg_score_today: number | null;
}

export interface UserTierInfo {
  tier: string;
  total_score_at_assignment: number;
  assigned_at: string;
}

export interface TodayStats {
  games_played: number;
  avg_score: number | null;
}

export interface UseCognitiveMetricsReturn {
  currentMetrics: CognitiveMetrics | null;
  snapshots: DailySnapshot[];
  currentTier: UserTierInfo | null;
  todayStats: TodayStats | null;
  streak: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY_METRICS: CognitiveMetrics = {
  memory_score: 50,
  agility_score: 50,
  focus_score: 50,
  logic_score: 50,
  flexibility_score: 50,
  processing_speed: 50,
  total_score: 50,
  cogni_coef_score: 50,
  decay_factor: 1.0,
  updated_at: new Date().toISOString(),
};

export function useCognitiveMetrics(userId: string | undefined | null): UseCognitiveMetricsReturn {
  const [currentMetrics, setCurrentMetrics] = useState<CognitiveMetrics | null>(null);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [currentTier, setCurrentTier] = useState<UserTierInfo | null>(null);
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);
  const [streak, setStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Calcular racha desde snapshots ──
  const computeStreak = useCallback((snapshotsList: DailySnapshot[]): number => {
    if (snapshotsList.length === 0) return 0;

    const today = new Date().toISOString().split('T')[0];
    let count = 0;

    // Ir hacia atrás día por día contando actividad
    for (let i = snapshotsList.length - 1; i >= 0; i--) {
      const snap = snapshotsList[i];
      if (snap.games_played_today > 0) {
        count++;
      } else if (snap.snapshot_date !== today) {
        // Si encontramos un día sin actividad que NO es hoy, la racha se corta
        break;
      }
      // Si es hoy y no tiene actividad, no cortamos — quizás juega más tarde
    }

    return count;
  }, []);

  const fetchData = useCallback(async () => {
    // Si es invitado local (prefijo guest_) o UUID inválido, no consultar Supabase
    const isGuestUser = !userId || userId.startsWith('guest_');
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || '');

    if (isGuestUser || !isValidUUID) {
      setCurrentMetrics(EMPTY_METRICS);
      setSnapshots([]);
      setCurrentTier(null);
      setTodayStats(null);
      setStreak(0);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const supabase = createClient();

      if (!supabase) {
        console.warn('useCognitiveMetrics: Supabase client not available (env vars missing)');
        setCurrentMetrics(EMPTY_METRICS);
        setSnapshots([]);
        setIsLoading(false);
        return;
      }

      // 1. Obtener métricas actuales
      const { data: metrics, error: metricsErr } = await supabase
        .from('cognitive_metrics')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (metricsErr && metricsErr.code !== 'PGRST116') {
        console.warn('Error fetching cognitive_metrics:', metricsErr);
      }

      setCurrentMetrics(metrics || {
        ...EMPTY_METRICS,
        user_id: userId,
      });

      // 2. Obtener daily_snapshots (últimos 30 días para evolución)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: snapshotData, error: snapErr } = await supabase
        .from('daily_snapshots')
        .select('*')
        .eq('user_id', userId)
        .gte('snapshot_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('snapshot_date', { ascending: true });

      if (snapErr && snapErr.code !== 'PGRST116') {
        console.warn('Error fetching daily_snapshots:', snapErr);
      }

      const snapshotsList = (snapshotData as DailySnapshot[]) || [];
      setSnapshots(snapshotsList);
      setStreak(computeStreak(snapshotsList));

      // 3. Obtener último tier
      const { data: tierData, error: tierErr } = await supabase
        .from('user_tier_history')
        .select('tier, total_score_at_assignment, assigned_at')
        .eq('user_id', userId)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tierErr) {
        console.warn('Error fetching tier:', tierErr);
      }

      setCurrentTier(tierData as UserTierInfo | null);

      // 4. Obtener stats de hoy
      const today = new Date().toISOString().split('T')[0];
      const { data: todaySnap, error: todayErr } = await supabase
        .from('daily_snapshots')
        .select('games_played_today, avg_score_today')
        .eq('user_id', userId)
        .eq('snapshot_date', today)
        .maybeSingle();

      if (todayErr) {
        console.warn('Error fetching today:', todayErr);
      }

      setTodayStats(todaySnap as TodayStats | null || { games_played: 0, avg_score: null });

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('useCognitiveMetrics error:', err);
      setError(msg);
      setCurrentMetrics(EMPTY_METRICS);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    currentMetrics,
    snapshots,
    currentTier,
    todayStats,
    streak,
    isLoading,
    error,
    refresh: fetchData,
  };
}
