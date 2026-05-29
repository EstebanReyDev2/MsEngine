// ─── OrderCard — Una orden individual ───

'use client';

import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import type { Order } from '../engine';
import { INGREDIENT_DEFS } from '../data/ingredients';

export const OrderCard = React.memo(function OrderCard({ order }: { order: Order }) {
  const isUrgent = order.status === 'expiring';
  const pct = (order.timeLeft / order.maxTime) * 100;

  return (
    <motion.div
      initial={{ x: 30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`border p-2.5 font-mono flex flex-col justify-between min-h-[100px] relative ${
        isUrgent ? 'border-red-500/60 bg-red-950/20' : 'border-white/15 bg-white/5'
      }`}
    >
      {/* Alerta de urgencia */}
      {isUrgent && (
        <motion.div
          className="absolute -top-1.5 -right-1.5"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          <AlertTriangle size={14} className="text-red-400" />
        </motion.div>
      )}

      <div>
        <div className="flex justify-between items-center text-[9px] mb-1">
          <span className="text-cyan-400 font-black">{order.orderNum}</span>
          <span className={`font-black tabular-nums ${isUrgent ? 'text-red-400' : 'text-zinc-400'}`}>
            {Math.ceil(order.timeLeft)}s
          </span>
        </div>
        <h4 className="text-[11px] font-black text-white truncate uppercase">{order.recipe.name}</h4>
        <div className="flex flex-wrap gap-1 mt-2">
          {Object.entries(order.recipe.ingredients).map(([id, qty]) => {
            const def = INGREDIENT_DEFS.find(i => i.id === id);
            return (
              <span key={id} className="text-[9px] px-1.5 bg-black/40 border border-white/10 rounded text-amber-300">
                {def?.symbol} x{qty}
              </span>
            );
          })}
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="w-full bg-stone-800 h-1 mt-2 overflow-hidden rounded-full">
        <motion.div
          className={`h-full ${isUrgent ? 'bg-red-500' : 'bg-cyan-500'}`}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: 'linear' }}
        />
      </div>

      {/* Timer numérico grande cuando es urgente */}
      {isUrgent && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          animate={{ opacity: [0, 0.06, 0] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
        >
          <span className="text-6xl font-black text-red-500">
            {Math.ceil(order.timeLeft)}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
});
