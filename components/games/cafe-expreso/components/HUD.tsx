// ─── HUD — Score, timer, streak, day ───

'use client';

import { useCafeStore, selectTimer, selectDayTarget } from '../store/cafeStore';
import { DAY_CONFIGS } from '../engine';
import { TOTAL_DAYS } from '../engine';

export function HUD() {
  const score = useCafeStore(s => s.score);
  const completedOrders = useCafeStore(s => s.completedOrders);
  const secondsLeft = useCafeStore(selectTimer);
  const streak = useCafeStore(s => s.streak);
  const currentDay = useCafeStore(s => s.currentDay);
  const targetOrders = useCafeStore(selectDayTarget);
  const dayConfig = DAY_CONFIGS[currentDay];

  const isUrgent = secondsLeft <= 15;
  const efficiency = completedOrders > 0
    ? Math.round((completedOrders / (completedOrders + Math.max(1, Math.floor((dayConfig?.duration ?? 90) / 15)))) * 100)
    : 0;

  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] flex-wrap">
      {/* Día */}
      <div className="bg-white/5 border border-white/10 px-2 py-1.5 flex items-center gap-1">
        <span className="text-white/50 text-[8px] uppercase">DÍA</span>
        <span className="font-black text-cyan-400">{currentDay}/{TOTAL_DAYS}</span>
      </div>

      {/* Crono */}
      <div className="bg-white/5 border border-white/10 px-2 py-1.5 flex items-center gap-1">
        <span className={`font-black tabular-nums ${isUrgent ? 'text-red-400' : 'text-rose-400'}`}>
          {Math.ceil(secondsLeft)}s
        </span>
      </div>

      {/* Score */}
      <div className="bg-white/5 border border-white/10 px-2 py-1.5 flex items-center gap-1">
        <span className="text-white/50 text-[8px] uppercase">SC</span>
        <span className="font-black text-emerald-400">{score}</span>
      </div>

      {/* Servidas / Objetivo */}
      <div className="bg-white/5 border border-white/10 px-2 py-1.5 flex items-center gap-1">
        <span className="text-white/50 text-[8px] uppercase">TAS</span>
        <span className="font-black text-cyan-400">{completedOrders}</span>
        <span className="text-white/30">/ {targetOrders}</span>
      </div>

      {/* Streak con indicador de combo */}
      <div className="bg-white/5 border border-white/10 px-2 py-1.5 flex items-center gap-1">
        <span className="font-black text-amber-400">{streak}</span>
        {streak >= 3 && <span className="text-[11px]">🔥</span>}
        {streak >= 5 && <span className="text-[11px]">⭐</span>}
        {streak >= 7 && <span className="text-[11px]">💎</span>}
      </div>
    </div>
  );
}
