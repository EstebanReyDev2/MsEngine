// 📂 /components/games/VectorLink.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { supabaseClient } from '@/lib/supabaseClient';

interface VectorLinkProps {
  onBack: () => void;
  currentUser: any;
  onRefreshUser: () => void;
}

interface Analogy {
  a: string;
  b: string;
  c: string;
  d: string;
  options: string[];
  correctIndex: number;
}

const ANALOGIES: Analogy[] = [
  { a: "Célula", b: "Organismo", c: "Ladrillo", d: "Pared", options: ["Pared", "Cemento", "Arcilla", "Casa"], correctIndex: 0 },
  { a: "Mapa", b: "Territorio", c: "Plano", d: "Edificio", options: ["Edificio", "Ladrillo", "Arquitecto", "Cimiento"], correctIndex: 0 },
  { a: "Sed", b: "Agua", c: "Hambre", d: "Comida", options: ["Comida", "Dieta", "Chef", "Vitamina"], correctIndex: 0 },
];

export default function VectorLink({ onBack, currentUser, onRefreshUser }: VectorLinkProps) {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'evaluating' | 'success' | 'summary'>('idle');
  const [currentAnalogy, setCurrentAnalogy] = useState<Analogy>(ANALOGIES[0]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSound = useCallback((type: 'success' | 'failure') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtxRef.current;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    }
    osc.start(); osc.stop(ctx.currentTime + 0.2);
  }, [soundEnabled]);

  const handleSelect = (idx: number) => {
    if (gameState !== 'playing') return;
    setGameState('evaluating');
    if (idx === currentAnalogy.correctIndex) {
      setScore(s => s + 100);
      playSound('success');
      setTimeout(() => setGameState('success'), 500);
    } else {
      playSound('failure');
      setTimeout(() => setGameState('playing'), 500);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-zinc-100 p-6 flex flex-col font-mono">
      <header className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
        <button onClick={onBack} className="text-zinc-500 hover:text-white flex items-center gap-2"><ArrowLeft size={16} /> [BACK]</button>
        <h1 className="text-xl font-black uppercase text-cyan-400 tracking-widest">Vector Link</h1>
        <button onClick={() => setSoundEnabled(!soundEnabled)}>{soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
      </header>

      <div className="grow flex flex-col items-center justify-center gap-12">
        <div className="flex gap-8 items-center text-xl font-bold">
          <div className="p-6 border border-zinc-700 bg-zinc-900 rounded">{currentAnalogy.a}</div>
          <div className="text-cyan-400">:</div>
          <div className="p-6 border border-zinc-700 bg-zinc-900 rounded">{currentAnalogy.b}</div>
          <div className="text-2xl">::</div>
          <div className="p-6 border border-zinc-700 bg-zinc-900 rounded">{currentAnalogy.c}</div>
          <div className="text-cyan-400">:</div>
          <div className="p-6 border-2 border-dashed border-zinc-500 rounded bg-zinc-950 text-zinc-500">[?]</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {currentAnalogy.options.map((opt, idx) => (
            <motion.button 
              key={idx}
              whileHover={{ scale: 1.05 }}
              onClick={() => handleSelect(idx)}
              className="px-8 py-4 border border-zinc-700 hover:border-cyan-500 rounded text-center transition-colors"
            >
              {opt}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
