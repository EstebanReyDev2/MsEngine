// ─── usePersistentHighScore — localStorage ───

'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'cafe-expreso-high-score';

export function usePersistentHighScore(currentScore: number): number {
  const [highScore, setHighScore] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const saved = stored ? parseInt(stored, 10) : 0;
    if (currentScore > saved) {
      localStorage.setItem(STORAGE_KEY, String(currentScore));
      setHighScore(currentScore);
    } else {
      setHighScore(saved);
    }
  }, [currentScore]);

  return highScore;
}
