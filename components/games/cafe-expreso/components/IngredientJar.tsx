// ─── IngredientJar — Un tarro individual ───

'use client';

import React from 'react';
import { motion } from 'motion/react';
import { useCafeStore, selectIngredient } from '../store/cafeStore';
import type { IngredientDef } from '../data/ingredients';
import type { IngredientId } from '../engine';
import { AudioManager } from '../engine/AudioManager';
import { useHaptic } from '@/hooks/use-haptic';

export const IngredientJar = React.memo(function IngredientJar({ def }: { def: IngredientDef }) {
  const state = useCafeStore(selectIngredient(def.id));
  const selected = useCafeStore(s => s.selectedIngredient);
  const dispatch = useCafeStore(s => s.dispatch);
  const haptic = useHaptic();

  if (!state) return null;

  const isSelected = selected === def.id;
  const isEmpty = state.stock <= 0;
  const isRefilling = state.refilling;

  const handleClick = () => {
    if (isRefilling) return;
    if (isEmpty || state.stock <= 2) {
      AudioManager.getInstance().play('deposit', 0.06);
      haptic.light();
      dispatch({ type: 'TRIGGER_REFILL', ingredientId: def.id as IngredientId });
      return;
    }
    AudioManager.getInstance().play('deposit', 0.06);
    haptic.light();
    dispatch({ type: 'SELECT_INGREDIENT', ingredientId: def.id as IngredientId });
  };

  return (
    <div
      onClick={handleClick}
      className={`border p-2.5 transition-all text-center relative cursor-pointer font-mono min-h-[72px] select-none ${
        isRefilling ? 'border-amber-400/20 bg-zinc-900/40' :
        isSelected ? 'border-amber-400 bg-amber-400/10' :
        state.stock <= 2 ? 'border-red-500/30 bg-red-950/10' :
        'border-white/10 hover:border-white/20 bg-black/40'
      }`}
      style={{ touchAction: 'manipulation' }}
    >
      {/* Overlay de recarga */}
      {isRefilling && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10">
          <span className="text-[8px] text-amber-500 font-bold mb-1">RECARGANDO</span>
          <div className="w-3/4 bg-stone-800 h-1">
            <div className="h-full bg-amber-400" style={{ width: `${state.refillProgress}%` }} />
          </div>
        </div>
      )}

      <div className="flex justify-between items-center text-[9px] mb-1">
        <span className={`px-1 rounded text-black font-bold text-[8px] ${def.bgClass}`}>
          {def.symbol}
        </span>
        <span className={state.stock <= 2 ? 'text-red-400 font-bold' : 'text-zinc-500'}>
          {state.stock}/10
        </span>
      </div>

      <h5 className="text-[9px] font-bold text-white uppercase leading-tight">{def.label}</h5>

      <div className="flex gap-0.5 justify-center mt-1.5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`h-1 w-1.5 rounded-sm ${i < Math.ceil(state.stock / 2) ? 'bg-amber-400' : 'bg-stone-800'}`}
          />
        ))}
      </div>
    </div>
  );
});
