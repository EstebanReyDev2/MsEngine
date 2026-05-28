// 📂 /components/games/ChronosSync.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabaseClient } from '@/lib/supabaseClient';
import { 
  Cpu, Sparkles, Activity, Brain, RotateCcw, 
  ArrowLeft, Check, AlertCircle, Play, Sliders, ChevronRight
} from 'lucide-react';

interface ChronosSyncProps {
  onBack: () => void;
  currentUser: any;
  onRefreshUser: () => void;
}

// Frequencies for our custom A Major chord synth tones
const AUDIO_FREQS = [330, 440, 554, 659, 880];
const FREQ_NAMES = ['SIGMA-330', 'ALPHA-440', 'DELTA-554', 'THETA-659', 'OMEGA-880'];

interface Stimulus {
  position: number;    // 0 to 8
  audioIndex: number;  // 0 to 4
}

interface Decision {
  position: boolean;
  audio: boolean;
}

export default function ChronosSync({ onBack, currentUser, onRefreshUser }: ChronosSyncProps) {
  // Configs
  const [nValue, setNValue] = useState(1);
  const [customInterval, setCustomInterval] = useState(2500); // ms
  
  // Game state
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'blockEnded'>('intro');
  const [currentBlock, setCurrentBlock] = useState(1);
  
  // Core sequence and active trial states
  const [sequence, setSequence] = useState<Stimulus[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [userDecisions, setUserDecisions] = useState<Decision[]>([]);
  const [activeCell, setActiveCell] = useState<number | null>(null);

  // Scoring indicators
  const [score, setScore] = useState(0);
  const [correctHits, setCorrectHits] = useState(0);
  const [totalDecisions, setTotalDecisions] = useState(0);
  const [feedback, setFeedback] = useState<'success' | 'failure' | null>(null);

  // Audio Context Ref (Only accessed inside event handlers to avoid render-phase accesses)
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Synthesize cyberpunk frequency tone
  const playFreq = (freq: number, duration = 0.4) => {
    if (typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtxClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Slends silently on compatibility issues
    }
  };

  const playTactileBeep = (freq: number) => {
    playFreq(freq, 0.12);
  };

  // Pre-generate entire block sequence purely
  const generateBlockSequence = (n: number): Stimulus[] => {
    const list: Stimulus[] = [];
    for (let i = 0; i < 20; i++) {
      let pos = Math.floor(Math.random() * 9);
      let audioId = Math.floor(Math.random() * AUDIO_FREQS.length);
      
      // Enforce N-Back match probability dynamically (~35% chance)
      if (i >= n && Math.random() < 0.35) {
        if (Math.random() < 0.5) {
          pos = list[i - n].position;
        } else {
          audioId = list[i - n].audioIndex;
        }
      }
      list.push({ position: pos, audioIndex: audioId });
    }
    return list;
  };

  // Keyboard and Button Action Handlers
  const handlePositionMatchInput = React.useCallback(() => {
    if (gameState !== 'playing' || currentIndex < 0 || currentIndex >= 20) return;

    // Check if they already pressed for current trial to avoid duplicates
    if (userDecisions[currentIndex]?.position) return;

    setUserDecisions(prev => {
      const updated = [...prev];
      if (updated[currentIndex]) {
        updated[currentIndex] = { ...updated[currentIndex], position: true };
      }
      return updated;
    });

    playTactileBeep(680);

    // Instant tactile UI edge warning glow
    const isCorrectMatch = currentIndex >= nValue && sequence[currentIndex - nValue]?.position === sequence[currentIndex]?.position;
    setFeedback(isCorrectMatch ? 'success' : 'failure');
    setTimeout(() => setFeedback(null), 250);
  }, [gameState, currentIndex, userDecisions, nValue, sequence]);

  const handleAudioMatchInput = React.useCallback(() => {
    if (gameState !== 'playing' || currentIndex < 0 || currentIndex >= 20) return;

    // Check if they already pressed for current trial to avoid duplicates
    if (userDecisions[currentIndex]?.audio) return;

    setUserDecisions(prev => {
      const updated = [...prev];
      if (updated[currentIndex]) {
        updated[currentIndex] = { ...updated[currentIndex], audio: true };
      }
      return updated;
    });

    playTactileBeep(840);

    // Instant tactile UI edge warning glow
    const isCorrectMatch = currentIndex >= nValue && sequence[currentIndex - nValue]?.audioIndex === sequence[currentIndex]?.audioIndex;
    setFeedback(isCorrectMatch ? 'success' : 'failure');
    setTimeout(() => setFeedback(null), 250);
  }, [gameState, currentIndex, userDecisions, nValue, sequence]);

  // Evaluates answer at the closing of each trial slot
  const evaluateTrial = React.useCallback((idx: number) => {
    if (idx < nValue) return; // ignore starter indexes beneath N boundary

    const stim = sequence[idx];
    const targetStim = sequence[idx - nValue];

    const hasPosMatch = targetStim?.position === stim?.position;
    const hasAudMatch = targetStim?.audioIndex === stim?.audioIndex;

    const userPressedPos = userDecisions[idx]?.position || false;
    const userPressedAud = userDecisions[idx]?.audio || false;

    // Direct Dual N-Back true check rules
    const posValidation = hasPosMatch ? userPressedPos : !userPressedPos;
    const audValidation = hasAudMatch ? userPressedAud : !userPressedAud;

    const correctMatch = posValidation && audValidation;

    setTotalDecisions(prev => prev + 1);
    if (correctMatch) {
      setCorrectHits(prev => prev + 1);
      setScore(prev => prev + 100);
      setFeedback('success');
    } else {
      setFeedback('failure');
    }

    setTimeout(() => {
      setFeedback(null);
    }, 280);
  }, [nValue, sequence, userDecisions]);

  // Coordinated play timer handler
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (currentIndex < 0) return;

    if (currentIndex >= 20) {
      return;
    }

    let stimTimer: NodeJS.Timeout | null = null;

    // Trigger visual/auditory stimulus
    const stimulus = sequence[currentIndex];
    if (stimulus) {
      const pos = stimulus.position;
      stimTimer = setTimeout(() => {
        setActiveCell(pos);
      }, 0);
      playFreq(AUDIO_FREQS[stimulus.audioIndex], 0.45);
    }

    // Visual pulse decay timer
    const fadeTimer = setTimeout(() => {
      setActiveCell(null);
    }, 500);

    // Speed calculation regulates response interval based on N level
    const speedLimit = Math.max(1400, customInterval - (nValue - 1) * 200);

    // Primary next loop timer
    const loopTimer = setTimeout(() => {
      // Evaluate current trial decisions before incrementing index
      evaluateTrial(currentIndex);
      
      const nextIndex = currentIndex + 1;
      if (nextIndex >= 20) {
        setGameState('blockEnded');
        
        // Register final score directly in database
        const finalScore = score + (nValue * 500);
        if (currentUser) {
          supabaseClient.db.saveScore(currentUser.id, 'Chronos Sync', finalScore, nValue);
          onRefreshUser();
        }
      } else {
        setCurrentIndex(nextIndex);
      }
    }, speedLimit);

    return () => {
      if (stimTimer) clearTimeout(stimTimer);
      clearTimeout(fadeTimer);
      clearTimeout(loopTimer);
    };
  }, [currentIndex, gameState, sequence, customInterval, nValue, currentUser, onRefreshUser, score, evaluateTrial]);

  // Keyboard handler listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      const key = e.key.toLowerCase();
      if (key === 'a') {
        handlePositionMatchInput();
      } else if (key === 'l') {
        handleAudioMatchInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, currentIndex, sequence, userDecisions]);

  // Start sequence and allocate state arrays
  const startActualGame = () => {
    // Initial audio context unlock gesture
    if (typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtxClass();
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    }

    const generated = generateBlockSequence(nValue);
    setSequence(generated);
    setUserDecisions(Array(20).fill({ position: false, audio: false }));
    
    setScore(0);
    setCorrectHits(0);
    setTotalDecisions(0);
    setGameState('playing');

    // Electronic startup chords progression
    playFreq(523.25, 0.15);
    setTimeout(() => playFreq(659.25, 0.15), 150);
    setTimeout(() => playFreq(783.99, 0.25), 300);

    setTimeout(() => {
      setCurrentIndex(0);
    }, 1000);
  };

  // Dynamic regulators at block completions
  const blockStats = useMemo(() => {
    const total = totalDecisions > 0 ? totalDecisions : 1;
    const accuracyValue = Math.round((correctHits / total) * 100);
    
    let regulator: 'increase' | 'decrease' | 'stable' = 'stable';
    if (accuracyValue >= 85) regulator = 'increase';
    else if (accuracyValue < 70 && nValue > 1) regulator = 'decrease';

    return { accuracy: accuracyValue, outcome: regulator };
  }, [correctHits, totalDecisions, nValue]);

  const handleAdvanceBlock = () => {
    const { outcome } = blockStats;
    let nextN = nValue;

    if (outcome === 'increase') {
      nextN = nValue + 1;
      playFreq(920, 0.4);
    } else if (outcome === 'decrease' && nValue > 1) {
      nextN = nValue - 1;
      playFreq(240, 0.5);
    }

    setNValue(nextN);
    setCurrentBlock(c => c + 1);

    // Wipe values and structures to baseline
    setSequence([]);
    setCurrentIndex(-1);
    setUserDecisions([]);
    setScore(0);
    setCorrectHits(0);
    setTotalDecisions(0);

    setGameState('playing');
    const generated = generateBlockSequence(nextN);
    setSequence(generated);
    setUserDecisions(Array(20).fill({ position: false, audio: false }));

    setTimeout(() => {
      setCurrentIndex(0);
    }, 1200);
  };

  const handleResetGame = () => {
    setNValue(1);
    setCurrentBlock(1);
    setSequence([]);
    setCurrentIndex(-1);
    setUserDecisions([]);
    setScore(0);
    setCorrectHits(0);
    setTotalDecisions(0);
    setGameState('intro');
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col justify-between p-6 transition-all relative overflow-hidden select-none font-sans">
      
      {/* 🔮 Active Feedback Glow Layers */}
      <AnimatePresence>
        {feedback === 'success' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 border-8 border-emerald-500/40 pointer-events-none z-50 rounded-none mix-blend-screen"
          />
        )}
        {feedback === 'failure' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 border-8 border-rose-600/40 pointer-events-none z-50 rounded-none mix-blend-screen"
          />
        )}
      </AnimatePresence>

      {/* Futuristic CRT lines decoration */}
      <div className="absolute inset-0 bg-white/[0.015] pointer-events-none [background-size:100%_4px] [background-image:linear-gradient(rgba(255,255,255,0.05)_50%,transparent_50%)]" />

      {/* Navigation Headers */}
      <header className="flex justify-between items-center border-b border-zinc-850 pb-4 relative z-10">
        <button 
          onClick={onBack}
          className="group text-xs text-zinc-500 hover:text-white flex items-center gap-1.5 font-mono cursor-pointer transition-colors"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          <span>[SANTUARIO_VOLVER]</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono tracking-widest text-cyan-400 bg-cyan-950/20 px-2 py-0.5 border border-cyan-500/25 uppercase font-bold">
            CHRONOS_DECK // ONLINE_SYNC_STABLE
          </span>
          <Activity size={14} className="text-cyan-400 animate-pulse" />
        </div>
      </header>

      {/* Main interactive grid and configurations */}
      <div className="my-auto max-w-[980px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-20">
        
        {/* Metric dashboard columns */}
        <div className="col-span-1 lg:col-span-5 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Cpu size={18} className="text-cyan-400" />
              <span className="font-mono text-[10px] font-bold tracking-widest text-cyan-400 uppercase">
                COGNITION_LABS // DECK_02
              </span>
            </div>
            <h1 className="text-4.5xl md:text-5xl font-black uppercase tracking-tighter text-white font-sans">
              Chronos Sync
            </h1>
            <p className="text-zinc-400 text-xs mt-2 font-serif italic max-w-sm leading-relaxed">
              Dual N-Back cuántico adaptativo de alto rendimiento. Mide tus umbrales de coincidencia sónica y ubicación espacial bajo alternancia selectiva.
            </p>
          </div>

          {/* Active play indicators HUD */}
          {gameState === 'playing' && (
            <div className="border border-zinc-800 p-4 space-y-3 font-mono bg-zinc-950/60 leading-tight">
              <div className="flex justify-between text-xs border-b border-zinc-850 pb-1.5">
                <span className="text-zinc-500">INDICE N-BACK EN VIVO:</span>
                <span className="text-cyan-400 font-bold">N = {nValue}</span>
              </div>
              <div className="flex justify-between text-xs border-b border-zinc-850 pb-1.5">
                <span className="text-zinc-500">LÍNEA DE TIEMPO (TRIAL):</span>
                <span className="text-zinc-300">#{currentIndex + 1} de 20</span>
              </div>
              <div className="flex justify-between text-xs border-b border-zinc-850 pb-1.5">
                <span className="text-zinc-500">PRECISIÓN EN TIEMPO REAL:</span>
                <span className="text-emerald-400 font-black">
                  {totalDecisions > 0 ? Math.round((correctHits / totalDecisions) * 100) : 100}%
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">PUNTOS DE REJILLA:</span>
                <span className="text-cyan-400 font-black">{score} PTS</span>
              </div>

              {/* Dynamic work tape dashboard */}
              <div className="mt-4 pt-3 border-t border-zinc-850 space-y-1">
                <span className="text-[9px] text-zinc-500 block uppercase tracking-wider">Últimos indices de cinta en memoria:</span>
                <div className="flex items-center gap-1 text-[9px]">
                  {Array.from({ length: Math.max(5, nValue + 2) }).map((_, i) => {
                    const idx = currentIndex - i;
                    const exists = idx >= 0 && idx < sequence.length;
                    return (
                      <div 
                        key={i} 
                        className={`grow h-4 border flex items-center justify-center font-mono ${
                          i === 0 
                            ? 'border-cyan-500 bg-cyan-950/30 text-cyan-300 font-bold' 
                            : i === nValue 
                            ? 'border-emerald-500 bg-emerald-950/30 text-emerald-300 font-bold' 
                            : 'border-zinc-850 text-zinc-600'
                        }`}
                      >
                        {exists ? `[${sequence[idx].position + 1}]` : '-'}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[8px] text-zinc-600 font-mono mt-1">
                  <span>ACTUAL</span>
                  <span>MARCADOR COMPARACIÓN N={nValue} ATRÁS</span>
                </div>
              </div>
            </div>
          )}

          {/* Intro controller decks */}
          {gameState === 'intro' && (
            <div className="border border-zinc-850 p-4 space-y-4 bg-zinc-950/40">
              <span className="font-mono text-[10px] font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-1">
                <Sliders size={12} /> CONFIGURACIONES CUÁNTICAS
              </span>

              <div className="space-y-1 font-mono">
                <label className="text-xs text-zinc-500 block">MEMORIA DE TRABAJO INDICE N:</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map(idx => (
                    <button
                      key={idx}
                      onClick={() => setNValue(idx)}
                      className={`py-2 text-xs font-bold border transition-colors cursor-pointer ${nValue === idx ? 'bg-cyan-500 border-cyan-400 text-black font-black' : 'bg-transparent border-zinc-800 text-zinc-400 hover:text-white'}`}
                    >
                      N = {idx}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1 font-mono">
                <label className="text-xs text-zinc-500 block">VELOCIDAD ENTRE INTERVALOS:</label>
                <div className="grid grid-cols-3 gap-1.5 font-bold uppercase text-[9px]">
                  {[
                    { ms: 3000, label: 'LENTO (3.0S)' },
                    { ms: 2500, label: 'ESTÁNDAR (2.5S)' },
                    { ms: 1800, label: 'SÍNCRON (1.8S)' },
                  ].map(item => (
                    <button
                      key={item.ms}
                      onClick={() => setCustomInterval(item.ms)}
                      className={`py-1.5 border transition-colors cursor-pointer ${customInterval === item.ms ? 'bg-zinc-200 border-white text-black' : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-white'}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* User Key map manual instructions card */}
          <div className="border border-zinc-850 p-4 bg-zinc-950/20 font-mono text-[10px] text-zinc-500 space-y-2 leading-relaxed">
            <span className="text-zinc-300 font-bold tracking-wider">[TECLAS_ASIGNACIÓN]</span>
            <p>
              Usa atajos rápidos de teclado para validar coincidencias en tiempo récord:
            </p>
            <div className="flex gap-4 border-t border-zinc-900 pt-2 text-[9px] text-zinc-400 font-bold">
              <div className="flex items-center gap-1.5">
                <span className="bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 text-cyan-400 rounded">A</span>
                <span>Coincidencia Posición</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 text-[#FF5028] rounded">L</span>
                <span>Coincidencia Audio</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Interactive 3x3 Grid Space */}
        <div className="col-span-1 lg:col-span-7 flex flex-col items-center justify-center">
          
          <div className="w-full aspect-square max-w-[420px] bg-zinc-950 border border-zinc-850 p-6 flex flex-col justify-between relative shadow-2xl">
            
            {/* Fine framing indicators */}
            <div className="absolute top-2 left-3 font-mono text-[8px] text-zinc-600 uppercase">SYS_GRID // DUAL_NBACK_MATRIX</div>
            <div className="absolute top-2 right-3 font-mono text-[8px] text-zinc-600 leading-none">BLOCK: #{currentBlock}</div>
            <div className="absolute bottom-2 left-3 font-mono text-[8px] text-zinc-600 uppercase">CALIBRADO_N: {nValue}</div>
            <div className="absolute bottom-2 right-3 font-mono text-[8px] text-zinc-600">PORT: 3000</div>

            {/* INTRO SCREEN */}
            {gameState === 'intro' && (
              <div className="grow flex flex-col items-center justify-center text-center p-4 space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-xl scale-75 animate-pulse" />
                  <div className="w-16 h-16 border border-cyan-500 bg-cyan-950/30 flex items-center justify-center relative">
                    <Brain className="text-cyan-400" size={32} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono tracking-widest text-cyan-400 font-bold uppercase block">
                    ENTRENAMIENTO COGNITIVO SOBERANO
                  </span>
                  <h2 className="text-2.5xl font-black uppercase tracking-tight text-white leading-tight">
                    ESTIMULACIÓN CHRONOS SYNC
                  </h2>
                  <p className="text-xs text-zinc-400 font-serif italic max-w-xs leading-normal mx-auto font-medium">
                    Activa el sincronizador táctico de datos. Entrena tu atención sostenida sónica y visoespacial con retroalimentación biométrica en tiempo real.
                  </p>
                </div>

                <button
                  onClick={startActualGame}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black px-8 py-3.5 font-mono font-black text-xs uppercase tracking-wider transition-all cursor-pointer border border-cyan-400 relative overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.35)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] active:scale-95"
                >
                  CONECTAR PULSO QUANTUM
                </button>
              </div>
            )}

            {/* PLAYING GRID MATRIX */}
            {gameState === 'playing' && (
              <div className="grow flex items-center justify-center">
                <div className="grid grid-cols-3 gap-3 w-72 h-72">
                  {Array.from({ length: 9 }).map((_, idx) => {
                    const isLit = activeCell === idx;
                    return (
                      <div 
                        key={idx}
                        className={`relative aspect-square border border-zinc-800 bg-black flex items-center justify-center transition-all ${isLit ? 'border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.25)]' : ''}`}
                      >
                        {/* Holloway circle node indicator */}
                        <div className={`w-3.5 h-3.5 rounded-full border transition-all ${isLit ? 'border-cyan-400 bg-cyan-400 scale-125 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'border-zinc-850'}`} />

                        {/* Neon Cyan expansion wave on trigger */}
                        <AnimatePresence>
                          {isLit && (
                            <motion.div 
                              initial={{ scale: 0.1, opacity: 1 }}
                              animate={{ scale: 2.2, opacity: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.45, ease: 'easeOut' }}
                              className="absolute inset-0 bg-cyan-400/35 pointer-events-none rounded-none"
                            />
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* BLOCK STATISTICS COMPOSITE */}
            {gameState === 'blockEnded' && (
              <div className="grow flex flex-col items-center justify-center text-center p-4 space-y-6">
                
                <div className="space-y-1">
                  <span className="text-[10px] font-mono tracking-widest text-[#FF5028] font-black block uppercase">
                    SECCIÓN DE BLOQUE DIAGNOSTICADA
                  </span>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight font-sans">
                    CONVERGENCIA DE BLOQUE #{currentBlock}
                  </h3>
                </div>

                {/* Score and results metrics boxes */}
                <div className="grid grid-cols-2 gap-3 w-full font-mono max-w-xs text-xs">
                  <div className="border border-zinc-850 p-3 bg-zinc-950 text-left">
                    <span className="text-[8px] text-zinc-500 block">PRECISIÓN TOTAL:</span>
                    <span className={`text-base font-black ${blockStats.accuracy >= 80 ? 'text-emerald-400' : 'text-[#FF5028]'}`}>
                      {blockStats.accuracy}%
                    </span>
                  </div>
                  <div className="border border-zinc-850 p-3 bg-zinc-950 text-left">
                    <span className="text-[8px] text-zinc-500 block">NIVEL N REGULADO:</span>
                    <span className="text-base font-black text-cyan-400 flex items-center gap-1 leading-none pt-0.5">
                      N = {nValue}
                      {blockStats.outcome === 'increase' && <span className="text-emerald-400 text-[10px] animate-bounce">▲ +1</span>}
                      {blockStats.outcome === 'decrease' && <span className="text-[#FF5028] text-[10px]">▼ -1</span>}
                    </span>
                  </div>
                </div>

                {/* Regulation description */}
                <div className="text-xs font-serif italic text-zinc-400 max-w-xs leading-relaxed">
                  {blockStats.outcome === 'increase' ? (
                    <span className="text-emerald-400 font-bold font-mono text-[9px] not-italic block uppercase border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 mb-2 tracking-wider">
                      ⚡ NIVEL DE PRECISIÓN SUPERADO (BENCHMARK &gt;= 85%). DIFICULTAD N CARGADA +1
                    </span>
                  ) : blockStats.outcome === 'decrease' ? (
                    <span className="text-[#FF5028] font-bold font-mono text-[10px] not-italic block uppercase border border-red-500/20 bg-red-500/5 px-2.5 py-1 mb-2 tracking-wider">
                      ⚠️ DEBAJO DEL LÍMITE DE ALTERNANCIA (70%). DIFICULTAD REDUCIDA
                    </span>
                  ) : (
                    <span className="text-zinc-500 font-bold font-mono text-[10px] not-italic block uppercase border border-zinc-800 bg-zinc-900/10 px-2.5 py-1 mb-2 tracking-wider">
                      ● CALIBRACIÓN EQUILIBRADA. NIVELES ESTABLES
                    </span>
                  )}
                  Tus perfiles de agilidad y estadísticas de descarte dinámico se han cargado de forma soberana a la base de datos central.
                </div>

                {/* CTA interactive triggers */}
                <div className="flex gap-3 w-full max-w-sm justify-center">
                  <button
                    onClick={handleResetGame}
                    className="border border-zinc-800 hover:border-zinc-500 hover:text-white text-zinc-400 px-4 py-3 font-mono text-xs uppercase tracking-wide cursor-pointer flex items-center gap-1 transition-all"
                  >
                    <RotateCcw size={12} /> Reiniciar
                  </button>

                  <button
                    onClick={handleAdvanceBlock}
                    className="bg-white hover:bg-cyan-400 text-black px-6 py-3 font-mono font-black text-xs uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-all w-48 justify-center shadow-[4px_4px_0_rgba(34,211,238,0.3)] hover:shadow-none"
                  >
                    Siguiente N-Bloque <ChevronRight size={14} />
                  </button>
                </div>

              </div>
            )}

          </div>

          {/* Tactical play actuators */}
          {gameState === 'playing' && (
            <div className="w-full max-w-[420px] grid grid-cols-2 gap-4 mt-6">
              
              {/* POSITION TRIGGER */}
              <button
                onClick={handlePositionMatchInput}
                className={`border-2 p-4 flex flex-col items-center justify-center transition-all cursor-pointer relative font-mono ${
                  userDecisions[currentIndex]?.position 
                    ? 'bg-cyan-500 border-cyan-400 text-black font-black shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                    : 'bg-zinc-950 border-zinc-850 text-zinc-300 hover:text-white hover:border-zinc-500'
                }`}
              >
                <div className="text-[10px] text-zinc-500 uppercase font-normal tracking-wide leading-none mb-1">TECLA [A]</div>
                <div className="text-sm font-extrabold tracking-tight uppercase">Coincidencia Visual</div>
                
                <div className="absolute top-1.5 right-2 text-[8px] bg-zinc-900 px-1 py-0.5 text-zinc-500 border border-zinc-800">
                  POSICIÓN
                </div>
              </button>

              {/* AUDIO TRIGGER */}
              <button
                onClick={handleAudioMatchInput}
                className={`border-2 p-4 flex flex-col items-center justify-center transition-all cursor-pointer relative font-mono ${
                  userDecisions[currentIndex]?.audio 
                    ? 'bg-[#FF5028] border-[#FF5028] text-white font-black shadow-[0_0_10px_rgba(255,80,40,0.3)]' 
                    : 'bg-zinc-950 border-zinc-850 text-zinc-300 hover:text-white hover:border-zinc-500'
                }`}
              >
                <div className="text-[10px] text-zinc-500 uppercase font-normal tracking-wide leading-none mb-1">TECLA [L]</div>
                <div className="text-sm font-extrabold tracking-tight uppercase">Coincidencia Auditiva</div>

                <div className="absolute top-1.5 right-2 text-[8px] bg-zinc-900 px-1 py-0.5 text-zinc-500 border border-zinc-800">
                  FIRMA SONIDO
                </div>
              </button>

            </div>
          )}

        </div>

      </div>

      {/* Cyberpunk minimal bottom information bar */}
      <footer className="mt-8 border-t border-zinc-900 pt-4 flex flex-col sm:flex-row justify-between items-center text-[9px] font-mono text-zinc-600 relative z-10 font-bold uppercase">
        <span>GRID DE COGNICIÓN SOBERANA CHRONOS // DISPARADOR ACTIVO</span>
        <span className="flex items-center gap-1.5 text-emerald-500">
          STATUS: <span className="animate-pulse">● CANAL RECEPTOR CUÁNTICO ESTABLE</span>
        </span>
      </footer>

    </div>
  );
}
