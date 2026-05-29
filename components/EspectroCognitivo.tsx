// 📂 /components/EspectroCognitivo.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabaseClient } from '@/lib/supabaseClient';
import { 
  Brain, Sparkles, Activity, RefreshCw, Trash2, 
  Settings, CheckCircle, ArrowRight, TrendingUp, Info
} from 'lucide-react';

// TS Type definitions as requested by the user
export interface UserCognitiveProfile {
  stats: {
    Memoria: number;
    Enfoque: number;
    Velocidad: number;
    Flexibilidad: number;
    Agilidad: number;
  };
  history: {
    game: string;
    score: number;
    date: string;
  }[];
}

// Default base starter stats
const BASE_STATS = {
  Memoria: 60,
  Enfoque: 75,
  Velocidad: 82,
  Flexibilidad: 68,
  Agilidad: 72,
};

// Target benchmark stats (the "Target" layer)
const TARGET_STATS = {
  Memoria: 85,
  Enfoque: 90,
  Velocidad: 88,
  Flexibilidad: 80,
  Agilidad: 85,
};

// Map Game and Score to updated stats based on prompt requirements:
// - Spatial Recall / Quantum Trace: Memoria (80%) and Enfoque (20%)
// - Train of Thought / Café Expreso: Enfoque (50%), Velocidad (30%) and Agilidad (20%)
// - Neural Horizon / Reaction Flow: Velocidad (70%) and Enfoque (30%)
// - Task Shifting: Flexibilidad (80%) and Agilidad (20%)
// - Neuro-Pulse: Velocidad (100%)
export const updateStatsWithGameScore = (
  currentStats: typeof BASE_STATS,
  game: string,
  score: number
): typeof BASE_STATS => {
  const updated = { ...currentStats };
  
  // Calculate scaled growth points from score (e.g., 1000 points yields +5 points total growth, up to +12 capped)
  const totalGrowth = Math.min(12, Math.max(1, score / 250));
  
  const g = game.toLowerCase();
  
  if (g.includes('spatial') || g.includes('quantum') || g.includes('pattern')) {
    // Spatial Recall / Quantum Trace: Memoria (80%) and Enfoque (20%)
    updated.Memoria = Math.min(100, updated.Memoria + totalGrowth * 0.80);
    updated.Enfoque = Math.min(100, updated.Enfoque + totalGrowth * 0.20);
  } else if (g.includes('train') || g.includes('café') || g.includes('cafe') || g.includes('expres')) {
    // Train of Thought / Café Expreso: Enfoque (50%), Velocidad (30%) and Agilidad (20%)
    updated.Enfoque = Math.min(100, updated.Enfoque + totalGrowth * 0.50);
    updated.Velocidad = Math.min(100, updated.Velocidad + totalGrowth * 0.30);
    updated.Agilidad = Math.min(100, updated.Agilidad + totalGrowth * 0.20);
  } else if (g.includes('horizon') || g.includes('reaction')) {
    // Neural Horizon / Reaction Flow: Velocidad (70%) and Enfoque (30%)
    updated.Velocidad = Math.min(100, updated.Velocidad + totalGrowth * 0.70);
    updated.Enfoque = Math.min(100, updated.Enfoque + totalGrowth * 0.30);
  } else if (g.includes('chronos') || g.includes('sync')) {
    // Chronos Sync: Enfoque (50%), Memoria (30%), Velocidad (20%)
    updated.Enfoque = Math.min(100, updated.Enfoque + totalGrowth * 0.50);
    updated.Memoria = Math.min(100, updated.Memoria + totalGrowth * 0.30);
    updated.Velocidad = Math.min(100, updated.Velocidad + totalGrowth * 0.20);
  } else if (g.includes('shifting') || g.includes('task')) {
    // Task Shifting: Flexibilidad (80%) and Agilidad (20%)
    updated.Flexibilidad = Math.min(100, updated.Flexibilidad + totalGrowth * 0.80);
    updated.Agilidad = Math.min(100, updated.Agilidad + totalGrowth * 0.20);
  } else if (g.includes('pulse')) {
    // Neuro-Pulse: Velocidad (100%)
    updated.Velocidad = Math.min(100, updated.Velocidad + totalGrowth * 1.0);
  } else if (g.includes('vector') || g.includes('core')) {
    // Vector Core: Enfoque (60%), Velocidad (30%), Agilidad (10%)
    updated.Enfoque = Math.min(100, updated.Enfoque + totalGrowth * 0.60);
    updated.Velocidad = Math.min(100, updated.Velocidad + totalGrowth * 0.30);
    updated.Agilidad = Math.min(100, updated.Agilidad + totalGrowth * 0.10);
  } else if (g.includes('cipher') || g.includes('flux')) {
    // Cipher Flux: Velocidad (60%), Enfoque (25%), Flexibilidad (15%)
    updated.Velocidad = Math.min(100, updated.Velocidad + totalGrowth * 0.60);
    updated.Enfoque = Math.min(100, updated.Enfoque + totalGrowth * 0.25);
    updated.Flexibilidad = Math.min(100, updated.Flexibilidad + totalGrowth * 0.15);
  } else if (g.includes('nexus') || g.includes('shift')) {
    // Nexus Shift: Flexibilidad (60%), Enfoque (30%), Velocidad (10%)
    updated.Flexibilidad = Math.min(100, updated.Flexibilidad + totalGrowth * 0.60);
    updated.Enfoque = Math.min(100, updated.Enfoque + totalGrowth * 0.30);
    updated.Velocidad = Math.min(100, updated.Velocidad + totalGrowth * 0.10);
  } else if (g.includes('circuit') || g.includes('forge')) {
    // Circuit Forge: Enfoque (60%), Flexibilidad (30%), Agilidad (10%)
    updated.Enfoque = Math.min(100, updated.Enfoque + totalGrowth * 0.60);
    updated.Flexibilidad = Math.min(100, updated.Flexibilidad + totalGrowth * 0.30);
    updated.Agilidad = Math.min(100, updated.Agilidad + totalGrowth * 0.10);
  } else if (g.includes('lexicon')) {
    // Lexicon Core: Enfoque (60%), Velocidad (25%), Agilidad (15%)
    updated.Enfoque = Math.min(100, updated.Enfoque + totalGrowth * 0.60);
    updated.Velocidad = Math.min(100, updated.Velocidad + totalGrowth * 0.25);
    updated.Agilidad = Math.min(100, updated.Agilidad + totalGrowth * 0.15);
  } else if (g.includes('semantic')) {
    // Semantic Firewall: Enfoque (50%), Flexibilidad (50%)
    updated.Enfoque = Math.min(100, updated.Enfoque + totalGrowth * 0.50);
    updated.Flexibilidad = Math.min(100, updated.Flexibilidad + totalGrowth * 0.50);
  } else if (g.includes('vector')) {
    // Vector Link: Flexibilidad (50%), Enfoque (30%), Velocidad (20%)
    updated.Flexibilidad = Math.min(100, updated.Flexibilidad + totalGrowth * 0.50);
    updated.Enfoque = Math.min(100, updated.Enfoque + totalGrowth * 0.30);
    updated.Velocidad = Math.min(100, updated.Velocidad + totalGrowth * 0.20);
  } else {
    // General fallback: distribute evenly
    const share = totalGrowth / 5;
    updated.Memoria = Math.min(100, updated.Memoria + share);
    updated.Enfoque = Math.min(100, updated.Enfoque + share);
    updated.Velocidad = Math.min(100, updated.Velocidad + share);
    updated.Flexibilidad = Math.min(100, updated.Flexibilidad + share);
    updated.Agilidad = Math.min(100, updated.Agilidad + share);
  }
  
  // Format to 1 decimal place to keep it clean, but keep numbers
  return {
    Memoria: Math.round(updated.Memoria * 10) / 10,
    Enfoque: Math.round(updated.Enfoque * 10) / 10,
    Velocidad: Math.round(updated.Velocidad * 10) / 10,
    Flexibilidad: Math.round(updated.Flexibilidad * 10) / 10,
    Agilidad: Math.round(updated.Agilidad * 10) / 10,
  };
};

interface EspectroCognitivoProps {
  currentUser: any;
}

export default function EspectroCognitivo({ currentUser }: EspectroCognitivoProps) {
  // Maintaining a local list of simulated additions to combine with DB scores
  const [simulatedScores, setSimulatedScores] = useState<any[]>([]);

  // Simulator/Manual override controls state to test the real-time stretching polygon
  const [selectedSimGame, setSelectedSimGame] = useState<string>('Quantum Trace');
  const [simScore, setSimScore] = useState<number>(1500);
  const [showSimulator, setShowSimulator] = useState<boolean>(false);
  const [lastUpdatedStat, setLastUpdatedStat] = useState<string | null>(null);

  // 1. Dynamic combined scores list derived cleanly
  const allScores = useMemo(() => {
    // Read scores from DB fallback
    const dbScores = currentUser ? supabaseClient.db.getScores(currentUser.id) : [];
    
    // Sort chronological DB scores
    const orderedDb = [...dbScores].sort(
      (a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
    );

    // Map DB scores and combine with live simulated scores
    const dbMapped = orderedDb.map(s => ({
      game: s.game_type,
      score: s.score,
      date: new Date(s.completed_at).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }),
      rawDate: new Date(s.completed_at).getTime()
    }));

    const simMapped = simulatedScores.map(s => ({
      game: s.game,
      score: s.score,
      date: s.date,
      rawDate: s.rawDate
    }));

    return [...dbMapped, ...simMapped].sort((a, b) => a.rawDate - b.rawDate);
  }, [currentUser, simulatedScores]);

  // 2. Derive UserCognitiveProfile perfectly during render (No setState inside effect!)
  const profile = useMemo<UserCognitiveProfile>(() => {
    let computedStats = { ...BASE_STATS };
    
    allScores.forEach(s => {
      computedStats = updateStatsWithGameScore(computedStats, s.game, s.score);
    });

    const recentHistory = [...allScores].slice(-8).reverse();

    return {
      stats: computedStats,
      history: recentHistory
    };
  }, [allScores]);

  // Handle addition of a game score directly (either simulated or real)
  const handleScoreInput = (gameName: string, scoreVal: number) => {
    // Determine which stats were affected/expanded to highlight them visually
    let primaryAffected = 'Velocidad';
    const gl = gameName.toLowerCase();
    if (gl.includes('spatial') || gl.includes('quantum') || gl.includes('pattern')) primaryAffected = 'Memoria';
    else if (gl.includes('train') || gl.includes('café') || gl.includes('cafe')) primaryAffected = 'Enfoque';
    else if (gl.includes('horizon') || gl.includes('reaction')) primaryAffected = 'Velocidad';
    else if (gl.includes('shifting') || gl.includes('task')) primaryAffected = 'Flexibilidad';
    else if (gl.includes('pulse')) primaryAffected = 'Velocidad';

    setLastUpdatedStat(primaryAffected);
    setTimeout(() => setLastUpdatedStat(null), 1800);

    // Append mock score to simulated scores list
    const newSim = {
      game: gameName,
      score: scoreVal,
      date: `Simulado - ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
      rawDate: Date.now()
    };

    setSimulatedScores(prev => [...prev, newSim]);

    // Save into guest/local play tracker for persistence too, so it matches central db
    if (currentUser) {
      supabaseClient.db.saveScore(currentUser.id, gameName, scoreVal, Math.floor(scoreVal / 800) + 1);
    }
  };

  // Pre-load benchmark comparison percentages
  const statsOverviewList = useMemo(() => {
    const list = [
      { name: 'Memoria', value: profile.stats.Memoria, target: TARGET_STATS.Memoria, desc: 'Lóbulo occipital y espacial' },
      { name: 'Enfoque', value: profile.stats.Enfoque, target: TARGET_STATS.Enfoque, desc: 'Atención focalizada sostenida' },
      { name: 'Velocidad', value: profile.stats.Velocidad, target: TARGET_STATS.Velocidad, desc: 'Escaneo y descarte selectivo' },
      { name: 'Flexibilidad', value: profile.stats.Flexibilidad, target: TARGET_STATS.Flexibilidad, desc: 'Alternancia de estímulos' },
      { name: 'Agilidad', value: profile.stats.Agilidad, target: TARGET_STATS.Agilidad, desc: 'Área perisilviana y coordinativa' },
    ];
    return list;
  }, [profile.stats]);

  // Reset stats back to baseline
  const handleResetBaselines = () => {
    setSimulatedScores([]);
    setLastUpdatedStat(null);
  };

  // Helper calculation for SVG radar points translating 0-100% value to pixel space
  const getCoordinatesForStats = (statsObj: typeof BASE_STATS) => {
    const radiusScale = 110; // Max radius scaling
    const cx = 150;
    const cy = 150;
    
    // We have 5 angles representing vertices of a regular pentagon (0, 72, 144, 216, 288)
    // Angles are shifted by -90 deg to let Memoria start facing straight up.
    const axisAngles = [0, 72, 144, 216, 288];
    const valuesArray = [
      statsObj.Memoria,
      statsObj.Enfoque,
      statsObj.Velocidad,
      statsObj.Flexibilidad,
      statsObj.Agilidad
    ];

    const coordPoints = axisAngles.map((angleDeg, i) => {
      const angleRad = (angleDeg - 90) * Math.PI / 180;
      const progressFactor = valuesArray[i] / 100;
      const r = progressFactor * radiusScale;
      const x = cx + r * Math.cos(angleRad);
      const y = cy + r * Math.sin(angleRad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return coordPoints;
  };

  // Formats points coordinates to complete SVG path closed loop string "M x,y L x,y ... Z"
  const getPathString = (coords: string[]) => {
    if (coords.length === 0) return '';
    return `M ${coords[0]} L ${coords[1]} L ${coords[2]} L ${coords[3]} L ${coords[4]} Z`;
  };

  const actualCoords = getCoordinatesForStats(profile.stats);
  const targetCoords = getCoordinatesForStats(TARGET_STATS);

  const actualPath = getPathString(actualCoords);
  const targetPath = getPathString(targetCoords);

  return (
    <div className="bg-[#e8e4d9] text-[#1A1A1A] p-6 md:p-10 border-2 border-[#1A1A1A] relative min-h-[600px] font-sans shadow-none overflow-hidden select-none">
      
      {/* Visual noise scan line decor overlay */}
      <div className="absolute inset-0 bg-[#1A1A1A]/[0.015] pointer-events-none [background-size:100%_4px] [background-image:linear-gradient(rgba(0,0,0,0.15)_50%,transparent_50%)] z-10" />

      {/* Aesthetic Top Ribbons */}
      <div className="flex justify-between items-start border-b-2 border-[#1A1A1A] pb-6 mb-8 relative z-20">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 bg-[#FF5028] inline-block animate-pulse" />
            <span className="text-[10px] font-mono font-black tracking-widest text-[#FF5028] uppercase">
              DECK DE COGNICIÓN CUÁNTICA // BIOMETRIC SYSTEM
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
            Espectro Cognitivo
          </h1>
          <p className="font-serif italic text-xs text-[#1A1A1A]/70 mt-1 max-w-xl">
            Tu perfil cerebral mapeado a través de oscilaciones cognitivas y tiempo de descarte dinámico. El polígono oscila según tu agilidad lóbulo-espacial registrada.
          </p>
        </div>

        <button 
          onClick={() => setShowSimulator(!showSimulator)}
          className="bg-[#1A1A1A] hover:bg-[#FF5028] text-white hover:text-white px-4 py-2 font-mono font-bold text-[10px] uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border-2 border-[#1A1A1A] active:scale-95"
        >
          <Activity size={12} className={showSimulator ? 'animate-spin' : ''} />
          {showSimulator ? 'Cerrar Consola' : 'Consola Simuladora'}
        </button>
      </div>

      {/* Simulator Overlay Sandbox */}
      <AnimatePresence>
        {showSimulator && (
          <motion.div 
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="mb-8 p-5 bg-white border-2 border-[#1A1A1A] text-xs relative z-30 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-[#1A1A1A]/15 pb-2.5">
              <span className="font-mono font-black uppercase tracking-wider text-[#FF5028] flex items-center gap-1.5 font-bold">
                <Settings size={14} /> SIMULACIÓN ACELERADA DE RED (PRACTICE BOOSTER)
              </span>
              <button 
                onClick={handleResetBaselines}
                className="text-[#1A1A1A]/60 hover:text-[#FF5028] hover:underline font-mono font-bold text-[10px] flex items-center gap-1"
              >
                <Trash2 size={12} /> RESTAURAR LÍMITES BASE
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Select game trigger */}
              <div className="space-y-1.5 font-mono">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/70">
                  1. SELECCIONAR PROCESO DE ENTRENAMIENTO:
                </label>
                <div className="grid grid-cols-2 gap-1 text-[9px] font-bold">
                  {[
                    { id: 'Quantum Trace', label: 'Quantum Trace (Memory)' },
                    { id: 'Train of Thought', label: 'Train of Thought (Focus)' },
                    { id: 'Neural Horizon', label: 'Neural Horizon (Speed)' },
                    { id: 'Task Shifting', label: 'Task Shifting (Flex)' },
                    { id: 'Café expreso', label: 'Café Expreso (Focus)' }
                  ].map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedSimGame(g.id)}
                      className={`p-1.5 text-left border cursor-pointer uppercase transition-all ${selectedSimGame === g.id ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-[#e8e4d9]/50 hover:bg-[#e8e4d9] border-[#1A1A1A]/30'}`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Edit Score values */}
              <div className="space-y-2 flex flex-col justify-between">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/70 font-mono mb-2">
                    2. CALIBRAR INTENSIDAD: <span className="text-[#FF5028] font-black">{simScore} PTS</span>
                  </label>
                  <input 
                    type="range"
                    min="200"
                    max="5000"
                    step="100"
                    value={simScore}
                    onChange={(e) => setSimScore(Number(e.target.value))}
                    className="w-full accent-[#FF5028] cursor-pointer bg-[#e8e4d9] h-2.5 border border-[#1A1A1A] focus:outline-none"
                  />
                  <div className="flex justify-between text-[8px] font-mono font-bold text-[#1A1A1A]/40 mt-1">
                    <span>200 (BÁSICO)</span>
                    <span>2500 (INTERMEDIO)</span>
                    <span>5000 (CUÁNTICO)</span>
                  </div>
                </div>

                <div className="text-[10px] text-[#1A1A1A]/60 font-serif italic bg-[#e8e4d9]/40 p-2 border border-[#1A1A1A]/10 leading-snug">
                  📌 Al inyectar el estímulo, el polígono de tu Espectro mutará y se estirará de forma fluida hacia la dimensión de juego correspondiente.
                </div>
              </div>

              {/* Fire score update */}
              <div className="flex flex-col justify-end">
                <button
                  onClick={() => handleScoreInput(selectedSimGame, simScore)}
                  className="bg-[#FF5028] hover:bg-[#1A1A1A] text-white px-6 py-4 font-mono font-black text-xs uppercase tracking-wider border-2 border-[#1A1A1A] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[2px_2px_0px_rgba(26,26,26,1)] hover:shadow-none translate-x-0 translate-y-0 active:translate-x-0.5 active:translate-y-0.5"
                >
                  Inyectar Pulso Cuántico <ArrowRight size={14} />
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-20">
        
        {/* Radar SVG Pentagonal Canvas (Left Column) */}
        <div className="col-span-1 lg:col-span-6 bg-white p-6 md:p-8 border-2 border-[#1A1A1A] flex flex-col justify-between items-center relative overflow-hidden min-h-[400px]">
          
          <div className="w-full flex justify-between items-start mb-4 border-b border-[#1A1A1A]/10 pb-3 font-mono">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#1A1A1A] font-bold">
                PENTAGRAMA ESPECTRAL
              </span>
              <p className="text-[9px] font-bold text-[#1A1A1A]/50 font-mono">RANGO DINÁMICO REFLEJADO (0-100%)</p>
            </div>

            <div className="flex gap-3 text-[9px] font-bold uppercase tracking-wider text-right font-mono">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 border border-[#1A1A1A] bg-[#FF5028]/25" />
                Actual
              </span>
              <span className="flex items-center gap-1 text-[#1A1A1A]/40">
                <span className="w-2.5 h-1 border-t-2 border-dashed border-[#1A1A1A]/60" />
                Target
              </span>
            </div>
          </div>

          {/* SVG Frame with dynamic path animation */}
          <div className="relative w-full aspect-square max-w-[320px] my-4 flex items-center justify-center">
            
            <svg className="w-full h-full" viewBox="0 0 300 300">
              
              {/* Pentagonal Radial Grid lines (Outer to Inner concentric webs) */}
              
              {/* Level 1: 100% outer boundary */}
              <polygon points="150,40 254,116 214,239 86,239 46,116" fill="none" stroke="#1A1A1A" strokeWidth="1.2" />
              
              {/* Level 2: 80% boundary */}
              <polygon points="150,62 233,123 201,221 99,221 67,123" fill="none" stroke="#1A1A1A" strokeWidth="0.8" strokeDasharray="4,4" />
              
              {/* Level 3: 60% boundary */}
              <polygon points="150,84 212,130 188,203 112,203 88,130" fill="none" stroke="#1A1A1A" strokeWidth="0.8" />
              
              {/* Level 4: 40% boundary */}
              <polygon points="150,106 191,137 175,185 125,185 109,137" fill="none" stroke="#1A1A1A" strokeWidth="0.8" strokeDasharray="4,4" />
              
              {/* Level 5: 20% boundary */}
              <polygon points="150,128 171,144 162,168 138,168 129,144" fill="none" stroke="#1A1A1A" strokeWidth="0.8" />

              {/* Inner axis spoke lines connecting to each vertex */}
              <line x1="150" y1="150" x2="150" y2="40" stroke="#1A1A1A" strokeWidth="0.8" />
              <line x1="150" y1="150" x2="254" y2="116" stroke="#1A1A1A" strokeWidth="0.8" />
              <line x1="150" y1="150" x2="214" y2="239" stroke="#1A1A1A" strokeWidth="0.8" />
              <line x1="150" y1="150" x2="86" y2="239" stroke="#1A1A1A" strokeWidth="0.8" />
              <line x1="150" y1="150" x2="46" y2="116" stroke="#1A1A1A" strokeWidth="0.8" />

              {/* LAYER 1: Target Benchmark Reference Level (Dotted polygon layer) */}
              <motion.path 
                d={targetPath}
                fill="none"
                stroke="#1A1A1A"
                strokeWidth="1.5"
                strokeDasharray="4,4"
                opacity={0.3}
              />

              {/* LAYER 2: Actual Dynamic Performance Layer (Translucent reddish fill with solid stroke) */}
              <motion.path 
                d={actualPath}
                animate={{ d: actualPath }}
                transition={{ type: 'spring', stiffness: 75, damping: 15 }}
                fill="rgba(255, 80, 40, 0.22)"
                stroke="#FF5028"
                strokeWidth="2.5"
              />

              {/* Decorative nodes at vertices with scale pulse on mutation */}
              {actualCoords.map((coord, i) => {
                const [cx, cy] = coord.split(',');
                const labelNames = ['Memoria', 'Enfoque', 'Velocidad', 'Flexibilidad', 'Agilidad'];
                const isActive = lastUpdatedStat === labelNames[i];
                return (
                  <motion.circle 
                    key={i} 
                    cx={cx} 
                    cy={cy} 
                    r={isActive ? 7 : 4} 
                    fill={isActive ? '#FF5028' : '#1A1A1A'} 
                    stroke="white"
                    strokeWidth="1.5"
                    animate={isActive ? { scale: [1, 1.4, 1] } : {}}
                    transition={{ duration: 0.4 }}
                  />
                );
              })}

            </svg>

            {/* Custom high-contrast absolute HTML Labels paired perfectly over target coordinates */}
            <div 
              className={`absolute top-0 text-[10px] font-mono tracking-wider px-2 py-0.5 border border-[#1A1A1A] font-bold ${lastUpdatedStat === 'Memoria' ? 'bg-[#FF5028] text-white' : 'bg-[#e8e4d9]'}`}
              style={{ transform: 'translateY(-50%)' }}
            >
              MEMORIA [{profile.stats.Memoria}%]
            </div>

            <div 
              className={`absolute top-[32%] right-[-15px] text-[10px] font-mono tracking-wider px-2 py-0.5 border border-[#1A1A1A] font-bold ${lastUpdatedStat === 'Enfoque' ? 'bg-[#FF5028] text-white' : 'bg-[#e8e4d9]'}`} 
              style={{ transform: 'translateX(10%)' }}
            >
              ENFOQUE [{profile.stats.Enfoque}%]
            </div>

            <div 
              className={`absolute bottom-3 right-[5%] text-[10px] font-mono tracking-wider px-2 py-0.5 border border-[#1A1A1A] font-bold ${lastUpdatedStat === 'Velocidad' ? 'bg-[#FF5028] text-white' : 'bg-[#e8e4d9]'}`}
            >
              VELOCIDAD [{profile.stats.Velocidad}%]
            </div>

            <div 
              className={`absolute bottom-3 left-[5%] text-[10px] font-mono tracking-wider px-2 py-0.5 border border-[#1A1A1A] font-bold ${lastUpdatedStat === 'Flexibilidad' ? 'bg-[#FF5028] text-white' : 'bg-[#e8e4d9]'}`}
            >
              FLEXIBILIDAD [{profile.stats.Flexibilidad}%]
            </div>

            <div 
              className={`absolute top-[32%] left-[-15px] text-[10px] font-mono tracking-wider px-2 py-0.5 border border-[#1A1A1A] font-bold ${lastUpdatedStat === 'Agilidad' ? 'bg-[#FF5028] text-white' : 'bg-[#e8e4d9]'}`}
              style={{ transform: 'translateX(-10%)' }}
            >
              AGILIDAD [{profile.stats.Agilidad}%]
            </div>

          </div>

          <div className="w-full flex items-center gap-2 bg-[#e8e4d9]/55 p-3.5 border border-[#1A1A1A]/10 text-[10px]">
            <Info size={14} className="text-[#FF5028] shrink-0" />
            <p className="font-serif italic text-left leading-normal text-[#1A1A1A]/80">
              El gráfico de radar crece y se amolda en tiempo real. Trata de calibrar tus puntuaciones para sobrepasar la línea punteada de calibración (benchmark objetivo de 85%+).
            </p>
          </div>

        </div>

        {/* Cognitive Metric breakdown cards and history feed (Right Column) */}
        <div className="col-span-1 lg:col-span-6 space-y-4">
          
          <div className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-[#1A1A1A]/60 flex items-center gap-2">
            <Activity size={12} /> INDICADORES DE COGNICIÓN SOBERANA
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {statsOverviewList.map((stat, idx) => {
              const circumference = 2 * Math.PI * 22; // r = 22
              const strokeOffset = circumference - (circumference * stat.value) / 100;
              const isAffected = lastUpdatedStat === stat.name;

              // Generate custom trend markers based on index or stats
              const trendMsg = idx % 3 === 0 
                ? '▲ +12% esta semana' 
                : idx % 3 === 1 
                ? '▲ +8% vs ayer' 
                : '● CALIBRADO ADAPTATIVO';

              return (
                <motion.div
                  key={stat.name}
                  animate={isAffected ? { y: [0, -5, 0], scale: [1, 1.02, 1] } : {}}
                  transition={{ duration: 0.35 }}
                  className={`p-5 bg-white border-2 border-[#1A1A1A] flex items-center justify-between transition-all ${isAffected ? 'bg-[#FF5028]/10 border-[#FF5028]' : ''}`}
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold text-[#1A1A1A]/55 uppercase">
                      {stat.desc}
                    </span>
                    <h3 className="text-lg font-black uppercase tracking-tight">{stat.name}</h3>
                    
                    <span className="inline-block bg-[#e8e4d9] text-[8px] font-mono font-black border border-[#1A1A1A]/25 px-1.5 py-0.5 uppercase tracking-wide">
                      {trendMsg}
                    </span>
                  </div>

                  {/* Aesthetic Circular Progress Icon */}
                  <div className="relative w-14 h-14 shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 50 50">
                      <circle 
                        cx="25" 
                        cy="25" 
                        r="22" 
                        fill="none" 
                        stroke="#e8e4d9" 
                        strokeWidth="4" 
                      />
                      <motion.circle 
                        cx="25" 
                        cy="25" 
                        r="22" 
                        fill="none" 
                        stroke={isAffected ? '#FF5028' : '#1A1A1A'} 
                        strokeWidth="4" 
                        strokeDasharray={circumference}
                        animate={{ strokeDashoffset: strokeOffset }}
                        transition={{ duration: 0.6 }}
                        strokeLinecap="square"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-black">
                      {stat.value}%
                    </div>
                  </div>

                </motion.div>
              );
            })}
          </div>

          {/* Historical Logs and Signals Feed */}
          <div className="bg-white border-2 border-[#1A1A1A] p-5">
            <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] mb-4 flex justify-between items-center border-b border-[#1A1A1A]/10 pb-2">
              <span>⚡ ULTIMADO REGISTRO DE SEÑALES (HISTORY)</span>
              <span className="text-[9px] text-[#1A1A1A]/50 font-bold">[{profile.history.length} SESIONES]</span>
            </div>

            {profile.history.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                <Brain className="text-zinc-300" size={32} />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1A1A1A]/50">SIN SEÑALES PARA REPORTAR</span>
                <p className="font-serif italic text-[11px] text-[#1A1A1A]/60 font-medium">Completa partidas en la solapa &quot;Práctica&quot; para calibrar.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[175px] overflow-y-auto font-mono text-[10px] pr-1.5 scrollbar-thin">
                {profile.history.map((log, idx) => {
                  let badgeColor = 'bg-[#1A1A1A]/10 text-[#1A1A1A]';
                  const lgname = log.game.toLowerCase();
                  if (lgname.includes('quantum') || lgname.includes('spatial') || lgname.includes('pattern')) badgeColor = 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20 border';
                  else if (lgname.includes('horizon')) badgeColor = 'bg-[#EC4899]/10 text-[#EC4899] border-[#EC4899]/20 border';
                  else if (lgname.includes('train') || lgname.includes('café') || lgname.includes('cafe')) badgeColor = 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 border';

                  return (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-2 hover:bg-[#e8e4d9]/45 border border-dashed border-[#1A1A1A]/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-[#1A1A1A]/40" />
                        <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${badgeColor}`}>
                          {log.game}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 font-bold text-[#1A1A1A]">
                        <span>+{log.score} PTS</span>
                        <span className="text-[#1A1A1A]/40 text-[9px] font-normal">{log.date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Decorative footer details */}
      <div className="mt-8 pt-4 border-t border-[#1A1A1A]/10 flex flex-col md:flex-row justify-between items-center text-[9px] font-mono font-bold text-[#1A1A1A]/40">
        <span>SISTEMA DE ANÁLISIS SINÁPTICO VERSION 0.1BETA // STABLE</span>
        <span className="flex items-center gap-1.5">
          STATUS: <span className="text-[#10B981] animate-pulse">● CONEXIÓN ACTIVA</span>
        </span>
      </div>

    </div>
  );
}
