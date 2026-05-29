// ─── useFeedbackEffects — Audio + Haptic basado en cambios de estado ───

'use client';

import { useEffect, useRef } from 'react';
import { useCafeStore } from '../store/cafeStore';
import { AudioManager } from '../engine/AudioManager';
import { useHaptic } from '@/hooks/use-haptic';
import type { CupState, GamePhase } from '../engine';

export function useFeedbackEffects() {
  const haptic = useHaptic();
  const phase = useCafeStore(s => s.phase);
  const soundEnabled = useCafeStore(s => s.soundEnabled);
  const stations = useCafeStore(s => s.stations);
  const score = useCafeStore(s => s.score);
  const selectedIngredient = useCafeStore(s => s.selectedIngredient);
  const prevCupStates = useRef<Record<number, CupState>>({});
  const prevScore = useRef(score);
  const prevSelected = useRef(selectedIngredient);

  useEffect(() => {
    if (phase !== 'playing' || !soundEnabled) return;
    const audio = AudioManager.getInstance();

    // Depositar ingrediente: selected pasó de no-null a null
    if (prevSelected.current !== null && selectedIngredient === null) {
      audio.play('deposit', 0.08);
    }
    prevSelected.current = selectedIngredient;

    // Transiciones de estaciones
    stations.forEach(s => {
      const prev = prevCupStates.current[s.id];
      if (!prev) {
        prevCupStates.current[s.id] = s.cupState;
        return;
      }

      if (prev === 'ADDING_INGREDIENTS' && s.cupState === 'BREWING') {
        audio.play('brew_done', 0.1);
      }
      if (s.cupState === 'READY' && prev !== 'READY') {
        audio.play('brew_done', 0.15);
        haptic.medium();
      }
      if (s.cupState === 'OVERFLOW' && prev !== 'OVERFLOW') {
        audio.play('fail', 0.12);
        haptic.error();
      }

      prevCupStates.current[s.id] = s.cupState;
    });

    // Score increment → serve sound
    if (score > prevScore.current) {
      audio.play('serve', 0.12);
      haptic.success();
    }
    prevScore.current = score;
  }, [stations, score, selectedIngredient, soundEnabled, haptic, phase]);
}
