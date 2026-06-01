// 📂 /components/InsightsView.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useCognitiveMetrics, DailySnapshot } from '@/hooks/useCognitiveMetrics';
import { motion } from 'motion/react';
import { Brain, Sparkles, TrendingUp, Trophy, Activity, Award } from 'lucide-react';

interface InsightsViewProps {
  currentUser: any;
}

const ATTRIBUTE_CONFIG = [
  { key: 'memory_score', label: 'Memoria', color: '#FF5028' },
  { key: 'agility_score', label: 'Agilidad', color: '#1A1A1A' },
  { key: 'focus_score', label: 'Enfoque', color: '#555555' },
  { key: 'logic_score', label: 'Lógica', color: '#888888' },
  { key: 'flexibility_score', label: 'Flexibilidad', color: '#AAAAAA' },
  { key: 'processing_speed', label: 'Velocidad', color: '#CCCCCC' },
] as const;

const TIER_LABELS: Record<string, string> = {
  unranked: 'Sin Clasificar',
  bronze: 'Bronce Cognitivo',
  silver: 'Plata Neural',
  gold: 'Oro Sináptico',
  diamond: 'Diamante Mental',
};

function Sparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = Math.max(data.length * 12, 80);

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });

  // Smooth curve via quadratic bezier
  const pathD = points
    .map((p, i) => {
      if (i === 0) return `M ${p}`;
      const prev = points[i - 1].split(',');
      const curr = p.split(',');
      const cx1 = (parseFloat(prev[0]) + parseFloat(curr[0])) / 2;
      return `Q ${cx1},${prev[1]} ${curr[0]},${curr[1]}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} />
      {/* Dot at latest */}
      <circle cx={points[points.length - 1].split(',')[0]} cy={points[points.length - 1].split(',')[1]} r={3} fill={color} />
    </svg>
  );
}

export default function InsightsView({ currentUser }: InsightsViewProps) {
  const {
    currentMetrics,
    snapshots,
    currentTier,
    isLoading,
    error,
  } = useCognitiveMetrics(currentUser?.id);

  const [aiReport, setAiReport] = useState<{ agilidadSummary: string; ejercicioRecomendado: string } | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [selectedAttr, setSelectedAttr] = useState<string | null>(null);

  const fetchBrainReport = useMemo(() => async () => {
    setLoadingReport(true);
    try {
      const res = await fetch('/app/api/gemini/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: currentMetrics,
          snapshots: snapshots.slice(-7),
          tier: currentTier?.tier || 'unranked',
          rank: currentUser?.cerebra_rank || 'Iniciado del Templo',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiReport({
          agilidadSummary: data.agilidadSummary,
          ejercicioRecomendado: data.ejercicioRecomendado,
        });
      }
    } catch {
      // Fallback
    } finally {
      setLoadingReport(false);
    }
  }, [currentMetrics, snapshots, currentTier, currentUser]);

  useEffect(() => {
    const t = setTimeout(fetchBrainReport, 300);
    return () => clearTimeout(t);
  }, [fetchBrainReport]);

  // Agrupar snapshots para el gráfico de evolución
  const evolutionData = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return null;

    // Tomar máximo 14 snapshots (últimos 14 días)
    const recent = snapshots.slice(-14);
    const labels = recent.map(s => {
      const d = new Date(s.snapshot_date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });

    const series = ATTRIBUTE_CONFIG.map(attr => ({
      ...attr,
      data: recent.map(s => (s as any)[attr.key] as number),
    }));

    return { labels, series };
  }, [snapshots]);

  // Determinar atributo más fuerte y más débil
  const highlights = useMemo(() => {
    if (!currentMetrics) return null;
    const entries = ATTRIBUTE_CONFIG.map(a => ({
      label: a.label,
      key: a.key,
      value: (currentMetrics as any)[a.key] as number,
    }));
    const sorted = [...entries].sort((a, b) => b.value - a.value);
    return {
      strongest: sorted[0],
      weakest: sorted[sorted.length - 1],
      sorted,
    };
  }, [currentMetrics]);

  return (
    <div className="animate-fade-in space-y-8 max-w-[1120px] mx-auto pb-12">

      {/* Header */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#1A1A1A] pb-8">
        <div>
          <span className="inline-block px-3 py-1 rounded-none border border-[#1A1A1A] bg-white/40 text-[#1A1A1A] text-[9px] font-bold uppercase tracking-widest">
            ESPECTRO COGNITIVO // ANÁLISIS
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-[#1A1A1A] mt-3 tracking-tight uppercase">
            PERFIL MENTAL
          </h1>
          <p className="font-serif italic text-sm text-[#1A1A1A]/70 mt-2 max-w-xl">
            {isLoading
              ? 'Cargando métricas...'
              : highlights
                ? `Atributo más fuerte: ${highlights.strongest.label} (${highlights.strongest.value}) · Más débil: ${highlights.weakest.label} (${highlights.weakest.value})`
                : 'Sin datos de métricas aún. ¡Juega una partida para generar tu perfil!'}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/30 border border-[#1A1A1A] rounded-none px-5 py-3 h-fit">
          <div className="w-10 h-10 rounded-none bg-[#1A1A1A] flex items-center justify-center text-white border border-[#1A1A1A]">
            <Trophy size={20} />
          </div>
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A]/60 block font-sans">Rango Actual</span>
            <span className="text-xl font-bold text-[#1A1A1A] block leading-none mt-1 font-mono">
              {currentTier ? TIER_LABELS[currentTier.tier] || currentTier.tier : 'Sin Clasificar'}
            </span>
          </div>
        </div>
      </section>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 text-xs text-red-700 font-mono">
          ⚠ Error al cargar métricas: {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ─── COLUMNA IZQUIERDA: Atributos + Evolución ─── */}
        <div className="lg:col-span-7 space-y-8">

          {/* Grid de atributos */}
          {highlights && (
            <div className="grid grid-cols-2 gap-4">
              {highlights.sorted.map((attr, i) => {
                const config = ATTRIBUTE_CONFIG.find(a => a.key === attr.key)!;
                const isSelected = selectedAttr === attr.key;
                return (
                  <motion.div
                    key={attr.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedAttr(isSelected ? null : attr.key)}
                    className={`bg-white/30 border p-5 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#FF5028] bg-white/60 shadow-sm'
                        : 'border-[#1A1A1A] hover:bg-white/50'
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A]/60 block font-mono">
                      {attr.label}
                    </span>
                    <span className="text-3xl font-black text-[#1A1A1A] mt-1 block">{attr.value}</span>
                    <div className="w-full h-1.5 bg-white/40 border border-[#1A1A1A]/20 mt-2 rounded-none overflow-hidden">
                      <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${attr.value}%`, backgroundColor: config?.color || '#1A1A1A' }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {!highlights && !isLoading && (
            <div className="bg-white/30 border border-[#1A1A1A] p-8 text-center">
              <Activity size={32} className="mx-auto text-[#1A1A1A]/30 mb-3" />
              <p className="text-sm font-mono text-[#1A1A1A]/60">
                No hay datos de métricas disponibles.
              </p>
              <p className="text-xs text-[#1A1A1A]/40 mt-1 font-serif italic">
                Las métricas aparecerán después de tu primera partida con el nuevo sistema.
              </p>
            </div>
          )}

          {/* Sparklines de evolución por atributo */}
          {evolutionData && (
            <div className="bg-white/30 border border-[#1A1A1A] p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={14} className="text-[#1A1A1A]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/60">
                  Evolución ({evolutionData.labels[0]} - {evolutionData.labels[evolutionData.labels.length - 1]})
                </span>
              </div>

              <div className="space-y-4">
                {evolutionData.series.map(series => (
                  <div key={series.key} className="flex items-center gap-4">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A]/60 w-20 flex-shrink-0 font-mono">
                      {series.label}
                    </span>
                    <div className="flex-grow overflow-x-auto">
                      <Sparkline data={series.data} color={series.color} />
                    </div>
                    <span className="text-xs font-black text-[#1A1A1A] w-8 text-right font-mono">
                      {series.data[series.data.length - 1]}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-[#1A1A1A]/10 text-[9px] text-[#1A1A1A]/40 font-mono">
                Últimos {evolutionData.labels.length} días · Cada punto representa un snapshot diario
              </div>
            </div>
          )}
        </div>

        {/* ─── COLUMNA DERECHA: Reporte + Logros ─── */}
        <div className="lg:col-span-5 space-y-6">

          {/* Reporte AI */}
          {aiReport ? (
            <section className="bg-[#1A1A1A] text-white p-6 border-2 border-[#1A1A1A]">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={14} className="text-[#FF5028]" />
                <span className="text-[9px] font-black uppercase tracking-[1.5px] text-[#FF5028] font-sans">
                  ANÁLISIS COGNITIVO
                </span>
              </div>

              <p className="font-serif italic text-sm leading-relaxed text-white/80">
                {aiReport.agilidadSummary}
              </p>

              <div className="mt-4 pt-4 border-t border-white/10">
                <span className="text-[#FF5028] font-bold uppercase tracking-wider text-[10px]">
                  🎯 RECOMENDACIÓN:
                </span>
                <span className="text-white/70 font-serif italic text-xs ml-2">
                  {aiReport.ejercicioRecomendado}
                </span>
              </div>
            </section>
          ) : !loadingReport ? (
            <section className="bg-white/30 border border-[#1A1A1A] p-6 text-center">
              <Brain size={24} className="mx-auto text-[#1A1A1A]/30 mb-2" />
              <p className="text-xs font-mono text-[#1A1A1A]/60">
                Juega algunas partidas para recibir un análisis personalizado de IA.
              </p>
            </section>
          ) : (
            <section className="bg-white/30 border border-[#1A1A1A] p-6 text-center">
              <div className="w-6 h-6 border-2 border-[#1A1A1A] border-t-transparent animate-spin rounded-none mx-auto mb-2" />
              <p className="text-xs font-mono text-[#1A1A1A]/60">Generando análisis...</p>
            </section>
          )}

          {/* Snapshot del día actual */}
          {currentMetrics && (
            <div className="bg-white/30 border border-[#1A1A1A] p-6">
              <div className="flex items-center gap-2 mb-3">
                <Award size={14} className="text-[#FF5028]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/60">
                  Score Compuesto
                </span>
              </div>

              <div className="text-center">
                <span className="text-5xl font-black text-[#1A1A1A] font-mono">
                  {currentMetrics.cogni_coef_score}
                </span>
                <span className="text-sm text-[#1A1A1A]/50 font-mono ml-1">/100</span>
              </div>

              <div className="mt-4 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-[#1A1A1A]/60">
                  <span>Score total</span>
                  <span className="font-bold text-[#1A1A1A]">{currentMetrics.total_score}/100</span>
                </div>
                {currentTier && (
                  <div className="flex justify-between text-[#1A1A1A]/60 pt-2 border-t border-[#1A1A1A]/10">
                    <span>Tier desde</span>
                    <span className="font-bold text-[#1A1A1A]">
                      {new Date(currentTier.assigned_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botón forzar refresh */}
          <button
            onClick={fetchBrainReport}
            disabled={loadingReport}
            className="w-full py-3 bg-[#1A1A1A] text-white text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-[#FF5028] transition-all border border-[#1A1A1A] disabled:opacity-50"
          >
            {loadingReport ? 'Generando...' : '🔄 Regenerar Análisis'}
          </button>
        </div>
      </div>
    </div>
  );
}
