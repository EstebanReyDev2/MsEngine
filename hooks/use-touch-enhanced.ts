// 📂 /hooks/use-touch-enhanced.ts
// Hook utilitario para unificar eventos touch + mouse en juegos.
// Proporciona handlers cross-platform con fat-finger tolerance.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseTouchEnhancedOptions {
  onTap?: () => void;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
  disabled?: boolean;
}

export function useTouchEnhanced(options: UseTouchEnhancedOptions = {}) {
  const { onTap, onTouchStart, onTouchEnd, disabled = false } = options;
  const [isPressed, setIsPressed] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const touchHandledRef = useRef(false);

  useEffect(() => {
    setIsTouchDevice(
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0)
    );
  }, []);

  const handlePointerDown = useCallback(() => {
    if (disabled) return;
    setIsPressed(true);
  }, [disabled]);

  const handlePointerUp = useCallback(() => {
    setIsPressed(false);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setIsPressed(false);
  }, []);

  const handleClick = useCallback(() => {
    if (disabled) return;
    // En touch devices, los clicks se disparan después del touch
    // Usamos un flag para evitar doble ejecución
    if (isTouchDevice && touchHandledRef.current) {
      touchHandledRef.current = false;
      return;
    }
    onTap?.();
  }, [disabled, onTap, isTouchDevice]);

  const handleTouchStartCallback = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault(); // Previene scroll
    touchHandledRef.current = true;
    setIsPressed(true);
    onTouchStart?.();
  }, [disabled, onTouchStart]);

  const handleTouchEndCallback = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsPressed(false);
    // Disparamos tap manualmente
    onTap?.();
    onTouchEnd?.();
  }, [disabled, onTap, onTouchEnd]);

  return {
    // Props para spread en el elemento
    handlers: {
      onClick: handleClick,
      onPointerDown: handlePointerDown,
      onPointerUp: handlePointerUp,
      onPointerLeave: handlePointerLeave,
      onTouchStart: handleTouchStartCallback,
      onTouchEnd: handleTouchEndCallback,
    },
    isTouchDevice,
    isPressed,
  };
}
