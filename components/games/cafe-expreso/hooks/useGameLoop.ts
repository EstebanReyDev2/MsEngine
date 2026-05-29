// ─── HOOK: useGameLoop — Conecta RAF + Engine + Store ───

'use client';

import { useEffect, useRef } from 'react';
import { useCafeStore } from '../store/cafeStore';
import { GameLoop } from '../engine/GameLoop';
import { AudioManager } from '../engine/AudioManager';
import type { GameAction } from '../engine';

export function useGameLoop() {
  const phase = useCafeStore(s => s.phase);
  const loopRef = useRef<GameLoop | null>(null);

  useEffect(() => {
    if (phase === 'playing') {
      // Unlock audio en primer gameplay
      AudioManager.getInstance().unlock();

      const loop = new GameLoop((dt) => {
        const store = useCafeStore.getState();
        const actions = [...store._pendingActions];
        const hasActions = actions.length > 0;

        // Pasar acciones al engine en este tick
        store._tick(dt, actions);

        // Log básico de acciones si debug
        if (hasActions) {
          // console.log('[CafeEngine] processed', actions.length, 'actions');
        }
      });

      loop.start();
      loopRef.current = loop;

      return () => {
        loop.stop();
        loopRef.current = null;
      };
    }

    // Detener loop si no está playing
    if (loopRef.current) {
      loopRef.current.stop();
      loopRef.current = null;
    }
  }, [phase]);

  // Pausa automática al perder foco
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && phase === 'playing') {
        useCafeStore.getState().dispatch({ type: 'PAUSE' });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [phase]);
}
