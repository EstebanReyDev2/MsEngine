// 📂 /components/games/TrainOfThought.tsx
// Refactored engine: ref-based mutable state + stable rAF loop (no restart on score/timer changes)
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { saveGameScore } from '@/lib/gameScoreService';
import GameShell from '@/components/shared/GameShell';
import {
  ArrowLeft, Play, Pause, HelpCircle,
  Volume2, VolumeX, Trophy, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useHaptic } from '@/hooks/use-haptic';

// ───────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────

type TrainColor = 'red' | 'blue' | 'green' | 'yellow';
type TrainSegment = 'start_to_A' | 'A_to_B' | 'A_to_C' | 'B_to_Red' | 'B_to_Blue' | 'C_to_Green' | 'C_to_Yellow';

interface Train {
  id: string;
  color: TrainColor;
  segment: TrainSegment;
  progress: number;
  speed: number;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface FloatingText {
  id: string;
  x: number;
  y: number;
  dy: number;
  life: number;
  text: string;
  colorClass: string;
}

// ───────────────────────────────────────────
// CONSTANTS
// ───────────────────────────────────────────

const COLOR_VALUES = {
  red:    { hex: '#FF5028', glow: 'rgba(255, 80, 40, 0.4)' },
  blue:   { hex: '#00A3FF', glow: 'rgba(0, 163, 255, 0.4)' },
  green:  { hex: '#10B981', glow: 'rgba(16, 185, 129, 0.4)' },
  yellow: { hex: '#FBBF24', glow: 'rgba(251, 191, 36, 0.4)' },
};

const NODES = {
  start:  { x: 400, y: 50 },
  A:      { x: 400, y: 160 },
  B:      { x: 250, y: 310 },
  C:      { x: 550, y: 310 },
  Red:    { x: 130, y: 490 },
  Blue:   { x: 310, y: 490 },
  Green:  { x: 490, y: 490 },
  Yellow: { x: 670, y: 490 },
};

const GAME_DURATION = 90;
const MAX_SPEED = 0.55;
const BASE_SPEED = 0.23;
const MIN_SPAWN_RATE = 1.5;
const BASE_SPAWN_RATE = 4.2;
const MAX_LIVES = 5;

// ───────────────────────────────────────────
// HELPERS (pure, outside React)
// ───────────────────────────────────────────

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function interpolateLine(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  t: number,
) {
  return { x: lerp(p0.x, p1.x, t), y: lerp(p0.y, p1.y, t) };
}

function interpolateBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

function getTrainCoords(segment: TrainSegment, progress: number) {
  switch (segment) {
    case 'start_to_A':
      return interpolateLine(NODES.start, NODES.A, progress);
    case 'A_to_B':
      return interpolateBezier(NODES.A, { x: 400, y: 220 }, { x: 250, y: 220 }, NODES.B, progress);
    case 'A_to_C':
      return interpolateBezier(NODES.A, { x: 400, y: 220 }, { x: 550, y: 220 }, NODES.C, progress);
    case 'B_to_Red':
      return interpolateBezier(NODES.B, { x: 250, y: 380 }, { x: 130, y: 380 }, NODES.Red, progress);
    case 'B_to_Blue':
      return interpolateBezier(NODES.B, { x: 250, y: 380 }, { x: 310, y: 380 }, NODES.Blue, progress);
    case 'C_to_Green':
      return interpolateBezier(NODES.C, { x: 550, y: 380 }, { x: 490, y: 380 }, NODES.Green, progress);
    case 'C_to_Yellow':
      return interpolateBezier(NODES.C, { x: 550, y: 380 }, { x: 670, y: 380 }, NODES.Yellow, progress);
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 8);
}

const COLORS: TrainColor[] = ['red', 'blue', 'green', 'yellow'];

function randomColor(): TrainColor {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

// ───────────────────────────────────────────
// SOUND (lazy singleton)
// ───────────────────────────────────────────

let _audioCtx: AudioContext | null = null;
function getAudioCtx() {
  if (typeof window === 'undefined') return null;
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch { return null; }
  }
  return _audioCtx;
}

function synthSound(
  freq: number,
  type: OscillatorType = 'sine',
  duration = 0.1,
  volume = 0.06,
) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch { /* safe fallback */ }
}

function playArrivalCorrect() {
  synthSound(783.99, 'triangle', 0.15, 0.08);
  setTimeout(() => synthSound(1046.50, 'triangle', 0.2, 0.08), 100);
}

function playArrivalWrong() {
  synthSound(120, 'sawtooth', 0.35, 0.08);
}

function playSpawn() {
  synthSound(330, 'sine', 0.08, 0.04);
}

function playSwitch(freq: number) {
  synthSound(freq, 'square', 0.05, 0.04);
}

function playGameOver() {
  synthSound(220, 'sawtooth', 0.4, 0.08);
}

// ───────────────────────────────────────────
// ENGINE REF — mutable game state
// ───────────────────────────────────────────

interface EngineState {
  trains: Train[];
  switches: { A: number; B: number; C: number };
  score: number;
  secondsLeft: number;
  lives: number;
  correctCount: number;
  incorrectCount: number;
  particles: Particle[];
  floatingTexts: FloatingText[];
  spawnTimer: number;
  phase: 'lobby' | 'playing' | 'paused' | 'gameover';
  gameOverTriggered: boolean;
}

function createEngine(): EngineState {
  return {
    trains: [],
    switches: { A: 0, B: 0, C: 0 },
    score: 0,
    secondsLeft: GAME_DURATION,
    lives: MAX_LIVES,
    correctCount: 0,
    incorrectCount: 0,
    particles: [],
    floatingTexts: [],
    spawnTimer: 0,
    phase: 'lobby',
    gameOverTriggered: false,
  };
}

// ───────────────────────────────────────────
// TRAIN ARRIVAL LOGIC (pure engine, no React)
// ───────────────────────────────────────────

function handleTrainArrival(engine: EngineState, train: Train): boolean {
  let stationColor: TrainColor = 'red';
  let targetX = NODES.Red.x;
  let targetY = NODES.Red.y;

  switch (train.segment) {
    case 'B_to_Red':
      stationColor = 'red';
      targetX = NODES.Red.x; targetY = NODES.Red.y;
      break;
    case 'B_to_Blue':
      stationColor = 'blue';
      targetX = NODES.Blue.x; targetY = NODES.Blue.y;
      break;
    case 'C_to_Green':
      stationColor = 'green';
      targetX = NODES.Green.x; targetY = NODES.Green.y;
      break;
    case 'C_to_Yellow':
      stationColor = 'yellow';
      targetX = NODES.Yellow.x; targetY = NODES.Yellow.y;
      break;
  }

  const isCorrect = train.color === stationColor;

  if (isCorrect) {
    engine.score += 15;
    engine.correctCount += 1;

    // Particles
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;
      engine.particles.push({
        id: `p_${train.id}_${i}`,
        x: targetX,
        y: targetY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.4,
        color: COLOR_VALUES[stationColor].hex,
      });
    }

    engine.floatingTexts.push({
      id: `ft_${train.id}`,
      x: targetX,
      y: targetY - 20,
      dy: -50,
      life: 1.2,
      text: '+15 PUNTOS',
      colorClass: 'text-emerald-400 font-black font-mono',
    });

    playArrivalCorrect();
  } else {
    engine.score = Math.max(0, engine.score - 10);
    engine.incorrectCount += 1;
    engine.lives -= 1;

    engine.floatingTexts.push({
      id: `ft_${train.id}`,
      x: targetX,
      y: targetY - 20,
      dy: -50,
      life: 1.2,
      text: 'ERROR -10',
      colorClass: 'text-[#FF5028] font-black font-mono',
    });

    playArrivalWrong();

    if (engine.lives <= 0) {
      engine.lives = 0;
      return true; // game over
    }
  }

  return false; // continue
}

// ───────────────────────────────────────────
// GAME LOOP UPDATE (pure engine tick)
// ───────────────────────────────────────────

function updateEngine(engine: EngineState, dt: number): boolean {
  if (engine.phase !== 'playing') return false;
  const cappedDt = Math.min(dt, 0.1);

  // 1. Timer
  engine.secondsLeft -= cappedDt;
  if (engine.secondsLeft <= 0) {
    engine.secondsLeft = 0;
    engine.phase = 'gameover';
    engine.gameOverTriggered = true;
    playGameOver();
    return true;
  }

  // 2. Difficulty scaling
  const elapsed = GAME_DURATION - engine.secondsLeft;
  const speedFactor = Math.min(MAX_SPEED, BASE_SPEED + (elapsed / GAME_DURATION) * 0.15 + (engine.score / 600) * 0.08);
  const spawnRate = Math.max(MIN_SPAWN_RATE, BASE_SPAWN_RATE - (elapsed / GAME_DURATION) * 1.6 - (engine.score / 600) * 0.9);

  // 3. Spawn
  engine.spawnTimer += cappedDt;
  if (engine.spawnTimer >= spawnRate) {
    engine.spawnTimer = 0;
    engine.trains.push({
      id: `t_${Date.now()}_${uid()}`,
      color: randomColor(),
      segment: 'start_to_A',
      progress: 0,
      speed: speedFactor,
    });
    playSpawn();
  }

  // 4. Move trains
  const remaining: Train[] = [];
  for (let i = 0; i < engine.trains.length; i++) {
    const train = engine.trains[i];
    const nextProgress = train.progress + train.speed * cappedDt;

    if (nextProgress >= 1.0) {
      // At a node — read switch NOW (ref-based, always current)
      let nextSegment: TrainSegment | null = null;

      if (train.segment === 'start_to_A') {
        nextSegment = engine.switches.A === 0 ? 'A_to_B' : 'A_to_C';
      } else if (train.segment === 'A_to_B') {
        nextSegment = engine.switches.B === 0 ? 'B_to_Red' : 'B_to_Blue';
      } else if (train.segment === 'A_to_C') {
        nextSegment = engine.switches.C === 0 ? 'C_to_Green' : 'C_to_Yellow';
      }

      if (nextSegment === null) {
        // Terminal arrived
        const gameOver = handleTrainArrival(engine, train);
        if (gameOver) {
          engine.phase = 'gameover';
          engine.gameOverTriggered = true;
          playGameOver();
        }
        // train removed (not pushed to remaining)
      } else {
        remaining.push({
          ...train,
          segment: nextSegment,
          progress: 0,
        });
      }
    } else {
      remaining.push({
        ...train,
        progress: nextProgress,
      });
    }
  }
  engine.trains = remaining;

  // 5. Update particles
  for (let i = engine.particles.length - 1; i >= 0; i--) {
    const p = engine.particles[i];
    p.x += p.vx * cappedDt;
    p.y += p.vy * cappedDt;
    p.life -= cappedDt;
    if (p.life <= 0) {
      engine.particles.splice(i, 1);
    }
  }

  // 6. Update floating texts
  for (let i = engine.floatingTexts.length - 1; i >= 0; i--) {
    const f = engine.floatingTexts[i];
    f.y += f.dy * cappedDt;
    f.life -= cappedDt;
    if (f.life <= 0) {
      engine.floatingTexts.splice(i, 1);
    }
  }

  return false;
}

// ───────────────────────────────────────────
// MAIN COMPONENT
// ───────────────────────────────────────────

interface TrainOfThoughtProps {
  onBack: () => void;
  currentUser: any;
  onRefreshUser: () => void;
}

export default function TrainOfThought({ onBack, currentUser, onRefreshUser }: TrainOfThoughtProps) {
  const haptic = useHaptic();

  // ── React state (triggers re-renders) ──
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'paused' | 'gameover'>('lobby');
  const [tick, setTick] = useState(0); // render tick — incremented every frame
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showTutorial, setShowTutorial] = useState(true);

  // ── Save score when game ends (separate effect to avoid side effects in game loop) ──
  useEffect(() => {
    if (gameState === 'gameover' && E.current.score > 0 && currentUser) {
      saveGameScore(
        currentUser?.id,
        'Train of Thought',
        E.current.score,
        Math.min(10, Math.floor(E.current.score / 100) + 1),
      );
      onRefreshUser();
    }
  }, [gameState, currentUser, onRefreshUser]);

  // ── Engine ref (mutable, never triggers re-render) ──
  const E = useRef<EngineState>(createEngine());
  const lastTime = useRef<number>(0);
  const rAF = useRef<number | null>(null);
  const soundRef = useRef(true);
  soundRef.current = soundEnabled; // keep in sync

  // ── Derived values from engine (for render) ──
  const engine = E.current;
  const trains = engine.trains;
  const switchesVal = engine.switches;
  const score = engine.score;
  const secondsLeft = engine.secondsLeft;
  const lives = engine.lives;
  const correctCount = engine.correctCount;
  const incorrectCount = engine.incorrectCount;
  const particles = engine.particles;
  const floatingTexts = engine.floatingTexts;
  const elapsed = GAME_DURATION - secondsLeft;
  const gameIntensity = Math.min(100, Math.floor((elapsed / GAME_DURATION) * 50 + (score / 600) * 50));

  // ── Is segment active (for track glow) ──
  const isSegmentActive = useCallback((seg: string): boolean => {
    const s = engine.switches;
    if (seg === 'start_to_A') return true;
    if (seg === 'A_to_B') return s.A === 0;
    if (seg === 'A_to_C') return s.A === 1;
    if (seg === 'B_to_Red') return s.A === 0 && s.B === 0;
    if (seg === 'B_to_Blue') return s.A === 0 && s.B === 1;
    if (seg === 'C_to_Green') return s.A === 1 && s.C === 0;
    if (seg === 'C_to_Yellow') return s.A === 1 && s.C === 1;
    return false;
  }, [engine.switches]);

  // ── STABLE GAME LOOP (depends ONLY on gameState) ──
  useEffect(() => {
    if (gameState !== 'playing') {
      if (rAF.current) { cancelAnimationFrame(rAF.current); rAF.current = null; }
      return;
    }

    // Sync engine phase
    engine.phase = 'playing';
    lastTime.current = performance.now();
    engine.gameOverTriggered = false;

    const loop = (timestamp: number) => {
      const dt = (timestamp - lastTime.current) / 1000;
      lastTime.current = timestamp;

      // Update engine
      updateEngine(engine, dt);

      // Check if game ended inside the update
      if (engine.phase === 'gameover' && engine.gameOverTriggered) {
        setGameState('gameover');
        setTick(n => n + 1);
        return; // stop loop
      }

      // Check if paused
      if (engine.phase === 'paused') {
        rAF.current = requestAnimationFrame(loop);
        return; // keep loop alive but don't tick render (to freeze display)
      }

      // Trigger React re-render
      setTick(n => n + 1);

      rAF.current = requestAnimationFrame(loop);
    };

    rAF.current = requestAnimationFrame(loop);

    return () => {
      if (rAF.current) cancelAnimationFrame(rAF.current);
    };
  }, [gameState]); // ← ONLY gameState — NEVER score/timer/trains

  // ── Switch toggle (ALWAYS available, ref-based) ──
  const toggleSwitch = useCallback((key: 'A' | 'B' | 'C') => {
    const nextVal = engine.switches[key] === 0 ? 1 : 0;
    engine.switches[key] = nextVal;

    if (soundRef.current) playSwitch(400 + nextVal * 150);
    haptic.light();

    // Force immediate re-render so switch visual updates even if game loop not ticking
    setTick(n => n + 1);
  }, [engine, haptic]);

  // ── Start / Restart ──
  const startGame = useCallback(() => {
    // Reset engine
    Object.assign(engine, createEngine());
    engine.phase = 'playing';
    lastTime.current = performance.now();

    setGameState('playing');
    setTick(0);

    if (soundRef.current) {
      synthSound(440, 'sine', 0.15, 0.06);
      setTimeout(() => synthSound(554.37, 'sine', 0.15, 0.06), 100);
      setTimeout(() => synthSound(659.25, 'sine', 0.25, 0.06), 200);
    }
  }, [engine]);

  // ── Pause / Resume ──
  const pauseGame = useCallback(() => {
    engine.phase = 'paused';
    setGameState('paused');
  }, [engine]);

  const resumeGame = useCallback(() => {
    engine.phase = 'playing';
    lastTime.current = performance.now();
    setGameState('playing');
  }, [engine]);

  // ── Spawner rect pulse ──
  const pulseOpacity = Math.sin(tick * 0.1) * 0.3 + 0.7;

  return (
    <GameShell active={gameState === 'playing' || gameState === 'paused'}>
    <div
      id="train-of-thought-root"
      className="game-area w-full max-w-[1000px] mx-auto bg-[#1A1A1A] text-[#F3F2EE] border-4 border-[#1A1A1A] p-3 md:p-6 select-none font-sans overflow-hidden relative min-h-[100dvh] max-md:max-h-[100dvh] max-md:flex max-md:flex-col"
    >
      <div className="absolute inset-0 bg-[#141414] opacity-40 pointer-events-none" />

      {/* ── HEADER ── */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-stretch gap-2 md:gap-4 pb-3 border-b border-[#F3F2EE]/10 mb-3 max-md:flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 border border-white/10 hover:border-white/30 text-white/70 hover:text-white transition-all cursor-pointer bg-white/5 min-w-[44px] min-h-[44px] flex items-center justify-center"
            id="back-to-practice-btn"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[2px] text-[#FF5028] block leading-tight">
              {'// SYSTEM CONSOLE'}
            </span>
            <h1 className="text-lg md:text-xl font-bold font-mono text-white tracking-tight uppercase flex items-center gap-2">
              <Layers className="text-[#00A3FF]" size={16} />
              <span>Train of Thought</span>
            </h1>
          </div>
        </div>

        {/* HUD stats — responsive: 4 cols on desktop, 2x2 on mobile */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-2 md:flex-grow md:max-w-xl text-center">
          <div className="bg-white/5 border border-white/10 p-1 md:p-2 font-mono">
            <span className="text-[7px] md:text-[8px] block text-white/50 uppercase tracking-wider">TIEMPO</span>
            <span className="text-xs md:text-sm font-black text-white">{Math.ceil(secondsLeft < 10 ? secondsLeft : secondsLeft)}s</span>
          </div>
          <div className="bg-white/5 border border-white/10 p-1 md:p-2 font-mono">
            <span className="text-[7px] md:text-[8px] block text-white/50 uppercase tracking-wider">SCORE</span>
            <span className="text-xs md:text-sm font-black text-emerald-400">{score}</span>
          </div>
          <div className="bg-white/5 border border-white/10 p-1 md:p-2 font-mono">
            <span className="text-[7px] md:text-[8px] block text-white/50 uppercase tracking-wider">VIDAS</span>
            <span className="text-xs md:text-sm font-black text-rose-500 tracking-tighter">
              {'★'.repeat(lives)}{'☆'.repeat(MAX_LIVES - lives)}
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 p-1 md:p-2 font-mono">
            <span className="text-[7px] md:text-[8px] block text-white/50 uppercase tracking-wider">INTENSIDAD</span>
            <span className="text-xs md:text-sm font-black text-[#FF5028]">{gameIntensity}%</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-center max-md:hidden">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 border border-white/10 hover:bg-white/5 text-[#F3F2EE]/70 hover:text-white cursor-pointer"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            onClick={() => setShowTutorial(prev => !prev)}
            className="p-2.5 border border-white/10 hover:bg-white/5 text-[#F3F2EE]/70 hover:text-white cursor-pointer"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {/* ── GAMEBOARD ── */}
      <div className="relative z-10 max-md:flex-1 max-md:min-h-0 max-md:flex max-md:flex-col max-md:items-stretch md:grid md:grid-cols-12 md:gap-6 md:items-start">

        {/* Overlays — full width (covers sidebar too) */}
        <AnimatePresence>
          {gameState === 'lobby' && (
            <motion.div
              className="absolute inset-0 bg-[#1A1A1A]/95 text-center flex flex-col items-center justify-center p-4 md:p-8 z-30 overflow-y-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="w-full max-w-xs sm:max-w-sm md:max-w-md space-y-3 md:space-y-5">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-white/5 border border-[#FF5028] text-[#FF5028] flex items-center justify-center mx-auto shadow-lg shadow-[#FF5028]/10">
                  <Layers size={28} />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base sm:text-lg md:text-2xl font-black uppercase font-mono tracking-tight text-white break-words">{'// CONFIGURACIÓN DE ATENCIÓN'}</h2>
                  <p className="font-serif italic text-xs text-white/60">
                    Entrena la agilidad sináptica de tu corteza prefrontal alternando flujos simultáneos en tiempo real.
                  </p>
                </div>
                <div className="bg-white/5 border border-white/10 p-3 md:p-4 text-left text-xs leading-relaxed space-y-2 md:space-y-3 font-mono">
                  <p className="text-[#00A3FF] uppercase font-bold text-center border-b border-white/10 pb-2">PROPIEDADES METABÓLICAS</p>
                  <div className="grid sm:grid-cols-2 gap-1.5 md:gap-2 text-[11px] text-white/80">
                    <div>🛠️ DURACIÓN: <span className="text-white font-extrabold">{GAME_DURATION} Segundos</span></div>
                    <div>🔄 INTERRUPTORES: <span className="text-white font-extrabold">3 Nódulos Activos</span></div>
                    <div>🧠 AGILIDAD: <span className="text-white font-extrabold">Atención Dividida</span></div>
                    <div>🤖 MEMORIA: <span className="text-white font-extrabold">Trabajo Espacial</span></div>
                  </div>
                </div>
                <button
                  onClick={startGame}
                  className="w-full py-3.5 md:py-4 bg-[#FF5028] text-white font-black text-sm uppercase tracking-wider hover:bg-white hover:text-black transition-all border border-[#1A1A1A] cursor-pointer"
                >
                  INICIAR SECUENCIA COGNITIVA
                </button>
              </div>
            </motion.div>
          )}

          {gameState === 'paused' && (
            <motion.div
              className="absolute inset-0 bg-[#1A1A1A]/90 text-center flex flex-col items-center justify-center p-6 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="max-w-xs space-y-4">
                <span className="text-[#00A3FF] text-[10px] uppercase font-black tracking-widest block">SESIÓN EN PAUSA</span>
                <h3 className="text-xl font-bold font-mono uppercase text-white tracking-wider">{'// FLUJO SUSPENDIDO'}</h3>
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={resumeGame}
                    className="py-3 bg-white text-black font-extrabold text-xs uppercase cursor-pointer hover:bg-[#FF5028] hover:text-white transition-all"
                  >
                    Reanudar
                  </button>
                  <button
                    onClick={startGame}
                    className="py-3 bg-white/5 border border-white/10 hover:border-white/30 text-white font-extrabold text-xs uppercase cursor-pointer transition-all"
                  >
                    Reiniciar Juego
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'gameover' && (
            <motion.div
              className="absolute inset-0 bg-[#1A1A1A]/95 text-center flex flex-col items-center justify-center p-6 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="max-w-sm space-y-5">
                <div className="w-12 h-12 bg-white/5 border border-white/20 text-[#00A3FF] flex items-center justify-center mx-auto">
                  <Trophy size={24} />
                </div>
                <div className="space-y-1">
                  <span className="text-[#FF5028] text-[9px] font-black uppercase tracking-widest block font-mono">{'// DIAGNÓSTICO COMPLETO'}</span>
                  <h2 className="text-2xl font-black font-mono text-white uppercase tracking-tight">Análisis Concluido</h2>
                </div>
                <div className="bg-white/5 border border-white/15 p-4 font-mono text-xs text-left space-y-2">
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
                    className="flex-1 py-3 bg-[#FF5028] text-white font-black text-xs uppercase tracking-wider hover:bg-white hover:text-black transition-all border border-[#1A1A1A] cursor-pointer"
                  >
                    REINTENTAR
                  </button>
                  <button
                    onClick={onBack}
                    className="flex-1 py-3 bg-white/5 border border-white/10 hover:border-white/30 text-white font-black text-xs uppercase tracking-wider hover:bg-white/10 transition-all cursor-pointer"
                  >
                    SALIR DE PRÁCTICA
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Left: SVG Board */}
        <div className="md:col-span-8 bg-[#151515] border border-white/10 p-2 md:p-4 max-md:flex-1 max-md:min-h-0 max-md:flex max-md:flex-col">

          {/* SVG Canvas — responsive aspect ratio */}
          <div className="w-full flex-1 md:aspect-[4/3] relative min-h-0">
            <svg
              viewBox="0 0 800 560"
              className="w-full h-full bg-[#111] border border-white/5 absolute inset-0"
              id="thought-game-svg"
            >
              {/* Background grid */}
              <defs>
                <pattern id="ggrid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.5" fill="#ffffff" fillOpacity="0.04" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#ggrid)" />

              {/* Station glow portals */}
              <g id="station-glow-portals">
                <circle cx={NODES.Red.x} cy={NODES.Red.y} r="35" fill={COLOR_VALUES.red.glow} filter="blur(15px)" opacity="0.4" />
                <circle cx={NODES.Blue.x} cy={NODES.Blue.y} r="35" fill={COLOR_VALUES.blue.glow} filter="blur(15px)" opacity="0.4" />
                <circle cx={NODES.Green.x} cy={NODES.Green.y} r="35" fill={COLOR_VALUES.green.glow} filter="blur(15px)" opacity="0.4" />
                <circle cx={NODES.Yellow.x} cy={NODES.Yellow.y} r="35" fill={COLOR_VALUES.yellow.glow} filter="blur(15px)" opacity="0.4" />
              </g>

              {/* Tracks */}
              <g id="tracks-group" strokeWidth="6" strokeLinecap="round" fill="none">
                {/* Base tracks (always dark) */}
                <path d="M 400,50 L 400,160" stroke="#222" />
                <path d="M 400,160 C 400,220 250,220 250,310" stroke="#222" />
                <path d="M 400,160 C 400,220 550,220 550,310" stroke="#222" />
                <path d="M 250,310 C 250,380 130,380 130,490" stroke="#222" />
                <path d="M 250,310 C 250,380 310,380 310,490" stroke="#222" />
                <path d="M 550,310 C 550,380 490,380 490,490" stroke="#222" />
                <path d="M 550,310 C 550,380 670,380 670,490" stroke="#222" />

                {/* Active track highlights */}
                <path d="M 400,50 L 400,160" stroke="#ffffff" strokeOpacity={isSegmentActive('start_to_A') ? '0.4' : '0'} strokeWidth="4" className="transition-all duration-300" />
                <path d="M 400,160 C 400,220 250,220 250,310" stroke="#00A3FF" strokeOpacity={isSegmentActive('A_to_B') ? '0.5' : '0'} strokeWidth="4" className="transition-all duration-300" />
                <path d="M 400,160 C 400,220 550,220 550,310" stroke="#00A3FF" strokeOpacity={isSegmentActive('A_to_C') ? '0.5' : '0'} strokeWidth="4" className="transition-all duration-300" />
                <path d="M 250,310 C 250,380 130,380 130,490" stroke="#FF5028" strokeOpacity={isSegmentActive('B_to_Red') ? '0.5' : '0'} strokeWidth="4" className="transition-all duration-300" />
                <path d="M 250,310 C 250,380 310,380 310,490" stroke="#00A3FF" strokeOpacity={isSegmentActive('B_to_Blue') ? '0.5' : '0'} strokeWidth="4" className="transition-all duration-300" />
                <path d="M 550,310 C 550,380 490,380 490,490" stroke="#10B981" strokeOpacity={isSegmentActive('C_to_Green') ? '0.5' : '0'} strokeWidth="4" className="transition-all duration-300" />
                <path d="M 550,310 C 550,380 670,380 670,490" stroke="#FBBF24" strokeOpacity={isSegmentActive('C_to_Yellow') ? '0.5' : '0'} strokeWidth="4" className="transition-all duration-300" />
              </g>

              {/* Spawner portal */}
              <g id="origin-portal">
                <rect x="382" y="32" width="36" height="24" fill="#1A1A1A" stroke="#F3F2EE" strokeWidth="2" />
                <rect x="395" y="44" width="10" height="4" fill="#FF5028" opacity={pulseOpacity} className="transition-opacity" />
                <text x="400" y="25" textAnchor="middle" fill="#F3F2EE" fontSize="8" fontFamily="monospace" fontWeight="bold">SPAWNER</text>
              </g>

              {/* Switch nodes */}
              <g id="switches-group">
                {(['A', 'B', 'C'] as const).map(key => {
                  const node = NODES[key];
                  const sVal = engine.switches[key];
                  const strokeColor = '#00A3FF';
                  const rot = key === 'A' ? (sVal === 0 ? -45 : 45) : (sVal === 0 ? -40 : 40);
                  return (
                    <g
                      key={key}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => toggleSwitch(key)}
                      onTouchEnd={(e) => { e.preventDefault(); toggleSwitch(key); }}
                      className="cursor-pointer select-none"
                      style={{ touchAction: 'none' }}
                    >
                      {/* Fat finger hit area */}
                      <circle r="30" fill="transparent" />

                      {/* Outer ring */}
                      <circle
                        r="22"
                        fill="#1A1A1A"
                        stroke={sVal === 1 ? strokeColor : '#ffffff'}
                        strokeWidth="3"
                        className="transition-colors duration-150"
                      />
                      <circle r="2" fill="#fff" />

                      {/* Animated direction arrow */}
                      <g style={{ transform: `rotate(${rot}deg)`, transition: 'transform 0.15s ease-out' }}>
                        <line x1="0" y1="0" x2="0" y2="15" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                        <polygon points="0,17 -4,11 4,11" fill="#fff" />
                      </g>

                      <rect x="-16" y="24" width="32" height="12" fill="#111" rx="2" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                      <text y="32" textAnchor="middle" fill="#fff" fontSize="8" fontFamily="monospace" fontWeight="black" className="uppercase font-mono">NODE {key}</text>
                    </g>
                  );
                })}
              </g>

              {/* Stations */}
              <g id="stations-ports">
                {([
                  { id: 'Red',    node: NODES.Red,    color: COLOR_VALUES.red.hex },
                  { id: 'Blue',   node: NODES.Blue,   color: COLOR_VALUES.blue.hex },
                  { id: 'Green',  node: NODES.Green,  color: COLOR_VALUES.green.hex },
                  { id: 'Yellow', node: NODES.Yellow, color: COLOR_VALUES.yellow.hex },
                ] as const).map(station => (
                  <g key={station.id} transform={`translate(${station.node.x}, ${station.node.y})`}>
                    <rect x="-24" y="-24" width="48" height="48" fill="#111" stroke={station.color} strokeWidth="3" />
                    <circle r="12" fill={station.color} />
                    <text y="4" textAnchor="middle" fill="#111" fontSize="10" fontFamily="monospace" fontWeight="extrabold">
                      {station.id === 'Yellow' ? 'YEL' : station.id === 'Green' ? 'GRN' : station.id.toUpperCase().slice(0, 3)}
                    </text>
                    <text y="35" textAnchor="middle" fill={station.color} fontSize="8" fontFamily="monospace" fontWeight="bold">S_0{['Red','Blue','Green','Yellow'].indexOf(station.id) + 1}</text>
                  </g>
                ))}
              </g>

              {/* Particles */}
              {particles.map(p => (
                <circle key={p.id} cx={p.x} cy={p.y} r="2.5" fill={p.color} opacity={Math.min(1, p.life * 3)} />
              ))}

              {/* Trains */}
              <g id="active-trains">
                {trains.map(train => {
                  const coords = getTrainCoords(train.segment, train.progress);
                  const color = COLOR_VALUES[train.color];
                  return (
                    <g key={train.id} transform={`translate(${coords.x}, ${coords.y})`}>
                      {/* Glow trail */}
                      <circle r="14" fill={color.hex} opacity="0.25" />
                      {/* Body */}
                      <rect x="-9" y="-9" width="18" height="18" rx="3" fill="#111111" stroke={color.hex} strokeWidth="3" />
                      {/* Center indicator */}
                      <circle cx="0" cy="0" r="4" fill={color.hex} opacity={0.6} />
                    </g>
                  );
                })}
              </g>

              {/* Floating texts */}
              <g id="screen-notifications" pointerEvents="none">
                {floatingTexts.map(f => (
                  <text
                    key={f.id}
                    x={f.x}
                    y={f.y}
                    textAnchor="middle"
                    fontSize="11"
                    className={`${f.colorClass} fill-current select-none font-mono font-black tracking-wide`}
                    opacity={Math.min(1, f.life * 1.5)}
                  >
                    {f.text}
                  </text>
                ))}
              </g>
            </svg>
          </div>

          {/* Sound + Tutorial + Pause controls (mobile only) */}
          <div className="flex md:hidden items-center justify-between bg-white/5 border border-white/10 p-2 mt-2 max-md:flex-shrink-0">
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 border border-white/10 hover:bg-white/5 text-[#F3F2EE]/70 hover:text-white cursor-pointer"
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
              <button
                onClick={() => setShowTutorial(prev => !prev)}
                className="p-2 border border-white/10 hover:bg-white/5 text-[#F3F2EE]/70 hover:text-white cursor-pointer"
              >
                <HelpCircle size={14} />
              </button>
            </div>
            <div className="flex gap-2 items-center">
              {gameState === 'playing' ? (
                <button
                  onClick={pauseGame}
                  className="bg-white/10 hover:bg-white/20 border border-white/10 text-white font-extrabold px-3 py-1.5 flex items-center gap-1 text-xs cursor-pointer"
                >
                  <Pause size={12} fill="currentColor" />
                  <span>PAUSAR</span>
                </button>
              ) : gameState === 'paused' ? (
                <button
                  onClick={resumeGame}
                  className="bg-[#FF5028] text-white font-extrabold px-3 py-1.5 flex items-center gap-1 text-xs cursor-pointer"
                >
                  <Play size={12} fill="currentColor" />
                  <span>REANUDAR</span>
                </button>
              ) : null}
              {gameState === 'gameover' && (
                <button
                  onClick={startGame}
                  className="bg-[#FF5028] text-white font-extrabold px-3 py-1.5 flex items-center gap-1 text-xs cursor-pointer"
                >
                  <Play size={12} fill="currentColor" />
                  <span>REINTENTAR</span>
                </button>
              )}
            </div>
          </div>

          {/* Desktop bottom bar */}
          <div className="hidden md:flex bg-white/5 border border-white/10 p-3 mt-4 justify-between items-center text-xs font-mono">
            <div className="flex gap-2.5 items-center">
              {gameState === 'playing' ? (
                <button onClick={pauseGame} className="bg-white/10 hover:bg-white/20 border border-white/10 text-white font-extrabold px-4 py-2 flex items-center gap-1 cursor-pointer">
                  <Pause size={12} fill="currentColor" />
                  <span>PAUSAR</span>
                </button>
              ) : gameState !== 'lobby' && (
                <button onClick={resumeGame} className="bg-[#FF5028] text-white font-extrabold px-4 py-2 flex items-center gap-1 cursor-pointer">
                  <Play size={12} fill="currentColor" />
                  <span>REANUDAR</span>
                </button>
              )}
              <span className="text-white/40">ESTADO: <span className="text-white font-bold">{gameState.toUpperCase()}</span></span>
            </div>
            <div className="text-right text-[11px] text-[#00A3FF]">
              {gameState === 'playing' && <span className="animate-pulse">● TRANSMISIÓN ACTIVA...</span>}
            </div>
          </div>

        </div>

        {/* Right Sidebar (desktop only) */}
        <div className="hidden md:block md:col-span-4 space-y-6">
          {showTutorial && (
            <div className="bg-[#FF5028]/10 border border-[#FF5028] p-5 relative">
              <button
                onClick={() => setShowTutorial(false)}
                className="absolute right-3 top-3 text-xs text-[#FF5028] font-black uppercase tracking-wider font-mono hover:underline cursor-pointer"
              >
                ✕ Cerrar
              </button>
              <span className="text-[9px] font-black text-[#FF5028] uppercase tracking-[1.5px] block mb-2 font-mono">INSTRUCTIVO DE CONSOLA</span>
              <h4 className="text-sm font-bold uppercase tracking-tight text-white mb-3 font-mono">{'// Cómo pilotar'}</h4>
              <ul className="text-xs space-y-2.5 leading-relaxed text-[#F3F2EE]/80 font-mono">
                <li className="flex items-start gap-2"><span className="text-[#FF5028] font-black">1.</span><span>Los trenes automáticos se despliegan desde el portal superior con códigos de color específicos.</span></li>
                <li className="flex items-start gap-2"><span className="text-[#00A3FF] font-black">2.</span><span>En las intersecciones, haz clic/tap sobre los nódulos circulares <strong className="text-white">(NODE A, B, C)</strong> para cambiar las agujas.</span></li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 font-black">3.</span><span>Guía cada tren de color hacia su terminal homónimo para recolectar puntos.</span></li>
                <li className="flex items-start gap-2"><span className="text-amber-400 font-black">4.</span><span>¡Cuidado! Desviar un tren a un puerto incorrecto cuesta 1 vida y deduce puntos.</span></li>
              </ul>
            </div>
          )}

          <div className="bg-white/5 border border-white/10 p-5 font-mono space-y-4">
            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest block font-sans">{'// STATUS COMPONENT'}</span>
            <h3 className="text-xs font-black uppercase text-white tracking-wider">{'// MONITOREO DE SISTEMAS'}</h3>
            <div className="space-y-3.5 text-xs">
              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-white/60">INTERVALO DE SPAWN</span>
                  <span className="text-white font-bold">
                    {gameState === 'playing' ? (Math.max(MIN_SPAWN_RATE, BASE_SPAWN_RATE - (elapsed / GAME_DURATION) * 1.6 - (score / 600) * 0.9)).toFixed(1) + 's' : `${BASE_SPAWN_RATE}s`}
                  </span>
                </div>
                <div className="h-1.5 bg-white/10">
                  <div className="h-full bg-[#00A3FF] transition-all duration-300" style={{ width: `${Math.min(100, gameIntensity * 1.2)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-white/60">RAPIDEZ DE TRÁNSITO</span>
                  <span className="text-white font-bold">
                    {gameState === 'playing' ? (1.0 + (elapsed / GAME_DURATION) * 0.4 + (score / 600) * 0.2).toFixed(2) + 'x' : '1.00x'}
                  </span>
                </div>
                <div className="h-1.5 bg-white/10">
                  <div className="h-full bg-[#FF5028] transition-all duration-300" style={{ width: `${gameIntensity}%` }} />
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

          <div className="bg-white/5 border border-white/10 p-5 space-y-3 font-mono">
            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest block font-sans">{'// SEGURIDAD BIOMÉTRICA'}</span>
            <h4 className="text-xs font-black uppercase tracking-wider text-white">{'// JUGADOR ASIGNADO'}</h4>
            <div className="text-xs text-white/80 space-y-1">
              <p>ID: <span className="text-white font-bold">{currentUser?.username || 'Invitado'}</span></p>
              <p>RANGO: <span className="text-[#FF5028] font-bold">{currentUser?.cerebra_rank || 'Iniciado del Templo'}</span></p>
              <p>PERFIL: <span className="text-white/60 text-[10px]">{currentUser?.is_guest ? 'ALMACENAMIENTO DE SESIÓN' : 'REGISTRADO EN POSTGRES'}</span></p>
            </div>
          </div>
        </div>

      </div>

      {/* Mobile floating tutorial */}
      {showTutorial && gameState === 'playing' && (
        <div className="md:hidden fixed inset-0 z-50 bg-[#1A1A1A]/95 flex items-center justify-center p-6">
          <div className="bg-[#FF5028]/10 border border-[#FF5028] p-5 relative max-w-sm w-full">
            <button
              onClick={() => setShowTutorial(false)}
              className="absolute right-3 top-3 text-xs text-[#FF5028] font-black uppercase tracking-wider font-mono cursor-pointer"
            >
              ✕ Cerrar
            </button>
            <span className="text-[9px] font-black text-[#FF5028] uppercase tracking-[1.5px] block mb-2 font-mono">INSTRUCTIVO</span>
            <h4 className="text-sm font-bold uppercase tracking-tight text-white mb-3 font-mono">{'// Cómo pilotar'}</h4>
            <ul className="text-xs space-y-2.5 leading-relaxed text-[#F3F2EE]/80 font-mono">
              <li className="flex items-start gap-2"><span className="text-[#FF5028] font-black">1.</span><span>Los trenes automáticos se despliegan desde el portal superior con códigos de color.</span></li>
              <li className="flex items-start gap-2"><span className="text-[#00A3FF] font-black">2.</span><span>Tocá los nódulos <strong className="text-white">(NODE A, B, C)</strong> para cambiar las agujas de las vías.</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 font-black">3.</span><span>Guiá cada tren hacia su terminal del mismo color para sumar puntos.</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-400 font-black">4.</span><span>Si un tren llega a la terminal incorrecta, perdés 1 vida y puntos.</span></li>
            </ul>
          </div>
        </div>
      )}
    </div>
    </GameShell>
  );
}
