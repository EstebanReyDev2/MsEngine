// 📂 /components/games/CipherFlux.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useHaptic } from '@/hooks/use-haptic';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabaseClient } from '@/lib/supabaseClient';
import { 
  Cpu, RotateCcw, ArrowLeft, Volume2, VolumeX, Zap, 
  Shield, Play, Sparkles, HelpCircle, ChevronRight, Check, AlertCircle 
} from 'lucide-react';

interface CipherFluxProps {
  onBack: () => void;
  currentUser: any;
  onRefreshUser: () => void;
}

type ShapeType = 'circle' | 'cross' | 'diagonal-left' | 'diagonal-right' | 'dot-cluster' | 'triangle' | 'empty';
type RuleType = 'EXACT_MATCH' | 'IGNORE_COLOR' | 'IGNORE_ROTATION';

interface CellData {
  shape: ShapeType;
  color: string; // Tailwind hex color
  rotation: 0 | 90 | 180 | 270;
}

interface CipherTrial {
  gridSize: number; // 3, 4, 5
  leftGrid: CellData[];
  rightGrid: CellData[];
  rule: RuleType;
  isMatch: boolean;
}

// Neon cyber theme palette
const COLORS = [
  '#22d3ee', // Cyan
  '#ec4899', // Magenta
  '#eab308', // Yellow
  '#10b981', // Emerald/Neon Green
  '#cbd5e1'  // Steel White
];

const SHAPES: ShapeType[] = ['circle', 'cross', 'diagonal-left', 'diagonal-right', 'dot-cluster', 'triangle', 'empty'];

export default function CipherFlux({ onBack, currentUser, onRefreshUser }: CipherFluxProps) {
  const haptic = useHaptic();
  const isMobile = useIsMobile();
  // Configs and preferences
  const [level, setLevel] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Game states: 'intro' | 'playing' | 'blockEnded'
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'blockEnded'>('intro');
  const [currentBlock, setCurrentBlock] = useState(1);
  
  // Trials state parameters
  const [trials, setTrials] = useState<CipherTrial[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [userAnswers, setUserAnswers] = useState<('MATCH' | 'DIFFERENT' | 'timeout' | null)[]>([]);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  
  // Visual Feedback overlay
  const [feedback, setFeedback] = useState<'success' | 'failure' | 'timeout' | null>(null);

  // Operational refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const trialStartTimeRef = useRef<number>(0);
  const hasRespondedThisTrial = useRef<boolean>(false);

  // Audio synthesis engine for low-latency cyberpunk sound effects
  const playSynthesizerTone = useCallback((freqs: number[], type: 'sine' | 'triangle' | 'pulse', duration = 0.15) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtxClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Mix sounds or chords
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = type === 'pulse' ? 'sine' : type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        // Apply distinct envelopes based on feedback category
        if (freq > 800) {
          // Sharp High confirmation tone is generated for correct choices
          gainNode.gain.setValueAtTime(0, ctx.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.08 / freqs.length, ctx.currentTime + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        } else if (freq < 200) {
          // Glitch frequency sweep down for errors/timeouts
          osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + duration);
          gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.03);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        } else {
          // Quiet rhythmic click synthesizer tick
          gainNode.gain.setValueAtTime(0, ctx.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.003);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        }

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      });
    } catch (e) {
      // Fail silently if AudioContext is unsupported
    }
  }, [soundEnabled]);

  // Helper code to generate cell structures
  const createRandomCell = (gSize: number, monochrome = false): CellData => {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    // Monochromatic (emerald green #10b981) for Levels 1-2, otherwise dynamic colors
    const color = monochrome ? '#10b981' : COLORS[Math.floor(Math.random() * COLORS.length)];
    const rotations: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];
    const rotation = rotations[Math.floor(Math.random() * rotations.length)];

    return { shape, color, rotation };
  };

  const cloneCell = (cell: CellData): CellData => ({ ...cell });

  // Generate adaptive trials block of 15 pairs
  const generateBlockTrials = useCallback((currLevel: number): CipherTrial[] => {
    const list: CipherTrial[] = [];

    // Configuration of difficulty metrics per level:
    // Level 1-2: Grid 3x3, monochromatic, always EXACT_MATCH rules.
    // Level 3: Grid 3x3 or 4x4, colors active, rule switches color exception.
    // Level 4: Grid 4x4, colors active, rule switches rotation exceptions.
    // Level 5+: Grid 5x5, max speed threshold, hybrid rule setups.
    
    let gridSize = 3;
    if (currLevel >= 3 && currLevel <= 4) gridSize = 4;
    else if (currLevel >= 5) gridSize = 5;

    const useMonochrome = currLevel <= 2;

    for (let i = 0; i < 15; i++) {
      const isMatch = Math.random() < 0.5;
      
      // Determine rules to query in this trial
      let rule: RuleType = 'EXACT_MATCH';
      if (currLevel === 3) {
        rule = Math.random() < 0.5 ? 'IGNORE_COLOR' : 'EXACT_MATCH';
      } else if (currLevel === 4) {
        rule = Math.random() < 0.6 ? 'IGNORE_ROTATION' : 'EXACT_MATCH';
      } else if (currLevel >= 5) {
        const rand = Math.random();
        if (rand < 0.33) rule = 'EXACT_MATCH';
        else if (rand < 0.66) rule = 'IGNORE_COLOR';
        else rule = 'IGNORE_ROTATION';
      }

      const totalCells = gridSize * gridSize;
      const leftGrid: CellData[] = [];
      const rightGrid: CellData[] = [];

      // Build baseline left grid elements
      for (let c = 0; c < totalCells; c++) {
        leftGrid.push(createRandomCell(gridSize, useMonochrome));
      }

      // Build right grid either exactly matching, or with subtle differences
      if (isMatch) {
        // Clone exact structure
        leftGrid.forEach(cell => {
          rightGrid.push(cloneCell(cell));
        });

        // Apply rules modifications that should still qualify as "MATCH"
        if (rule === 'IGNORE_COLOR') {
          // Scramble colors on right grid to challenge the user to ignore them!
          rightGrid.forEach(cell => {
            cell.color = COLORS[Math.floor(Math.random() * COLORS.length)];
          });
        } else if (rule === 'IGNORE_ROTATION') {
          // Scramble rotations on right grid so user ignore orientation!
          const rotations: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];
          rightGrid.forEach(cell => {
            cell.rotation = rotations[Math.floor(Math.random() * rotations.length)];
          });
        }

      } else {
        // Build mismatch structures
        leftGrid.forEach(cell => {
          rightGrid.push(cloneCell(cell));
        });

        // Introduce a specific distinct mismatch
        const mismatchIdx = Math.floor(Math.random() * totalCells);

        if (rule === 'EXACT_MATCH') {
          // Mismatch could be on shape, color, or rotation
          const errType = Math.random();
          if (errType < 0.35) {
            // Alter shape
            let nextShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
            while (nextShape === rightGrid[mismatchIdx].shape) {
              nextShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
            }
            rightGrid[mismatchIdx].shape = nextShape;
          } else if (errType < 0.70 && !useMonochrome) {
            // Alter color
            let nextCol = COLORS[Math.floor(Math.random() * COLORS.length)];
            while (nextCol === rightGrid[mismatchIdx].color) {
              nextCol = COLORS[Math.floor(Math.random() * COLORS.length)];
            }
            rightGrid[mismatchIdx].color = nextCol;
          } else {
            // Alter rotation
            const initialRot = rightGrid[mismatchIdx].rotation;
            const possibleRots: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];
            const nextRot = possibleRots.find(r => r !== initialRot) || 90;
            rightGrid[mismatchIdx].rotation = nextRot;
          }

        } else if (rule === 'IGNORE_COLOR') {
          // We MUST guarantee a discrepancy in either shape or rotation (ignore color mismatch)
          // Scramble color values globally to confuse
          rightGrid.forEach(cell => {
            cell.color = COLORS[Math.floor(Math.random() * COLORS.length)];
          });

          // Induce real structural mismatch (rotation or shape)
          if (Math.random() < 0.5) {
            let nextShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
            while (nextShape === rightGrid[mismatchIdx].shape) {
              nextShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
            }
            rightGrid[mismatchIdx].shape = nextShape;
          } else {
            const initialRot = rightGrid[mismatchIdx].rotation;
            const possibleRots: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];
            const nextRot = possibleRots.find(r => r !== initialRot) || 90;
            rightGrid[mismatchIdx].rotation = nextRot;
          }

        } else if (rule === 'IGNORE_ROTATION') {
          // We MUST guarantee a discrepancy in either shape or color, as rotations are ignored.
          // Scramble rotation values globally
          const possibleRots: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];
          rightGrid.forEach(cell => {
            cell.rotation = possibleRots[Math.floor(Math.random() * possibleRots.length)];
          });

          // Induce real structural mismatch (shape or color)
          if (Math.random() < 0.5 || useMonochrome) {
            let nextShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
            while (nextShape === rightGrid[mismatchIdx].shape) {
              nextShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
            }
            rightGrid[mismatchIdx].shape = nextShape;
          } else {
            let nextCol = COLORS[Math.floor(Math.random() * COLORS.length)];
            while (nextCol === rightGrid[mismatchIdx].color) {
              nextCol = COLORS[Math.floor(Math.random() * COLORS.length)];
            }
            rightGrid[mismatchIdx].color = nextCol;
          }
        }
      }

      list.push({
        gridSize,
        leftGrid,
        rightGrid,
        rule,
        isMatch
      });
    }

    return list;
  }, []);

  // Compute countdown speed adaptation limits (starts 1500ms down to 600ms)
  const responseWindowMs = useMemo(() => {
    return Math.max(600, 1500 - (level - 1) * 130);
  }, [level]);

  // Handle player input decision triggers
  const handleInputDecision = useCallback((decision: 'MATCH' | 'DIFFERENT') => {
    if (gameState !== 'playing' || currentIndex < 0 || currentIndex >= 15) return;
    if (hasRespondedThisTrial.current) return;

    hasRespondedThisTrial.current = true;
    const now = performance.now();
    const rt = now - trialStartTimeRef.current;

    const currentTrial = trials[currentIndex];
    const isActuallyMatched = currentTrial.isMatch;
    const isCorrect = (decision === 'MATCH' && isActuallyMatched) || 
                      (decision === 'DIFFERENT' && !isActuallyMatched);

    setUserAnswers(prev => {
      const updated = [...prev];
      updated[currentIndex] = decision;
      return updated;
    });

    setReactionTimes(prev => [...prev, rt]);

    if (isCorrect) {
      setCorrectCount(c => c + 1);
      setStreak(s => {
        const next = s + 1;
        if (next > maxStreak) setMaxStreak(next);
        return next;
      });
      // Standard base points + precision agility points
      const agilityBonus = Math.max(0, Math.round((responseWindowMs - rt) / 4));
      setScore(s => s + 120 + agilityBonus);
      setFeedback('success');
      haptic.success();
      playSynthesizerTone([1000, 1300], 'sine', 0.15);
    } else {
      setStreak(0);
      setFeedback('failure');
      haptic.error();
      playSynthesizerTone([160], 'triangle', 0.25);
    }

    setTimeout(() => {
      setFeedback(null);
    }, 200);
  }, [gameState, currentIndex, trials, maxStreak, responseWindowMs, playSynthesizerTone]);

  // Bind keyboard hotkeys (S: Si son iguales, D: Diferentes)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleInputDecision('MATCH');
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleInputDecision('DIFFERENT');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, handleInputDecision]);

  // Time tracking effect loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (currentIndex < 0) return;

    if (currentIndex >= 15) {
      // Defer to prevent render state cascading warning loop!
      const finishTimer = setTimeout(() => {
        setGameState('blockEnded');
        
        // Permanent storage persistence
        const finalScore = score + (level * 700);
        if (currentUser) {
          supabaseClient.db.saveScore(currentUser.id, 'Cipher Flux', finalScore, level);
          onRefreshUser();
        }
      }, 0);
      return () => clearTimeout(finishTimer);
    }

    hasRespondedThisTrial.current = false;
    trialStartTimeRef.current = performance.now();

    // Rhythmic calibrator sync ticks sound
    playSynthesizerTone([440], 'sine', 0.04);

    let isEvaporated = false;

    // Timeout reactor
    const timeoutTimer = setTimeout(() => {
      if (isEvaporated) return;
      if (!hasRespondedThisTrial.current) {
        hasRespondedThisTrial.current = true;
        setUserAnswers(prev => {
          const updated = [...prev];
          updated[currentIndex] = 'timeout';
          return updated;
        });
        setStreak(0);
        setFeedback('timeout');
        playSynthesizerTone([110], 'triangle', 0.35);

        setTimeout(() => {
          if (!isEvaporated) setFeedback(null);
        }, 200);
      }
    }, responseWindowMs);

    // Warm gap step interval
    const gapTimer = setTimeout(() => {
      if (isEvaporated) return;
      setCurrentIndex(prev => prev + 1);
    }, responseWindowMs + 320); // rest window buffer

    return () => {
      isEvaporated = true;
      clearTimeout(timeoutTimer);
      clearTimeout(gapTimer);
    };
  }, [currentIndex, gameState, level, score, responseWindowMs, playSynthesizerTone, currentUser, onRefreshUser]);

  // Game loop launcher
  const initiateGameSession = () => {
    if (typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtxClass();
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    }

    const testTrials = generateBlockTrials(level);
    setTrials(testTrials);
    setUserAnswers(Array(15).fill(null));
    setReactionTimes([]);
    setScore(0);
    setCorrectCount(0);
    setStreak(0);
    setMaxStreak(0);
    setGameState('playing');

    // Synth booting notes
    playSynthesizerTone([523], 'sine', 0.12);
    setTimeout(() => playSynthesizerTone([659], 'sine', 0.12), 100);
    setTimeout(() => playSynthesizerTone([784, 1046], 'sine', 0.22), 200);

    setTimeout(() => {
      setCurrentIndex(0);
    }, 1100);
  };

  const endStats = useMemo(() => {
    const totalRt = reactionTimes.reduce((sum, t) => sum + t, 0);
    const avgRt = reactionTimes.length > 0 ? Math.round(totalRt / reactionTimes.length) : 0;
    const accuracy = Math.round((correctCount / 15) * 100);

    let levelAdjustment: 'up' | 'down' | 'stay' = 'stay';
    if (accuracy >= 80) {
      levelAdjustment = 'up';
    } else if (accuracy < 60 && level > 1) {
      levelAdjustment = 'down';
    }

    return { accuracy, avgRt, outcome: levelAdjustment };
  }, [correctCount, reactionTimes, level]);

  const handleNextAdaptiveBlock = () => {
    const { outcome } = endStats;
    let nextLevel = level;

    if (outcome === 'up') {
      nextLevel = level + 1;
      playSynthesizerTone([880, 1100], 'sine', 0.35);
    } else if (outcome === 'down' && level > 1) {
      nextLevel = level - 1;
      playSynthesizerTone([220], 'triangle', 0.4);
    }

    setLevel(nextLevel);
    setCurrentBlock(b => b + 1);

    // Reset vectors
    setTrials([]);
    setCurrentIndex(-1);
    setUserAnswers([]);
    setReactionTimes([]);
    setScore(0);
    setCorrectCount(0);
    setStreak(0);

    setGameState('playing');
    const freshTrials = generateBlockTrials(nextLevel);
    setTrials(freshTrials);
    setUserAnswers(Array(15).fill(null));

    setTimeout(() => {
      setCurrentIndex(0);
    }, 1100);
  };

  const handleQuitOrIntro = () => {
    setLevel(1);
    setCurrentBlock(1);
    setTrials([]);
    setCurrentIndex(-1);
    setUserAnswers([]);
    setReactionTimes([]);
    setScore(0);
    setCorrectCount(0);
    setStreak(0);
    setMaxStreak(0);
    setGameState('intro');
  };

  // Cell path graphics helper
  const renderCellGraphic = (cell: CellData) => {
    const { shape, color, rotation } = cell;

    if (shape === 'empty') return null;

    return (
      <div 
        className="w-full h-full flex items-center justify-center transition-transform duration-150"
        style={{ transform: `rotate(${rotation}deg)`, color }}
      >
        <svg viewBox="0 0 40 40" className="w-[82%] h-[82%] stroke-current fill-none" strokeWidth={3.5} strokeLinecap="round">
          {shape === 'circle' && (
            <circle cx="20" cy="20" r="14" />
          )}
          {shape === 'cross' && (
            <>
              <line x1="8" y1="8" x2="32" y2="32" />
              <line x1="32" y1="8" x2="8" y2="32" />
            </>
          )}
          {shape === 'diagonal-left' && (
            <line x1="8" y1="8" x2="32" y2="32" />
          )}
          {shape === 'diagonal-right' && (
            <line x1="32" y1="8" x2="8" y2="32" />
          )}
          {shape === 'dot-cluster' && (
            <>
              <circle cx="20" cy="20" r="3.5" className="fill-current" />
              <circle cx="10" cy="10" r="2" className="fill-current" />
              <circle cx="30" cy="10" r="2" className="fill-current" />
              <circle cx="10" cy="30" r="2" className="fill-current" />
              <circle cx="30" cy="30" r="2" className="fill-current" />
            </>
          )}
          {shape === 'triangle' && (
            <polygon points="20,7 33,31 7,31" />
          )}
        </svg>
      </div>
    );
  };

  const currentTrial = useMemo(() => {
    if (currentIndex >= 0 && currentIndex < trials.length) {
      return trials[currentIndex];
    }
    return null;
  }, [currentIndex, trials]);

  return (
    <div className="game-area min-h-screen bg-neutral-950 text-zinc-200 flex flex-col justify-between p-6 relative overflow-hidden select-none font-sans">
      
      {/* 🧬 Cognitive Pulse Overlay Border */}
      <AnimatePresence>
        {feedback === 'success' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 border-8 border-cyan-500/25 pointer-events-none z-50 rounded-none mix-blend-screen"
          />
        )}
        {feedback === 'failure' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 border-8 border-rose-500/25 pointer-events-none z-50 rounded-none mix-blend-screen"
          />
        )}
        {feedback === 'timeout' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 border-8 border-amber-500/25 pointer-events-none z-50 rounded-none mix-blend-screen"
          />
        )}
      </AnimatePresence>

      {/* Cyber retro static screen lines */}
      {gameState === 'playing' && level >= 4 && (
        <div className="absolute inset-x-0 inset-y-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90.1deg,rgba(255,0,0,0.04),rgba(0,255,0,0.01),rgba(0,0,255,0.04))] [background-size:100%_4px,3px_100%] pointer-events-none z-10 opacity-40" />
      )}

      {/* Grid design alignments background overlay */}
      <div className="absolute inset-0 bg-transparent opacity-5 pointer-events-none [background-size:30px_30px] [background-image:linear-gradient(to_right,gray_1px,transparent_1px),linear-gradient(to_bottom,gray_1px,transparent_1px)]" />

      {/* Header bar controls */}
      <header className="flex justify-between items-center border-b border-neutral-800 pb-4 relative z-10">
          <button 
            onClick={onBack}
            className="group text-xs text-neutral-500 hover:text-white flex items-center gap-1.5 font-mono cursor-pointer transition-colors min-h-[44px] min-w-[44px]"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            <span className="hidden md:inline">[SANTUARIO_PORT]</span>
          </button>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-neutral-550 hover:text-white transition-colors p-1"
            title={soundEnabled ? "Mute diagnostics audio" : "Activate diagnostics audio"}
          >
            {soundEnabled ? <Volume2 size={13} className="text-cyan-400" /> : <VolumeX size={13} />}
          </button>

          <span className="text-[9px] font-mono tracking-widest text-[#22D3EE] bg-cyan-950/20 px-2 py-0.5 border border-cyan-500/20 uppercase font-bold">
            SISTEMA ESPEJO COMPILADO // FLUX_ACTIVE
          </span>
        </div>
      </header>

      {/* Main layout contents space */}
      <div className="my-auto max-w-[1050px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-20">
        
        {/* Left column: rule boards and telemetry */}
        <div className="col-span-1 lg:col-span-5 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Cpu size={18} className="text-cyan-400 animate-pulse" />
              <span className="font-mono text-[10px] font-bold tracking-widest text-cyan-400 uppercase">
                CALIBRACIÓN ESPEJO COGNITIVO
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white">
              Cipher Flux
            </h1>
            <p className="text-zinc-400 text-xs mt-2 font-serif italic max-w-sm leading-relaxed">
              Consolida la velocidad de emparejamiento visual comparando paneles gemelos. Resiste la interferencia secundaria ignorando rotaciones arbitrarias y fluctuaciones de color en tiempo real.
            </p>
          </div>

          {/* PLAYING METRICS STATS TELEMETRY */}
          {gameState === 'playing' && (
            <div className="border border-neutral-800 p-4 space-y-3 font-mono bg-neutral-950/80 leading-tight">
              <div className="flex justify-between text-xs border-b border-neutral-900 pb-1.5">
                <span className="text-neutral-500">VELOCIDAD LIMITE:</span>
                <span className="text-cyan-400 font-bold">{responseWindowMs} ms / ensayo</span>
              </div>
              <div className="flex justify-between text-xs border-b border-neutral-900 pb-1.5">
                <span className="text-neutral-500">NIVEL ADAPTATIVO:</span>
                <span className="text-zinc-200">FASE_{level}</span>
              </div>
              <div className="flex justify-between text-xs border-b border-neutral-900 pb-1.5">
                <span className="text-neutral-500">RACHA ACTUAL:</span>
                <span className="text-emerald-400">🔥 {streak} CALIBRADOS</span>
              </div>
              <div className="flex justify-between text-xs border-b border-neutral-900 pb-1.5">
                <span className="text-neutral-500">PROGRESO DEL ENSAYO:</span>
                <span className="text-zinc-200">{currentIndex + 1} / 15</span>
              </div>
              <div className="flex justify-between text-xs pb-1">
                <span className="text-neutral-500">FLUJO ACUMULADO:</span>
                <span className="text-cyan-400 font-black">{score} PTS</span>
              </div>

              {/* Individual progress beads track */}
              <div className="pt-2 border-t border-neutral-900 space-y-1">
                <span className="text-[9px] text-neutral-500 block uppercase tracking-wider">Flujo de señales procesadas en el Bloque:</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 15 }).map((_, i) => {
                    const ans = userAnswers[i];
                    return (
                      <div 
                        key={i} 
                        className={`grow h-2.5 border transition-all ${
                          i === currentIndex 
                            ? 'bg-cyan-500/25 border-cyan-400 animate-pulse' 
                            : ans === 'timeout' 
                            ? 'bg-amber-500/40 border-amber-600'
                            : ans && ((ans === 'MATCH' && trials[i]?.isMatch) || (ans === 'DIFFERENT' && !trials[i]?.isMatch))
                            ? 'bg-cyan-500/35 border-cyan-400'
                            : ans
                            ? 'bg-rose-600/35 border-rose-600' 
                            : 'border-neutral-900 bg-neutral-950'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* INTRO SPECS PANEL */}
          {gameState === 'intro' && (
            <div className="border border-neutral-800 p-4 space-y-4 bg-neutral-950/40 font-mono">
              <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase flex items-center gap-1.5">
                <Shield size={12} className="text-cyan-400" /> REGLAS CONDICIONALES INTEGRALE
              </span>

              <div className="text-[10px] text-neutral-400 space-y-2 leading-relaxed">
                <p>
                  El juego presentará dos paneles simétricos. Dependiendo de la directiva superior activa, deberás ignorar ciertas dimensiones irrelevantes para tu comparación:
                </p>
                <div className="space-y-1.5 border-t border-neutral-900 pt-2.5">
                  <div className="flex items-center gap-1.5 text-zinc-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span><b>Fase 1-2:</b> Comparación estricta de geometrías monocromáticas.</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-pink-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                    <span><b>Fase 3:</b> Ignorar colores. Centra tu atención en formas exactas.</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-yellow-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                    <span><b>Fase 4+:</b> Ignorar rotaciones. Evalúa sólo formas y colores.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FAST HOTKEYS MANUAL BAR */}
          <div className="border border-neutral-800 p-4 bg-neutral-950/20 font-mono text-[10px] text-neutral-500 space-y-2 leading-relaxed">
            <span className="text-zinc-300 font-bold tracking-wider">[HOTKEYS_DE_RESPUESTA_PC]</span>
            <div className="grid grid-cols-2 gap-4 border-t border-neutral-900 pt-2 text-[9px]">
              <div className="flex items-center gap-1.5 text-cyan-400">
                <span className="bg-neutral-900 border border-neutral-700 px-2 py-0.5 rounded text-white font-mono text-xs">S</span>
                <span>IGUALES (Si son idénticos)</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-450">
                <span className="bg-neutral-900 border border-neutral-700 px-2 py-0.5 rounded text-white font-mono text-xs">D</span>
                <span>DIFERENTES (Hay discrepancia)</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right column: active game stage spaces */}
        <div className="col-span-1 lg:col-span-12 xl:col-span-7 flex flex-col items-center justify-center">
          
          <div className="w-full max-w-[620px] bg-neutral-950 border border-neutral-800 p-6 flex flex-col justify-between relative shadow-2xl min-h-[440px]">
            
            {/* Cyberpunk aesthetics identifiers */}
            <div className="absolute top-2 left-3 font-mono text-[8px] text-neutral-600 uppercase tracking-widest">CIPHER_FLUX_DECRYPTER // V:1.5</div>
            <div className="absolute top-2 right-3 font-mono text-[8px] text-neutral-600">SYS_F_LEVEL: {level}</div>
            <div className="absolute bottom-2 left-3 font-mono text-[8px] text-neutral-600 uppercase">ATENCIÓN_COGNITIVA: {gameState === 'playing' ? 'DURAS_REGLAS' : 'REPOSO'}</div>
            <div className="absolute bottom-2 right-3 font-mono text-[8px] text-neutral-600 uppercase">DIFICULTAD: {level >= 5 ? 'EXTREMO' : level >= 3 ? 'Avanzado' : 'Iniciante'}</div>

            {/* INTRO SCREEN TAB */}
            {gameState === 'intro' && (
              <div className="grow flex flex-col items-center justify-center text-center p-4 space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl scale-75 animate-pulse" />
                  <div className="w-16 h-16 border border-cyan-500 bg-cyan-950/30 flex items-center justify-center relative">
                    <Zap className="text-cyan-400" size={30} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono tracking-widest text-cyan-400 font-bold uppercase block">
                    DESCIFRADO ESPEJO DÚO
                  </span>
                  <h2 className="text-3xl font-black uppercase tracking-tight text-white leading-tight">
                    CALIBRACIÓN CIPHER FLUX
                  </h2>
                  <p className="text-xs text-zinc-400 font-serif italic max-w-sm leading-normal mx-auto">
                    Ajusta la velocidad y el procesamiento selectivo visual filtrando dimensiones incongruentes. Compara las dos estructuras de alta densidad con transiciones fulminantes.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={initiateGameSession}
                    className="bg-cyan-500 hover:bg-cyan-600 text-black px-8 py-3.5 font-mono font-black text-xs uppercase tracking-wider transition-all cursor-pointer border border-cyan-400 relative overflow-hidden shadow-[0_0_15px_rgba(34,211,238,0.35)] hover:shadow-[0_0_25px_rgba(34,211,238,0.6)] active:scale-95"
                  >
                    INICIAR EMPAREJAMIENTO ESPEJO
                  </button>
                </div>
              </div>
            )}

            {/* ACTIVE PLAYING SCREEN WITH GRID COMPARISONS */}
            {gameState === 'playing' && (
              <div className="grow flex flex-col justify-between py-4">
                
                {/* Rule instruction call to action label bar */}
                {currentTrial && (
                  <div className="w-full text-center py-1.5 bg-neutral-900 border border-neutral-800 font-mono text-[10px] uppercase font-black tracking-widest relative">
                    {currentTrial.rule === 'EXACT_MATCH' && (
                      <span className="text-emerald-400">✔ DIRECTIVA: COMPARACIÓN EXACTA</span>
                    )}
                    {currentTrial.rule === 'IGNORE_COLOR' && (
                      <span className="text-pink-400 animate-pulse">⚡ DIRECTIVA: IGNORA EL COLOR, COMPARA SOLO GEOMETRÍA</span>
                    )}
                    {currentTrial.rule === 'IGNORE_ROTATION' && (
                      <span className="text-yellow-400 animate-pulse">⚡ DIRECTIVA: IGNORA LA ROTACIÓN, COMPARA FORMA/COLOR</span>
                    )}
                  </div>
                )}

                {/* Left and Right grid presentation container */}
                {currentTrial ? (
                  <div className="grid grid-cols-2 gap-6 items-center my-6">
                    
                    {/* LEFT PANEL */}
                    <div className="flex flex-col items-center">
                      <span className="font-mono text-[9px] text-neutral-500 mb-1.5 uppercase">NÚCLEO_INTEGRAL_L</span>
                      <div className="w-full aspect-square max-w-[210px] bg-neutral-950 border-2 border-neutral-800 p-2 relative">
                        <div 
                          className="w-full h-full grid gap-1.5"
                          style={{ gridTemplateColumns: `repeat(${currentTrial.gridSize}, minmax(0, 1fr))` }}
                        >
                          {currentTrial.leftGrid.map((cell, idx) => (
                            <div key={`cell-l-${idx}`} className="bg-neutral-900/40 border border-neutral-850 flex items-center justify-center p-0.5">
                              {renderCellGraphic(cell)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* RIGHT PANEL */}
                    <div className="flex flex-col items-center">
                      <span className="font-mono text-[9px] text-neutral-500 mb-1.5 uppercase">CONFIGURACIÓN_ESPEJO_R</span>
                      <div className="w-full aspect-square max-w-[210px] bg-neutral-950 border-2 border-neutral-800 p-2 relative">
                        <div 
                          className="w-full h-full grid gap-1.5"
                          style={{ gridTemplateColumns: `repeat(${currentTrial.gridSize}, minmax(0, 1fr))` }}
                        >
                          {currentTrial.rightGrid.map((cell, idx) => (
                            <div key={`cell-r-${idx}`} className="bg-neutral-900/40 border border-neutral-850 flex items-center justify-center p-0.5">
                              {renderCellGraphic(cell)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="grow flex items-center justify-center h-48">
                    <span className="font-mono text-xs text-neutral-500 uppercase tracking-widest animate-pulse">
                      SINTETIZANDO MODELOS DIGITALES...
                    </span>
                  </div>
                )}

                {/* Instant timer slider progress line */}
                {currentTrial && (
                  <div className="w-full h-1 bg-neutral-900 overflow-hidden relative">
                    <motion.div 
                      key={`timer-bar-${currentIndex}`}
                      initial={{ width: '100%' }}
                      animate={{ width: '0%' }}
                      transition={{ duration: responseWindowMs / 1000, ease: 'linear' }}
                      className="absolute inset-y-0 left-0 bg-cyan-400"
                    />
                  </div>
                )}

              </div>
            )}

            {/* BLOCK STATUS DISCORD COMPILATION RESULTS */}
            {gameState === 'blockEnded' && (
              <div className="grow flex flex-col items-center justify-center text-center p-4 space-y-6">
                
                <div className="space-y-1">
                  <span className="text-[10px] font-mono tracking-widest text-[#22D3EE] font-black block uppercase">
                    SECCIÓN COMPLETADA // DIAGNÓSTICO VELOCIDAD DE DESCIFRADO
                  </span>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                    ANÁLISIS ESPEJO COMPILADO
                  </h3>
                </div>

                {/* Statistics panel detail */}
                <div className="grid grid-cols-2 gap-3 w-full font-mono max-w-xs text-xs">
                  <div className="border border-neutral-800 p-3 bg-neutral-900 text-left">
                    <span className="text-[8px] text-neutral-500 block">ENFOQUE SELECCION:</span>
                    <span className={`text-[15px] font-black ${endStats.accuracy >= 75 ? 'text-cyan-400' : 'text-amber-500'}`}>
                      {endStats.accuracy}%
                    </span>
                  </div>
                  <div className="border border-neutral-800 p-3 bg-neutral-900 text-left">
                    <span className="text-[8px] text-neutral-500 block">VELOCIDAD CIPHER:</span>
                    <span className="text-[15px] font-black text-emerald-400">
                      {endStats.avgRt} ms
                    </span>
                  </div>
                </div>

                {/* Block outcomes adjustments */}
                <div className="text-xs font-serif italic text-zinc-400 max-w-xs leading-normal">
                  {endStats.outcome === 'up' ? (
                    <span className="text-emerald-400 font-mono text-[9px] not-italic block uppercase border border-emerald-500/20 bg-emerald-500/5 py-1 mb-2 tracking-wider font-extrabold">
                      ⚡ PRECISIÓN DE DESCIFRADO EXCELENTE ({endStats.accuracy}%). EL NIVEL COGNITIVO SE INCREMENTA
                    </span>
                  ) : endStats.outcome === 'down' ? (
                    <span className="text-rose-400 font-mono text-[9px] not-italic block uppercase border border-rose-500/20 bg-rose-500/5 py-1 mb-2 tracking-wider font-extrabold">
                      ⚠️ CONTROL VISUAL DÉBIL ({endStats.accuracy}%). REGULACIÓN DE VELOCIDAD REDUCIDA
                    </span>
                  ) : (
                    <span className="text-neutral-500 font-mono text-[10px] not-italic block uppercase border border-neutral-850 bg-neutral-900/40 py-1 mb-2 tracking-wider font-bold">
                      ● CALIBRACIÓN CORRECTA. SECCIÓN EN PARÁMETROS ESTABLES
                    </span>
                  )}
                  Tus perfiles de exclusión asíncrona de distractores espaciales se han persistido exitosamente en tu tarjeta sintáctica de rendimiento.
                </div>

                {/* Button controllers */}
                <div className="flex gap-3 w-full max-w-sm justify-center">
                  <button
                    onClick={handleQuitOrIntro}
                    className="border border-neutral-850 hover:border-neutral-500 text-neutral-450 hover:text-white px-4 py-3 font-mono text-xs uppercase tracking-wide cursor-pointer flex items-center gap-1 transition-all"
                  >
                    <RotateCcw size={12} /> Salir
                  </button>

                  <button
                    onClick={handleNextAdaptiveBlock}
                    className="bg-white hover:bg-cyan-400 hover:border-cyan-400 text-black px-6 py-3 font-mono font-black text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 transition-all w-48 shadow-[4px_4px_0_rgba(34,211,238,0.3)] hover:shadow-none"
                  >
                    Siguiente Fase <ChevronRight size={14} />
                  </button>
                </div>

              </div>
            )}

          </div>

          {/* Large touch mobile-friendly bottom controls layout */}
          {gameState === 'playing' && (
            <div className="w-full max-w-[620px] grid grid-cols-2 gap-4 mt-6">
              
              {/* MATCH OPTION BUTTON */}
              <button
                onClick={() => handleInputDecision('MATCH')}
                onTouchEnd={(e) => { e.preventDefault(); handleInputDecision('MATCH'); }}
                className="border border-neutral-800 bg-neutral-950 p-4 hover:border-cyan-500 hover:text-white transition-all text-neutral-400 flex flex-col items-center justify-center font-mono cursor-pointer relative min-h-[64px]"
                style={{ touchAction: 'manipulation' }}
              >
                <div className="text-[9px] text-neutral-600 uppercase font-normal mb-1">Emparejado Exacto</div>
                <div className="text-base font-extrabold tracking-tight flex items-center gap-1 text-emerald-400">
                  <Check size={16} strokeWidth={3} /> SÍ, COINCIDE
                </div>
                <span className="absolute bottom-1 right-2 text-[8px] font-mono text-neutral-700 font-bold">[TECLA S]</span>
              </button>

              {/* MISMATCH OPTION BUTTON */}
              <button
                onClick={() => handleInputDecision('DIFFERENT')}
                onTouchEnd={(e) => { e.preventDefault(); handleInputDecision('DIFFERENT'); }}
                className="border border-neutral-800 bg-neutral-950 p-4 hover:border-cyan-500 hover:text-white transition-all text-neutral-400 flex flex-col items-center justify-center font-mono cursor-pointer relative min-h-[64px]"
                style={{ touchAction: 'manipulation' }}
              >
                <div className="text-[9px] text-neutral-600 uppercase font-normal mb-1">Incompatibilidad</div>
                <div className="text-base font-extrabold tracking-tight flex items-center gap-1 text-rose-450">
                  <AlertCircle size={16} strokeWidth={3} /> NO, ES DIFERENTE
                </div>
                <span className="absolute bottom-1 right-2 text-[8px] font-mono text-neutral-700 font-bold">[TECLA D]</span>
              </button>

            </div>
          )}

        </div>

      </div>

      {/* Cyberpunk system footer */}
      <footer className="mt-8 border-t border-neutral-900 pt-4 flex flex-col sm:flex-row justify-between items-center text-[9px] font-mono text-neutral-600 relative z-10 font-bold uppercase">
        <span>RED COMPILATOR ESPEJO CIPHER FLUX // ATENCIÓN EXTRAORDINARIA</span>
        <span className="flex items-center gap-1">
          RESONANCIA ESPECIALIZADA: <span className="text-[#22D3EE] animate-pulse">● CALIBRADA DISRUPTOR ACTIVO</span>
        </span>
      </footer>

    </div>
  );
}
