// ─── DayTransitionScreen — Transición entre días ───

'use client';

import { motion } from 'motion/react';
import { ArrowRight, ChefHat } from 'lucide-react';
import { useCafeStore, selectDayTarget } from '../store/cafeStore';
import { AudioManager } from '../engine/AudioManager';
import { TOTAL_DAYS, DAY_CONFIGS } from '../engine';

export function DayTransitionScreen() {
  const currentDay = useCafeStore(s => s.currentDay);
  const dayResults = useCafeStore(s => s.dayResults);
  const dispatch = useCafeStore(s => s.dispatch);
  const lastResult = dayResults[dayResults.length - 1];
  const nextDay = currentDay + 1;
  const nextConfig = DAY_CONFIGS[nextDay];
  const targetMet = lastResult && lastResult.ordersServed >= DAY_CONFIGS[currentDay]?.targetOrders;

  const handleContinue = () => {
    AudioManager.getInstance().unlock();
    dispatch({ type: 'ADVANCE_DAY' });
  };

  const isLastDay = currentDay >= TOTAL_DAYS;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 bg-[#121212]/98 flex flex-col items-center justify-center p-6 z-30"
    >
      <div className="max-w-sm space-y-5 text-center">
        <div className="w-12 h-12 bg-white/5 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto">
          <ChefHat size={26} />
        </div>

        <div className="space-y-1">
          <span className="text-[#FF5028] text-[9px] font-black uppercase tracking-widest block font-mono">
            {'// INFORME DE JORNADA'}
          </span>
          <h2 className="text-2xl font-black font-mono text-white uppercase tracking-tight">
            Día {currentDay} Completado
          </h2>
        </div>

        {/* Stats del día */}
        {lastResult && (
          <div className="bg-white/5 border border-white/10 p-4 font-mono text-xs text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-white/60">PUNTOS HOY:</span>
              <span className="text-emerald-400 font-bold">{lastResult.score}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">TAZAS SERVIDAS:</span>
              <span className="text-white font-bold">{lastResult.ordersServed} / {DAY_CONFIGS[currentDay]?.targetOrders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">MEJOR RACHA:</span>
              <span className="text-amber-400 font-bold">{lastResult.streak}</span>
            </div>
            {!targetMet && (
              <div className="border-t border-red-500/30 pt-2 text-red-400 text-[9px] text-center">
                No alcanzaste el objetivo mínimo del día
              </div>
            )}
          </div>
        )}

        {/* Preview próximo día */}
        {!isLastDay && nextConfig && (
          <div className="bg-cyan-950/20 border border-cyan-500/20 p-3 text-left font-mono text-[9px] space-y-1.5">
            <span className="text-cyan-400 font-black tracking-widest block uppercase">
              {'>> PRÓXIMO DÍA'}
            </span>
            <div className="flex justify-between text-white/70">
              <span>Duración:</span>
              <span className="text-white">{nextConfig.duration}s</span>
            </div>
            <div className="flex justify-between text-white/70">
              <span>Estaciones:</span>
              <span className="text-white">{nextConfig.activeStations}</span>
            </div>
            <div className="flex justify-between text-white/70">
              <span>Objetivo:</span>
              <span className="text-amber-400">{nextConfig.targetOrders} tazas</span>
            </div>
            <div className="flex justify-between text-white/70">
              <span>Recetas:</span>
              <span className="text-white capitalize">{nextConfig.allowedTiers.join(', ')}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleContinue}
          className="w-full py-3.5 bg-cyan-600 text-white font-black text-xs uppercase tracking-wider hover:bg-cyan-500 transition-all border border-cyan-400/30 cursor-pointer select-none flex items-center justify-center gap-2"
          style={{ touchAction: 'manipulation' }}
        >
          {isLastDay ? 'VER RESULTADO FINAL' : `COMENZAR DÍA ${nextDay}`}
          <ArrowRight size={14} />
        </button>
      </div>
    </motion.div>
  );
}
