// 📂 /components/shared/TouchableArea.tsx
// Wrapper que garantiza touch target mínimo de 44x44px,
// previene scroll accidental y agrega feedback visual y háptico.

'use client';

import React, { forwardRef } from 'react';
import { motion } from 'motion/react';
import { useTouchEnhanced } from '@/hooks/use-touch-enhanced';
import { useHaptic } from '@/hooks/use-haptic';

interface TouchableAreaProps {
  children: React.ReactNode;
  onTap?: () => void;
  disabled?: boolean;
  /** Clases adicionales */
  className?: string;
  /** Forzar tamaño mínimo (default: true) */
  enforceMinSize?: boolean;
  /** Tipo de feedback háptico en tap */
  haptic?: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'none';
  /** Escala al presionar (default: 0.95) */
  pressScale?: number;
  /** ID para testing */
  id?: string;
  /** Atributo aria */
  ariaLabel?: string;
}

export const TouchableArea = forwardRef<HTMLDivElement, TouchableAreaProps>(
  (
    {
      children,
      onTap,
      disabled = false,
      className = '',
      enforceMinSize = true,
      haptic = 'light',
      pressScale = 0.95,
      id,
      ariaLabel,
    }: TouchableAreaProps,
    ref
  ) => {
    const hapticFeed = useHaptic();
    const { handlers, isPressed } = useTouchEnhanced({
      onTap: () => {
        if (disabled) return;
        if (haptic !== 'none') hapticFeed[haptic]();
        onTap?.();
      },
      disabled,
    });

    const minSizeClass = enforceMinSize ? 'min-w-[44px] min-h-[44px]' : '';

    return (
      <motion.div
        ref={ref}
        id={id}
        {...handlers}
        aria-label={ariaLabel}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        className={`
          inline-flex items-center justify-center
          select-none
          ${minSizeClass}
          ${disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
          ${className}
        `}
        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        animate={{ scale: isPressed && !disabled ? pressScale : 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTap?.();
          }
        }}
      >
        {children}
      </motion.div>
    );
  }
);

TouchableArea.displayName = 'TouchableArea';
