// ─── GameOverScreen — Pantalla de fin multi-día ───

'use client';

import { motion } from 'motion/react';
import { Trophy } from 'lucide-react';
import { useCafeStore } from '../store/cafeStore';
import { AudioManager } from '../engine/AudioManager';
import { usePersistentHighScore } from '../hooks/usePersistentHighScore';
import { TOTAL_DAYS, DAY_CONFIGS } from '../engine';

export function GameOverScreen({ onBack }: { onBack: () => void }) {
  const score = useCafeStore(s => s.score);
  const completedOrders = useCafeStore(s => s.completedOrders);
  const streak = useCafeStore(s => s.streak);
  const dispatch = useCafeStore(s => s.dispatch);
  const totalPlaced = useCafeStore(s => s.totalOrdersPlaced);
  const dayResults = useCafeStore(s => s.dayResults);
  const efficiency = totalPlaced > 0 ? Math.round((completedOrders / totalPlaced) * 100) : 0;

  const daysCleared = dayResults.filter(r => r.ordersServed >= (DAY_CONFIGS[r.day]?.targetOrders ?? 0)).length;
  const isVictory = dayResults.length >= TOTAL_DAYS;
  const highScore = usePersistentHighScore(score);

  const handleRestart = () => {
    AudioManager.getInstance().unlock();
    dispatch({ type: 'START_GAME' });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 bg-[#121212]/98 flex flex-col items-center justify-center p-6 z-30"
    >
      <div className="max-w-sm space-y-5 text-center">
        <div className={`w-12 h-12 border flex items-center justify-center mx-auto ${
          isVictory
            ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
            : 'bg-white/5 border-amber-500/30 text-[#FBBF24]'
        }`}>
          <Trophy size={26} />
        </div>

        <div className="space-y-1">
          <span className="text-[#FF5028] text-[9px] font-black uppercase tracking-widest block font-mono">
            {'// AUDITORÍA FINAL'}
          </span>
          <h2 className="text-2xl font-black font-mono text-white uppercase tracking-tight">
            {isVictory ? 'Turno Completo' : 'Cierre de Inventario'}
          </h2>
          {isVictory && (
            <span className="text-[10px] font-mono text-emerald-400 block">
              ¡Todos los objetivos cumplidos!
            </span>
          )}
          {!isVictory && daysCleared > 0 && (
            <span className="text-[10px] font-mono text-amber-400 block">
              {daysCleared}/{TOTAL_DAYS} días completados
            </span>
          )}
        </div>

        {/* Desglose por día */}
        {dayResults.length > 0 && (
          <div className="bg-white/5 border border-white/10 p-3 font-mono text-[9px] text-left space-y-1.5">
            <span className="text-white/40 tracking-widest uppercase block">Desglose por día</span>
            {dayResults.map(r => (
              <div key={r.day} className="flex justify-between items-center">
                <span className="text-white/60">Día {r.day}</span>
                <span className="text-white/80">
                  {r.ordersServed}s / {DAY_CONFIGS[r.day]?.targetOrders}obj ·{' '}
                  <span className="text-emerald-400">+{r.score}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Stats totales */}
        <div className="bg-white/5 border border-white/10 p-4 font-mono text-xs text-left space-y-2">
          <div className="flex justify-between">
            <span className="text-white/60">PUNTUACIÓN TOTAL:</span>
            <span className="text-emerald-400 font-bold text-sm">{score} pts</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">HIGH SCORE:</span>
            <span className="text-cyan-400 font-bold">{highScore} pts</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">TAZAS SERVIDAS:</span>
            <span className="text-white font-bold">{completedOrders}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">MEJOR RACHA:</span>
            <span className="text-amber-400 font-bold">{streak}</span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-2">
            <span className="text-white/40">EFICIENCIA:</span>
            <span className="text-emerald-400 font-bold">{efficiency}%</span>
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={handleRestart}
            className="flex-1 py-3.5 bg-[#FF5028] text-white font-black text-xs uppercase tracking-wider hover:bg-white hover:text-black transition-all border border-[#1A1A1A] cursor-pointer select-none"
            style={{ touchAction: 'manipulation' }}
          >
            NUEVO TURNO
          </button>
          <button
            onClick={onBack}
            className="flex-1 py-3.5 bg-white/5 border border-white/10 hover:border-white/20 text-white font-black text-xs uppercase tracking-wider cursor-pointer select-none"
            style={{ touchAction: 'manipulation' }}
          >
            SALIR
          </button>
        </div>
      </div>
    </motion.div>
  );
}
