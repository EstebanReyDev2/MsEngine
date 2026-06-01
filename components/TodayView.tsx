// 📂 /components/TodayView.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useCognitiveMetrics } from '@/hooks/useCognitiveMetrics';
import { getGameScores } from '@/lib/gameScoreService';
import { Flame, Brain, CheckCircle2, ArrowRight, Sparkles, Trophy, Activity } from 'lucide-react';

interface TodayViewProps {
  currentUser: any;
  onStartGame: () => void;
  onNavigate: (tab: 'today' | 'insights' | 'practice' | 'profile') => void;
}

const TIER_LABELS: Record<string, string> = {
  unranked: 'Sin Clasificar',
  bronze: 'Bronce Cognitivo',
  silver: 'Plata Neural',
  gold: 'Oro Sináptico',
  diamond: 'Diamante Mental',
};

export default function TodayView({ currentUser, onStartGame, onNavigate }: TodayViewProps) {
  const {
    currentMetrics,
    currentTier,
    todayStats,
    streak,
    isLoading,
  } = useCognitiveMetrics(currentUser?.id);

  const [tasks, setTasks] = useState([
    { id: 1, label: 'Completar 1 sesión de entrenamiento', done: false },
    { id: 2, label: 'Verificar espectro cognitivo', done: false },
    { id: 3, label: 'Sincronizar huella mental', done: true },
  ]);
  const [aiAffirmation, setAiAffirmation] = useState('Cada conexión se fortalece con el silencio del pensamiento.');
  const [loadingAffirmation, setLoadingAffirmation] = useState(false);

  // Marcar tarea 1 como completada si ya jugó hoy
  useEffect(() => {
    if (todayStats && todayStats.games_played > 0) {
      setTasks(prev => prev.map(t => t.id === 1 ? { ...t, done: true } : t));
    }
  }, [todayStats]);

  const fetchAffirmation = async () => {
    setLoadingAffirmation(true);
    try {
      const userScores = getGameScores(currentUser?.id);
      const res = await fetch('/app/api/gemini/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores: userScores,
          streak,
          rank: currentTier?.tier
            ? (TIER_LABELS[currentTier.tier] || currentTier.tier)
            : (currentUser?.cerebra_rank || 'Iniciado del Templo'),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.afirmacionDelDia) {
          setAiAffirmation(data.afirmacionDelDia);
        }
      }
    } catch {
      // Fallback stays
    } finally {
      setLoadingAffirmation(false);
    }
  };

  // Cargar afirmación al montar
  useEffect(() => {
    fetchAffirmation();
  }, []);

  const completedCount = tasks.filter(t => t.done).length;
  const tierName = currentTier
    ? TIER_LABELS[currentTier.tier] || currentTier.tier
    : (currentUser?.cerebra_rank || 'Iniciado del Templo');
  const totalScore = currentMetrics?.cogni_coef_score ?? currentMetrics?.total_score ?? 0;
  const gamesToday = todayStats?.games_played ?? 0;

  return (
    <div className="animate-fade-in space-y-8 max-w-[1120px] mx-auto pb-12">

      {/* 👋 Hero Greeting */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#1A1A1A] pb-8">
        <div>
          <span className="inline-block px-3 py-1 rounded-none border border-[#1A1A1A] bg-white/40 text-[#1A1A1A] text-[9px] font-bold uppercase tracking-widest">
            SANTUARIO ACTIVO // V1.0
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-[#1A1A1A] mt-3 tracking-tight uppercase">
            HOLA, {currentUser?.displayName || currentUser?.username || 'Invitado'}
          </h1>
          <p className="font-serif italic text-sm text-[#1A1A1A]/70 mt-2 max-w-xl">
            {isLoading ? 'Cargando perfil cognitivo...' : (
              <>
                Rango: <span className="text-[#1A1A1A] font-bold not-italic font-sans">{tierName}</span>.
                Score cognitivo: <span className="text-[#1A1A1A] font-bold not-italic font-sans">{totalScore}/100</span>.
                Partidas hoy: <span className="text-[#1A1A1A] font-bold not-italic font-sans">{gamesToday}</span>.
              </>
            )}
          </p>
        </div>

        {/* ⚡ Streak + Score pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-white/30 border border-[#1A1A1A] rounded-none px-5 py-3 h-fit">
            <div className="w-10 h-10 rounded-none bg-[#FF5028] flex items-center justify-center text-white border border-[#1A1A1A]">
              <Flame size={20} fill="currentColor" strokeWidth={1} />
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A]/60 block font-sans">Racha Diaria</span>
              <span className="text-xl font-bold text-[#1A1A1A] block leading-none mt-1 font-mono">{streak} {streak === 1 ? 'DÍA' : 'DÍAS'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/30 border border-[#1A1A1A] rounded-none px-5 py-3 h-fit">
            <div className="w-10 h-10 rounded-none bg-[#1A1A1A] flex items-center justify-center text-white border border-[#1A1A1A]">
              <Activity size={20} />
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A]/60 block font-sans">Score</span>
              <span className="text-xl font-bold text-[#1A1A1A] block leading-none mt-1 font-mono">{totalScore}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 📋 Daily Routine */}
        <div className="lg:col-span-7 bg-white/30 rounded-none border border-[#1A1A1A] p-8 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-black text-[#1A1A1A] uppercase tracking-wider">Rutina Focalizada</h2>
                <div className="font-serif italic text-xs text-[#1A1A1A]/60 mt-0.5">Completa tus desafíos diarios para aumentar tu rango cerebral</div>
              </div>
              <span className="text-xs font-mono text-white font-bold bg-[#1A1A1A] px-2.5 py-1 rounded-none border border-[#1A1A1A]">
                {completedCount}/3 OK
              </span>
            </div>

            <div className="space-y-4">
              {tasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t))}
                  className={`flex items-center justify-between p-4 rounded-none border transition-all cursor-pointer ${task.done ? 'bg-white/10 border-[#1A1A1A]/40 opacity-70' : 'bg-white/50 border-[#1A1A1A] hover:bg-white/80'}`}
                >
                  <div className="flex items-center gap-3">
                    <button className={`w-5 h-5 rounded-none flex items-center justify-center transition-all ${task.done ? 'bg-[#FF5028] text-white border border-[#1A1A1A]' : 'border border-[#1A1A1A] hover:border-[#FF5028] bg-white/45'}`}>
                      {task.done && <CheckCircle2 size={13} strokeWidth={3} />}
                    </button>
                    <span className={`text-xs text-[#1A1A1A] font-bold ${task.done ? 'line-through text-[#1A1A1A]/50' : ''}`}>
                      {task.label}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-[#1A1A1A]/60">Aptitud</span>
                </div>
              ))}
            </div>

            {/* Mini radar de métricas actuales */}
            {currentMetrics && (
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { label: 'Memoria', value: currentMetrics.memory_score },
                  { label: 'Enfoque', value: currentMetrics.focus_score },
                  { label: 'Agilidad', value: currentMetrics.agility_score },
                  { label: 'Lógica', value: currentMetrics.logic_score },
                  { label: 'Flexibilidad', value: currentMetrics.flexibility_score },
                  { label: 'Velocidad', value: currentMetrics.processing_speed },
                ].map(attr => (
                  <div key={attr.label} className="bg-white/40 border border-[#1A1A1A]/30 p-2 text-center">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-[#1A1A1A]/60 block">{attr.label}</span>
                    <span className="text-xs font-black text-[#1A1A1A]">{attr.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-[#1A1A1A]/15 flex flex-col sm:flex-row justify-between items-center gap-4">
            {todayStats && todayStats.avg_score ? (
              <span className="font-serif italic text-xs text-[#1A1A1A]/60">
                Promedio de hoy: <strong>{Math.round(todayStats.avg_score)} pts</strong>
              </span>
            ) : (
              <span className="font-serif italic text-xs text-[#1A1A1A]/60">
                {currentTier
                  ? `Siguiente rango: ${currentTier.tier === 'diamond' ? '★ MAESTRO ABSOLUTO ★' : 'Sigue entrenando para subir de tier'}`
                  : 'Sin datos de tier aún'}
              </span>
            )}
            <button
              onClick={onStartGame}
              className="px-6 py-3 bg-[#FF5028] text-white rounded-none border border-[#1A1A1A] hover:bg-[#1A1A1A] transition-all font-bold text-xs flex items-center gap-2 group cursor-pointer uppercase tracking-wider"
            >
              <span>Comenzar Práctica</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* 🧘 AI Affirmation + Quick Stats */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white/30 rounded-none border border-[#1A1A1A] p-8 flex-grow flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
              <Sparkles size={120} />
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-[#FF5028]" />
                <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#FF5028]">AFIRMACIÓN DEL DÍA (AI)</span>
              </div>

              <blockquote className="text-base text-[#1A1A1A] tracking-tight italic font-serif leading-relaxed">
                &ldquo;{aiAffirmation}&rdquo;
              </blockquote>
            </div>

            <div className="mt-8 relative z-10 flex justify-between items-center">
              <span className="text-[10px] text-[#1A1A1A]/60 uppercase tracking-widest block font-bold font-mono">{"// BROADCAST"}</span>
              <button
                onClick={fetchAffirmation}
                disabled={loadingAffirmation}
                className="text-xs text-[#FF5028] font-bold hover:underline cursor-pointer disabled:opacity-50 uppercase tracking-wider"
              >
                {loadingAffirmation ? 'Sincronizando...' : 'Actualizar'}
              </button>
            </div>
          </div>

          {/* Tier Progress + Stats */}
          <div className="bg-white/30 border border-[#1A1A1A] rounded-none p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-none bg-[#1A1A1A] flex items-center justify-center text-white border border-[#1A1A1A]">
                  <Trophy size={20} />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#1A1A1A] block">{tierName}</span>
                  <span className="text-[10px] text-[#1A1A1A]/60 block mt-0.5 font-serif italic">
                    {currentTier
                      ? `Score: ${totalScore}/100`
                      : 'Sin datos de tier'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onNavigate('insights')}
                className="text-[#1A1A1A] hover:text-[#FF5028] transition-colors cursor-pointer"
              >
                <ArrowRight size={18} />
              </button>
            </div>

            {/* Barra de progreso al siguiente tier */}
            {currentTier && (
              <div className="pt-2">
                <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A]/60 mb-1">
                  <span>Progreso al siguiente rango</span>
                  <span>{totalScore}/100</span>
                </div>
                <div className="w-full h-2 bg-white/40 border border-[#1A1A1A]/30 rounded-none overflow-hidden">
                  <div
                    className="h-full bg-[#1A1A1A] transition-all duration-700"
                    style={{ width: `${Math.min(100, totalScore)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[8px] font-mono text-[#1A1A1A]/40 mt-1">
                  <span>Bronce (25)</span>
                  <span>Plata (45)</span>
                  <span>Oro (65)</span>
                  <span>Diamante (85)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
