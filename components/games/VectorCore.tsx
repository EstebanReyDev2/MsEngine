// 📂 /components/games/VectorCore.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useHaptic } from '@/hooks/use-haptic';
import { useIsMobile } from '@/hooks/use-mobile';
import { saveGameScore } from '@/lib/gameScoreService';
import GameShell from '@/components/shared/GameShell';
import { 
  Cpu, Sparkles, Activity, Brain, RotateCcw, 
  ArrowLeft, Check, AlertCircle, Play, Sliders, ChevronLeft, ChevronRight, Volume2, VolumeX, Zap 
} from 'lucide-react';

interface VectorCoreProps {
  onBack: () => void;
  currentUser: any;
  onRefreshUser: () => void;
}

interface FlankerTrial {
  targetDirection: 'left' | 'right';
  isCongruent: boolean;
  distractorScale: number; // 0.7 to 1.3
  distractorColor: 'normal' | 'magenta' | 'yellow' | 'accent';
}

export default function VectorCore({ onBack, currentUser, onRefreshUser }: VectorCoreProps) {
  const haptic = useHaptic();
  const isMobile = useIsMobile();
  // Configs and preferences
  const [level, setLevel] = useState(1);
  const [metronomeActive, setMetronomeActive] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Game state flow
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'blockEnded'>('intro');
  const [currentBlock, setCurrentBlock] = useState(1);
  
  // Sequence representation
  const [trials, setTrials] = useState<FlankerTrial[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [userAnswers, setUserAnswers] = useState<('left' | 'right' | 'timeout' | null)[]>([]);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  
  // Tactile screen overlays
  const [feedback, setFeedback] = useState<'success' | 'failure' | 'timeout' | null>(null);

  // Timers and operational refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const trialStartTimeRef = useRef<number>(0);
  const hasRespondedThisTrial = useRef<boolean>(false);

  // Audio Synthesizer Engine
  const playSynthesizerTone = useCallback((freq: number, type: 'sine' | 'triangle' | 'percussive', duration = 0.15) => {
    if (!soundEnabled || typeof window === 'undefined') return;
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

      osc.type = type === 'percussive' ? 'sine' : type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      if (type === 'percussive') {
        // Soft percussive click for metronome pulse
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      } else if (freq > 800) {
        // Success high resonant chime
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      } else {
        // Error dry, flat low tone
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      }

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Fail silently
    }
  }, [soundEnabled]);

  // Generate adaptive trials list for a 20-trial block
  const generateAdaptiveTrials = useCallback((currLevel: number): FlankerTrial[] => {
    const list: FlankerTrial[] = [];
    
    // Config values based on level
    // Incongruent ratio increases with higher levels (starts 20%, caps at 65%)
    const incongruentChance = Math.min(0.65, 0.20 + (currLevel - 1) * 0.09);
    
    for (let i = 0; i < 20; i++) {
      const targetDir: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right';
      const isCongruent = Math.random() > incongruentChance;
      
      // Secondary dimensions (flicker/color and size alterations)
      let scale = 1.0;
      let colorMode: 'normal' | 'magenta' | 'yellow' | 'accent' = 'normal';

      if (currLevel >= 2) {
        // Distractor size deviation starts at level 2
        scale = 0.7 + Math.random() * 0.6; // random from 0.7x to 1.3x size
      }

      if (currLevel >= 3) {
        // Distractor color deviations start at level 3
        const colRand = Math.random();
        if (colRand < 0.35) {
          colorMode = 'magenta';
        } else if (colRand < 0.70) {
          colorMode = 'yellow';
        } else {
          colorMode = 'accent';
        }
      }

      list.push({
        targetDirection: targetDir,
        isCongruent,
        distractorScale: Number(scale.toFixed(2)),
        distractorColor: colorMode,
      });
    }

    return list;
  }, []);

  // Compute timing properties adaptively (decreases from 1100ms down to 400ms threshold)
  const trialResponseWindowMs = useMemo(() => {
    return Math.max(400, 1100 - (level - 1) * 110);
  }, [level]);

  // Main evaluation logic
  const handlePlayerDecision = useCallback((decision: 'left' | 'right') => {
    if (gameState !== 'playing' || currentIndex < 0 || currentIndex >= 20) return;
    if (hasRespondedThisTrial.current) return;

    hasRespondedThisTrial.current = true;
    const now = performance.now();
    const rt = now - trialStartTimeRef.current;

    const currentTrial = trials[currentIndex];
    const isCorrect = currentTrial.targetDirection === decision;

    setUserAnswers(prev => {
      const updated = [...prev];
      updated[currentIndex] = decision;
      return updated;
    });

    setReactionTimes(prev => [...prev, rt]);

    if (isCorrect) {
      setCorrectCount(c => c + 1);
      setStreak(s => {
        const next = s + 1;
        if (next > maxStreak) setMaxStreak(next);
        return next;
      });
      // Score adds base points plus extra precision bonus
      const speedBonus = Math.max(0, Math.round((trialResponseWindowMs - rt) / 5));
      setScore(s => s + 100 + speedBonus);
      setFeedback('success');
      haptic.success();
      playSynthesizerTone(1020, 'sine', 0.15);
    } else {
      setStreak(0);
      setFeedback('failure');
      haptic.error();
      playSynthesizerTone(210, 'triangle', 0.25);
    }

    setTimeout(() => {
      setFeedback(null);
    }, 220);
  }, [gameState, currentIndex, trials, maxStreak, trialResponseWindowMs, playSynthesizerTone]);

  // Keyboard handler triggers mapping Left & Right arrow controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePlayerDecision('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handlePlayerDecision('right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, handlePlayerDecision]);

  // Timed loop system for the continuous presentation of flanker blocks
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (currentIndex < 0) return;

    if (currentIndex >= 20) {
      // Completed current block of 20 trials successfully - defer to avoid cascading triggers
      const completeTimer = setTimeout(() => {
        setGameState('blockEnded');
        
        // Persistence integration with permanent storage
        const finalScore = score + (level * 600);
        if (currentUser) {
          saveGameScore(currentUser?.id, 'Vector Core', finalScore, level);
          onRefreshUser();
        }
      }, 0);
      
      return () => clearTimeout(completeTimer);
    }

    // New Trial Initialization Setup
    hasRespondedThisTrial.current = false;
    trialStartTimeRef.current = performance.now();

    // Soft click indicating sync metronome pulse beat
    if (metronomeActive) {
      playSynthesizerTone(380, 'percussive', 0.07);
    }

    let isCleanedUp = false;

    // Timeout trigger for single trial presentation limits
    const responseTimer = setTimeout(() => {
      if (isCleanedUp) return;
      if (!hasRespondedThisTrial.current) {
        // Registered timeout violation
        hasRespondedThisTrial.current = true;
        setUserAnswers(prev => {
          const updated = [...prev];
          updated[currentIndex] = 'timeout';
          return updated;
        });
        setStreak(0);
        setFeedback('timeout');
        playSynthesizerTone(160, 'triangle', 0.35);

        setTimeout(() => {
          if (!isCleanedUp) setFeedback(null);
        }, 220);
      }
    }, trialResponseWindowMs);

    // Dynamic trial slide cooldown interval between trials
    const gapTimer = setTimeout(() => {
      if (isCleanedUp) return;
      setCurrentIndex(prev => prev + 1);
    }, trialResponseWindowMs + 380); // Rest buffer before following stimulus is loaded

    return () => {
      isCleanedUp = true;
      clearTimeout(responseTimer);
      clearTimeout(gapTimer);
    };
  }, [currentIndex, gameState, level, trialResponseWindowMs, score, metronomeActive, playSynthesizerTone, currentUser, onRefreshUser]);

  // Main system initializer trig
  const startActualGame = () => {
    // Prime context
    if (typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtxClass();
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    }

    const firstTrials = generateAdaptiveTrials(level);
    setTrials(firstTrials);
    setUserAnswers(Array(20).fill(null));
    setReactionTimes([]);
    setScore(0);
    setCorrectCount(0);
    setStreak(0);
    setMaxStreak(0);
    setGameState('playing');

    // Startup neon hum chords
    playSynthesizerTone(440, 'sine', 0.12);
    setTimeout(() => playSynthesizerTone(554, 'sine', 0.12), 120);
    setTimeout(() => playSynthesizerTone(659, 'sine', 0.25), 240);

    // Warm-up wait interval
    setTimeout(() => {
      setCurrentIndex(0);
    }, 1200);
  };

  // Block scoring calculations
  const blockStats = useMemo(() => {
    const totalReactionTime = reactionTimes.reduce((sum, t) => sum + t, 0);
    const avgRt = reactionTimes.length > 0 ? Math.round(totalReactionTime / reactionTimes.length) : 0;
    const accuracy = Math.round((correctCount / 20) * 100);

    let regulatoryAction: 'levelUp' | 'levelDown' | 'stable' = 'stable';
    // Success rate standards for selective processing tasks
    if (accuracy >= 85) {
      regulatoryAction = 'levelUp';
    } else if (accuracy < 60 && level > 1) {
      regulatoryAction = 'levelDown';
    }

    return { accuracy, avgRt, outcome: regulatoryAction };
  }, [correctCount, reactionTimes, level]);

  // Advance level block regulator
  const handleAdvanceBlock = () => {
    const { outcome } = blockStats;
    let nextLevel = level;

    if (outcome === 'levelUp') {
      nextLevel = level + 1;
      playSynthesizerTone(880, 'sine', 0.4);
    } else if (outcome === 'levelDown' && level > 1) {
      nextLevel = level - 1;
      playSynthesizerTone(220, 'triangle', 0.5);
    }

    setLevel(nextLevel);
    setCurrentBlock(b => b + 1);

    // Reboot sequence structures
    setTrials([]);
    setCurrentIndex(-1);
    setUserAnswers([]);
    setReactionTimes([]);
    setScore(0);
    setCorrectCount(0);
    setStreak(0);

    setGameState('playing');
    const freshGenerated = generateAdaptiveTrials(nextLevel);
    setTrials(freshGenerated);
    setUserAnswers(Array(20).fill(null));

    setTimeout(() => {
      setCurrentIndex(0);
    }, 1200);
  };

  const handleResetGame = () => {
    setLevel(1);
    setCurrentBlock(1);
    setTrials([]);
    setCurrentIndex(-1);
    setUserAnswers([]);
    setReactionTimes([]);
    setScore(0);
    setCorrectCount(0);
    setStreak(0);
    setMaxStreak(0);
    setGameState('intro');
  };

  // Obtain active gliph rendering variables
  const currentTrialData = useMemo(() => {
    if (currentIndex >= 0 && currentIndex < trials.length) {
      return trials[currentIndex];
    }
    return null;
  }, [currentIndex, trials]);

  return (
    <GameShell active={gameState !== 'intro'}>
    <div className="game-area min-h-screen bg-neutral-950 text-zinc-100 flex flex-col justify-between p-6 relative overflow-hidden select-none font-sans">
      
      {/* 🔮 Active Peripheral Alert Frame overlay */}
      <AnimatePresence>
        {feedback === 'success' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 border-8 border-emerald-500/25 pointer-events-none z-50 rounded-none mix-blend-screen"
          />
        )}
        {feedback === 'failure' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 border-8 border-rose-500/25 pointer-events-none z-50 rounded-none mix-blend-screen"
          />
        )}
        {feedback === 'timeout' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 border-8 border-amber-500/25 pointer-events-none z-50 rounded-none mix-blend-screen"
          />
        )}
      </AnimatePresence>

      {/* Retro scan laser active line overlay */}
      {gameState === 'playing' && level >= 4 && (
        <motion.div 
          initial={{ y: '-100%' }}
          animate={{ y: '100vw' }}
          transition={{ repeat: Infinity, duration: 4.8, ease: 'linear' }}
          className="absolute inset-x-0 h-[2px] bg-cyan-400/20 shadow-[0_0_8px_rgba(34,211,238,0.5)] pointer-events-none z-10"
        />
      )}

      {/* Vector terminal alignment lines decor (Anti-AI-slop professional aesthetic) */}
      <div className="absolute inset-0 bg-transparent opacity-5 pointer-events-none [background-size:20px_20px] [background-image:linear-gradient(to_right,gray_1px,transparent_1px),linear-gradient(to_bottom,gray_1px,transparent_1px)]" />

      {/* System Command Header */}
      <header className="flex justify-between items-center border-b border-neutral-800 pb-4 relative z-10">
          <button 
            onClick={onBack}
            className="group text-xs text-neutral-500 hover:text-white flex items-center gap-1.5 font-mono cursor-pointer transition-colors min-h-[44px] min-w-[44px]"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            <span className="hidden md:inline">[SANTUARIO_MS]</span>
          </button>

        <div className="flex items-center gap-4">
          {/* Sound settings shortcuts */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="text-neutral-550 hover:text-white transition-colors p-1"
              title={soundEnabled ? "Mute audios" : "Unmute audios"}
            >
              {soundEnabled ? <Volume2 size={13} className="text-cyan-400" /> : <VolumeX size={13} />}
            </button>
            <button
              onClick={() => setMetronomeActive(!metronomeActive)}
              className={`px-2 py-0.5 text-[8px] font-mono border uppercase tracking-wider ${metronomeActive ? 'bg-cyan-950/20 text-cyan-400 border-cyan-400/20' : 'text-neutral-500 border-neutral-800'}`}
              title="Toggle rhythmic alignment metronome"
            >
              metrónomo: {metronomeActive ? 'ON' : 'OFF'}
            </button>
          </div>

          <span className="text-[9px] font-mono tracking-widest text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 border border-[#10B981]/20 uppercase font-black">
            NÚCLEO VECTORIAL ESTABLE
          </span>
        </div>
      </header>

      {/* Main Grid Interactive Segment */}
      <div className="my-auto max-w-[1000px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-20">
        
        {/* Left Side: Rule details & Cognitive telemetry counters */}
        <div className="col-span-1 lg:col-span-5 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Cpu size={18} className="text-cyan-400" />
              <span className="font-mono text-[10px] font-bold tracking-widest text-cyan-400 uppercase">
                VECTOR_CORE // CALIBRACIÓN SENSORIAL
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white">
              Vector Core
            </h1>
            <p className="text-zinc-400 text-xs mt-2 font-serif italic max-w-sm leading-relaxed">
              Filtro de Atención Selectiva adaptativo. Responde únicamente a la orientación del puntero vectorial central, suprimiendo distractores colaterales de alta interferencia cognitiva.
            </p>
          </div>

          {/* Active play indicators telemetry */}
          {gameState === 'playing' && (
            <div className="border border-neutral-800 p-4 space-y-3 font-mono bg-neutral-950/80 leading-tight">
              <div className="flex justify-between text-xs border-b border-neutral-900 pb-1.5">
                <span className="text-neutral-500">VELOCIDAD CALIBRADA:</span>
                <span className="text-cyan-400 font-bold">{trialResponseWindowMs} ms</span>
              </div>
              <div className="flex justify-between text-xs border-b border-neutral-900 pb-1.5">
                <span className="text-neutral-500">NIVEL COGNITIVO:</span>
                <span className="text-zinc-200">NIVEL_BLOCK_{level}</span>
              </div>
              <div className="flex justify-between text-xs border-b border-neutral-900 pb-1.5">
                <span className="text-neutral-500">CONSECUTIVO ACTIVO:</span>
                <span className="text-emerald-400">⚡ {streak} ENSAYOS</span>
              </div>
              <div className="flex justify-between text-xs border-b border-neutral-900 pb-1.5">
                <span className="text-neutral-500">PULSO ACTUAL:</span>
                <span className="text-zinc-200">{currentIndex + 1} / 20</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">RESONANCIA ACUMULADA:</span>
                <span className="text-[#10B981] font-black">{score} PTS</span>
              </div>

              {/* Progress dynamic tape indicators */}
              <div className="pt-2 border-t border-neutral-900 space-y-1">
                <span className="text-[9px] text-neutral-500 block uppercase tracking-wider">Cero de errores en cola (Bloque):</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 20 }).map((_, i) => {
                    const ans = userAnswers[i];
                    return (
                      <div 
                        key={i} 
                        className={`grow h-2.5 border transition-all ${
                          i === currentIndex 
                            ? 'bg-cyan-500/25 border-cyan-400 animate-pulse' 
                            : ans === 'timeout' 
                            ? 'bg-amber-550/40 border-amber-600'
                            : ans && trials[i]?.targetDirection === ans
                            ? 'bg-[#10B981]/35 border-[#10B981]'
                            : ans
                            ? 'bg-rose-600/35 border-rose-600' 
                            : 'border-neutral-900 bg-neutral-950'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Intro calibrations panel setup */}
          {gameState === 'intro' && (
            <div className="border border-neutral-800 p-4 space-y-4 bg-neutral-950/40 font-mono">
              <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase flex items-center gap-1.5">
                <Sliders size={12} /> CALIBRACIÓN DE INGRESO
              </span>

              <div className="space-y-1">
                <label className="text-xs text-neutral-500 block uppercase">Nivel de inicio cognitivo (Fase):</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 4, 6].map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => {
                        setLevel(lvl);
                        playSynthesizerTone(300 + lvl * 90, 'sine');
                      }}
                      className={`py-2 text-xs font-bold border transition-colors cursor-pointer ${level === lvl ? 'bg-cyan-500 border-cyan-400 text-black font-black' : 'bg-transparent border-neutral-800 text-neutral-400 hover:text-white'}`}
                    >
                      FASE {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1 border-t border-neutral-900 pt-3">
                <span className="text-[10px] text-neutral-500 block uppercase">Capas de interferencia activa:</span>
                <div className="text-[9px] text-neutral-400 space-y-1 leading-normal list-inside">
                  <div>• <span className="text-zinc-205 py-0.5 px-1 bg-neutral-900 border border-neutral-800 font-bold">Fase 1-2:</span> Ventana de respuesta estándar, distractores adaptativos espaciales.</div>
                  <div>• <span className="text-cyan-400 py-0.5 px-1 bg-cyan-950/20 border border-cyan-500/20 font-bold">Fase 3-4:</span> Distractores en parpadeo asíncrono (Colores Magenta/Amarillo) + Escaneo vertical láser.</div>
                  <div>• <span className="text-rose-450 py-0.5 px-1 bg-rose-950/10 border border-rose-500/10 font-bold">Fase 5-6+:</span> Tiempo límite síncron (&lt;500ms), máxima tasa de incongruencias cruzadas.</div>
                </div>
              </div>
            </div>
          )}

          {/* Fast rules card summary */}
          <div className="border border-neutral-800 p-4 bg-neutral-950/20 font-mono text-[10px] text-neutral-500 space-y-2 leading-relaxed">
            <span className="text-zinc-300 font-bold tracking-wider">[MANUAL_TACTICAL_RULES]</span>
            <p>
              Ignora los distractores de las esquinas. Presiona únicamente la dirección en la que señala la flecha **Central (Core Objetivo)**:
            </p>
            <div className="flex gap-4 border-t border-neutral-900 pt-2 text-[9px] text-[#10B981] font-bold">
              <div className="flex items-center gap-1.5">
                <span className="bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 rounded text-white font-mono">← / A</span>
                <span>Calibrar Izquierda</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 rounded text-white font-mono">→ / D</span>
                <span>Calibrar Derecha</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Side: Interactive Vector presentation space */}
        <div className="col-span-1 lg:col-span-7 flex flex-col items-center justify-center">
          
          <div className="w-full aspect-square max-w-[420px] bg-neutral-950 border border-neutral-800 p-6 flex flex-col justify-between relative shadow-2xl">
            
            {/* Ambient system headers */}
            <div className="absolute top-2 left-3 font-mono text-[8px] text-neutral-600 uppercase">CORE_VECTOR_ENGINE // FLANKER_ATTN</div>
            <div className="absolute top-2 right-3 font-mono text-[8px] text-neutral-600 leading-none">FASE: BLOQUE_{level}</div>
            <div className="absolute bottom-2 left-3 font-mono text-[8px] text-neutral-600 uppercase font-bold">SPEED: {trialResponseWindowMs}ms</div>
            <div className="absolute bottom-2 right-3 font-mono text-[8px] text-neutral-600">SYS_PORT: 3000</div>

            {/* INTRO SCREEN */}
            {gameState === 'intro' && (
              <div className="grow flex flex-col items-center justify-center text-center p-4 space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl scale-75 animate-pulse" />
                  <div className="w-16 h-16 border border-emerald-500 bg-emerald-950/30 flex items-center justify-center relative">
                    <Zap className="text-emerald-400" size={32} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono tracking-widest text-[#10B981] font-bold uppercase block">
                    ATENCIÓN SELECTIVA INTEGRADA
                  </span>
                  <h2 className="text-2.5xl font-black uppercase tracking-tight text-white leading-tight">
                    INICIALIZACIÓN VECTOR CORE
                  </h2>
                  <p className="text-xs text-zinc-400 font-serif italic max-w-xs leading-normal mx-auto">
                    Aíslate del ruido de fondo distractor. Entrena la velocidad de toma de decisiones corticales inhibiendo estímulos adyacentes incompatibles.
                  </p>
                </div>

                <button
                  onClick={startActualGame}
                  className="bg-[#10B981] hover:bg-[#059669] text-black px-8 py-3.5 font-mono font-black text-xs uppercase tracking-wider transition-all cursor-pointer border border-emerald-400 relative overflow-hidden shadow-[0_0_15px_rgba(16,185,129,0.35)] hover:shadow-[0_0_25px_rgba(16,185,129,0.6)] active:scale-95"
                >
                  INYECTAR SECUENCIA VECTOR
                </button>
              </div>
            )}

            {/* PLAYING GRID PRESENTATION ARROWS PATH */}
            {gameState === 'playing' && (
              <div className="grow flex flex-col items-center justify-center">
                
                {/* 5 High HD horizontal flanking arrows row */}
                {currentTrialData ? (
                  <div className="flex items-center justify-center gap-4 py-8">
                    {/* Distractors Left 2 */}
                    {Array.from({ length: 2 }).map((_, idx) => {
                      const pointsLeft = currentTrialData.isCongruent 
                        ? currentTrialData.targetDirection === 'left' 
                        : currentTrialData.targetDirection !== 'left';
                      
                      // Choose distractor custom color properties depending on level specifications
                      const colClass = currentTrialData.distractorColor === 'magenta' 
                        ? 'text-pink-500' 
                        : currentTrialData.distractorColor === 'yellow' 
                        ? 'text-yellow-400' 
                        : currentTrialData.distractorColor === 'accent'
                        ? 'text-cyan-400'
                        : 'text-neutral-500';

                      return (
                        <div 
                          key={`dist-left-${idx}`}
                          className={`transition-all duration-100 ${colClass}`}
                          style={{ transform: `scale(${currentTrialData.distractorScale})` }}
                        >
                          {pointsLeft ? <ChevronLeft size={38} strokeWidth={4} /> : <ChevronRight size={38} strokeWidth={4} />}
                        </div>
                      );
                    })}

                    {/* TARGET CENTRAL ARROW (OBJETIVO) */}
                    <div className="p-3 bg-neutral-900 border-2 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)] rounded-none text-emerald-400 z-10 transition-transform scale-110">
                      {currentTrialData.targetDirection === 'left' ? (
                        <ChevronLeft size={44} strokeWidth={5} />
                      ) : (
                        <ChevronRight size={44} strokeWidth={5} />
                      )}
                    </div>

                    {/* Distractors Right 2 */}
                    {Array.from({ length: 2 }).map((_, idx) => {
                      const pointsLeft = currentTrialData.isCongruent 
                        ? currentTrialData.targetDirection === 'left' 
                        : currentTrialData.targetDirection !== 'left';

                      const colClass = currentTrialData.distractorColor === 'magenta' 
                        ? 'text-pink-500' 
                        : currentTrialData.distractorColor === 'yellow' 
                        ? 'text-yellow-400' 
                        : currentTrialData.distractorColor === 'accent'
                        ? 'text-cyan-400'
                        : 'text-neutral-500';

                      return (
                        <div 
                          key={`dist-right-${idx}`}
                          className={`transition-all duration-100 ${colClass}`}
                          style={{ transform: `scale(${currentTrialData.distractorScale})` }}
                        >
                          {pointsLeft ? <ChevronLeft size={38} strokeWidth={4} /> : <ChevronRight size={38} strokeWidth={4} />}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="font-mono text-xs text-neutral-500 uppercase tracking-widest animate-pulse">
                    CALIBRANDO ENTRADAS VECTORIALES...
                  </div>
                )}

                {/* Instant countdown helper slider bar */}
                {currentTrialData && (
                  <div className="w-64 h-1 bg-neutral-900 mt-6 relative overflow-hidden">
                    <motion.div 
                      key={`timer-bar-${currentIndex}`}
                      initial={{ width: '100%' }}
                      animate={{ width: '0%' }}
                      transition={{ duration: trialResponseWindowMs / 1000, ease: 'linear' }}
                      className="absolute inset-y-0 left-0 bg-cyan-400"
                    />
                  </div>
                )}

              </div>
            )}

            {/* BLOCK завершено STATISTICS */}
            {gameState === 'blockEnded' && (
              <div className="grow flex flex-col items-center justify-center text-center p-4 space-y-6">
                
                <div className="space-y-1">
                  <span className="text-[10px] font-mono tracking-widest text-[#10B981] font-black block uppercase">
                    SECCIÓN COMPLETADA // DIAGNÓSTICO DE FILTRADO
                  </span>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                    ANÁLISIS DE INTERFERENCIA COMPILADO
                  </h3>
                </div>

                {/* Accuracy and speed statistics metrics cards */}
                <div className="grid grid-cols-2 gap-3 w-full font-mono max-w-xs text-xs">
                  <div className="border border-neutral-800 p-3 bg-neutral-900 text-left">
                    <span className="text-[8px] text-neutral-500 block">ENFOQUE SELECTIVO:</span>
                    <span className={`text-[15px] font-black ${blockStats.accuracy >= 80 ? 'text-emerald-400' : 'text-amber-500'}`}>
                      {blockStats.accuracy}%
                    </span>
                  </div>
                  <div className="border border-neutral-800 p-3 bg-neutral-900 text-left">
                    <span className="text-[8px] text-neutral-500 block">VELOCIDAD REFLEJO:</span>
                    <span className="text-[15px] font-black text-cyan-400">
                      {blockStats.avgRt} ms
                    </span>
                  </div>
                </div>

                {/* Regulatory progress feedback text */}
                <div className="text-xs font-serif italic text-zinc-400 max-w-xs leading-normal">
                  {blockStats.outcome === 'levelUp' ? (
                    <span className="text-emerald-400 font-mono text-[9px] not-italic block uppercase border border-emerald-500/20 bg-emerald-500/5 py-1 mb-2 tracking-wider font-extrabold">
                      ⚡ PRECISIÓN DE ATENCIÓN EXCELENTE (&gt;= 85%). NIVEL COGNITIVO AUMENTADO
                    </span>
                  ) : blockStats.outcome === 'levelDown' ? (
                    <span className="text-[#FF5028] font-mono text-[10px] not-italic block uppercase border border-rose-500/20 bg-rose-500/5 py-1 mb-2 tracking-wider font-bold">
                      ⚠️ CONTROL DE INTERFERENCIA DÉBIL (&lt;60%). REGULADOR DE FLUJO REDUCIDO
                    </span>
                  ) : (
                    <span className="text-neutral-500 font-mono text-[10px] not-italic block uppercase border border-neutral-850 bg-neutral-900/40 py-1 mb-2 tracking-wider font-bold">
                      ● CALIBRACIÓN CORRECTA. SECCIÓN EN PARÁMETROS ESTABLES
                    </span>
                  )}
                  Tus perfiles de exclusión asíncrona de distractores espaciales se han persistido exitosamente en tu tarjeta sintáctica de rendimiento.
                </div>

                {/* Back and Advance Buttons and Triggers */}
                <div className="flex gap-3 w-full max-w-sm justify-center">
                  <button
                    onClick={handleResetGame}
                    className="border border-neutral-850 hover:border-neutral-500 text-neutral-450 hover:text-white px-4 py-3 font-mono text-xs uppercase tracking-wide cursor-pointer flex items-center gap-1 transition-all"
                  >
                    <RotateCcw size={12} /> Reiniciar
                  </button>

                  <button
                    onClick={handleAdvanceBlock}
                    className="bg-white hover:bg-emerald-400 hover:border-emerald-400 text-black px-6 py-3 font-mono font-black text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 transition-all w-48 shadow-[4px_4px_0_rgba(16,185,129,0.3)] hover:shadow-none"
                  >
                    Siguiente Fase <ChevronRight size={14} />
                  </button>
                </div>

              </div>
            )}

          </div>

          {/* Large Minimalist Bottom Corner Click/Tactile Areas for mobile devices & desktop clickers */}
          {gameState === 'playing' && (
            <div className="w-full max-w-[420px] grid grid-cols-2 gap-4 mt-6">
              
              {/* LEFT CLICK SECTOR */}
              <button
                onClick={() => handlePlayerDecision('left')}
                onTouchEnd={(e) => { e.preventDefault(); handlePlayerDecision('left'); }}
                className="border border-neutral-800 bg-neutral-950 p-4 hover:border-cyan-500 hover:text-white transition-all text-neutral-400 flex flex-col items-center justify-center font-mono cursor-pointer relative min-h-[64px]"
                style={{ touchAction: 'manipulation' }}
              >
                <div className="text-[9px] text-neutral-600 uppercase font-normal mb-1">Sector Izquierdo</div>
                <div className="text-base font-extrabold tracking-tight flex items-center gap-1">
                  <ChevronLeft size={16} strokeWidth={3} /> CALIBRACIÓN L
                </div>
                <span className="absolute bottom-1 right-2 text-[8px] font-mono text-neutral-700 font-bold">[← / A]</span>
              </button>

              {/* RIGHT CLICK SECTOR */}
              <button
                onClick={() => handlePlayerDecision('right')}
                onTouchEnd={(e) => { e.preventDefault(); handlePlayerDecision('right'); }}
                className="border border-neutral-800 bg-neutral-950 p-4 hover:border-cyan-500 hover:text-white transition-all text-neutral-400 flex flex-col items-center justify-center font-mono cursor-pointer relative min-h-[64px]"
                style={{ touchAction: 'manipulation' }}
              >
                <div className="text-[9px] text-neutral-600 uppercase font-normal mb-1">Sector Derecho</div>
                <div className="text-base font-extrabold tracking-tight flex items-center gap-1">
                  CALIBRACIÓN R <ChevronRight size={16} strokeWidth={3} />
                </div>
                <span className="absolute bottom-1 right-2 text-[8px] font-mono text-neutral-700 font-bold">[→ / D]</span>
              </button>

            </div>
          )}

        </div>

      </div>

      {/* Cyberpunk minimal system foot telemetry footer bar */}
      <footer className="mt-8 border-t border-neutral-900 pt-4 flex flex-col sm:flex-row justify-between items-center text-[9px] font-mono text-neutral-600 relative z-10 font-bold uppercase">
        <span>RED DE EXCLUSIÓN VECTORIAL DE SENSING DE ALTA PRECISIÓN</span>
        <span className="flex items-center gap-1">
          RESONANCIA BIOCORTICAL: <span className="text-[#10B981] animate-pulse">● CALIBRADA COMPILADO</span>
        </span>
      </footer>

    </div>
    </GameShell>
  );
}
