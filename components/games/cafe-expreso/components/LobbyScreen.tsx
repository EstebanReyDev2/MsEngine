// ─── LobbyScreen — Pantalla de inicio ───

'use client';

import { motion } from 'motion/react';
import { Coffee } from 'lucide-react';
import { useCafeStore } from '../store/cafeStore';
import { DAY_CONFIGS, TOTAL_DAYS } from '../engine';

export function LobbyScreen() {
  const dispatch = useCafeStore(s => s.dispatch);
  const day1 = DAY_CONFIGS[1];

  return (
    <div className="absolute inset-0 bg-[#121212]/98 flex flex-col items-center justify-center p-6 z-30">
      <div className="max-w-md space-y-6">
        <div className="w-16 h-16 bg-[#78350F]/20 border-2 border-[#D97706] text-[#FBBF24] flex items-center justify-center mx-auto shadow-xl shadow-amber-900/10">
          <Coffee size={36} />
        </div>

        <div className="space-y-1.5 text-center">
          <h2 className="text-2xl font-black uppercase font-mono tracking-tight text-white">
            {'// CAFÉ EXPRESO'}
          </h2>
          <p className="font-serif italic text-xs text-white/60">
            Coordinación sináptica de flujos múltiples en tiempo real.
            Gestiona recursos limitados bajo alerta de caducidad.
          </p>
        </div>

        <div className="bg-white/5 border border-white/15 p-4 font-mono text-xs space-y-2 text-white/80">
          <p className="text-amber-400 font-bold uppercase text-center border-b border-white/10 pb-1.5">
            PARÁMETROS DE ATENCIÓN
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>📅 DÍAS: <span className="text-white font-bold">{TOTAL_DAYS}</span></div>
            <div>⏱️ INICIAL: <span className="text-white font-bold">{day1.duration}s</span></div>
            <div>🔌 ESTACIONES: <span className="text-white font-bold">{day1.activeStations}→4</span></div>
            <div>🎯 OBJETIVO/DÍA: <span className="text-white font-bold">Variable</span></div>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => dispatch({ type: 'START_GAME' })}
          className="w-full py-4 bg-[#FF5028] text-white font-black text-sm uppercase tracking-wider hover:bg-white hover:text-black transition-all border border-[#1A1A1A] cursor-pointer select-none"
          style={{ touchAction: 'manipulation' }}
        >
          INICIAR JORNADA LABORAL
        </motion.button>
      </div>
    </div>
  );
}
