// ─── StationGrid — Grid / Carrusel de estaciones activas ───

'use client';

import { useCafeStore, selectStations } from '../store/cafeStore';
import { StationCard } from './StationCard';

export function StationGrid() {
  const stations = useCafeStore(selectStations);

  return (
    <div>
      <h3 className="text-[10px] font-black tracking-widest text-amber-500 font-mono mb-2 uppercase">
        {'// ESTACIONES DE PREPARACIÓN'}
      </h3>

      {/* ─── Mobile: carrusel horizontal ─── */}
      <div className="flex md:hidden flex-row overflow-x-auto snap-x scrollbar-none gap-3 w-full overscroll-x-contain">
        {stations.map(s => (
          <div key={s.id} className="min-w-[140px] w-[45%] snap-center flex-shrink-0">
            <StationCard station={s} />
          </div>
        ))}
      </div>

      {/* ─── Desktop: grid estático ─── */}
      <div className="hidden md:grid grid-cols-2 gap-3">
        {stations.map(s => (
          <StationCard key={s.id} station={s} />
        ))}
        {/* Rellenar huecos si hay menos de 4 estaciones (mantiene grid) */}
        {stations.length < 4 && Array.from({ length: 4 - stations.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="border border-dashed border-white/5 bg-black/10 min-h-[180px] flex items-center justify-center"
          >
            <span className="text-[8px] font-mono text-white/10 uppercase tracking-widest">
              Sin asignar
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
