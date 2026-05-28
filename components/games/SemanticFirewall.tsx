// 📂 /components/games/SemanticFirewall.tsx
'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Volume2, VolumeX, ShieldCheck, Terminal } from 'lucide-react';

interface FallacyArgument {
  id: number;
  text: string;
  isFallacy: boolean;
  fallacyType?: 'Ad Hominem' | 'Slippery Slope' | 'False Dilemma' | 'False Cause';
  explanation: string;
}

const ARGUMENTS: FallacyArgument[] = [
  { id: 1, text: "Debemos confiar en el algoritmo de trading porque el desarrollador ha ganado 3 medallas de ajedrez.", isFallacy: true, fallacyType: 'False Cause', explanation: "Se asume una relación causal inexistente entre habilidades de ajedrez y éxito de trading." },
  { id: 2, text: "Este sistema de seguridad es el más eficiente porque ha sido optimizado con técnicas de IA de última generación.", isFallacy: false, explanation: "El argumento presenta una afirmación sobre la optimización sin caer en falacias lógicas." },
  { id: 3, text: "No escuches al analista, su peinado es ridículo y nunca ha trabajado en una empresa del Fortune 500.", isFallacy: true, fallacyType: 'Ad Hominem', explanation: "Se ataca a la persona en lugar de evaluar la validez del argumento presentado." },
];

interface SemanticFirewallProps {
  onBack: () => void;
  currentUser: any;
  onRefreshUser: () => void;
}

export default function SemanticFirewall({ onBack, currentUser, onRefreshUser }: SemanticFirewallProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentArg, setCurrentArg] = useState<FallacyArgument>(ARGUMENTS[0]);
  const [log, setLog] = useState<FallacyArgument[]>([]);
  const [gameState, setGameState] = useState<'playing' | 'feedback'>('playing');
  const [feedback, setFeedback] = useState<string | null>(null);
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

    osc.frequency.setValueAtTime(type === 'success' ? 440 : 220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(type === 'success' ? 880 : 110, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(); osc.stop(ctx.currentTime + 0.1);
  }, [soundEnabled]);

  const handleAction = (isFallacyChoice: boolean, type?: FallacyArgument['fallacyType']) => {
    setGameState('feedback');
    const isCorrect = currentArg.isFallacy === isFallacyChoice && (currentArg.isFallacy ? currentArg.fallacyType === type : true);
    
    if (isCorrect) {
      playSound('success');
      setFeedback(`[SYSTEM_ACCEPTED]: ${currentArg.isFallacy ? 'Categoría identificada correctamente' : 'Argumento válido'}`);
    } else {
      playSound('failure');
      setFeedback(`[DATA_ALERT]: ${currentArg.explanation}`);
      if (currentArg.isFallacy) setLog(prev => [currentArg, ...prev]);
    }

    setTimeout(() => {
      const nextIndex = (currentIndex + 1) % ARGUMENTS.length;
      setCurrentIndex(nextIndex);
      setCurrentArg(ARGUMENTS[nextIndex]);
      setGameState('playing');
      setFeedback(null);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-300 p-6 flex flex-col font-mono">
      <header className="flex justify-between items-center mb-8 border-b border-zinc-900 pb-4">
        <button onClick={onBack} className="text-zinc-600 hover:text-white flex items-center gap-2"><ArrowLeft size={16} /> [BACK]</button>
        <h1 className="text-xl font-black uppercase text-cyan-500 tracking-widest">Semantic Firewall</h1>
        <button onClick={() => setSoundEnabled(!soundEnabled)}>{soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
      </header>

      <div className="grow flex gap-6">
        <div className="flex-grow flex flex-col justify-center items-center gap-8">
          <div className="w-full max-w-xl p-8 border border-zinc-800 bg-zinc-950 rounded relative">
            <Terminal className="text-zinc-700 mb-4" size={24} />
            <p className="text-lg leading-relaxed">{currentArg.text}</p>
            {feedback && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 p-4 bg-zinc-900 text-zinc-400 text-xs border-l-2 border-zinc-700">
                {feedback}
              </motion.div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 w-full max-w-xl">
             <button onClick={() => handleAction(false)} className="col-span-2 p-4 border border-zinc-700 hover:border-emerald-500 rounded flex items-center justify-center gap-2">
                <ShieldCheck /> Estructura Sólida (Segura)
             </button>
             {['Ad Hominem', 'Slippery Slope', 'False Dilemma', 'False Cause'].map(type => (
               <button key={type} onClick={() => handleAction(true, type as any)} className="p-4 border border-zinc-700 hover:border-red-500 rounded text-xs uppercase">
                 {type}
               </button>
             ))}
          </div>
        </div>

        <aside className="w-80 border-l border-zinc-900 pl-6">
          <h2 className="text-sm font-bold text-zinc-500 mb-4 uppercase tracking-widest">[QUARANTINE_LOG]</h2>
          <div className="space-y-4">
            <AnimatePresence>
              {log.map(item => (
                <motion.div key={item.id} initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 50, opacity: 0 }} className="p-3 bg-zinc-950 border border-zinc-900 text-[10px] text-red-500">
                  {item.text.slice(0, 50)}...
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </aside>
      </div>
    </div>
  );
}
