// ─── PauseOverlay — Pausa ───

'use client';

import { motion } from 'motion/react';
import { useCafeStore } from '../store/cafeStore';

export function PauseOverlay() {
  const dispatch = useCafeStore(s => s.dispatch);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 bg-[#121212]/95 flex flex-col items-center justify-center p-6 z-30"
    >
      <div className="max-w-xs space-y-4 font-mono text-center">
        <span className="text-amber-400 text-xs tracking-widest block animate-pulse">
          {'// PROCESAMIENTO DETENIDO'}
        </span>
        <h3 className="text-lg font-black text-white uppercase">SISTEMA SUSPENDIDO</h3>
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => dispatch({ type: 'RESUME' })}
            className="py-3 bg-white text-black font-extrabold text-xs uppercase cursor-pointer hover:bg-amber-400 transition-all select-none"
            style={{ touchAction: 'manipulation' }}
          >
            Reanudar Simulación
          </button>
          <button
            onClick={() => dispatch({ type: 'START_GAME' })}
            className="py-3 bg-white/5 border border-white/10 hover:border-white/30 text-white font-extrabold text-xs uppercase cursor-pointer select-none"
            style={{ touchAction: 'manipulation' }}
          >
            Reiniciar Máquinas
          </button>
        </div>
      </div>
    </motion.div>
  );
}
