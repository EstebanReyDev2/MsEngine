// 📂 /components/InsightsView.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';
import { Brain, Sparkles } from 'lucide-react';
import EspectroCognitivo from './EspectroCognitivo';

interface InsightsViewProps {
  currentUser: any;
}

export default function InsightsView({ currentUser }: InsightsViewProps) {
  const [aiReport, setAiReport] = useState<{ agilidadSummary: string; ejercicioRecomendado: string } | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const fetchBrainReport = React.useCallback(async (userScores: any[]) => {
    setLoadingReport(true);
    try {
      const res = await fetch('/app/api/gemini/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores: userScores,
          streak: supabaseClient.db.getStreak(currentUser?.id).current_streak,
          rank: currentUser?.cerebra_rank || 'Iniciado del Templo'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiReport({
          agilidadSummary: data.agilidadSummary,
          ejercicioRecomendado: data.ejercicioRecomendado
        });
      }
    } catch (e) {
      // standard fallback
    } finally {
      setLoadingReport(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      const userScores = supabaseClient.db.getScores(currentUser.id);
      const t = setTimeout(() => {
        fetchBrainReport(userScores);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [currentUser, fetchBrainReport]);

  return (
    <div className="animate-fade-in space-y-8 max-w-[1120px] mx-auto pb-12">
      {/* 🔮 Render our high-contrast, fully interactive EspectroCognitivo Dashboard */}
      <EspectroCognitivo currentUser={currentUser} />

      {/* 🧠 Full personalized brain report from Gemini AI model */}
      {aiReport && (
        <section className="bg-[#1A1A1A] text-white rounded-none p-8 relative overflow-hidden border-2 border-[#1A1A1A] animate-fade-in shadow-none mt-8">
          <div className="absolute top-0 right-0 p-6 opacity-[0.02] pointer-events-none">
            <Brain size={180} />
          </div>

          <div className="relative z-10 space-y-4 max-w-2xl">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#FF5028]" />
              <span className="text-[10px] font-black uppercase tracking-[1.5px] text-[#FF5028] font-sans">ANÁLISIS COGNITIVO PERSONALIZADO (MEMORIA ESPACIAL)</span>
            </div>
            
            <h2 className="text-xl font-bold tracking-tight text-white mb-2 uppercase font-mono">{"// "}DIAGNÓSTICO DE ENFOQUE Y RESONANCIA</h2>
            <p className="font-serif italic text-sm leading-relaxed text-white/80">
              {aiReport.agilidadSummary}
            </p>

            <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs font-mono">
              <div className="text-[#FF5028] font-bold uppercase tracking-wider">
                🎯 RECOMENDACIÓN DE PRÁCTICA: <span className="text-white font-serif font-medium lowercase italic">{aiReport.ejercicioRecomendado}</span>
              </div>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
