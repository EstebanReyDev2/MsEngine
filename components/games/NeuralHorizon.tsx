// 📂 /components/games/NeuralHorizon.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';
import { 
  ArrowLeft, Play, Pause, RotateCcw, HelpCircle, 
  Volume2, VolumeX, Trophy, Sparkles, CheckCircle2, 
  XCircle, Zap, RefreshCw, Terminal, Eye, ShieldAlert, Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useHaptic } from '@/hooks/use-haptic';
import { useIsMobile } from '@/hooks/use-mobile';

// Radial sector offsets for 8 directions on the UFCV wheel
const SECTORS = [
  { name: 'N', angle: -90, xFactor: 0, yFactor: -1 },
  { name: 'NE', angle: -45, xFactor: 0.707, yFactor: -0.707 },
  { name: 'E', angle: 0, xFactor: 1, yFactor: 0 },
  { name: 'SE', angle: 45, xFactor: 0.707, yFactor: 0.707 },
  { name: 'S', angle: 90, xFactor: 0, yFactor: 1 },
  { name: 'SW', angle: 135, xFactor: -0.707, yFactor: 0.707 },
  { name: 'W', angle: 180, xFactor: -1, yFactor: 0 },
  { name: 'NW', angle: -135, xFactor: -0.707, yFactor: -0.707 }
];

const getNow = (): number => {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
};

type GameState = 'lobby' | 'ready' | 'flash' | 'answer_center' | 'answer_periph' | 'feedback' | 'gameover';

interface NetworkResult {
  round: number;
  exposureMs: number;
  centerCorrect: boolean;
  periphCorrect: boolean;
  responseTimeMs: number;
}

export default function NeuralHorizon({ onBack, currentUser, onRefreshUser }: { onBack: () => void, currentUser: any, onRefreshUser: () => void }) {
  const haptic = useHaptic();
  const isMobile = useIsMobile();
  // Configured constants
  const GRID_ROWS = 15;
  const GRID_COLS = 20;

  // Game configuration
  const [gameState, setGameState] = useState<GameState>('lobby');
  const [score, setScore] = useState<number>(0);
  const [round, setRound] = useState<number>(1);
  const [lives, setLives] = useState<number>(3);
  const [exposureMs, setExposureMs] = useState<number>(500); // Dynamic difficulty starts at 500ms
  const [distractorCount, setDistractorCount] = useState<number>(0); // dynamic distractor scaling (0 to 6)
  
  // Audio controls
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showTutorial, setShowTutorial] = useState<boolean>(true);

  // Stimuli definitions for the active round
  const [centralGliph, setCentralGliph] = useState<'triangle' | 'rhombus'>('triangle');
  const [targetSectorIndex, setTargetSectorIndex] = useState<number>(0);
  const [distractorIndexes, setDistractorIndexes] = useState<number[]>([]);

  // User input responses
  const [userSelectedCenter, setUserSelectedCenter] = useState<'triangle' | 'rhombus' | null>(null);
  const [userSelectedPeriph, setUserSelectedPeriph] = useState<number | null>(null);
  
  // Scoring parameters feedback
  const [isCenterCorrect, setIsCenterCorrect] = useState<boolean>(false);
  const [isPeriphCorrect, setIsPeriphCorrect] = useState<boolean>(false);
  const [roundExposureMs, setRoundExposureMs] = useState<number>(500);
  const [roundStartTime, setRoundStartTime] = useState<number>(0);
  const [roundResponseTime, setRoundResponseTime] = useState<number>(0);
  const [history, setHistory] = useState<NetworkResult[]>([]);

  // Timers references
  const flashTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Custom visual retro synthesizer sounds
  const playSound = (freq: number, type: 'sine' | 'square' | 'triangle' | 'sawtooth' = 'sine', duration = 0.15) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio fallback safe
    }
  };

  // Launch fresh game
  const handleStartGame = () => {
    setScore(0);
    setRound(1);
    setLives(3);
    setExposureMs(500);
    setDistractorCount(0);
    setHistory([]);
    setGameState('ready');
    playSound(400, 'sine', 0.2);
    setTimeout(() => playSound(600, 'sine', 0.25), 100);
  };

  // Prepare & trigger the stimulus flashing sequence
  const executeScan = () => {
    if (gameState !== 'ready') return;

    // 1. Roll randomized target components
    const rolledCenter = Math.random() > 0.5 ? 'triangle' : 'rhombus';
    const rolledPeriphIndex = Math.floor(Math.random() * SECTORS.length);

    // 2. Distractor density placement mapping
    const availablePositions = Array.from({ length: 8 }, (_, i) => i).filter(v => v !== rolledPeriphIndex);
    const randomizedDistractors: number[] = [];
    const countToPlace = Math.min(distractorCount, availablePositions.length);
    
    // Shuffle positions
    availablePositions.sort(() => Math.random() - 0.5);
    for (let i = 0; i < countToPlace; i++) {
      randomizedDistractors.push(availablePositions[i]);
    }

    setCentralGliph(rolledCenter);
    setTargetSectorIndex(rolledPeriphIndex);
    setDistractorIndexes(randomizedDistractors);
    setUserSelectedCenter(null);
    setUserSelectedPeriph(null);
    setRoundExposureMs(exposureMs);

    // 3. Play cybernet activation tone
    playSound(900, 'sawtooth', 0.1);
    setGameState('flash');

    // 4. Hide strictly on timeout limit
    flashTimerRef.current = setTimeout(() => {
      setGameState('answer_center');
      setRoundStartTime(getNow());
      playSound(250, 'triangle', 0.08);
    }, exposureMs);
  };

  // Check choices and route to phase 2
  const submitCenterAnswer = (selected: 'triangle' | 'rhombus') => {
    setUserSelectedCenter(selected);
    playSound(450, 'sine', 0.05);
    haptic.light();
    setGameState('answer_periph');
  };

  // Record outer sector clicked coordinates and evaluate round success
  const submitPeriphAnswer = (sectorIndex: number) => {
    const end = getNow();
    const rt = Math.round(end - roundStartTime);
    setRoundResponseTime(rt);
    setUserSelectedPeriph(sectorIndex);

    // Evaluate correct checks
    const centerCorrect = userSelectedCenter === centralGliph;
    const periphCorrect = sectorIndex === targetSectorIndex;
    const allCorrect = centerCorrect && periphCorrect;

    setIsCenterCorrect(centerCorrect);
    setIsPeriphCorrect(periphCorrect);

    let roundDeltaPoints = 0;

    if (allCorrect) {
      haptic.success();
      // Points inversely proportional to speed, multiplied by level exposure complexity
      const speedBonus = Math.max(10, Math.floor((1500 - rt) / 50));
      const exposureMultiplier = Math.max(1, Math.floor((600 - exposureMs) / 100));
      roundDeltaPoints = (20 + speedBonus) * exposureMultiplier;
      
      setScore(prev => prev + roundDeltaPoints);
      
      // Chime combo victory audio
      playSound(600, 'sine', 0.1);
      setTimeout(() => playSound(800, 'sine', 0.1), 80);
      setTimeout(() => playSound(1000, 'sine', 0.2), 160);

      // Dynamic difficulty adjustment on SUCCESS: make is faster
      setExposureMs(prev => Math.max(40, Math.round(prev * 0.8)));
      // Increment distractor density slowly
      if (round % 2 === 0) {
        setDistractorCount(prev => Math.min(6, prev + 1));
      }
    } else {
      // Penalize lives on error
      setLives(prev => {
        const next = prev - 1;
        if (next <= 0) {
          // Trigger gameover after short delay
          setTimeout(() => endGame(score), 1500);
        }
        return next;
      });

      // Buzz mistake audio tone
      playSound(120, 'sawtooth', 0.4);
      haptic.error();

      // Relax exposure dynamic speed on mistake to assist brain loop
      setExposureMs(prev => Math.min(800, Math.round(prev * 1.3)));
    }

    // Capture diagnostic tracking log
    const result: NetworkResult = {
      round,
      exposureMs: roundExposureMs,
      centerCorrect,
      periphCorrect,
      responseTimeMs: rt
    };
    setHistory(prev => [result, ...prev]);

    setGameState('feedback');
  };

  // Go on to next round
  const proceedToNextRound = () => {
    if (lives <= 0) {
      endGame(score);
      return;
    }
    setRound(prev => prev + 1);
    setGameState('ready');
    playSound(400, 'sine', 0.1);
  };

  // Close the session
  const endGame = (finalScore: number) => {
    setGameState('gameover');
    if (currentUser) {
      try {
        supabaseClient.db.saveScore(
          currentUser.id, 
          'Neural Horizon', 
          finalScore, 
          Math.min(10, Math.floor(finalScore / 100) + 1)
        );
        onRefreshUser();
      } catch (err) {
        console.error('Error saving game index score:', err);
      }
    }
  };

  // Clear timers clean-up
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  return (
    <div id="neural-horizon-root" className="game-area w-full max-w-[1050px] mx-auto bg-zinc-950 text-zinc-100 border-4 border-zinc-900 p-4 md:p-6 select-none font-sans overflow-hidden relative">
      
      {/* 🚀 Header HUD display */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-stretch gap-4 pb-4 border-b border-zinc-800 mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer rounded-none bg-zinc-900/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Volver "
            id="neural-back-btn"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[2px] text-emerald-400 block">{"// DEPARTAMENTO COGNITIVO VISOESPACIAL"}</span>
            <h1 className="text-xl font-bold font-mono text-white tracking-tight uppercase flex items-center gap-2">
              <Cpu className="text-emerald-400 animate-pulse" size={18} />
              <span>Neural Horizon</span>
            </h1>
          </div>
        </div>

        {/* Level diagnostics readouts */}
        <div className="grid grid-cols-4 gap-2 md:gap-4 flex-grow md:max-w-xl text-center font-mono">
          <div className="bg-zinc-900 border border-zinc-800 p-2">
            <span className="text-[8px] block text-zinc-500 uppercase tracking-wider">RONDA</span>
            <span className="text-sm font-black text-white">0{round}</span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-2">
            <span className="text-[8px] block text-zinc-500 uppercase tracking-wider">SCORE</span>
            <span className="text-sm font-black text-[#00A3FF]">{score}</span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-2">
            <span className="text-[8px] block text-zinc-500 uppercase tracking-wider">VIDAS</span>
            <span className="text-sm font-black text-rose-500 uppercase tracking-tighter">
              {'★'.repeat(lives)}{'☆'.repeat(3 - lives)}
            </span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-2">
            <span className="text-[8px] block text-zinc-500 uppercase tracking-wider">RETARDO FLASH</span>
            <span className="text-sm font-black text-amber-400">{exposureMs}ms</span>
          </div>
        </div>

        {/* Utilities */}
        <div className="flex items-center gap-1.5 self-center">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer"
            id="neural-sound-toggle"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button 
            onClick={() => setShowTutorial(prev => !prev)}
            className="p-2.5 border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer"
            id="neural-help-toggle"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {/* 🔮 Interactive Canvas Stage wrapper layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 items-start">
        
        {/* Left Arena Stage */}
        <div className="lg:col-span-8 bg-zinc-900/40 border border-zinc-800 p-4 md:p-6 relative min-h-[520px] flex items-center justify-center">
          
          {/* Noise background vector grid effect */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:24px_24px] opacity-20 pointer-events-none" />

          {/* LOBBY overlay state */}
          <AnimatePresence>
            {gameState === 'lobby' && (
              <motion.div 
                className="absolute inset-0 bg-zinc-950/98 text-center flex flex-col items-center justify-center p-6 z-30 font-mono"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                id="neural-lobby-overlay"
              >
                <div className="max-w-md space-y-6">
                  <div className="w-16 h-16 rounded-sm bg-emerald-950/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-900/10 animate-pulse">
                    <Eye size={36} />
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black uppercase tracking-tight text-white">{"// NEURAL HORIZON CONSOLE"}</h2>
                    <p className="font-serif italic text-xs text-zinc-400">
                      Entrena la velocidad de integración periférica y discriminación instantánea del córtex visual.
                    </p>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 p-4 text-left text-xs leading-relaxed space-y-2.5 text-zinc-300">
                    <p className="text-indigo-400 font-bold uppercase text-center border-b border-zinc-800 pb-2">PROPIEDADES DE ESCÁNER ÓPTICO</p>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>🔌 VELOCIDAD: <span className="text-white font-bold">Adaptativa (500ms - 50ms)</span></div>
                      <div>🛰️ PERIFERIA: <span className="text-white font-bold">8 Canales Radiales</span></div>
                      <div>🛡️ DETALLES: <span className="text-white font-bold">Atención Dividida</span></div>
                      <div>🧬 CAPACIDAD: <span className="text-white font-bold">Campo de Visión Útil</span></div>
                    </div>
                  </div>

                  <button 
                    onClick={handleStartGame}
                    className="w-full py-4 bg-emerald-500 text-black font-black text-sm uppercase tracking-wider rounded-none hover:bg-white transition-all border border-transparent cursor-pointer"
                  >
                    INICIAR CALIBRACIÓN COGNITIVA
                  </button>
                </div>
              </motion.div>
            )}

            {/* GAME OVER state */}
            {gameState === 'gameover' && (
              <motion.div 
                className="absolute inset-0 bg-zinc-950/98 text-center flex flex-col items-center justify-center p-6 z-30 font-mono"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                id="neural-gameover-overlay"
              >
                <div className="max-w-xs space-y-5">
                  <div className="w-12 h-12 bg-zinc-900 border border-zinc-700 text-[#00A3FF] flex items-center justify-center mx-auto">
                    <Trophy size={24} />
                  </div>

                  <div className="space-y-1">
                    <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest block font-mono">{"// DIAGNÓSTICO COMPLETO CONCLUIDO"}</span>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Escaneo Concluido</h2>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 p-4 space-y-2 text-xs text-left">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">PUNTUACIÓN FINAL:</span>
                      <span className="text-emerald-400 font-bold">{score} Puntos</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">RONDAS COMPLETADAS:</span>
                      <span className="text-white font-bold">{round}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">RETRASO DE FLASH FINAL:</span>
                      <span className="text-amber-400 font-bold">{exposureMs} ms</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <button 
                      onClick={handleStartGame}
                      className="py-3 bg-emerald-500 hover:bg-white text-black font-black text-xs uppercase cursor-pointer transition-all"
                    >
                      Reintentar Secuencia
                    </button>
                    <button 
                      onClick={onBack}
                      className="py-3 bg-zinc-900 border border-zinc-800 text-zinc-400 font-black text-xs uppercase cursor-pointer"
                    >
                      Salir
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 📡 THE MAIN RADIAL UFVC BOARD */}
          <div className="relative w-[420px] h-[420px] flex items-center justify-center border border-zinc-800/60 rounded-full bg-zinc-950/40">
            
            {/* Sector concentric helper rings */}
            <div className="absolute w-[360px] h-[360px] border border-dashed border-zinc-900 rounded-full pointer-events-none" />
            <div className="absolute w-[240px] h-[240px] border border-dashed border-zinc-900 rounded-full pointer-events-none" />

            {/* Sector subdivision axes lines */}
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
              <div className="absolute w-full h-[1px] bg-white transform rotate-0" />
              <div className="absolute w-full h-[1px] bg-white transform rotate-45" />
              <div className="absolute w-full h-[1px] bg-white transform rotate-90" />
              <div className="absolute w-full h-[1px] bg-white transform rotate-135" />
            </div>

            {/* 💾 THE CENTRAL NUCLEUS / GOAL */}
            <div className="absolute z-20 w-32 h-32 rounded-full border border-zinc-800 bg-zinc-950 flex flex-col items-center justify-center shadow-2xl">
              
              {/* Ready State launch trigger */}
              {gameState === 'ready' && (
                <button 
                  onClick={executeScan}
                  className="w-24 h-24 rounded-full bg-emerald-950/30 border-2 border-emerald-400/80 hover:border-emerald-400 text-white font-mono text-[10px] font-black tracking-widest uppercase transition-all flex flex-col items-center justify-center gap-1 cursor-pointer select-none active:scale-95"
                >
                  <Eye size={18} className="text-emerald-400 animate-pulse" />
                  <span>ESCANEAR</span>
                </button>
              )}

              {/* Flashing target preview center */}
              {gameState === 'flash' && (
                <div className="flex flex-col items-center justify-center">
                  {centralGliph === 'triangle' ? (
                    <div className="w-12 h-12 border-b-4 border-r-4 border-cyan-400 rotate-45 transform mb-3 -mt-1" />
                  ) : (
                    <div className="w-10 h-10 border-2 border-cyan-400 rotate-45 transform" />
                  )}
                  <span className="text-[9px] font-mono text-cyan-400 animate-pulse mt-1 tracking-widest font-bold">NÚCLEO</span>
                </div>
              )}

              {/* Answering Choice Phase 1: Center Glifo selection */}
              {gameState === 'answer_center' && (
                <div className="flex flex-col items-center justify-center gap-2 p-1 font-mono">
                  <span className="text-[8px] text-zinc-500 font-black text-center uppercase tracking-wide">¿QUÉ VISTE EN EL CENTRO?</span>
                  <div className="flex gap-2">
                    {/* Triangle option button */}
                    <button 
                      onClick={() => submitCenterAnswer('triangle')}
                      onTouchEnd={(e) => { e.preventDefault(); submitCenterAnswer('triangle'); }}
                      className="min-w-[44px] min-h-[44px] md:w-12 md:h-12 border border-zinc-800 hover:border-cyan-400 bg-zinc-900/40 text-cyan-400 hover:bg-zinc-900 cursor-pointer flex items-center justify-center"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <div className="w-5 h-5 border-b-2 border-r-2 border-cyan-400 rotate-45 transform" />
                    </button>
                    {/* Rhombus option button */}
                    <button 
                      onClick={() => submitCenterAnswer('rhombus')}
                      onTouchEnd={(e) => { e.preventDefault(); submitCenterAnswer('rhombus'); }}
                      className="min-w-[44px] min-h-[44px] md:w-12 md:h-12 border border-zinc-800 hover:border-cyan-400 bg-zinc-900/40 text-cyan-400 hover:bg-zinc-900 cursor-pointer flex items-center justify-center"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <div className="w-4 h-4 border-2 border-cyan-400 rotate-45 transform" />
                    </button>
                  </div>
                </div>
              )}

              {/* Waiting status center indicator */}
              {gameState === 'answer_periph' && (
                <div className="text-center p-2 font-mono">
                  <div className="w-6 h-6 border-2 border-t-transparent border-emerald-400 rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-[9px] text-emerald-400 font-bold block animate-pulse uppercase tracking-wider">LOCALIZAR BRECHA</span>
                </div>
              )}

              {/* Feedback readout results center */}
              {gameState === 'feedback' && (
                <div className="text-center font-mono">
                  {isCenterCorrect && isPeriphCorrect ? (
                    <div className="text-emerald-400">
                      <CheckCircle2 size={24} className="mx-auto mb-1" />
                      <span className="text-[10px] font-black uppercase">ÉXITO</span>
                    </div>
                  ) : (
                    <div className="text-rose-500">
                      <XCircle size={24} className="mx-auto mb-1" />
                      <span className="text-[10px] font-black uppercase">FALLO</span>
                    </div>
                  )}
                  <span className="text-[9px] text-zinc-400 block mt-1">{roundResponseTime}ms</span>
                  <button 
                    onClick={proceedToNextRound}
                    className="mt-2 text-[9px] text-[#00A3FF] hover:underline font-bold"
                  >
                    CONTINUAR
                  </button>
                </div>
              )}
            </div>

            {/* 🛰️ RADIAL SECTOR OVERLAYS LAYER (Outer ring elements) */}
            {SECTORS.map((sec, idx) => {
              // Calculate coordinate translation
              const radius = 180;
              const xPos = 210 + sec.xFactor * radius;
              const yPos = 210 + sec.yFactor * radius;

              // Display visual modes
              const isFlashing = gameState === 'flash';
              const isTargetLocal = idx === targetSectorIndex;
              const isDistractorLocal = distractorIndexes.includes(idx);
              const isAnsweringPeriph = gameState === 'answer_periph';
              const isFeedback = gameState === 'feedback';

              return (
                <div 
                  key={sec.name}
                  className="absolute"
                  style={{ 
                    left: `${xPos}px`, 
                    top: `${yPos}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  {/* Real interactive clickable sector targets on localization check */}
                  {isAnsweringPeriph && (
                    <button 
                      onClick={() => submitPeriphAnswer(idx)}
                      onTouchEnd={(e) => { e.preventDefault(); submitPeriphAnswer(idx); }}
                      className="min-w-[44px] min-h-[44px] md:w-14 md:h-14 rounded-full border border-emerald-500/20 hover:border-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/20 text-white font-mono text-[11px] md:text-xs font-black cursor-pointer shadow-lg shadow-emerald-500/5 hover:scale-105 transition-all flex items-center justify-center animate-pulse"
                      title={`Vincular a sector ${sec.name}`}
                      style={{ touchAction: 'manipulation' }}
                    >
                      {sec.name}
                    </button>
                  )}

                  {/* Flash phase stimuli presentation absolute overlay */}
                  {isFlashing && isTargetLocal && (
                    <motion.div 
                      className="w-12 h-12 flex items-center justify-center bg-fuchsia-950/40 border-2 border-fuchsia-500 rounded-sm text-fuchsia-500 text-center shadow-lg shadow-fuchsia-500/20"
                      initial={{ scale: 0.8, opacity: 1 }}
                      animate={{ scale: 1 }}
                    >
                      {/* Breach warning icon */}
                      <ShieldAlert size={20} className="animate-spin" />
                    </motion.div>
                  )}

                  {/* Flash phase dynamic grey distractors to raise UFOV tracking difficulties */}
                  {isFlashing && isDistractorLocal && (
                    <div 
                      className="w-12 h-12 flex items-center justify-center bg-zinc-900 border-2 border-zinc-800 rounded-sm text-zinc-600 text-center"
                    >
                      {/* Look alike distractor details */}
                      <ShieldAlert size={16} />
                    </div>
                  )}

                  {/* Feedback summary answer pointer paths */}
                  {isFeedback && (
                    <div className="flex flex-col items-center justify-center font-mono">
                      {isTargetLocal && (
                        <div className="w-10 h-10 border border-fuchsia-500/50 flex flex-col justify-center items-center rounded-sm bg-fuchsia-950/10 text-fuchsia-500 font-black text-[9px]">
                          CORRECTO
                        </div>
                      )}
                      
                      {isFeedback && idx === userSelectedPeriph && !isPeriphCorrect && (
                        <div className="w-10 h-10 border border-rose-500/50 flex flex-col justify-center items-center rounded-sm bg-rose-950/10 text-rose-500 font-black text-[9px]">
                          ERROR
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick HUD guide actions */}
          <div className="absolute bottom-4 left-4 right-4 flex bg-zinc-900 border border-zinc-800 p-2.5 mt-4 justify-between items-center text-xs font-mono">
            <div>
              <span className="text-zinc-500">ESTADO REGISTRADO: <span className="text-emerald-400 font-bold">{gameState.toUpperCase()}</span></span>
            </div>
            <div>
              {gameState === 'ready' && (
                <span className="text-emerald-400 animate-pulse">● SISTEMA LISTO PARA ESCALO ÓPTICO</span>
              )}
              {gameState === 'answer_center' && (
                <span className="text-[#00A3FF] animate-pulse">▲ SELECCIONAR GLIFO EN EL MAPA CENTRAL</span>
              )}
              {gameState === 'answer_periph' && (
                <span className="text-[#FF5028] animate-pulse">◆ SELECCIONAR SECTOR DE LA BRECHA MAGENTA</span>
              )}
            </div>
          </div>

        </div>

        {/* Right Help Column */}
        <div className="lg:col-span-4 space-y-6 font-mono text-zinc-300">
          
          {showTutorial && (
            <div className="bg-emerald-950/10 border border-emerald-500 p-5 relative rounded-none">
              <button 
                onClick={() => setShowTutorial(false)}
                className="absolute right-3 top-3 text-[10px] uppercase font-black tracking-widest text-emerald-400 font-mono hover:underline cursor-pointer"
                id="neural-close-tutorial"
              >
                ✕ Cerrar
              </button>
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block mb-2 font-mono">CONSOLA INFORMATIVA</span>
              <h4 className="text-sm font-bold uppercase tracking-tight text-white mb-3 font-mono">{"// Cómo pilotar"}</h4>
              
              <ul className="text-xs space-y-3 leading-relaxed text-zinc-400 font-mono">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-black">1.</span>
                  <span>Presiona <strong className="text-white">{"'ESCANEAR'"}</strong> en el centro. Inmediatamente se flashearán glifos rápidos de luz.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-black">2.</span>
                  <span>Determina qué glifo apareció en el centro (Triángulo o Rombo).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-fuchsia-500 font-black">3.</span>
                  <span>Localiza la brecha periférica (Glifo Magenta parpadeante en el anillo de 8 sectores).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-black">4.</span>
                  <span>La velocidad del flash aumenta con aciertos consecutivos, reduciendo tu tiempo de reacción.</span>
                </li>
              </ul>
            </div>
          )}

          {/* Diagnostics statistics history tracker logs */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 font-mono space-y-4 rounded-none">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">{"// STATUS REPORT"}</span>
            <h3 className="text-xs font-black uppercase text-white tracking-wider">REGISTRO DE ESCANEOS</h3>

            <div className="max-h-56 overflow-y-auto space-y-2 text-[11px] pr-2">
              {history.length === 0 ? (
                <div className="text-zinc-600 italic py-4 text-center">Sin datos de sesión activo.</div>
              ) : (
                history.map((h, index) => (
                  <div key={index} className="flex justify-between border-b border-zinc-800/60 pb-1.5 items-center">
                    <span className="text-zinc-500">Scan_0{h.round}</span>
                    <span className="text-amber-400">{h.exposureMs}ms</span>
                    <span className={h.centerCorrect && h.periphCorrect ? 'text-emerald-400 font-bold' : 'text-rose-500 font-bold'}>
                      {h.centerCorrect && h.periphCorrect ? 'SINCRO' : 'BRECHA'}
                    </span>
                    <span className="text-zinc-400">{h.responseTimeMs}ms</span>
                  </div>
                ))
              )}
            </div>

            <hr className="border-zinc-800" />

            <div className="bg-zinc-950 p-3 rounded-none border border-zinc-800 text-[10px] leading-relaxed space-y-1 text-zinc-400">
              <p className="text-emerald-400 font-bold uppercase mb-1">Dificultad Dinámica</p>
              <p>Distractores activos: <span className="text-white font-bold">{distractorCount}</span></p>
              <p>Latencia actual: <span className="text-white font-bold">{exposureMs}ms</span></p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
