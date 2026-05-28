// 📂 /components/TodayView.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';
import { Flame, Brain, CheckCircle2, ArrowRight, Sparkles, Trophy } from 'lucide-react';

interface TodayViewProps {
  currentUser: any;
  onStartGame: () => void;
  onNavigate: (tab: 'today' | 'insights' | 'practice' | 'profile') => void;
}

export default function TodayView({ currentUser, onStartGame, onNavigate }: TodayViewProps) {
  const [streak, setStreak] = useState(1);
  const [tasks, setTasks] = useState([
    { id: 1, label: 'Completar 1 sesión de Pattern Recall', done: false },
    { id: 2, label: 'Verificar espectro cognitivo en Insights', done: false },
    { id: 3, label: 'Sincronizar huella mental', done: true }
  ]);
  const [aiAffirmation, setAiAffirmation] = useState('Cada conexión se fortalece con el silencio del pensamiento.');
  const [loadingAffirmation, setLoadingAffirmation] = useState(false);

  const fetchAffirmation = async () => {
    setLoadingAffirmation(true);
    try {
      const userScores = supabaseClient.db.getScores(currentUser?.id);
      const res = await fetch('/app/api/gemini/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores: userScores,
          streak: streak,
          rank: currentUser?.cerebra_rank || 'Iniciado del Templo'
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.afirmacionDelDia) {
          setAiAffirmation(data.afirmacionDelDia);
        }
      }
    } catch (e) {
      // Fallback stays
    } finally {
      setLoadingAffirmation(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      const activeStreak = supabaseClient.db.getStreak(currentUser.id);
      const t = setTimeout(() => {
        setStreak(activeStreak.current_streak);
        fetchAffirmation();
      }, 0);
      
      return () => clearTimeout(t);
    }
  }, [currentUser]);

  const toggleTask = (id: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const completedCount = tasks.filter(t => t.done).length;

  return (
    <div className="animate-fade-in space-y-8 max-w-[1120px] mx-auto pb-12">
      
      {/* 👋 Hero Greeting */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#1A1A1A] pb-8">
        <div>
          <span className="inline-block px-3 py-1 rounded-none border border-[#1A1A1A] bg-white/40 text-[#1A1A1A] text-[9px] font-bold uppercase tracking-widest">
            SANTUARIO ACTIVO // V1.0
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-[#1A1A1A] mt-3 tracking-tight uppercase">
            HOLA, {currentUser?.username || 'Invitado'}
          </h1>
          <p className="font-serif italic text-sm text-[#1A1A1A]/70 mt-2 max-w-xl">
            Tu rango mental es <span className="text-[#1A1A1A] font-bold not-italic font-sans">{currentUser?.cerebra_rank}</span>. Tu mente está relajada y lista para canalizar enfoque visoespacial.
          </p>
        </div>

        {/* ⚡ Streak Pill Badge */}
        <div className="flex items-center gap-3 bg-white/30 border border-[#1A1A1A] rounded-none px-5 py-3 h-fit">
          <div className="w-10 h-10 rounded-none bg-[#FF5028] flex items-center justify-center text-white border border-[#1A1A1A]">
            <Flame size={20} fill="currentColor" strokeWidth={1} />
          </div>
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A]/60 block font-sans">Racha Diaria</span>
            <span className="text-xl font-bold text-[#1A1A1A] block leading-none mt-1 font-mono">{streak} {streak === 1 ? 'DÍA' : 'DÍAS'}</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 📋 Daily Routine Checklists (Bento Box 1) */}
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
                  onClick={() => toggleTask(task.id)}
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
          </div>

          <div className="mt-8 pt-6 border-t border-[#1A1A1A]/15 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="font-serif italic text-xs text-[#1A1A1A]/60">Siguiente rango: {supabaseClient.db.getScores(currentUser?.id).length > 2 ? 'Explorador Sináptico' : 'Mente Enfocada'}</span>
            <button 
              onClick={onStartGame}
              className="px-6 py-3 bg-[#FF5028] text-white rounded-none border border-[#1A1A1A] hover:bg-[#1A1A1A] transition-all font-bold text-xs flex items-center gap-2 group cursor-pointer uppercase tracking-wider"
            >
              <span>Comenzar Práctica</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* 🧘 Wellness AI Reflection (Bento Box 2) */}
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

          {/* Quick Stats Summary Widget */}
          <div className="bg-white/30 border border-[#1A1A1A] rounded-none p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-none bg-[#1A1A1A] flex items-center justify-center text-white border border-[#1A1A1A]">
                <Brain size={20} />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1A1A1A] block">Entrenamiento Completo</span>
                <span className="text-[10px] text-[#1A1A1A]/60 block mt-0.5 font-serif italic">Visita Espectro para un análisis profundo</span>
              </div>
            </div>
            <button 
              onClick={() => onNavigate('insights')}
              className="text-[#1A1A1A] hover:text-[#FF5028] transition-colors cursor-pointer"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
