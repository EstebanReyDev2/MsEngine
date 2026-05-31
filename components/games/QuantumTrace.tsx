// 📂 /components/games/QuantumTrace.tsx
// MOBILE-OPTIMIZED: touch-action, hit areas 44px+, haptic feedback, responsive SVG
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { saveGameScore } from '@/lib/gameScoreService';
import GameShell from '@/components/shared/GameShell';
import { 
  ArrowLeft, Volume2, VolumeX, Trophy, Sparkles, CheckCircle2, 
  XCircle, Zap, RefreshCw, HelpCircle, Eye, ShieldAlert, Cpu, 
  Play, RotateCcw, Share2, Activity, GitCommit, Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useResponsiveScale } from '@/hooks/use-responsive-scale';
import { useHaptic } from '@/hooks/use-haptic';

interface Node {
  id: number;
  x: number; // 0 - 1000
  y: number; // 0 - 700
}

interface PerformanceLog {
  round: number;
  length: number;
  speedMs: number;
  rotation: number;
  isCorrect: boolean;
  accuracy: number; // percentage
}

type GameState = 'lobby' | 'showing_path' | 'player_input' | 'success' | 'failure' | 'gameover';

const getNow = (): number => {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
};

// Irwin-Hall or custom noise stable generator helper (to avoid render side effects)
const generateQuantumGraph = (numNodes: number, minDistance = 140): Node[] => {
  const newNodes: Node[] = [];
  
  let attempts = 0;
  while (newNodes.length < numNodes && attempts < 200) {
    attempts++;
    const x = 120 + Math.random() * 760; // safety border margin
    const y = 100 + Math.random() * 500;
    
    let tooClose = false;
    for (const n of newNodes) {
      const dist = Math.sqrt((n.x - x) ** 2 + (n.y - y) ** 2);
      if (dist < minDistance) {
        tooClose = true;
        break;
      }
    }
    
    if (!tooClose) {
      newNodes.push({ id: newNodes.length, x, y });
    }
  }
  
  // Fallback if random placement did not fully settle
  if (newNodes.length < numNodes) {
    for (let i = newNodes.length; i < numNodes; i++) {
      newNodes.push({
        id: i,
        x: 150 + ((i * 123) % 700),
        y: 120 + ((i * 97) % 460),
      });
    }
  }
  
  return newNodes;
};

interface RoundData {
  nodes: Node[];
  sequence: number[];
}

const prepareRoundData = (currentRound: number, desiredSeqLength: number, isMobile: boolean): RoundData => {
  // En mobile reducimos la cantidad de nodos para que haya más espacio entre ellos
  const maxNodes = isMobile ? 8 : 12;
  const totalNodesCount = Math.min(maxNodes, 4 + Math.floor(currentRound / 2));
  const minDist = isMobile ? 180 : 140; // Más separación en mobile
  const generatedNodes = generateQuantumGraph(totalNodesCount, minDist);
  
  const draftSequence: number[] = [];
  let currentIdx = Math.floor(Math.random() * totalNodesCount);
  draftSequence.push(currentIdx);

  while (draftSequence.length < desiredSeqLength) {
    const candidates = Array.from({ length: totalNodesCount }, (_, i) => i)
      .filter(i => i !== currentIdx && !draftSequence.includes(i));
    
    if (candidates.length === 0) {
      const repeatCandidates = Array.from({ length: totalNodesCount }, (_, i) => i)
        .filter(i => i !== currentIdx);
      currentIdx = repeatCandidates[Math.floor(Math.random() * repeatCandidates.length)];
    } else {
      currentIdx = candidates[Math.floor(Math.random() * candidates.length)];
    }
    draftSequence.push(currentIdx);
  }
  
  return {
    nodes: generatedNodes,
    sequence: draftSequence
  };
};

export default function QuantumTrace({ onBack, currentUser, onRefreshUser }: { onBack: () => void, currentUser: any, onRefreshUser: () => void }) {
  const haptic = useHaptic();
  const { nodeRadius, hitAreaRadius, isMobile, mobileFactor } = useResponsiveScale({
    baseWidth: 1000,
    baseHeight: 700,
    minNodeRadius: 7,
    minHitAreaRadius: 22,
    mobileScaleFactor: 1.8,
  });

  // Game state configurations
  const [gameState, setGameState] = useState<GameState>('lobby');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  
  // Speed + sequence scale dynamics
  const [round, setRound] = useState<number>(1);
  const [score, setScore] = useState<number>(0);
  const [highStreak, setHighStreak] = useState<number>(0);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  
  // Dynamic complexity factors
  const [sequenceLength, setSequenceLength] = useState<number>(3);
  const [nodeDisplayInterval, setNodeDisplayInterval] = useState<number>(850); // Millis between lights
  const [rotationDegrees, setRotationDegrees] = useState<number>(0); // 0 during demo, sutil change on advanced states
  const [isRotatingEffect, setIsRotatingEffect] = useState<boolean>(false);
  const [onlyShowSequenceNodes, setOnlyShowSequenceNodes] = useState<boolean>(false);

  // Active highlighted parameters (Demonstration indexes)
  const [activeDemoItemIndex, setActiveDemoItemIndex] = useState<number>(-1);
  const [isLineDrawing, setIsLineDrawing] = useState<boolean>(false);

  // Utilities & Settings
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [helpOpened, setHelpOpened] = useState<boolean>(true);
  const [history, setHistory] = useState<PerformanceLog[]>([]);

  // Referencia al SVG container para touch-action
  const arenaRef = useRef<HTMLDivElement>(null);

  // Sound generator (stabilized inside useCallback callback)
  const playSound = React.useCallback((freq: number, type: 'sine' | 'square' | 'triangle' | 'sawtooth' = 'sine', duration = 0.2) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio failsafe
    }
  }, [soundEnabled]);

  // Launch a brand new session
  const startNewGame = () => {
    setScore(0);
    setRound(1);
    setCurrentStreak(0);
    setLives(3);
    setSequenceLength(3);
    setNodeDisplayInterval(850);
    setHistory([]);
    setRotationDegrees(0);
    setIsRotatingEffect(false);
    setOnlyShowSequenceNodes(false);
    
    // Gen initial configuration & run
    const { nodes: generatedNodes, sequence: draftSequence } = prepareRoundData(1, 3, isMobile);
    setNodes(generatedNodes);
    setSequence(draftSequence);
    setPlayerInput([]);
    
    setActiveDemoItemIndex(0);
    setIsLineDrawing(true);
    setGameState('showing_path');
    playSound(440, 'triangle', 0.15);
    haptic.light();
  };

  // Build the constellation and sequence logic dynamically per round
  const setupNextRound = (currentRound: number, desiredSeqLength: number, currentInterval: number) => {
    const { nodes: generatedNodes, sequence: draftSequence } = prepareRoundData(currentRound, desiredSeqLength, isMobile);
    setNodes(generatedNodes);
    setSequence(draftSequence);
    setPlayerInput([]);
    setRotationDegrees(0);
    setIsRotatingEffect(false);
    setOnlyShowSequenceNodes(false);
    
    // Switch to presentation stage after brief assembly delay
    setActiveDemoItemIndex(0);
    setIsLineDrawing(true);
    setGameState('showing_path');
    playSound(440, 'triangle', 0.15);
  };

  // Trigger demo path showing chain sequence when state moves to showing_path
  useEffect(() => {
    if (gameState !== 'showing_path' || sequence.length === 0) return;

    let index = 0;
    playSound(350 + index * 100, 'sine', 0.18);

    const intervalTimer = setInterval(() => {
      index++;
      if (index < sequence.length) {
        setActiveDemoItemIndex(index);
        playSound(350 + index * 100, 'sine', 0.18);
      } else {
        clearInterval(intervalTimer);
        const isAdvancedSpatialShift = round >= 3;
        const rollRotation = isAdvancedSpatialShift ? (Math.random() > 0.5 ? (isMobile ? 10 : 20) : isMobile ? -10 : -20) : 0;
        
        if (isAdvancedSpatialShift) {
          setIsRotatingEffect(true);
          playSound(280, 'sawtooth', 0.45);
          
          setTimeout(() => {
            setRotationDegrees(rollRotation);
            setOnlyShowSequenceNodes(round >= 5);
            setGameState('player_input');
            playSound(587.33, 'triangle', 0.12);
          }, 600);
        } else {
          setRotationDegrees(0);
          setGameState('player_input');
          playSound(587.33, 'triangle', 0.12);
        }
      }
    }, nodeDisplayInterval);

    return () => {
      clearInterval(intervalTimer);
    };
  }, [gameState, sequence, nodeDisplayInterval, round, playSound, isMobile]);

  // Player action interactions click node handler
  const handleNodeClick = (nodeId: number) => {
    if (gameState !== 'player_input') return;

    const currentSequenceIndex = playerInput.length;
    const expectedNodeId = sequence[currentSequenceIndex];

    if (nodeId === expectedNodeId) {
      const updatedInput = [...playerInput, nodeId];
      setPlayerInput(updatedInput);
      playSound(500 + currentSequenceIndex * 80, 'sine', 0.1);
      haptic.light();

      if (updatedInput.length === sequence.length) {
        const speedMultiplier = Math.max(1, Math.floor((1000 - nodeDisplayInterval) / 100));
        const addedValue = (sequenceLength * 15) + (currentStreak * 10) + (speedMultiplier * 20);
        
        setScore(prev => prev + addedValue);
        setCurrentStreak(prev => {
          const next = prev + 1;
          if (next > highStreak) setHighStreak(next);
          return next;
        });

        const log: PerformanceLog = {
          round,
          length: sequenceLength,
          speedMs: nodeDisplayInterval,
          rotation: rotationDegrees,
          isCorrect: true,
          accuracy: 100
        };
        setHistory(prev => [log, ...prev]);

        playSound(659.25, 'triangle', 0.12);
        setTimeout(() => playSound(880, 'sine', 0.18), 100);
        setTimeout(() => playSound(1318.51, 'sine', 0.3), 200);
        haptic.success();

        setGameState('success');
        setRound(prev => prev + 1);
        setSequenceLength(prev => Math.min(10, prev + 1));
        setNodeDisplayInterval(prev => Math.max(300, prev - 60));
      }
    } else {
      playSound(150, 'sawtooth', 0.5);
      haptic.error();
      
      const accuracyPercent = Math.round((currentSequenceIndex / sequence.length) * 100);
      const log: PerformanceLog = {
        round,
        length: sequenceLength,
        speedMs: nodeDisplayInterval,
        rotation: rotationDegrees,
        isCorrect: false,
        accuracy: accuracyPercent
      };
      setHistory(prev => [log, ...prev]);

      setLives(prev => {
        const next = prev - 1;
        if (next <= 0) {
          setTimeout(() => handleFinishSession(score), 1200);
        }
        return next;
      });

      setCurrentStreak(0);
      setGameState('failure');
      setSequenceLength(prev => Math.max(3, prev - 1));
      setNodeDisplayInterval(prev => Math.min(950, prev + 80));
    }
  };

  // Transition to next challenge stage
  const handleContinue = () => {
    if (lives <= 0) {
      handleFinishSession(score);
    } else {
      setupNextRound(round, sequenceLength, nodeDisplayInterval);
    }
  };

  // Gracefully wrap up data tracking structures to database
  const handleFinishSession = (finalScore: number) => {
    setGameState('gameover');
    playSound(200, 'sawtooth', 0.8);
    haptic.heavy();
    
    if (currentUser) {
      try {
        saveGameScore(
          currentUser?.id,
          'Quantum Trace',
          finalScore,
          Math.min(10, Math.floor(finalScore / 130) + 1)
        );
        onRefreshUser();
      } catch (err) {
        console.error('Failure logging quantum metrics:', err);
      }
    }
  };

  // Tamaños visuales dinámicos según viewport
  const visualOuterRadius = Math.round(24 * (isMobile ? mobileFactor : 1));
  const visualInnerRadius = Math.round(nodeRadius);
  const glowRadius = Math.round(40 * (isMobile ? mobileFactor : 1));
  const sequenceLabelOffset = Math.round(36 * (isMobile ? mobileFactor : 1));

  return (
    <GameShell active={gameState !== 'lobby'}>
    <div 
      id="quantum-trace-game" 
      className="game-area w-full max-w-[1050px] mx-auto bg-zinc-950 text-zinc-100 border-4 border-zinc-900 p-4 md:p-6 select-none font-sans overflow-hidden relative"
    >
      
      {/* 🚀 Sleek Futuristic HUD Dashboard Top banner */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-stretch gap-4 pb-4 border-b border-zinc-800 mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer rounded-none bg-zinc-900/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Atrás al Menú"
            id="quantum-back-button"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[2px] text-cyan-400 block">{"// MAPA DE CONECTIVIDAD CUÁNTICA"}</span>
            <h1 className="text-xl font-bold font-mono text-white tracking-tight uppercase flex items-center gap-2">
              <Compass className="text-cyan-400 animate-spin-slow" size={18} />
              <span>Quantum Trace</span>
            </h1>
          </div>
        </div>

        {/* Level metrics statistics dashboard */}
        <div className="grid grid-cols-4 gap-2 md:gap-4 flex-grow md:max-w-xl text-center font-mono">
          <div className="bg-zinc-900 border border-zinc-800 p-2">
            <span className="text-[8px] block text-zinc-500 uppercase tracking-wider">PASOS</span>
            <span className="text-sm font-black text-white">{sequenceLength} NODOS</span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-2">
            <span className="text-[8px] block text-zinc-500 uppercase tracking-wider">SCORE</span>
            <span className="text-sm font-black text-emerald-400">{score}</span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-2">
            <span className="text-[8px] block text-zinc-500 uppercase tracking-wider">RACHA</span>
            <span className="text-sm font-black text-cyan-400">0{currentStreak}</span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-2">
            <span className="text-[8px] block text-zinc-500 uppercase tracking-wider">SINCRO</span>
            <span className="text-sm font-black text-rose-500 uppercase">
              {'★'.repeat(lives)}{'☆'.repeat(3 - lives)}
            </span>
          </div>
        </div>

        {/* Audio control settings */}
        <div className="flex items-center gap-1.5 self-center">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            id="quantum-sound-toggle"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button 
            onClick={() => setHelpOpened(prev => !prev)}
            className="p-2.5 border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            id="quantum-help-toggle"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {/* Main Graph Arena Canvas Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 items-start">
        
        {/* Left Interactive Arena block */}
        <div 
          ref={arenaRef}
          className="game-area-precise lg:col-span-8 bg-zinc-900/40 border border-zinc-800 p-2 relative min-h-[420px] md:min-h-[520px] flex items-center justify-center"
        >
          
          {/* Subtle quantum grid background dot pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-25 pointer-events-none" />

          {/* Lobby Screen layer */}
          <AnimatePresence>
            {gameState === 'lobby' && (
              <motion.div 
                className="absolute inset-0 bg-zinc-950/98 text-center flex flex-col items-center justify-center p-6 z-30 font-mono"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                id="quantum-lobby-overlay"
              >
                <div className="max-w-md space-y-6">
                  <div className="w-16 h-16 rounded-full bg-cyan-950/30 border-2 border-cyan-400 text-cyan-400 flex items-center justify-center mx-auto shadow-xl shadow-cyan-950/20">
                    <GitCommit size={36} className="animate-pulse" />
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black uppercase tracking-tight text-white">QUANTUM TRACE INDEX</h2>
                    <p className="font-serif italic text-xs text-zinc-400">
                      Entrenamiento holístico del córtex prefrontal en memoria de trabajo y retención topológica espacial.
                    </p>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 p-4 text-left text-xs leading-relaxed space-y-2 text-zinc-300">
                    <p className="text-cyan-400 font-bold uppercase text-center border-b border-zinc-800 pb-2">PARÁMETROS DIAGNÓSTICOS</p>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>🧬 COGNICIÓN: <span className="text-white font-bold">Memoria de Trabajo</span></div>
                      <div>⚡ RECONEXIÓN: <span className="text-white font-bold">Secuencias Activas</span></div>
                      <div>🌀 COMPLEJIDAD: <span className="text-white font-bold">3 a 10 Nodos Sucesivos</span></div>
                      <div>🔮 DISTRACTOR: <span className="text-white font-bold">Rotación Espacial</span></div>
                    </div>
                  </div>

                  <button 
                    onClick={startNewGame}
                    className="w-full py-4 bg-cyan-500 text-black font-black text-sm uppercase tracking-wider rounded-none hover:bg-white transition-all border border-transparent cursor-pointer min-h-[52px]"
                  >
                    CONECTAR RED CUÁNTICA
                  </button>
                </div>
              </motion.div>
            )}

            {/* Game Over Screen layer */}
            {gameState === 'gameover' && (
              <motion.div 
                className="absolute inset-0 bg-zinc-950/98 text-center flex flex-col items-center justify-center p-6 z-30 font-mono"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                id="quantum-gameover-overlay"
              >
                <div className="max-w-xs space-y-5">
                  <div className="w-12 h-12 bg-zinc-900 border border-zinc-700 text-amber-400 flex items-center justify-center mx-auto">
                    <Trophy size={24} />
                  </div>

                  <div className="space-y-1">
                    <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest block">{"// CONEXIÓN FINALIZADA"}</span>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Trace Concluido</h2>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 p-4 space-y-2 text-[11px] text-left">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">PUNTUACIÓN OBTENIDA:</span>
                      <span className="text-cyan-400 font-bold">{score} PTS</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">MAYOR RACHA CONTINUA:</span>
                      <span className="text-white font-bold">0{highStreak}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">RONDAS EJECUTADAS:</span>
                      <span className="text-white font-bold">{round}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <button 
                      onClick={startNewGame}
                      className="py-3 bg-cyan-500 hover:bg-white text-black font-black text-xs uppercase cursor-pointer transition-all min-h-[48px]"
                    >
                      Reiniciar Matriz
                    </button>
                    <button 
                      onClick={onBack}
                      className="py-3 bg-zinc-900 border border-zinc-800 text-zinc-400 font-black text-xs uppercase cursor-pointer min-h-[48px]"
                    >
                      Salir
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 🌀 DYNAMIC SVG ARENA STAGE (Rotation active on advanced phases) */}
          <motion.div 
            className="w-full relative max-w-[650px] aspect-[10/7] flex items-center justify-center"
            animate={{ rotate: rotationDegrees }}
            transition={{ type: 'spring', damping: 20, stiffness: 60 }}
          >
            <svg 
              viewBox="0 0 1000 700" 
              className="w-full h-full overflow-visible"
              id="quantum-svg-viewport"
              style={{ touchAction: 'none' }}
            >
              {/* background connecting paths: visual layout only */}
              {gameState !== 'lobby' && nodes.map((node, index) => {
                const nextNode = nodes[(index + 1) % nodes.length];
                return (
                  <line 
                    key={`bg-line-${index}`}
                    x1={node.x}
                    y1={node.y}
                    x2={nextNode.x}
                    y2={nextNode.y}
                    className="stroke-zinc-900/40"
                    strokeWidth={1.5}
                  />
                );
              })}

              {/* ⚡ DIRECT SEQUENCE TRACING CONECTIVITIES LINKS */}
              {/* 1. Showing Path Path Demo Connections Rendering */}
              {gameState === 'showing_path' && activeDemoItemIndex >= 1 && (
                sequence.slice(0, activeDemoItemIndex + 1).map((nodeId, sIdx) => {
                  if (sIdx === 0) return null;
                  const fromNode = nodes[sequence[sIdx - 1]];
                  const toNode = nodes[nodeId];
                  if (!fromNode || !toNode) return null;
                  
                  return (
                    <motion.line 
                      key={`demo-link-${sIdx}`}
                      x1={fromNode.x}
                      y1={fromNode.y}
                      x2={toNode.x}
                      y2={toNode.y}
                      className="stroke-amber-400"
                      strokeWidth={isMobile ? 5 : 3.5}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  );
                })
              )}

              {/* 2. User Input Reconnections Links Rendering */}
              {(gameState === 'player_input' || gameState === 'success' || gameState === 'failure') && playerInput.length >= 1 && (
                playerInput.map((nodeId, pIdx) => {
                  if (pIdx === 0) return null;
                  const fromNode = nodes[playerInput[pIdx - 1]];
                  const toNode = nodes[nodeId];
                  if (!fromNode || !toNode) return null;

                  return (
                    <line 
                      key={`player-link-${pIdx}`}
                      x1={fromNode.x}
                      y1={fromNode.y}
                      x2={toNode.x}
                      y2={toNode.y}
                      className="stroke-cyan-400 shadow-xl"
                      strokeWidth={isMobile ? 6 : 4.5}
                    />
                  );
                })
              )}

              {/* 🔮 THE ACTIVE GEOMETRIC QUANTUM NODES GRAPH */}
              {gameState !== 'lobby' && nodes.map((node) => {
                const isSequenceMember = sequence.includes(node.id);
                
                // Determine highlighted status
                let isHighlighted = false;
                let isSuccessState = false;
                let isErrorState = false;

                if (gameState === 'showing_path') {
                  const currentSecId = sequence[activeDemoItemIndex];
                  isHighlighted = currentSecId === node.id;
                } else if (gameState === 'player_input' || gameState === 'success' || gameState === 'failure') {
                  const isAlreadyConnected = playerInput.includes(node.id);
                  isHighlighted = isAlreadyConnected;
                  
                  if (gameState === 'failure' && playerInput.length < sequence.length) {
                    isErrorState = isAlreadyConnected;
                  }
                  if (gameState === 'success') {
                    isSuccessState = true;
                  }
                }

                // Fog distractor mode in round >= 5
                const isDimmed = onlyShowSequenceNodes && !isSequenceMember && gameState === 'player_input';

                return (
                  <g 
                    key={`quantum-node-${node.id}`}
                    className={`transition-opacity duration-500 ${isDimmed ? 'opacity-[0.05] pointer-events-none' : 'opacity-100'}`}
                    onClick={() => handleNodeClick(node.id)}
                    onTouchEnd={(e) => {
                      // En mobile, prevenimos duplicación del evento click
                      e.preventDefault();
                      handleNodeClick(node.id);
                    }}
                    style={{ touchAction: 'none', cursor: gameState === 'player_input' ? 'pointer' : 'default' }}
                  >
                    {/* ✅ HIT AREA INVISIBLE — FAT FINGER TOLERANCE */}
                    {/* Este círculo invisible captura el toque en un área mínima de 44px */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={hitAreaRadius}
                      fill="transparent"
                      className="cursor-pointer"
                    />

                    {/* Ring highlight wave shock pulsator */}
                    <AnimatePresence>
                      {isHighlighted && (
                        <motion.circle 
                          cx={node.x}
                          cy={node.y}
                          r={glowRadius}
                          className="fill-none stroke-cyan-500/30"
                          strokeWidth={2}
                          initial={{ scale: 0.5, opacity: 1 }}
                          animate={{ scale: 1.4, opacity: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.2 }}
                        />
                      )}
                    </AnimatePresence>

                    {/* Nodes neon glow backdrop circles */}
                    <circle 
                      cx={node.x}
                      cy={node.y}
                      r={visualOuterRadius}
                      className={`transition-all duration-300 ${
                        isErrorState 
                          ? 'fill-rose-950/80 stroke-rose-500 animate-pulse'
                          : isSuccessState
                          ? 'fill-emerald-950/80 stroke-emerald-400'
                          : isHighlighted
                          ? 'fill-cyan-950/80 stroke-cyan-400'
                          : 'fill-zinc-950 stroke-zinc-700/80 hover:stroke-zinc-500 hover:fill-zinc-900'
                      }`}
                      strokeWidth={isMobile ? 3 : 2.5}
                    />

                    {/* Visual core vector node dots */}
                    <circle 
                      cx={node.x}
                      cy={node.y}
                      r={visualInnerRadius}
                      className={`${
                        isErrorState
                          ? 'fill-rose-500'
                          : isSuccessState
                          ? 'fill-emerald-400'
                          : isHighlighted
                          ? 'fill-cyan-400 animate-ping'
                          : 'fill-zinc-650'
                      }`}
                    />

                    {/* Sequential labeling — más pequeño en mobile */}
                    {!isMobile && (
                      <text 
                        x={node.x}
                        y={node.y + sequenceLabelOffset}
                        textAnchor="middle"
                        className="fill-zinc-500 text-[11px] font-mono select-none"
                      >
                        {`NODE_0${node.id}`}
                      </text>
                    )}
                    {isMobile && (
                      <text 
                        x={node.x}
                        y={node.y + sequenceLabelOffset}
                        textAnchor="middle"
                        className="fill-zinc-600 text-[8px] font-mono select-none"
                      >
                        {`N${node.id}`}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Impelled spatial shift dynamic indicator banner overlay */}
            <AnimatePresence>
              {isRotatingEffect && (
                <motion.div 
                  className="absolute bg-amber-500/90 text-black border border-amber-400 px-4 py-2 text-xs font-black tracking-widest font-mono uppercase rounded-none max-w-sm text-center shadow-lg pointer-events-none"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                >
                  ⚠️ SPATIAL COGNITIVE SHIFT: ROTANDO CONSTELACIÓN
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Quick interactive UI notification alerts bar */}
          <div className="absolute bottom-4 left-4 right-4 flex bg-zinc-900 border border-zinc-800 p-2.5 mt-4 justify-between items-center text-xs font-mono">
            <div>
              <span className="text-zinc-500">ESTADO RED: <span className="text-cyan-400 font-bold">{gameState.toUpperCase()}</span></span>
            </div>
            <div className="hidden md:block">
              {gameState === 'showing_path' && (
                <span className="text-amber-400 animate-pulse">🛰️ MUESTRA DE SECUENCIA EN PROCESO...</span>
              )}
              {gameState === 'player_input' && (
                <span className="text-cyan-400 animate-pulse">● REPRODUCE LA SECUENCIA EXACTA</span>
              )}
              {gameState === 'success' && (
                <span className="text-emerald-400 animate-pulse">✓ SECUENCIA COMPLEMENTADA CON EXCELENCIA</span>
              )}
              {gameState === 'failure' && (
                <span className="text-rose-500 animate-pulse">✕ ERROR DE RETENCIÓN TOPOLÓGICA</span>
              )}
            </div>
          </div>

        </div>

        {/* Right Tutorial/Diagnostic Column Section */}
        <div className="lg:col-span-4 space-y-6 font-mono text-zinc-300">
          
          {/* Diagnostic dynamic actions controllers */}
          {(gameState === 'success' || gameState === 'failure') && (
            <div className={`p-5 border ${gameState === 'success' ? 'bg-emerald-950/20 border-emerald-500/80' : 'bg-rose-950/20 border-rose-500/80'} space-y-4`}>
              <div className="flex items-center gap-2">
                {gameState === 'success' ? (
                  <CheckCircle2 className="text-emerald-400" size={18} />
                ) : (
                  <XCircle className="text-rose-500" size={18} />
                )}
                <h3 className="text-sm font-bold uppercase tracking-tight text-white">
                  {gameState === 'success' ? 'Secuencia Procesada' : 'Fallo de Coordinación'}
                </h3>
              </div>
              
              <p className="text-xs text-zinc-400 leading-relaxed">
                {gameState === 'success' 
                  ? 'Fabuloso. Tu corteza visual ha sincronizado los nodos cuánticos. El retardo adaptativo se ha reducido.' 
                  : 'Has fallado la cadena de re-conexión. La escala de nodos se mantendrá estable para ayudarte a reconectar.'}
              </p>

              <button 
                onClick={handleContinue}
                className={`w-full py-3 text-xs font-bold uppercase tracking-widest cursor-pointer min-h-[48px] ${
                  gameState === 'success' ? 'bg-emerald-500 hover:bg-white text-black' : 'bg-rose-500 hover:bg-white text-black'
                }`}
              >
                Siguiente Desafío
              </button>
            </div>
          )}

          {helpOpened && (
            <div className="bg-cyan-950/10 border border-cyan-500 p-5 relative rounded-none">
              <button 
                onClick={() => setHelpOpened(false)}
                className="absolute right-3 top-3 text-[10px] uppercase font-black tracking-widest text-cyan-400 font-mono hover:underline cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                id="quantum-close-tutorial"
              >
                ✕ Cerrar
              </button>
              <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest block mb-2 font-mono">NEURAL MANUAL</span>
              <h4 className="text-sm font-bold uppercase tracking-tight text-white mb-3">{"// QUANTUM TRACE"}</h4>
              
              <ul className="text-xs space-y-3 leading-relaxed text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-black">1.</span>
                  <span>Memoriza la <strong className="text-white">trayectoria de iluminación</strong> secuencial de los nodos del mapa.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-black">2.</span>
                  <span>Toca los nodos en <strong className="text-white">exactamente el mismo orden</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-black">3.</span>
                  <span>A partir del nivel 3, <strong className="text-zinc-300">toda la constelación rota sutilmente</strong> justo antes de tu respuesta. ¡Sigue la lógica topológica del mapa, no las coordenadas absolutas!</span>
                </li>
              </ul>
            </div>
          )}

          {/* Diagnostic statistics trace history logs */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 space-y-4 rounded-none">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">{"// HISTÓRICO COGNITIVO"}</span>
            <h3 className="text-xs font-black uppercase text-white tracking-wider">HISTORIAL DE LOGS</h3>

            <div className="max-h-56 overflow-y-auto space-y-2 text-[11px] pr-2">
              {history.length === 0 ? (
                <div className="text-zinc-600 italic py-4 text-center">Sin escaneos completados en la sesión.</div>
              ) : (
                history.map((h, index) => (
                  <div key={index} className="flex justify-between border-b border-zinc-800/60 pb-1.5 items-center font-mono">
                    <span className="text-zinc-500">Trace_0{h.round}</span>
                    <span className="text-slate-400">{h.length} Nodos</span>
                    <span className={h.isCorrect ? 'text-emerald-400 font-bold' : 'text-rose-500 font-bold'}>
                      {h.isCorrect ? 'COMPLETO' : `${h.accuracy}%`}
                    </span>
                    <span className="text-zinc-400">{h.speedMs}ms</span>
                  </div>
                ))
              )}
            </div>

            <hr className="border-zinc-800" />

            <div className="bg-zinc-950 p-3 rounded-none border border-zinc-800 text-[10px] leading-relaxed space-y-1 text-zinc-400">
              <p className="text-cyan-400 font-bold uppercase mb-1">Cálculo de Latencia Adaptativa</p>
              <p>Tiempo de exposición: <span className="text-white font-bold">{nodeDisplayInterval}ms</span></p>
              <p>Modo Desafío Hinchado: <span className="text-white font-bold">{round >= 5 ? 'ACTIVO (Fog de Retención)' : 'DESACTIVADO'}</span></p>
              <p>Rotación Máxima: <span className="text-white font-bold">{round >= 3 ? `${isMobile ? 10 : 20} Grados` : '0'}</span></p>
            </div>
          </div>

        </div>

      </div>

    </div>
    </GameShell>
  );
}
