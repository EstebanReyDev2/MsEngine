// 📂 /components/shared/GameShell.tsx
// Wraps a game and locks the viewport when gameplay is active.
// - When active=false: normal scrollable container
// - When active=true: 100dvh fullscreen, scroll locked, touch-action: none

'use client';

import React, { useRef, type ReactNode } from 'react';
import { useGameFullscreen } from '@/hooks/useGameFullscreen';

interface GameShellProps {
  /** Should the game be fullscreen? Typically: gameState === 'playing' || gameState === 'blockEnded' etc */
  active: boolean;
  children: ReactNode;
  className?: string;
}

export default function GameShell({ active, children, className = '' }: GameShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);

  useGameFullscreen({ active, elementRef: shellRef });

  return (
    <div
      ref={shellRef}
      className={`game-shell ${active ? 'game-shell--active' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
