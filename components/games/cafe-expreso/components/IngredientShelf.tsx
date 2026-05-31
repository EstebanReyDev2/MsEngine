// ─── IngredientShelf — Estante / Carrusel de ingredientes ───

'use client';

import { INGREDIENT_DEFS } from '../data/ingredients';
import { IngredientJar } from './IngredientJar';

export function IngredientShelf() {
  return (
    <div className="bg-[#1C1C1E] border border-white/10 p-3 md:p-4">
      <div className="flex justify-between items-center mb-2 font-mono">
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
          {'// INGREDIENTES'}
        </span>
        <span className="text-[8px] text-white/40">Tap para usar · Doble tap rellena</span>
      </div>

      {/* ─── Mobile: carrusel horizontal compacto ─── */}
      <div className="flex md:hidden flex-row overflow-x-auto snap-x scrollbar-none gap-2 w-full pt-1 pb-2 overscroll-x-contain">
        {INGREDIENT_DEFS.map(def => (
          <div key={def.id} className="min-w-[100px] h-[110px] flex-shrink-0 snap-center">
            <IngredientJar def={def} />
          </div>
        ))}
      </div>

      {/* ─── Desktop: grid estático ─── */}
      <div className="hidden md:grid grid-cols-3 md:grid-cols-6 gap-2">
        {INGREDIENT_DEFS.map(def => (
          <IngredientJar key={def.id} def={def} />
        ))}
      </div>
    </div>
  );
}
