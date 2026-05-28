// 📂 /components/games/CircuitForge.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Volume2, VolumeX, CheckCircle2 } from 'lucide-react';

interface CircuitForgeProps {
  onBack: () => void;
  currentUser: any;
  onRefreshUser: () => void;
}

type Color = 'cyan' | 'magenta' | 'yellow' | 'empty';
const COLORS: Color[] = ['cyan', 'magenta', 'yellow', 'empty'];
const HEX: Record<Color, string> = {
  cyan: '#22d3ee',
  magenta: '#ec4899',
  yellow: '#eab308',
  empty: '#1f2937'
};

interface Node {
  id: number;
  x: number;
  y: number;
  color: Color;
  isFixed: boolean;
}

interface Connection {
  from: number;
  to: number;
}

interface Zone {
  nodeIds: number[];
  target: Record<Exclude<Color, 'empty'>, number>;
}

export default function CircuitForge({ onBack, currentUser, onRefreshUser }: CircuitForgeProps) {
  // Initialize level
  const [nodes, setNodes] = useState<Node[]>(() => [
    { id: 0, x: 100, y: 100, color: 'empty', isFixed: false },
    { id: 1, x: 300, y: 100, color: 'cyan', isFixed: true },
    { id: 2, x: 200, y: 250, color: 'empty', isFixed: false },
    { id: 3, x: 400, y: 250, color: 'empty', isFixed: false },
  ]);
  const [connections] = useState<Connection[]>([{ from: 0, to: 2 }, { from: 1, to: 2 }, { from: 2, to: 3 }]);
  const [zones] = useState<Zone[]>([{ nodeIds: [0, 2, 3], target: { cyan: 1, magenta: 1, yellow: 1 } }]);
  const [gameState, setGameState] = useState<'playing' | 'success'>('playing');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSynthesizerTone = useCallback((freq: number, type: OscillatorType, duration: number) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }, [soundEnabled]);

  const checkVictory = useCallback((newNodes: Node[]) => {
    const adjErrors = connections.filter(conn => {
      const nA = newNodes.find(n => n.id === conn.from);
      const nB = newNodes.find(n => n.id === conn.to);
      return nA?.color !== 'empty' && nB?.color !== 'empty' && nA?.color === nB?.color;
    });

    const zoneStatus = zones.map(zone => {
      const counts: Record<Exclude<Color, 'empty'>, number> = { cyan: 0, magenta: 0, yellow: 0 };
      zone.nodeIds.forEach(id => {
        const n = newNodes.find(n => n.id === id);
        if (n && n.color !== 'empty') counts[n.color]++;
      });
      return (['cyan', 'magenta', 'yellow'] as const).every(c => counts[c] === zone.target[c]);
    });

    if (adjErrors.length === 0 && zoneStatus.every(isMet => isMet) && newNodes.every(n => n.color !== 'empty')) {
      setGameState('success');
      playSynthesizerTone(660, 'sine', 0.2);
    }
  }, [connections, zones, playSynthesizerTone]);

  const handleNodeClick = (id: number) => {
    if (gameState === 'success') return;
    
    setNodes(prev => {
      const nextNodes = prev.map(node => {
        if (node.id === id && !node.isFixed) {
          const nextColor = COLORS[(COLORS.indexOf(node.color) + 1) % COLORS.length];
          playSynthesizerTone(node.color === 'empty' ? 440 : 550, 'sine', 0.1);
          return { ...node, color: nextColor };
        }
        return node;
      });
      checkVictory(nextNodes);
      return nextNodes;
    });
  };

  const adjErrors = useMemo(() => {
    return connections.filter(conn => {
      const nA = nodes.find(n => n.id === conn.from);
      const nB = nodes.find(n => n.id === conn.to);
      return nA?.color !== 'empty' && nB?.color !== 'empty' && nA?.color === nB?.color;
    });
  }, [nodes, connections]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 flex flex-col font-mono">
      <header className="flex justify-between items-center mb-8">
        <button onClick={onBack} className="text-neutral-500 hover:text-white flex items-center gap-2"><ArrowLeft size={16} /> [BACK]</button>
        <h1 className="text-2xl font-black uppercase text-cyan-400">Circuit Forge</h1>
        <button onClick={() => setSoundEnabled(!soundEnabled)}>{soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
      </header>

      <div className="grow flex items-center justify-center relative">
        <svg viewBox="0 0 500 400" className="w-full max-w-2xl">
          {connections.map((conn, i) => {
            const A = nodes.find(n => n.id === conn.from);
            const B = nodes.find(n => n.id === conn.to);
            const hasError = adjErrors.some(e => (e.from === conn.from && e.to === conn.to) || (e.from === conn.to && e.to === conn.from));
            return A && B && <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} className={hasError ? 'stroke-rose-600 stroke-[5px]' : 'stroke-neutral-700 stroke-[2px]'} />;
          })}
          {nodes.map(node => (
            <motion.circle 
              key={node.id} cx={node.x} cy={node.y} r={25}
              onClick={() => handleNodeClick(node.id)}
              className={`cursor-pointer transition-colors duration-300 ${node.isFixed ? 'stroke-neutral-500 stroke-[4px]' : 'stroke-white stroke-[2px]'}`}
              style={{ fill: HEX[node.color] }}
              whileHover={{ scale: 1.1 }}
            />
          ))}
        </svg>

        {gameState === 'success' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
            <div className="text-center">
              <CheckCircle2 size={64} className="text-emerald-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold uppercase">Circuit Validated</h2>
              <button className="mt-6 bg-cyan-600 px-6 py-2 rounded uppercase font-bold" onClick={onBack}>Complete</button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
