'use client';
// MOBILE-OPTIMIZED: touch targets ≥ 44px, haptic, touch-action

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabaseClient } from '@/lib/supabaseClient';
import GameShell from '@/components/shared/GameShell';
import { 
  Cpu, RotateCcw, ArrowLeft, Volume2, VolumeX, Shield, 
  ChevronRight, AlertCircle, Zap, RefreshCw
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useHaptic } from '@/hooks/use-haptic';
import { TouchableArea } from '@/components/shared/TouchableArea';

interface NexusShiftProps {
  onBack: () => void;
  currentUser: any;
  onRefreshUser: () => void;
}

type Color = 'cyan' | 'magenta' | 'yellow';
type Shape = 'triangle' | 'square' | 'circle';
type Count = 1 | 2 | 3;
type Rule = 'COLOR' | 'SHAPE' | 'COUNT';

interface DataPacket {
  color: Color;
  shape: Shape;
  count: Count;
}

interface Station {
  id: 'left' | 'right';
  attribute: { color: Color } | { shape: Shape } | { count: Count };
}

const COLORS: Color[] = ['cyan', 'magenta', 'yellow'];
const SHAPES: Shape[] = ['triangle', 'square', 'circle'];
const COUNTS: Count[] = [1, 2, 3];

const HEX_COLORS: Record<Color, string> = {
  cyan: '#22d3ee',
  magenta: '#ec4899',
  yellow: '#eab308',
};

export default function NexusShift({ onBack, currentUser, onRefreshUser }: NexusShiftProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  
  const [level, setLevel] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'blockEnded'>('intro');
  
  const [activeRule, setActiveRule] = useState<Rule>('COLOR');
  const [packet, setPacket] = useState<DataPacket | null>(null);
  const [stations, setStations] = useState<{left: DataPacket, right: DataPacket} | null>(null);
  
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  
  const [feedback, setFeedback] = useState<'success' | 'failure' | 'timeout' | null>(null);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const responseWindow = useMemo(() => Math.max(800, 2000 - (level - 1) * 200), [level]);

  const playSound = useCallback((type: 'success' | 'failure' | 'switch') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'failure') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {}
  }, [soundEnabled]);

  const generateTrial = useCallback((currentRule: Rule) => {
    const randomPacket = (): DataPacket => ({
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      count: COUNTS[Math.floor(Math.random() * COUNTS.length)],
    });

    const p = randomPacket();
    setPacket(p);

    const station1 = randomPacket();
    const station2 = randomPacket();
    
    const matchesRule = (st: DataPacket) => {
      if (currentRule === 'COLOR') return st.color === p.color;
      if (currentRule === 'SHAPE') return st.shape === p.shape;
      return st.count === p.count;
    };

    setStations(Math.random() > 0.5 ? {left: station1, right: station2} : {left: station2, right: station1});
  }, []);

  const changeRule = useCallback(() => {
    const rules: Rule[] = ['COLOR', 'SHAPE', 'COUNT'];
    const nextRule = rules[Math.floor(Math.random() * rules.length)];
    setActiveRule(nextRule);
    playSound('switch');
    generateTrial(nextRule);
  }, [playSound, generateTrial]);

  const handleDecision = useCallback((side: 'left' | 'right') => {
    if (!packet || !stations || feedback) return;
    
    const selectedStation = stations[side];
    const isCorrect = (activeRule === 'COLOR' && selectedStation.color === packet.color) ||
                      (activeRule === 'SHAPE' && selectedStation.shape === packet.shape) ||
                      (activeRule === 'COUNT' && selectedStation.count === packet.count);

    if (isCorrect) {
      setScore(s => s + 100);
      setCorrectCount(c => c + 1);
      setStreak(s => s + 1);
      setFeedback('success');
      playSound('success');
      haptic.success();
      if (streak + 1 >= 5) {
        setStreak(0);
        changeRule();
      } else {
        generateTrial(activeRule);
      }
    } else {
      setStreak(0);
      setFeedback('failure');
      playSound('failure');
      haptic.error();
      generateTrial(activeRule);
    }
    
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(() => setFeedback(null), 300);
  }, [packet, stations, activeRule, feedback, streak, playSound, generateTrial, changeRule, haptic]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    
    timerRef.current = setTimeout(() => {
        handleDecision('left');
    }, responseWindow);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [packet, feedback, gameState, responseWindow, handleDecision]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      if (e.key === 'ArrowLeft') handleDecision('left');
      if (e.key === 'ArrowRight') handleDecision('right');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, handleDecision]);

  // Tamaños adaptativos para mobile
  const packetSize = isMobile ? 'w-28 h-28' : 'w-24 h-24';
  const centerPacketSize = isMobile ? 'w-32 h-32' : 'w-40 h-40';
  const shapeSize = isMobile ? 10 : 12;

  const renderPacket = (p: DataPacket, sizeClass = packetSize) => (
    <div className={`${sizeClass} flex flex-col items-center justify-center border-4 rounded-xl shadow-lg bg-zinc-900/80`} style={{ borderColor: HEX_COLORS[p.color] }}>
      {p.shape === 'triangle' && <div className="w-0 h-0 border-l-[30px] border-r-[30px] border-b-[50px] border-l-transparent border-r-transparent" style={{ borderBottomColor: HEX_COLORS[p.color] }} />}
      {p.shape === 'square' && <div className="w-10 h-10" style={{ backgroundColor: HEX_COLORS[p.color] }} />}
      {p.shape === 'circle' && <div className="w-10 h-10 rounded-full" style={{ backgroundColor: HEX_COLORS[p.color] }} />}
      <div className="flex gap-1 mt-2">
        {Array.from({ length: p.count }).map((_, i) => <div key={i} className="w-3 h-3 rounded-full bg-white animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <GameShell active={gameState !== 'intro'}>
    <div className="game-area min-h-screen bg-zinc-950 text-zinc-200 p-6 flex flex-col items-center justify-center font-mono relative overflow-hidden">
      {/* Context Ring */}
      <motion.div 
        animate={{ borderWidth: activeRule === 'COLOR' ? '2px' : activeRule === 'SHAPE' ? '6px' : '4px', borderStyle: activeRule === 'SHAPE' ? 'dashed' : 'solid' }}
        className="absolute inset-4 rounded-3xl border-cyan-500/30 -z-0"
      />

      {/* Feedback overlays */}
      <AnimatePresence>
        {feedback === 'success' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-emerald-500/20 z-10 pointer-events-none" />
        )}
        {feedback === 'failure' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-rose-500/20 z-10 pointer-events-none" />
        )}
      </AnimatePresence>

      <div className="absolute top-6 left-6 text-cyan-400 font-bold uppercase text-xs tracking-widest z-20">
        Regla: <span className="text-white">{activeRule}</span>
      </div>
      <div className="absolute top-6 right-6 text-zinc-500 font-bold uppercase text-xs tracking-widest z-20">
        Puntos: {score}
      </div>

      <button onClick={onBack} className="absolute top-6 left-1/2 -translate-x-1/2 text-zinc-500 hover:text-white text-xs z-20 min-h-[44px] min-w-[44px] flex items-center justify-center">
        <ArrowLeft size={14} /> <span className="ml-1 hidden md:inline">Salir</span>
      </button>

      {gameState === 'intro' && (
        <TouchableArea onTap={() => { setGameState('playing'); changeRule(); }} haptic="medium"
          className="bg-cyan-600 px-8 py-4 rounded-lg font-bold text-xl uppercase tracking-widest hover:bg-cyan-500 z-20">
          Iniciar Nexus
        </TouchableArea>
      )}

      {gameState === 'playing' && (
        <div className={`w-full max-w-4xl flex ${isMobile ? 'flex-col items-center gap-8' : 'justify-between'} items-center z-20`}>
          <TouchableArea onTap={() => handleDecision('left')} haptic="light" className="flex flex-col items-center">
            {stations && renderPacket(stations.left)}
            <span className="text-zinc-500 text-xs mt-2 block text-center min-h-[20px]">← IZQUIERDA</span>
          </TouchableArea>

          <motion.div animate={{ y: [0, -15, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            {packet && renderPacket(packet, centerPacketSize)}
          </motion.div>

          <TouchableArea onTap={() => handleDecision('right')} haptic="light" className="flex flex-col items-center">
            {stations && renderPacket(stations.right)}
            <span className="text-zinc-500 text-xs mt-2 block text-center min-h-[20px]">DERECHA →</span>
          </TouchableArea>
        </div>
      )}

      {/* Streak indicator */}
      {gameState === 'playing' && streak > 0 && (
        <div className="absolute bottom-12 text-cyan-400 text-sm font-bold z-20">
          🔥 Racha: {streak}/5
        </div>
      )}
    </div>
    </GameShell>
  );
}
