// 📂 /components/games/SemanticFirewall.tsx
'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import GameShell from '@/components/shared/GameShell';
import { ArrowLeft, Volume2, VolumeX, ShieldCheck, Terminal, AlertTriangle } from 'lucide-react';
import { useHaptic } from '@/hooks/use-haptic';

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

const FALLACY_TYPES = ['Ad Hominem', 'Slippery Slope', 'False Dilemma', 'False Cause'] as const;

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
  const [showLog, setShowLog] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const haptic = useHaptic();

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

  const advanceToNext = useCallback(() => {
    const nextIndex = (currentIndex + 1) % ARGUMENTS.length;
    setCurrentIndex(nextIndex);
    setCurrentArg(ARGUMENTS[nextIndex]);
    setGameState('playing');
    setFeedback(null);
  }, [currentIndex]);

  const handleAction = useCallback((isFallacyChoice: boolean, type?: FallacyArgument['fallacyType']) => {
    if (gameState !== 'playing') return;
    setGameState('feedback');

    const isCorrect = currentArg.isFallacy === isFallacyChoice &&
      (currentArg.isFallacy ? currentArg.fallacyType === type : true);

    if (isCorrect) {
      playSound('success');
      haptic.success();
      setFeedback(`[ACEPTADO]: ${currentArg.isFallacy ? 'Falacia identificada' : 'Argumento válido'}`);
    } else {
      playSound('failure');
      haptic.error();
      setFeedback(`[RECHAZADO]: ${currentArg.explanation}`);
      if (currentArg.isFallacy) setLog(prev => [currentArg, ...prev]);
    }

    setTimeout(advanceToNext, 2000);
  }, [gameState, currentArg, playSound, haptic, advanceToNext]);

  return (
    <GameShell active={true}>
    <div
      className="w-full min-h-[100dvh] flex flex-col bg-black text-zinc-300 select-none overflow-hidden font-mono"
      style={{ touchAction: 'manipulation' }}
    >
      {/* ─── HEADER: h-12 fijo ─── */}
      <header className="h-12 flex items-center justify-between px-4 shrink-0 border-b border-zinc-900">
        <button
          onClick={onBack}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] text-zinc-600 hover:text-white transition-colors"
          style={{ touchAction: 'manipulation' }}
        >
          <ArrowLeft size={18} />
        </button>

        <h1 className="text-xs sm:text-sm font-black uppercase text-cyan-500 tracking-[0.2em]">
          Semantic Firewall
        </h1>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] text-zinc-600 hover:text-white transition-colors"
          style={{ touchAction: 'manipulation' }}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </header>

      {/* ─── CUERPO PRINCIPAL: texto + opciones ─── */}
      <div className="flex-1 flex flex-col px-4 pt-4 pb-2 gap-3 overflow-hidden">
        {/* Caja del stream de texto — w-full sin bordes laterales muertos */}
        <div className="w-full flex-1 min-h-0 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 sm:p-6 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 text-zinc-600 mb-3 shrink-0">
            <Terminal size={14} />
            <span className="text-[10px] uppercase tracking-widest">Análisis semántico</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <p className="text-sm sm:text-base leading-relaxed text-zinc-200 whitespace-normal break-words">
              {currentArg.text}
            </p>
          </div>

          {/* Feedback inline */}
          <AnimatePresence>
            {feedback && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 pt-3 border-t border-zinc-800 shrink-0"
              >
                <p className={`text-xs leading-relaxed whitespace-normal break-words ${
                  feedback.startsWith('[ACEPTADO]') ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {feedback}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── ÁREA DE ACCIÓN: botón seguro + grid falacias ─── */}
      <div className="px-4 pb-3 shrink-0 space-y-2">
        {/* Botón "Estructura Sólida" — ancho completo */}
        <button
          onClick={() => handleAction(false)}
          onTouchEnd={(e) => { e.preventDefault(); handleAction(false); }}
          disabled={gameState !== 'playing'}
          className="w-full h-14 rounded-xl border border-zinc-700 bg-zinc-900/80 flex items-center justify-center gap-2 text-sm font-bold text-zinc-200 hover:border-emerald-500 hover:text-emerald-400 active:border-emerald-400 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          style={{ touchAction: 'manipulation' }}
        >
          <ShieldCheck size={16} />
          Estructura Sólida
        </button>

        {/* Grid de falacias — 2 columnas, h-14 cada una */}
        <div className="grid grid-cols-2 gap-2">
          {FALLACY_TYPES.map(type => (
            <button
              key={type}
              onClick={() => handleAction(true, type)}
              onTouchEnd={(e) => { e.preventDefault(); handleAction(true, type); }}
              disabled={gameState !== 'playing'}
              className="h-14 rounded-xl border border-zinc-700 bg-zinc-950 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 hover:border-red-500 hover:text-red-400 active:border-red-400 transition-colors disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center px-2 text-center leading-tight"
              style={{ touchAction: 'manipulation' }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* ─── QUARANTINE LOG COMPACTO (reemplaza sidebar) ─── */}
      <div className="shrink-0 border-t border-zinc-900">
        <button
          onClick={() => setShowLog(!showLog)}
          className="w-full flex items-center justify-between px-4 py-2 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          style={{ touchAction: 'manipulation' }}
        >
          <span className="flex items-center gap-1.5 uppercase tracking-widest">
            <AlertTriangle size={12} />
            Cuarentena ({log.length})
          </span>
          <span className="text-zinc-700">{showLog ? '▲' : '▼'}</span>
        </button>

        <AnimatePresence>
          {showLog && log.length > 0 && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 space-y-1.5 max-h-[120px] overflow-y-auto">
                {log.map(item => (
                  <div key={item.id} className="flex items-start gap-2 p-2 bg-zinc-950 border border-zinc-900 rounded text-[10px] text-red-500 whitespace-normal break-words">
                    <span className="shrink-0 mt-0.5">⚠</span>
                    <span>{item.text.slice(0, 60)}{item.text.length > 60 ? '…' : ''}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </GameShell>
  );
}
