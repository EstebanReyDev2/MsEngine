// 📂 /components/games/LexiconCore.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabaseClient } from '@/lib/supabaseClient';
import { 
  ArrowLeft, Volume2, VolumeX, Sparkles, AlertCircle, Check 
} from 'lucide-react';

interface LexiconCoreProps {
  onBack: () => void;
  currentUser: any;
  onRefreshUser: () => void;
}

interface Syllogism {
  p1: string;
  p2: string;
  options: string[];
  correctIndex: number;
}

const SYLLOGISMS: Syllogism[] = [
  {
    p1: "Todos los [X] emiten luz.",
    p2: "Todos los emisores de luz son [Y].",
    options: ["Todos los [X] son [Y].", "Ningún [X] son [Y].", "Algunos [Y] son [X].", "Ninguna de las conclusiones es válida."],
    correctIndex: 0
  },
  {
    p1: "Ningún [A] es [B].",
    p2: "Todos los [C] son [A].",
    options: ["Algunos [C] son [B].", "Ningún [C] es [B].", "Todos los [C] son [B].", "Ninguna de las conclusiones es válida."],
    correctIndex: 1
  }
];

export default function LexiconCore({ onBack, currentUser, onRefreshUser }: LexiconCoreProps) {
  const [currentSyllogism, setCurrentSyllogism] = useState<Syllogism>(SYLLOGISMS[0]);
  const [gameState, setGameState] = useState<'playing' | 'feedback' | 'success'>('playing');
  const [timeLeft, setTimeLeft] = useState(15);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSound = useCallback((type: 'success' | 'failure' | 'switch') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtxRef.current;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'failure') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    }
  }, [soundEnabled]);

  // Timer logic
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameState('feedback');
          playSound('failure');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState, playSound]);

  const handleSelect = (idx: number) => {
    if (gameState !== 'playing') return;
    
    setGameState('feedback');
    if (idx === currentSyllogism.correctIndex) {
      playSound('success');
    } else {
      playSound('failure');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 flex flex-col font-mono">
      <header className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
        <button onClick={onBack} className="text-zinc-500 hover:text-white flex items-center gap-2"><ArrowLeft size={16} /> [BACK]</button>
        <h1 className="text-xl font-black uppercase text-cyan-400 tracking-widest">Lexicon Core</h1>
        <button onClick={() => setSoundEnabled(!soundEnabled)}>{soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
      </header>

      <div className="grow max-w-2xl mx-auto w-full flex flex-col justify-center gap-8">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg text-lg space-y-4">
          <p className="text-cyan-400">Premisa 1: {currentSyllogism.p1}</p>
          <p className="text-cyan-400">Premisa 2: {currentSyllogism.p2}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {currentSyllogism.options.map((opt, idx) => (
            <button 
              key={idx}
              onClick={() => handleSelect(idx)}
              className={`p-4 border rounded hover:border-cyan-500 transition-colors text-left ${gameState !== 'playing' ? 'opacity-50' : ''}`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
