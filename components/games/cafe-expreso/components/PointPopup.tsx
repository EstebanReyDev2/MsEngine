// ─── PointPopup — Flotante de puntaje ───

'use client';

import { motion, AnimatePresence } from 'motion/react';
import type { Popup } from '../engine';

export function PointPopup({ popup }: { popup: Popup }) {
  const colorMap = {
    score: 'text-emerald-400',
    penalty: 'text-red-400',
    combo: 'text-amber-400',
  };

  return (
    <AnimatePresence>
      <motion.div
        key={popup.id}
        initial={{ opacity: 1, y: 0, scale: 0.5 }}
        animate={{ opacity: 0, y: -40, scale: 1.2 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={`absolute pointer-events-none font-black text-xs font-mono ${colorMap[popup.variant]}`}
        style={{ left: `${popup.x}%`, top: `${popup.y}%` }}
      >
        {popup.text}
      </motion.div>
    </AnimatePresence>
  );
}
