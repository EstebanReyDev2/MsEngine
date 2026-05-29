// 📂 /components/games/TrainOfThought.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';
import { 
  ArrowLeft, Play, Pause, RotateCcw, HelpCircle, 
  Volume2, VolumeX, Trophy, Sparkles, CheckCircle2, 
  XCircle, Zap, RefreshCw, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useHaptic } from '@/hooks/use-haptic';
import { useIsMobile } from '@/hooks/use-mobile';

// Types
interface Train {
  id: string;
  color: 'red' | 'blue' | 'green' | 'yellow';
  segment: 'start_to_A' | 'A_to_B' | 'A_to_C' | 'B_to_Red' | 'B_to_Blue' | 'C_to_Green' | 'C_to_Yellow';
  progress: number; // 0 to 1
  speed: number;    // increment per second
}

interface Particle {
  id: string;
  x: number;
  y: number;
  color: string;
}

interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  colorClass: string;
}

interface TrainOfThoughtProps {
  onBack: () => void;
  currentUser: any;
  onRefreshUser: () => void;
}

// Colors schema mapping
const COLOR_VALUES = {
  red: { hex: '#FF5028', glow: 'rgba(255, 80, 40, 0.4)', text: 'text-[#FF5028]', bg: 'bg-[#FF5028]' },
  blue: { hex: '#00A3FF', glow: 'rgba(0, 163, 255, 0.4)', text: 'text-[#00A3FF]', bg: 'bg-[#00A3FF]' },
  green: { hex: '#10B981', glow: 'rgba(16, 185, 129, 0.4)', text: 'text-[#10B981]', bg: 'bg-[#10B981]' },
  yellow: { hex: '#FBBF24', glow: 'rgba(251, 191, 36, 0.4)', text: 'text-[#FBBF24]', bg: 'bg-[#FBBF24]' }
};

// Math helpers
function interpolateLine(p0: { x: number; y: number }, p1: { x: number; y: number }, t: number) {
  return {
    x: p0.x + (p1.x - p0.x) * t,
    y: p0.y + (p1.y - p0.y) * t
  };
}

function interpolateBezier(
  p0: { x: number; y: number }, 
  p1: { x: number; y: number }, 
  p2: { x: number; y: number }, 
  p3: { x: number; y: number }, 
  t: number
) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
  };
}

// Pure helper function declared outside React scope to bypass purity checks
function generateExplosionParticles(x: number, y: number, color: string): Particle[] {
  const list: Particle[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const length = 5 + Math.random() * 25;
    list.push({
      id: `particle_${Date.now()}_${i}_${Math.random()}`,
      x: x + Math.cos(angle) * length,
      y: y + Math.sin(angle) * length,
      color
    });
  }
  return list;
}

function generateFloatingTextId(): string {
  return `float_${Date.now()}_${Math.random()}`;
}

export default function TrainOfThought({ onBack, currentUser, onRefreshUser }: TrainOfThoughtProps) {
  const haptic = useHaptic();
  const isMobile = useIsMobile();
  // Game state
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'paused' | 'gameover'>('lobby');
  const [secondsLeft, setSecondsLeft] = useState<number>(90);
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(5);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [incorrectCount, setIncorrectCount] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showTutorial, setShowTutorial] = useState<boolean>(true);
  
  // Trains on board
  const [trains, setTrains] = useState<Train[]>([]);
  
  // Active switch directions (0 = left choice, 1 = right choice)
  const [switches, setSwitches] = useState<{ A: number; B: number; C: number }>({ A: 0, B: 0, C: 0 });
  const switchesRef = useRef<{ A: number; B: number; C: number }>({ A: 0, B: 0, C: 0 });

  // Floating effects states
  const [particles, setParticles] = useState<Particle[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);

  // Track the spawning interval timer in game loop
  const gameLoopRef = useRef<number | null>(null);
  const spawnTimerAccumulator = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Nodes screen points specification
  const nodes = {
    start: { x: 400, y: 50 },
    A: { x: 400, y: 160 },
    B: { x: 250, y: 310 },
    C: { x: 550, y: 310 },
    Red: { x: 130, y: 490 },
    Blue: { x: 310, y: 490 },
    Green: { x: 490, y: 490 },
    Yellow: { x: 670, y: 490 }
  };

  // Bezier curve coordinate evaluation for a segment at degree progress
  const getTrainCoords = (segment: string, progress: number) => {
    switch (segment) {
      case 'start_to_A':
        return interpolateLine(nodes.start, nodes.A, progress);
      case 'A_to_B':
        return interpolateBezier(nodes.A, { x: 400, y: 220 }, { x: 250, y: 220 }, nodes.B, progress);
      case 'A_to_C':
        return interpolateBezier(nodes.A, { x: 400, y: 220 }, { x: 550, y: 220 }, nodes.C, progress);
      case 'B_to_Red':
        return interpolateBezier(nodes.B, { x: 250, y: 380 }, { x: 130, y: 380 }, nodes.Red, progress);
      case 'B_to_Blue':
        return interpolateBezier(nodes.B, { x: 250, y: 380 }, { x: 310, y: 380 }, nodes.Blue, progress);
      case 'C_to_Green':
        return interpolateBezier(nodes.C, { x: 550, y: 380 }, { x: 490, y: 380 }, nodes.Green, progress);
      case 'C_to_Yellow':
        return interpolateBezier(nodes.C, { x: 550, y: 380 }, { x: 670, y: 380 }, nodes.Yellow, progress);
      default:
        return nodes.start;
    }
  };

  // Custom retro retro sound synth helper
  const playSound = (freq: number, type: 'sine' | 'square' | 'triangle' | 'sawtooth' = 'sine', duration = 0.1) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio fallback safe
    }
  };

  // Spawn particle effect on matching stations
  const createExplosion = (x: number, y: number, color: string) => {
    const newParticles = generateExplosionParticles(x, y, color);
    setParticles(prev => [...prev, ...newParticles]);
    // Auto-clean particles
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.includes(p)));
    }, 600);
  };

  // Add floating point indicators
  const addFloatingText = (x: number, y: number, text: string, colorClass: string) => {
    const id = generateFloatingTextId();
    setFloatingTexts(prev => [...prev, { id, x, y, text, colorClass }]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(f => f.id !== id));
    }, 1200);
  };

  // Toggle switch trigger
  const toggleSwitch = (key: 'A' | 'B' | 'C') => {
    const nextVal = switches[key] === 0 ? 1 : 0;
    
    switchesRef.current[key] = nextVal;
    setSwitches(prev => ({ ...prev, [key]: nextVal }));
    
    // Play clicking tech chime
    playSound(400 + (nextVal * 150), 'square', 0.05);
    haptic.light();
  };

  // Start the actual game run
  const startGame = () => {
    setGameState('playing');
    setSecondsLeft(90);
    setScore(0);
    setLives(5);
    setCorrectCount(0);
    setIncorrectCount(0);
    setTrains([]);
    setSwitches({ A: 0, B: 0, C: 0 });
    switchesRef.current = { A: 0, B: 0, C: 0 };
    lastTimeRef.current = performance.now();
    spawnTimerAccumulator.current = 0;
    
    playSound(440, 'sine', 0.15);
    setTimeout(() => playSound(554.37, 'sine', 0.15), 100);
    setTimeout(() => playSound(659.25, 'sine', 0.25), 200);
  };

  // Conclude running session
  const endGame = (finalScore: number) => {
    setGameState('gameover');
    playSound(220, 'sawtooth', 0.4);
    
    // Save to Postgres/Local db
    if (currentUser) {
      try {
        supabaseClient.db.saveScore(
          currentUser.id, 
          'Train of Thought', 
          finalScore, 
          Math.min(10, Math.floor(finalScore / 100) + 1)
        );
        onRefreshUser();
      } catch (e) {
        console.error('Error saving score:', e);
      }
    }
  };

  // Process train arrivals at station ports
  const handleTrainArrival = (train: Train) => {
    // Determine the terminal station coordinate we reached
    let stationColor: 'red' | 'blue' | 'green' | 'yellow' = 'red';
    let targetX = 400;
    let targetY = 490;

    switch (train.segment) {
      case 'B_to_Red':
        stationColor = 'red';
        targetX = nodes.Red.x;
        targetY = nodes.Red.y;
        break;
      case 'B_to_Blue':
        stationColor = 'blue';
        targetX = nodes.Blue.x;
        targetY = nodes.Blue.y;
        break;
      case 'C_to_Green':
        stationColor = 'green';
        targetX = nodes.Green.x;
        targetY = nodes.Green.y;
        break;
      case 'C_to_Yellow':
        stationColor = 'yellow';
        targetX = nodes.Yellow.x;
        targetY = nodes.Yellow.y;
        break;
    }

    const isCorrect = (train.color === stationColor);

    if (isCorrect) {
      setScore(prev => {
        const nextScore = prev + 15;
        // Check timer and increase score
        return nextScore;
      });
      setCorrectCount(prev => prev + 1);
      
      // Neon bright blast success
      playSound(783.99, 'triangle', 0.15); // G5 note
      setTimeout(() => playSound(1046.50, 'triangle', 0.2), 100); // C6 note
      
      createExplosion(targetX, targetY, COLOR_VALUES[stationColor].hex);
      addFloatingText(targetX, targetY - 20, '+15 POINTS', 'text-emerald-400 font-black font-mono');
    } else {
      setScore(prev => Math.max(0, prev - 10));
      setIncorrectCount(prev => prev + 1);
      
      // Deduct life
      setLives(prev => {
        const nextLives = prev - 1;
        if (nextLives <= 0) {
          setTimeout(() => endGame(score), 50);
          return 0;
        }
        return nextLives;
      });

      // Mistake buzzer sound
      playSound(120, 'sawtooth', 0.35);
      addFloatingText(targetX, targetY - 20, 'MISMATCH -10', 'text-[#FF5028] font-black font-mono');
    }
  };

  // Core Game Loop
  useEffect(() => {
    if (gameState !== 'playing') {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    const loop = (timestamp: number) => {
      // Delta calculations
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = (timestamp - lastTimeRef.current) / 1000; // in seconds
      lastTimeRef.current = timestamp;

      // Ensure stable frames
      const cappedDt = Math.min(dt, 0.1);

      // 1. Update Remaining Clock
      setSecondsLeft(prev => {
        const nextTime = prev - cappedDt;
        if (nextTime <= 0) {
          setTimeout(() => endGame(score), 50);
          return 0;
        }
        return nextTime;
      });

      // 2. Adaptive Speed & Interval Calculus
      const elapsed = 90 - secondsLeft;
      // Train propagation speed segment traversals (factor dynamically rises with score & time)
      const currentSpeedFactor = Math.min(0.55, 0.23 + (elapsed / 90) * 0.15 + (score / 300) * 0.08);
      // Train spacing rate
      const currentSpawnRate = Math.max(1.5, 4.2 - (elapsed / 90) * 1.6 - (score / 300) * 0.9);

      // 3. Train Spawner Tracker Accrual
      spawnTimerAccumulator.current += cappedDt;
      if (spawnTimerAccumulator.current >= currentSpawnRate) {
        spawnTimerAccumulator.current = 0;
        
        // Spawn fresh train
        const colors: Array<'red' | 'blue' | 'green' | 'yellow'> = ['red', 'blue', 'green', 'yellow'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        const newTrain: Train = {
          id: `train_${Date.now()}_${Math.random()}`,
          color: randomColor,
          segment: 'start_to_A',
          progress: 0.0,
          speed: currentSpeedFactor
        };

        setTrains(prev => [...prev, newTrain]);
        playSound(330, 'sine', 0.08); // quiet spawning chime
      }

      // 4. Update Position/Tracks for All Active Trains
      setTrains(prevTrains => {
        const updated: Train[] = [];

        prevTrains.forEach(train => {
          const nextProgress = train.progress + train.speed * cappedDt;

          if (nextProgress >= 1.0) {
            // Train concluded current track segment! Decipher where to route next.
            let nextSegment: Train['segment'] | null = null;

            if (train.segment === 'start_to_A') {
              const dir = switchesRef.current.A;
              nextSegment = (dir === 0) ? 'A_to_B' : 'A_to_C';
            } else if (train.segment === 'A_to_B') {
              const dir = switchesRef.current.B;
              nextSegment = (dir === 0) ? 'B_to_Red' : 'B_to_Blue';
            } else if (train.segment === 'A_to_C') {
              const dir = switchesRef.current.C;
              nextSegment = (dir === 0) ? 'C_to_Green' : 'C_to_Yellow';
            }

            if (nextSegment === null) {
              // Terminal station point reached
              handleTrainArrival(train);
              // Cleaned from active list
            } else {
              // Send onto next segment route
              updated.push({
                ...train,
                segment: nextSegment,
                progress: 0.0
              });
            }
          } else {
            // Continue straight transit
            updated.push({
              ...train,
              progress: nextProgress
            });
          }
        });

        return updated;
      });

      gameLoopRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    gameLoopRef.current = requestAnimationFrame(loop);

    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState, score, secondsLeft]);

  // Derived calculations
  const elapsed = 90 - secondsLeft;
  const gameIntensity = Math.min(100, Math.floor((elapsed / 90) * 50 + (score / 300) * 50));

  // Determine which paths have bright active connection lines
  const isSegmentActive = (seg: string): boolean => {
    if (seg === 'start_to_A') return true;
    if (seg === 'A_to_B') return switches.A === 0;
    if (seg === 'A_to_C') return switches.A === 1;
    if (seg === 'B_to_Red') return switches.A === 0 && switches.B === 0;
    if (seg === 'B_to_Blue') return switches.A === 0 && switches.B === 1;
    if (seg === 'C_to_Green') return switches.A === 1 && switches.C === 0;
    if (seg === 'C_to_Yellow') return switches.A === 1 && switches.C === 1;
    return false;
  };

  return (
    <div id="train-of-thought-root" className="game-area w-full max-w-[1000px] mx-auto bg-[#1A1A1A] text-[#F3F2EE] border-4 border-[#1A1A1A] p-4 md:p-6 select-none font-sans overflow-hidden relative">
      <div className="absolute inset-0 bg-[#141414] opacity-40 pointer-events-none" />
      
      {/* 🚀 Header HUD display */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-stretch gap-4 pb-4 border-b border-[#F3F2EE]/10 mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 border border-white/10 hover:border-white/30 text-white/70 hover:text-white transition-all cursor-pointer rounded-none bg-white/5 min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Volver a la selección"
            id="back-to-practice-btn"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[2px] text-[#FF5028] block">{"// SYSTEM CONSOLE"}</span>
            <h1 className="text-xl font-bold font-mono text-white tracking-tight uppercase flex items-center gap-2">
              <Layers className="text-[#00A3FF] animate-pulse" size={18} />
              <span>Train of Thought</span>
            </h1>
          </div>
        </div>

        {/* State readouts */}
        <div className="grid grid-cols-4 gap-2 md:gap-4 flex-grow md:max-w-xl text-center">
          <div className="bg-white/5 border border-white/10 p-2 font-mono">
            <span className="text-[8px] block text-white/50 uppercase tracking-wider">TIEMPO</span>
            <span className="text-sm font-black text-white">{Math.ceil(secondsLeft)}s</span>
          </div>
          <div className="bg-white/5 border border-white/10 p-2 font-mono">
            <span className="text-[8px] block text-white/50 uppercase tracking-wider">SCORE</span>
            <span className="text-sm font-black text-emerald-400">{score}</span>
          </div>
          <div className="bg-white/5 border border-white/10 p-2 font-mono">
            <span className="text-[8px] block text-white/50 uppercase tracking-wider">VIDAS</span>
            <span className="text-sm font-black text-rose-500 uppercase tracking-tighter">
              {'★'.repeat(lives)}{'☆'.repeat(5 - lives)}
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 p-2 font-mono">
            <span className="text-[8px] block text-white/50 uppercase tracking-wider">INTENSIDAD</span>
            <span className="text-sm font-black text-[#FF5028]">{gameIntensity}%</span>
          </div>
        </div>

        {/* Utilities */}
        <div className="flex items-center gap-1.5 self-center">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 border border-white/10 hover:bg-white/5 text-[#F3F2EE]/70 hover:text-white cursor-pointer"
            id="sound-toggle-btn"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button 
            onClick={() => setShowTutorial(prev => !prev)}
            className="p-2.5 border border-white/10 hover:bg-white/5 text-[#F3F2EE]/70 hover:text-white cursor-pointer"
            id="tutorial-toggle-btn"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {/* 🔮 Central Gameboard Stage overlay */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative z-10">
        
        {/* Left Interactive SVG Board Panel */}
        <div className="lg:col-span-8 bg-[#151515] border border-white/10 p-2 md:p-4 rounded-none relative">
          
          <AnimatePresence>
            {/* LOBBY overlay state */}
            {gameState === 'lobby' && (
              <motion.div 
                className="absolute inset-0 bg-[#1A1A1A]/95 text-center flex flex-col items-center justify-center p-6 z-30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                id="lobby-overlay-panel"
              >
                <div className="max-w-md space-y-5">
                  <div className="w-16 h-16 rounded-none bg-white/5 border border-[#FF5028] text-[#FF5028] flex items-center justify-center mx-auto shadow-lg shadow-[#FF5028]/10 animate-bounce">
                    <Layers size={32} />
                  </div>
                  
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black uppercase font-mono tracking-tight text-white">{"// CONFIGURACIÓN DE ATENCIÓN"}</h2>
                    <p className="font-serif italic text-xs text-white/60">
                      Entrena la agilidad sináptica de tu corteza prefrontal alternando flujos simultáneos en tiempo real.
                    </p>
                  </div>

                  <div className="bg-white/5 border border-white/10 p-4 text-left rounded-none text-xs leading-relaxed space-y-3 font-mono">
                    <p className="text-[#00A3FF] uppercase font-bold text-center border-b border-white/10 pb-2">PROPIEDADES METABÓLICAS DE PRUEBA</p>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-white/80">
                      <div>🛠️ DURACIÓN: <span className="text-white font-extrabold">90 Segundos</span></div>
                      <div>🔄 INTERRUPTORES: <span className="text-white font-extrabold">3 Nódulos Activos</span></div>
                      <div>🧠 AGILIDAD: <span className="text-white font-extrabold">Atención Dividida</span></div>
                      <div>🤖 MEMORIA: <span className="text-white font-extrabold">Trabajo Espacial</span></div>
                    </div>
                  </div>

                  <button 
                    onClick={startGame}
                    className="w-full py-4 bg-[#FF5028] text-white font-black text-sm uppercase tracking-wider rounded-none hover:bg-white hover:text-black transition-all border border-[#1A1A1A] cursor-pointer"
                  >
                    INICIAR SECUENCIA COGNITIVA
                  </button>
                </div>
              </motion.div>
            )}

            {/* PAUSE overlay state */}
            {gameState === 'paused' && (
              <motion.div 
                className="absolute inset-0 bg-[#1A1A1A]/90 text-center flex flex-col items-center justify-center p-6 z-30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                id="paused-overlay-panel"
              >
                <div className="max-w-xs space-y-4">
                  <span className="text-[#00A3FF] text-[10px] uppercase font-black tracking-widest block animate-pulse">SESIÓN EN PAUSA</span>
                  <h3 className="text-xl font-bold font-mono uppercase text-white tracking-wider">{"// FLUJO SUSPENDIDO"}</h3>
                  <div className="flex flex-col gap-2 pt-2">
                    <button 
                      onClick={() => setGameState('playing')}
                      className="py-3 bg-white text-black font-extrabold text-xs uppercase cursor-pointer hover:bg-[#FF5028] hover:text-white transition-all rounded-none"
                    >
                      Reanudar
                    </button>
                    <button 
                      onClick={startGame}
                      className="py-3 bg-white/5 border border-white/10 hover:border-white/30 text-white font-extrabold text-xs uppercase cursor-pointer transition-all rounded-none"
                    >
                      Reiniciar Juego
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* GAMEOVER overlay state */}
            {gameState === 'gameover' && (
              <motion.div 
                className="absolute inset-0 bg-[#1A1A1A]/95 text-center flex flex-col items-center justify-center p-6 z-30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                id="gameover-overlay-panel"
              >
                <div className="max-w-sm space-y-5">
                  <div className="w-12 h-12 bg-white/5 border border-white/20 text-[#00A3FF] flex items-center justify-center mx-auto rounded-none">
                    <Trophy size={24} />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[#FF5028] text-[9px] font-black uppercase tracking-widest block font-mono">{"// DIAGNÓSTICO COMPLETO"}</span>
                    <h2 className="text-2xl font-black font-mono text-white uppercase tracking-tight">Análisis Concluido</h2>
                  </div>

                  <div className="bg-white/5 border border-white/15 p-4 rounded-none font-mono text-xs text-left space-y-2">
                    <div className="flex justify-between">
                      <span className="text-white/60">PUNTUACIÓN LOGRADA:</span>
                      <span className="text-emerald-400 font-bold">{score} Puntos</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">TRENES ENRUTADOS:</span>
                      <span className="text-white font-bold">{correctCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">ERRORES DE FILTRADO:</span>
                      <span className="text-[#FF5028] font-bold">{incorrectCount}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-2 text-[10px]">
                      <span className="text-white/40">SINCRO CLOUD DE CORTEZA:</span>
                      <span className="text-blue-400 font-semibold">{currentUser?.is_guest ? 'LOCAL BACKUP' : 'SUPABASE COMPLETED'}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button 
                      onClick={startGame}
                      className="flex-1 py-3 bg-[#FF5028] text-white font-black text-xs uppercase tracking-wider rounded-none hover:bg-white hover:text-black transition-all border border-[#1A1A1A] cursor-pointer"
                    >
                      REINTENTAR
                    </button>
                    <button 
                      onClick={onBack}
                      className="flex-1 py-3 bg-white/5 border border-white/10 hover:border-white/30 text-white font-black text-xs uppercase tracking-wider rounded-none hover:bg-white/10 transition-all cursor-pointer"
                    >
                      SALIR DE PRÁCTICA
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 🚂 Main Game Canvas Frame */}
          <div className="aspect-[4/3] w-full relative">
            <svg 
              viewBox="0 0 800 560" 
              className="w-full h-full bg-[#111] border border-white/5 rounded-none"
              id="thought-game-svg"
            >
              {/* Grid Background Dots pattern */}
              <defs>
                <pattern id="ggrid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.5" fill="#ffffff" fillOpacity="0.04" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#ggrid)" />

              {/* Glowing station portal backdrops */}
              <g id="station-glow-portals">
                <circle cx={nodes.Red.x} cy={nodes.Red.y} r="35" fill={COLOR_VALUES.red.glow} filter="blur(15px)" opacity="0.4" />
                <circle cx={nodes.Blue.x} cy={nodes.Blue.y} r="35" fill={COLOR_VALUES.blue.glow} filter="blur(15px)" opacity="0.4" />
                <circle cx={nodes.Green.x} cy={nodes.Green.y} r="35" fill={COLOR_VALUES.green.glow} filter="blur(15px)" opacity="0.4" />
                <circle cx={nodes.Yellow.x} cy={nodes.Yellow.y} r="35" fill={COLOR_VALUES.yellow.glow} filter="blur(15px)" opacity="0.4" />
              </g>

              {/* 🛤️ Visual Circuit Lines / Rails */}
              <g id="tracks-group" strokeWidth="6" strokeLinecap="round" fill="none">
                {/* 1. Inactive/Background Track Path Bases */}
                <path d="M 400,50 L 400,160" stroke="#222" />
                
                <path d="M 400,160 C 400,220 250,220 250,310" stroke="#222" />
                <path d="M 400,160 C 400,220 550,220 550,310" stroke="#222" />
                
                <path d="M 250,310 C 250,380 130,380 130,490" stroke="#222" />
                <path d="M 250,310 C 250,380 310,380 310,490" stroke="#222" />
                <path d="M 550,310 C 550,380 490,380 490,490" stroke="#222" />
                <path d="M 550,310 C 550,380 670,380 670,490" stroke="#222" />

                {/* 2. Active Tracks (Glowing Circuit Routes based on active switch choices) */}
                <path 
                  d="M 400,50 L 400,160" 
                  stroke={isSegmentActive('start_to_A') ? '#ffffff' : '#222'} 
                  strokeOpacity={isSegmentActive('start_to_A') ? '0.4' : '0'} 
                  strokeWidth="4"
                  className="transition-all duration-300"
                />
                <path 
                  d="M 400,160 C 400,220 250,220 250,310" 
                  stroke={isSegmentActive('A_to_B') ? '#00A3FF' : '#222'} 
                  strokeOpacity={isSegmentActive('A_to_B') ? '0.5' : '0'} 
                  strokeWidth="4" 
                  className="transition-all duration-300"
                />
                <path 
                  d="M 400,160 C 400,220 550,220 550,310" 
                  stroke={isSegmentActive('A_to_C') ? '#00A3FF' : '#222'} 
                  strokeOpacity={isSegmentActive('A_to_C') ? '0.5' : '0'} 
                  strokeWidth="4"
                  className="transition-all duration-300"
                />
                <path 
                  d="M 250,310 C 250,380 130,380 130,490" 
                  stroke={isSegmentActive('B_to_Red') ? '#FF5028' : '#222'} 
                  strokeOpacity={isSegmentActive('B_to_Red') ? '0.5' : '0'} 
                  strokeWidth="4"
                  className="transition-all duration-300"
                />
                <path 
                  d="M 250,310 C 250,380 310,380 310,490" 
                  stroke={isSegmentActive('B_to_Blue') ? '#00A3FF' : '#222'} 
                  strokeOpacity={isSegmentActive('B_to_Blue') ? '0.5' : '0'} 
                  strokeWidth="4"
                  className="transition-all duration-300"
                />
                <path 
                  d="M 550,310 C 550,380 490,380 490,490" 
                  stroke={isSegmentActive('C_to_Green') ? '#10B981' : '#222'} 
                  strokeOpacity={isSegmentActive('C_to_Green') ? '0.5' : '0'} 
                  strokeWidth="4"
                  className="transition-all duration-300"
                />
                <path 
                  d="M 550,310 C 550,380 670,380 670,490" 
                  stroke={isSegmentActive('C_to_Yellow') ? '#FBBF24' : '#222'} 
                  strokeOpacity={isSegmentActive('C_to_Yellow') ? '0.5' : '0'} 
                  strokeWidth="4"
                  className="transition-all duration-300"
                />
              </g>

              {/* Spawner node head visually */}
              <g id="origin-portal">
                <rect x="382" y="32" width="36" height="24" fill="#1A1A1A" stroke="#F3F2EE" strokeWidth="2" />
                <rect x="395" y="44" width="10" height="4" fill="#FF5028" className="animate-pulse" />
                <text x="400" y="25" textAnchor="middle" fill="#F3F2EE" fontSize="8" fontFamily="monospace" fontWeight="bold">SPAWNER</text>
              </g>

              {/* 🎛️ Clickable Switch Nodes overlays - MOBILE OPTIMIZED */}
              <g id="switches-group">
                {/* Switch A */}
                <g 
                  transform={`translate(${nodes.A.x}, ${nodes.A.y})`} 
                  onClick={() => toggleSwitch('A')}
                  onTouchEnd={(e) => { e.preventDefault(); toggleSwitch('A'); }}
                  className="cursor-pointer group select-none"
                  id="switch-a-group"
                  style={{ touchAction: 'none' }}
                >
                  {/* Hit area invisible extra grande para fat finger */}
                  <circle r={isMobile ? 30 : 22} fill="transparent" />
                  <circle r="22" fill="#1A1A1A" stroke={switches.A === 1 ? '#00A3FF' : '#ffffff'} strokeWidth="3" className="group-hover:stroke-[#FF5028] transition-colors duration-200" />
                  <circle r="2" fill="#fff" />
                  
                  {/* Direction Guide Indicator arrow */}
                  <g transform={`rotate(${switches.A === 0 ? -45 : 45})`}>
                    <line x1="0" y1="0" x2="0" y2="15" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                    <polygon points="0,17 -4,11 4,11" fill="#fff" />
                  </g>
                  
                  <rect x="-16" y="24" width="32" height="12" fill="#111" rx="2" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  <text y="32" textAnchor="middle" fill="#fff" fontSize="8" fontFamily="monospace" fontWeight="black" className="uppercase font-mono">NODE A</text>
                </g>

                {/* Switch B */}
                <g 
                  transform={`translate(${nodes.B.x}, ${nodes.B.y})`} 
                  onClick={() => toggleSwitch('B')}
                  onTouchEnd={(e) => { e.preventDefault(); toggleSwitch('B'); }}
                  className="cursor-pointer group select-none"
                  id="switch-b-group"
                  style={{ touchAction: 'none' }}
                >
                  <circle r={isMobile ? 30 : 22} fill="transparent" />
                  <circle r="22" fill="#1A1A1A" stroke="#00A3FF" strokeWidth="3" className="group-hover:stroke-[#FF5028] transition-colors duration-200" />
                  <circle r="2" fill="#fff" />
                  
                  <g transform={`rotate(${switches.B === 0 ? -40 : 40})`}>
                    <line x1="0" y1="0" x2="0" y2="15" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                    <polygon points="0,17 -4,11 4,11" fill="#fff" />
                  </g>
                  
                  <rect x="-16" y="24" width="32" height="12" fill="#111" rx="2" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  <text y="32" textAnchor="middle" fill="#fff" fontSize="8" fontFamily="monospace" fontWeight="black" className="uppercase font-mono">NODE B</text>
                </g>

                {/* Switch C */}
                <g 
                  transform={`translate(${nodes.C.x}, ${nodes.C.y})`} 
                  onClick={() => toggleSwitch('C')}
                  onTouchEnd={(e) => { e.preventDefault(); toggleSwitch('C'); }}
                  className="cursor-pointer group select-none"
                  id="switch-c-group"
                  style={{ touchAction: 'none' }}
                >
                  <circle r={isMobile ? 30 : 22} fill="transparent" />
                  <circle r="22" fill="#1A1A1A" stroke="#00A3FF" strokeWidth="3" className="group-hover:stroke-[#FF5028] transition-colors duration-200" />
                  <circle r="2" fill="#fff" />
                  
                  <g transform={`rotate(${switches.C === 0 ? -40 : 40})`}>
                    <line x1="0" y1="0" x2="0" y2="15" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                    <polygon points="0,17 -4,11 4,11" fill="#fff" />
                  </g>
                  
                  <rect x="-16" y="24" width="32" height="12" fill="#111" rx="2" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  <text y="32" textAnchor="middle" fill="#fff" fontSize="8" fontFamily="monospace" fontWeight="black" className="uppercase font-mono">NODE C</text>
                </g>
              </g>

              {/* 🖲️ Final Terminal Stations graphic pins */}
              <g id="stations-ports">
                {/* Station Red */}
                <g transform={`translate(${nodes.Red.x}, ${nodes.Red.y})`}>
                  <rect x="-24" y="-24" width="48" height="48" fill="#111" stroke={COLOR_VALUES.red.hex} strokeWidth="3" />
                  <circle r="12" fill={COLOR_VALUES.red.hex} />
                  <text y="4" textAnchor="middle" fill="#111" fontSize="10" fontFamily="monospace" fontWeight="extrabold">RED</text>
                  <text y="35" textAnchor="middle" fill={COLOR_VALUES.red.hex} fontSize="8" fontFamily="monospace" fontWeight="bold">S_01</text>
                </g>

                {/* Station Blue */}
                <g transform={`translate(${nodes.Blue.x}, ${nodes.Blue.y})`}>
                  <rect x="-24" y="-24" width="48" height="48" fill="#111" stroke={COLOR_VALUES.blue.hex} strokeWidth="3" />
                  <circle r="12" fill={COLOR_VALUES.blue.hex} />
                  <text y="4" textAnchor="middle" fill="#111" fontSize="10" fontFamily="monospace" fontWeight="extrabold">BLUE</text>
                  <text y="35" textAnchor="middle" fill={COLOR_VALUES.blue.hex} fontSize="8" fontFamily="monospace" fontWeight="bold">S_02</text>
                </g>

                {/* Station Green */}
                <g transform={`translate(${nodes.Green.x}, ${nodes.Green.y})`}>
                  <rect x="-24" y="-24" width="48" height="48" fill="#111" stroke={COLOR_VALUES.green.hex} strokeWidth="3" />
                  <circle r="12" fill={COLOR_VALUES.green.hex} />
                  <text y="4" textAnchor="middle" fill="#111" fontSize="10" fontFamily="monospace" fontWeight="extrabold">GRN</text>
                  <text y="35" textAnchor="middle" fill={COLOR_VALUES.green.hex} fontSize="8" fontFamily="monospace" fontWeight="bold">S_03</text>
                </g>

                {/* Station Yellow */}
                <g transform={`translate(${nodes.Yellow.x}, ${nodes.Yellow.y})`}>
                  <rect x="-24" y="-24" width="48" height="48" fill="#111" stroke={COLOR_VALUES.yellow.hex} strokeWidth="3" />
                  <circle r="12" fill={COLOR_VALUES.yellow.hex} />
                  <text y="4" textAnchor="middle" fill="#111" fontSize="9" fontFamily="monospace" fontWeight="extrabold">YEL</text>
                  <text y="35" textAnchor="middle" fill={COLOR_VALUES.yellow.hex} fontSize="8" fontFamily="monospace" fontWeight="bold">S_04</text>
                </g>
              </g>

              {/* 🌫️ Moving particle effects layer */}
              {particles.map(p => (
                <circle key={p.id} cx={p.x} cy={p.y} r="3" fill={p.color} className="animate-ping" opacity="0.8" />
              ))}

              {/* 🚂 ACTIVE Live Trains Render */}
              <g id="active-trains">
                {trains.map(train => {
                  const coords = getTrainCoords(train.segment, train.progress);
                  const colorMatch = COLOR_VALUES[train.color] || COLOR_VALUES.red;
                  
                  return (
                    <g key={train.id} transform={`translate(${coords.x}, ${coords.y})`}>
                      {/* Trail glow backing circle */}
                      <circle r="15" fill={colorMatch.hex} opacity="0.3" className="animate-pulse" />
                      
                      {/* Train bullet body */}
                      <rect 
                        x="-10" 
                        y="-10" 
                        width="20" 
                        height="20" 
                        rx="4"
                        fill="#111111" 
                        stroke={colorMatch.hex} 
                        strokeWidth="3.5" 
                      />
                      
                      {/* Direction/color micro indicator */}
                      <circle cx="0" cy="0" r="4.5" fill={colorMatch.hex} />
                    </g>
                  );
                })}
              </g>

              {/* Text indicator notifications layers overlay */}
              <g id="screen-notifications" pointerEvents="none">
                {floatingTexts.map(f => (
                  <text 
                    key={f.id} 
                    x={f.x} 
                    y={f.y} 
                    textAnchor="middle" 
                    fontSize="11" 
                    className={`${f.colorClass} fill-current select-none animate-bounce font-mono font-black tracking-wide`}
                  >
                    {f.text}
                  </text>
                ))}
              </g>
            </svg>
          </div>

          {/* Core play toggle button and quick HUD */}
          <div className="flex bg-white/5 border border-white/10 p-3 mt-4 justify-between items-center text-xs font-mono">
            <div className="flex gap-2.5 items-center">
              {gameState === 'playing' ? (
                <button 
                  onClick={() => setGameState('paused')}
                  className="bg-white/10 hover:bg-white/20 border border-white/10 text-white font-extrabold px-4 py-2 flex items-center gap-1 cursor-pointer"
                  id="pause-game-btn"
                >
                  <Pause size={12} fill="currentColor" />
                  <span>PAUSAR</span>
                </button>
              ) : (
                gameState !== 'lobby' && (
                  <button 
                    onClick={() => setGameState('playing')}
                    className="bg-[#FF5028] text-white font-extrabold px-4 py-2 flex items-center gap-1 cursor-pointer"
                    id="resume-game-btn"
                  >
                    <Play size={12} fill="currentColor" />
                    <span>REANUDAR</span>
                  </button>
                )
              )}
              <span className="text-white/40">ESTADO REGISTRADO: <span className="text-white font-bold">{gameState.toUpperCase()}</span></span>
            </div>

            <div className="text-right text-[11px] text-[#00A3FF]">
              {gameState === 'playing' && (
                <span className="animate-pulse">● TRANSMISIÓN AGILIDAD CONTINUA...</span>
              )}
            </div>
          </div>

        </div>

        {/* Right Dashboard Sidebar Panel */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Instrucciones interactivos collapsible dialog */}
          {showTutorial && (
            <div className="bg-[#FF5028]/10 border border-[#FF5028] p-5 relative rounded-none">
              <button 
                onClick={() => setShowTutorial(false)}
                className="absolute right-3 top-3 text-xs text-[#FF5028] font-black uppercase tracking-wider font-mono hover:underline cursor-pointer"
                id="close-tutorial-btn"
              >
                ✕ Cerrar
              </button>
              <span className="text-[9px] font-black text-[#FF5028] uppercase tracking-[1.5px] block mb-2 font-mono">INSTRUCTIVO DE CONSOLA</span>
              <h4 className="text-sm font-bold uppercase tracking-tight text-white mb-3 font-mono">{"// Cómo pilotar"}</h4>
              
              <ul className="text-xs space-y-2.5 leading-relaxed text-[#F3F2EE]/80 font-mono">
                <li className="flex items-start gap-2">
                  <span className="text-[#FF5028] font-black">1.</span>
                  <span>Los trenes automáticos se despliegan desde el portal superior con códigos de color específicos.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00A3FF] font-black">2.</span>
                  <span>En las intersecciones de vía, haz un clic sobre los nódulos circulares <strong className="text-white">(NODE A, B, C)</strong> para cambiar sus agujas.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-black">3.</span>
                  <span>Guía cada tren de color hacia su terminal homónimo <strong className="text-white">(RED, BLUE, GRN, YEL)</strong> para recolectar puntos.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-black">4.</span>
                  <span>¡Cuidado! Desviar un tren a un puerto de color incorrecto cuesta 1 vida y deduce puntos.</span>
                </li>
              </ul>
            </div>
          )}

          {/* Panel de control de velocidad */}
          <div className="bg-white/5 border border-white/10 p-5 rounded-none font-mono space-y-4">
            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest block font-sans">{"// STATUS COMPONENT"}</span>
            <h3 className="text-xs font-black uppercase text-white tracking-wider">{"// MONITOREO DE SISTEMAS"}</h3>

            <div className="space-y-3.5 text-xs">
              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-white/60">INTERVALO DE SPAWN</span>
                  <span className="text-white font-bold">
                    {gameState === 'playing' ? (Math.max(1.5, 4.2 - (elapsed / 90) * 1.6 - (score / 300) * 0.9)).toFixed(1) + 's' : '4.2s'}
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 overflow-hidden">
                  <div 
                    className="h-full bg-[#00A3FF] transition-all duration-300" 
                    style={{ width: `${Math.min(100, (gameIntensity * 1.2))}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-white/60">RAPIDEZ DE TRÁNSITO</span>
                  <span className="text-white font-bold">
                    {gameState === 'playing' ? (1.0 + (elapsed / 90) * 0.4 + (score / 300) * 0.2).toFixed(2) + 'x' : '1.00x'}
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 overflow-hidden">
                  <div 
                    className="h-full bg-[#FF5028] transition-all duration-300" 
                    style={{ width: `${gameIntensity}%` }}
                  />
                </div>
              </div>
            </div>

            <hr className="border-white/10 my-4" />

            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div className="bg-white/5 border border-white/10 p-2">
                <span className="text-[9px] text-white/40 block">ENRUTADOS</span>
                <span className="text-sm font-black text-emerald-400 mt-1 block">{correctCount} t</span>
              </div>
              <div className="bg-white/5 border border-white/10 p-2">
                <span className="text-[9px] text-white/40 block">ERRORES</span>
                <span className="text-sm font-black text-rose-500 mt-1 block">{incorrectCount} t</span>
              </div>
            </div>
          </div>

          {/* Registro local racha */}
          <div className="bg-white/5 border border-white/10 p-5 rounded-none space-y-3 font-mono">
            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest block font-sans">{"// SEGURIDAD BIOMÉTRICA"}</span>
            <h4 className="text-xs font-black uppercase tracking-wider text-white">{"// JUGADOR ASIGNADO"}</h4>
            
            <div className="text-xs text-white/80 space-y-1">
              <p>ID: <span className="text-white font-bold">{currentUser?.username || 'Invitado'}</span></p>
              <p>RANGO: <span className="text-[#FF5028] font-bold">{currentUser?.cerebra_rank || 'Iniciado del Templo'}</span></p>
              <p>PERFIL: <span className="text-white/60 text-[10px]">{currentUser?.is_guest ? 'ALMACENAMIENTO DE SESIÓN' : 'REGISTRADO EN POSTGRES'}</span></p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
