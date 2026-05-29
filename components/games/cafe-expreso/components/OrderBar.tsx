// ─── OrderBar — Barra de órdenes activas (4 slots) ───

'use client';

import { useCafeStore, selectOrders } from '../store/cafeStore';
import { OrderCard } from './OrderCard';

export function OrderBar() {
  const orders = useCafeStore(selectOrders);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-black/40 p-3 border border-white/5">
      {[0, 1, 2, 3].map(i => {
        const order = orders[i];
        return order ? (
          <OrderCard key={order.id} order={order} />
        ) : (
          <div
            key={`empty-${i}`}
            className="border border-white/5 bg-black/30 h-[100px] flex items-center justify-center text-white/10 text-[9px] uppercase tracking-widest font-mono"
          >
            [ VACANTE ]
          </div>
        );
      })}
    </div>
  );
}
