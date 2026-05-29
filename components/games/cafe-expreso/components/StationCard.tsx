// ─── StationCard — Estación individual con FSM visual ───

'use client';

import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Zap, Coffee, X, Flame } from 'lucide-react';
import type { Station, IngredientId } from '../engine';
import { useCafeStore } from '../store/cafeStore';
import { INGREDIENT_DEFS } from '../data/ingredients';

export const StationCard = React.memo(function StationCard({ station }: { station: Station }) {
  const dispatch = useCafeStore(s => s.dispatch);
  const selected = useCafeStore(s => s.selectedIngredient);
  const order = useCafeStore(s => s.orders.find(o => o.id === station.assignedOrderId));

  const handleClick = () => {
    if (station.cupState === 'READY') {
      dispatch({ type: 'SERVE_ORDER', stationId: station.id });
      return;
    }
    if (station.cupState === 'OVERFLOW') {
      dispatch({ type: 'CLEAR_STATION', stationId: station.id });
      return;
    }
    if (station.cupState === 'SERVED') {
      dispatch({ type: 'CLEAR_STATION', stationId: station.id });
      return;
    }
    if (selected) {
      dispatch({ type: 'DEPOSIT_INGREDIENT', stationId: station.id });
    } else if (station.cupState === 'ADDING_INGREDIENTS') {
      dispatch({ type: 'CLEAR_STATION', stationId: station.id });
    }
  };

  const isBrewing = station.cupState === 'BREWING';
  const isReady = station.cupState === 'READY';
  const isOverflow = station.cupState === 'OVERFLOW';
  const isServed = station.cupState === 'SERVED';
  const isEmpty = station.cupState === 'EMPTY';
  const isAdding = station.cupState === 'ADDING_INGREDIENTS';

  return (
    <motion.div
      onClick={handleClick}
      animate={isOverflow ? { x: [0, -4, 4, -2, 2, 0] } : {}}
      transition={isOverflow ? { duration: 0.3 } : {}}
      className={`border p-3 transition-colors relative flex flex-col justify-between min-h-[180px] cursor-pointer select-none overflow-hidden ${
        station.error ? 'bg-red-950/40 border-red-500' :
        isReady ? 'border-emerald-500/60 bg-emerald-950/20 shadow-lg shadow-emerald-500/10' :
        isOverflow ? 'border-red-500/40 bg-red-950/30' :
        isServed ? 'border-cyan-500/30 bg-cyan-950/10' :
        selected ? 'border-amber-500/50 bg-amber-500/5' :
        'border-white/10 bg-black/20 hover:border-white/20'
      }`}
      style={{ touchAction: 'manipulation' }}
    >
      {/* Vapor animado durante brewing */}
      {isBrewing && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-1">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-1 h-3 rounded-full bg-amber-400/30"
              animate={{ y: [-4, -12, -4], opacity: [0.3, 0.8, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.2 + i * 0.3, delay: i * 0.2 }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-white/10 z-10">
        <span className="text-[9px] font-mono font-black text-white/50">EST_{station.id}</span>
        {station.assignedOrderId && order && (
          <span className="text-[9px] bg-cyan-600 px-1.5 py-0.5 font-bold text-black rounded font-mono">
            {order.recipe.name.slice(0, 6)}
          </span>
        )}
      </div>

      {/* Cuerpo */}
      <div className="flex flex-col items-center justify-center flex-1 py-3 gap-2 z-10">
        {isBrewing && (
          <div className="flex flex-col items-center gap-1">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
              <Flame size={18} className="text-amber-400" />
            </motion.div>
            <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full"
                style={{ width: `${station.brewProgress}%` }}
              />
            </div>
            <span className="text-[8px] text-amber-500 font-mono">{Math.floor(station.brewProgress)}%</span>
          </div>
        )}

        {isReady && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex flex-col items-center gap-1"
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <CheckCircle2 size={28} className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            </motion.div>
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">SERVIR</span>
          </motion.div>
        )}

        {isOverflow && (
          <div className="flex flex-col items-center gap-1">
            <X size={22} className="text-red-400" />
            <span className="text-[8px] text-red-400 font-bold uppercase">COLAPSADO</span>
          </div>
        )}

        {isServed && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-1"
          >
            <CheckCircle2 size={22} className="text-cyan-400" />
            <span className="text-[8px] text-cyan-400 font-mono uppercase">Servido ✓</span>
            <span className="text-[7px] text-cyan-500/50 font-mono">Toque para limpiar</span>
          </motion.div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center gap-1">
            <Coffee size={22} className="text-white/20" />
            <span className="text-[8px] text-white/20 font-mono">Vacía</span>
          </div>
        )}

        {isAdding && (
          <div className="flex flex-col items-center gap-1 w-full">
            <div className="flex flex-wrap items-center justify-center gap-1 max-w-[80px]">
              {Object.entries(station.ingredients).filter(([_, c]) => c > 0).map(([id, count]) => {
                const def = INGREDIENT_DEFS.find(i => i.id === id);
                return (
                  <motion.span
                    key={id}
                    initial={{ scale: 0, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    className="text-sm"
                  >
                    {def?.symbol}
                  </motion.span>
                );
              })}
            </div>
            {order && (
              <div className="w-full text-[8px] text-center text-zinc-500 mt-1">
                {Object.entries(order.recipe.ingredients).map(([id, qty]) => {
                  const got = station.ingredients[id as IngredientId] || 0;
                  return (
                    <span key={id} className={`mx-0.5 ${got >= (qty || 0) ? 'text-emerald-400' : 'text-zinc-600'}`}>
                      {INGREDIENT_DEFS.find(i => i.id === id)?.symbol}{got}/{qty}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-white/5 text-[8px] text-white/30 text-center font-mono z-10">
        {isEmpty && !selected && 'Toque para añadir'}
        {isEmpty && selected && 'Toque para depositar'}
        {isAdding && 'Agregando...'}
        {isReady && '¡Listo para servir!'}
        {isOverflow && 'Toque para limpiar'}
        {isServed && 'Toque para limpiar'}
        {isBrewing && 'Preparando...'}
      </div>
    </motion.div>
  );
});
