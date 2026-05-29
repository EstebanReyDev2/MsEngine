// ─── IngredientShelf — Estante de ingredientes ───

'use client';

import { INGREDIENT_DEFS } from '../data/ingredients';
import { IngredientJar } from './IngredientJar';

export function IngredientShelf() {
  return (
    <div className="bg-[#1C1C1E] border border-white/10 p-4">
      <div className="flex justify-between items-center mb-2 font-mono">
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
          {'// INGREDIENTES'}
        </span>
        <span className="text-[8px] text-white/40">Tap para usar · Doble tap rellena</span>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {INGREDIENT_DEFS.map(def => (
          <IngredientJar key={def.id} def={def} />
        ))}
      </div>
    </div>
  );
}
