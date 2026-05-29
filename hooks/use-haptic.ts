// 📂 /hooks/use-haptic.ts
// Feedback háptico cross-platform. iOS no soporta vibrate, Android sí.
// Uso: const haptic = useHaptic(); haptic.light();

'use client';

import { useCallback, useRef } from 'react';

export function useHaptic() {
  const supportedRef = useRef<boolean | null>(null);

  const vibrate = useCallback((pattern: number | number[]) => {
    if (supportedRef.current === false) return;
    if (typeof navigator === 'undefined') return;

    if (supportedRef.current === null) {
      supportedRef.current = 'vibrate' in navigator;
      if (!supportedRef.current) return;
    }

    try {
      navigator.vibrate(pattern);
    } catch {
      supportedRef.current = false;
    }
  }, []);

  const light = useCallback(() => vibrate(10), [vibrate]);
  const medium = useCallback(() => vibrate(20), [vibrate]);
  const heavy = useCallback(() => vibrate(40), [vibrate]);
  const success = useCallback(() => vibrate([10, 30, 10]), [vibrate]);
  const error = useCallback(() => vibrate([30, 50, 30]), [vibrate]);
  const pattern = useCallback((p: number[]) => vibrate(p), [vibrate]);

  return { light, medium, heavy, success, error, pattern };
}
