// 📂 /components/games/PatternRecall.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { saveGameScore } from '@/lib/gameScoreService';
import { useHaptic } from '@/hooks/use-haptic';

interface PatternRecallProps {
  onBack: () => void;
  currentUser: any;
  onRefreshUser: () => void;
}

export default function PatternRecall({ onBack, currentUser, onRefreshUser }: PatternRecallProps) {
  const haptic = useHaptic();
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState(1); // 1 to 5 rounds per level
  const [gameState, setGameState] = useState<'preview' | 'playing' | 'paused' | 'success' | 'failed' | 'gameover'>('preview');
  const [gridSize, setGridSize] = useState(4); // 4x4 grid standard
  const [pattern, setPattern] = useState<number[]>([]);
  const [userSelection, setUserSelection] = useState<number[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(12);
  const [score, setScore] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sound Synth Synthesizer for retro tactile analog sounds
  const playBeep = (freq: number, type: 'sine' | 'square' | 'triangle' = 'sine', duration = 0.1) => {
    if (typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio fallback silent
    }
  };

  const handleRoundEnded = (wasSuccessful: boolean) => {
    if (wasSuccessful) {
      setGameState('success');
      playBeep(659.25, 'triangle', 0.2);
      
      setTimeout(() => {
        if (round < 5) {
          const nextRound = round + 1;
          setRound(nextRound);
          startRound(level, nextRound);
        } else {
          // Complete Level!
          const nextLevel = level + 1;
          setLevel(nextLevel);
          setRound(1);
          startRound(nextLevel, 1);
        }
      }, 1500);
    } else {
      setGameState('gameover');
      // Save user high-score
      const finalScore = score + (level - 1) * 100;
      if (currentUser) {
        saveGameScore(currentUser?.id, 'Pattern Recall', finalScore, level);
        onRefreshUser(); // pull the new rank up!
      }
    }
  };

  // Generate new grid pattern
  const startRound = (currLevel: number, currRound: number) => {
    // Grid size scales with level
    let currentGridSize = 4;
    let itemsToRecall = 3;

    if (currLevel === 1) {
      currentGridSize = 3;
      itemsToRecall = 3;
    } else if (currLevel === 2) {
      currentGridSize = 3;
      itemsToRecall = 4;
    } else if (currLevel === 3) {
      currentGridSize = 4;
      itemsToRecall = 4;
    } else if (currLevel === 4) {
      currentGridSize = 4;
      itemsToRecall = 5;
    } else {
      currentGridSize = 5;
      itemsToRecall = 6 + Math.min(currRound, 2);
    }

    setGridSize(currentGridSize);
    setUserSelection([]);
    setSecondsLeft(12);

    const totalCells = currentGridSize * currentGridSize;
    const indices: number[] = [];
    while (indices.length < itemsToRecall) {
      const rand = Math.floor(Math.random() * totalCells);
      if (!indices.includes(rand)) {
        indices.push(rand);
      }
    }

    setPattern(indices);
    setGameState('preview');
    playBeep(330, 'triangle', 0.25);

    // After 2.5 seconds, let player guess
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setGameState('playing');
      playBeep(440, 'sine', 0.15);
    }, 2200);
  };

  // Setup initial round on load
  useEffect(() => {
    const t = setTimeout(() => {
      startRound(level, round);
    }, 50);
    
    return () => {
      clearTimeout(t);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (gameState === 'playing' && secondsLeft > 0) {
      const t = setTimeout(() => {
        setSecondsLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(t);
    } else if (gameState === 'playing' && secondsLeft === 0) {
      // Run out of time is failure
      const t = setTimeout(() => {
        handleRoundEnded(false);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [gameState, secondsLeft]);

  const handleCellClick = (index: number) => {
    if (gameState !== 'playing') return;

    // Check if correct
    if (pattern.includes(index)) {
      if (userSelection.includes(index)) return; // already clicked

      const nextSelection = [...userSelection, index];
      setUserSelection(nextSelection);
      playBeep(523.25 + (nextSelection.length * 40), 'sine', 0.1);
      haptic.light();

      // Check if finished pattern
      if (nextSelection.length === pattern.length) {
        // Correct round!
        setScore(prev => prev + (pattern.length * 20) + secondsLeft * 5);
        haptic.success();
        handleRoundEnded(true);
      }
    } else {
      // Incorrect cell clicked
      playBeep(180, 'square', 0.4);
      haptic.error();
      handleRoundEnded(false);
    }
  };

  const handleRestart = () => {
    setLevel(1);
    setRound(1);
    setScore(0);
    startRound(1, 1);
  };

  // Convert timer percent to circle stroke config (circumference is 282.6)
  const strokeDashoffset = 282.6 - (282.6 * secondsLeft) / 12;

  return (
    <div className="game-area flex flex-col min-h-screen text-on-surface bg-background max-w-lg mx-auto w-full px-5 py-6 font-sans">
      
      {/* 🧭 Header */}
      <header className="flex flex-col gap-4 py-4">
        <div className="flex justify-between items-center w-full">
          <button 
            id="btn-recall-back"
            onClick={onBack}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-primary active:scale-95 border border-hairline bg-surface min-w-[44px] min-h-[44px]"
          >
            <span className="text-xl">←</span>
          </button>
          <h1 className="text-xl font-bold text-primary tracking-tight">Pattern Recall</h1>
          <div className="w-10 h-10"></div>
        </div>

        <div className="w-full flex items-center gap-4 px-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Level {level}</span>
          <div className="flex-grow h-1.5 bg-surface-container rounded-full overflow-hidden">
            <div 
              style={{ width: `${(round / 5) * 100}%` }}
              className="h-full bg-mint-deep rounded-full transition-all duration-500 ease-out"
            />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#409E85]">0{round}/05</span>
        </div>
      </header>

      {/* 🔮 Center Area */}
      <main className="flex-grow flex flex-col items-center justify-center py-6 w-full">
        {gameState !== 'gameover' && (
          <div className="text-center mb-6">
            <p className="text-lg font-medium text-primary">
              {gameState === 'preview' ? 'Memoriza el patrón' : 'Selecciona las celdas correctas'}
            </p>
          </div>
        )}

        {/* Dynamic 3x3, 4x4 or 5x5 Grid */}
        {gameState !== 'gameover' ? (
          <div 
            style={{
              gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`
            }}
            className="grid gap-3 p-4 bg-surface rounded-2xl border border-hairline shadow-[0_4px_24px_rgba(26,59,74,0.04)] w-full max-w-[340px] aspect-square items-center"
          >
            {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
              const isCellPattern = pattern.includes(idx);
              const isSelected = userSelection.includes(idx);
              let tileClass = "bg-surface-soft hover:bg-surface-container";

              if (gameState === 'preview' && isCellPattern) {
                // Glow active pattern
                tileClass = "bg-[#8ef2d5] border border-mint-deep/30 shadow-[0_0_15px_rgba(116,216,188,0.55)] scale-95 duration-200";
              } else if (gameState === 'playing' && isSelected) {
                tileClass = "bg-mint-deep text-white shadow-[0_0_12px_rgba(64,158,133,0.3)]";
              } else if (gameState === 'success') {
                tileClass = isCellPattern ? "bg-mint-deep text-white scale-95" : "bg-surface-soft opacity-40";
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleCellClick(idx)}
                  className={`aspect-square rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-fixed cursor-pointer ${tileClass}`}
                />
              );
            })}
          </div>
        ) : (
          /* GameOver State Screen */
          <div className="text-center bg-surface border border-hairline p-8 rounded-2xl shadow-[0_6px_30px_rgba(26,59,74,0.05)] w-full max-w-[340px]">
            <span className="text-4xl">🧠</span>
            <h2 className="text-2xl font-bold text-primary mt-4">Juego Completado</h2>
            <p className="text-xs text-ink-muted mt-2">Guardando sesión de agilidad...</p>
            
            <div className="my-6 py-4 bg-surface-soft rounded-xl border border-hairline/50">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Puntaje Recibido</span>
              <p className="text-3xl font-bold text-primary mt-1">{score + (level - 1) * 100}</p>
              <div className="mt-2 text-[10px] text-mint-deep font-semibold">
                Nivel Máximo: {level} (Ronda {round})
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleRestart}
                onTouchEnd={(e) => { e.preventDefault(); handleRestart(); }}
                className="w-full py-3 bg-primary text-on-primary rounded-full font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer min-h-[48px]"
                style={{ touchAction: 'manipulation' }}
              >
                Volver a Entrenar
              </button>
              <button
                onClick={onBack}
                onTouchEnd={(e) => { e.preventDefault(); onBack(); }}
                className="w-full py-3 border border-hairline hover:bg-surface-soft text-ink rounded-full font-bold text-sm transition-all active:scale-95 cursor-pointer min-h-[48px]"
                style={{ touchAction: 'manipulation' }}
              >
                Volver al Santuario
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 🧭 Footer Controls */}
      {gameState !== 'gameover' && (
        <footer className="w-full pb-6 pt-4 flex flex-col items-center gap-6 mt-auto">
          {/* Custom Score Indicator */}
          <div className="text-xs tracking-wider text-ink-muted text-center font-bold uppercase">
            PUNTOS: <span className="text-primary font-mono">{score}</span>
          </div>

          {/* Sizable Circular Countdown Clock */}
          <div className="relative flex items-center justify-center">
            <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
              <circle
                className="text-surface-container"
                cx="50"
                cy="50"
                fill="none"
                r="45"
                stroke="currentColor"
                strokeWidth="4.5"
              />
              <circle
                className="text-mint-deep transition-all duration-1000 ease-linear"
                cx="50"
                cy="50"
                fill="none"
                r="45"
                stroke="currentColor"
                strokeWidth="4.5"
                strokeDasharray="282.6"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-base font-bold text-primary font-mono">{secondsLeft}s</span>
            </div>
          </div>

          {/* Pause Trigger Button */}
          <button 
            onClick={() => setGameState(gameState === 'playing' ? 'preview' : 'playing')}
            className="px-6 py-2 rounded-full bg-surface border border-hairline shadow-sm hover:shadow-md transition-all text-xs font-semibold text-primary flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <span>{gameState === 'playing' ? '⏸️ Pausar' : '▶️ Reanudar'}</span>
          </button>
        </footer>
      )}
    </div>
  );
}
