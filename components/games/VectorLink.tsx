// 📂 /components/games/VectorLink.tsx
// Quantum Semantic Engineer — Vector Link v2
// Arrastrá el concepto correcto al núcleo de validación para cerrar la brecha semántica.

'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Volume2, VolumeX, Zap, Crown, RotateCcw } from 'lucide-react';
import { useHaptic } from '@/hooks/use-haptic';

// ─── TIPOS ───

interface VectorLinkProps {
  onBack: () => void;
  currentUser: any;
  onRefreshUser: () => void;
}

interface Equation {
  equation: string;   // "Rey - Hombre + Mujer"
  answer: string;
  distractors: string[];
  phase: 1 | 2 | 3 | 4;
}

interface VectorNode {
  id: string;
  text: string;
  homeX: number;
  homeY: number;
  isAnswer: boolean;
  isDistractor: boolean;
}

// ─── BANCO DE ECUACIONES SEMÁNTICAS (50+ para evitar repetición temprana) ───

const EQUATIONS: Equation[] = [
  // FASE 1 — Calibración (analogías directas 1:1)
  { equation: "Célula : Organismo", answer: "Pared", distractors: ["Cemento", "Arcilla", "Casa", "Ventana"], phase: 1 },
  { equation: "Mapa : Territorio", answer: "Edificio", distractors: ["Ladrillo", "Arquitecto", "Cimiento", "Plano"], phase: 1 },
  { equation: "Sed : Agua", answer: "Comida", distractors: ["Dieta", "Chef", "Vitamina", "Hambre"], phase: 1 },
  { equation: "Llave : Puerta", answer: "Contraseña", distractors: ["Cerradura", "Candado", "Sistema", "Acceso"], phase: 1 },
  { equation: "Semilla : Árbol", answer: "Huevo", distractors: ["Planta", "Raíz", "Tierra", "Fruta"], phase: 1 },
  { equation: "Oxígeno : Respirar", answer: "Comida", distractors: ["Agua", "Aire", "Vida", "Energía"], phase: 1 },
  { equation: "Luz : Ver", answer: "Sonido", distractors: ["Oír", "Luz", "Ojo", "Foco"], phase: 1 },
  { equation: "Carbón : Diamante", answer: "Presión", distractors: ["Tiempo", "Calor", "Roca", "Brillo"], phase: 1 },
  { equation: "Pregunta : Respuesta", answer: "Problema", distractors: ["Duda", "Solución", "Ecuación", "Acertijo"], phase: 1 },
  { equation: "Martillo : Clavo", answer: "Destornillador", distractors: ["Tornillo", "Madera", "Carpintero", "Clavija"], phase: 1 },

  // FASE 2 — Flujo (operaciones semánticas)
  { equation: "Rey - Hombre + Mujer", answer: "Reina", distractors: ["Princesa", "Duquesa", "Realeza", "Corona"], phase: 2 },
  { equation: "Sol - Luz + Lluvia", answer: "Arcoíris", distractors: ["Nube", "Relámpago", "Agua", "Viento"], phase: 2 },
  { equation: "Médico + Enseñar", answer: "Maestro", distractors: ["Doctor", "Profesor", "Cirujano", "Científico"], phase: 2 },
  { equation: "Bosque - Árbol + Agua", answer: "Lago", distractors: ["Río", "Océano", "Lluvia", "Pantano"], phase: 2 },
  { equation: "Computadora - Cable + Señal", answer: "WiFi", distractors: ["Bluetooth", "Red", "Antena", "Router"], phase: 2 },
  { equation: "Volar - Alas + Hélices", answer: "Helicóptero", distractors: ["Avión", "Dron", "Jet", "Globo"], phase: 2 },
  { equation: "Pintor + Palabra", answer: "Escritor", distractors: ["Poeta", "Periodista", "Novelista", "Autor"], phase: 2 },
  { equation: "Nadar - Agua + Aire", answer: "Volar", distractors: ["Flotar", "Planear", "Ascender", "Elevar"], phase: 2 },
  { equation: "Noche - Oscuridad + Luz", answer: "Día", distractors: ["Amanecer", "Atardecer", "Mañana", "Tarde"], phase: 2 },
  { equation: "Cocinar - Fuego + Frío", answer: "Ensalada", distractors: ["Helado", "Sushi", "Ensalada", "Gazpacho"], phase: 2 },

  // FASE 3 — Interferencia (mayor abstracción)
  { equation: "Ola - Agua + Viento", answer: "Tormenta", distractors: ["Huracán", "Tsunami", "Vendaval", "Maremoto", "Tifón"], phase: 3 },
  { equation: "Tiempo - Reloj + Memoria", answer: "Experiencia", distractors: ["Recuerdo", "Historia", "Edad", "Sabiduría", "Pasado"], phase: 3 },
  { equation: "Música - Notas + Silencio", answer: "Pausa", distractors: ["Suspenso", "Calma", "Vacío", "Quietud", "Ritmo"], phase: 3 },
  { equation: "Datos - Ruido + Señal", answer: "Información", distractors: ["Conocimiento", "Mensaje", "Código", "Contenido", "Bit"], phase: 3 },
  { equation: "Fuego - Calor + Movimiento", answer: "Energía", distractors: ["Electricidad", "Fuerza", "Vapor", "Potencia", "Motor"], phase: 3 },
  { equation: "Ciudad - Ruido + Naturaleza", answer: "Campo", distractors: ["Jardín", "Parque", "Bosque", "Jardín", "Rural"], phase: 3 },
  { equation: "Laboratorio + Ciencia + Error", answer: "Descubrimiento", distractors: ["Invención", "Experimento", "Teoría", "Avance", "Fracaso"], phase: 3 },
  { equation: "Espejo - Imagen + Memoria", answer: "Recuerdo", distractors: ["Fotografía", "Retrato", "Sueño", "Reflejo", "Pensamiento"], phase: 3 },

  // FASE 4 — Colapso (múltiples pasos semánticos)
  { equation: "Calor + Agua + Movimiento", answer: "Vapor", distractors: ["Humedad", "Nube", "Niebla", "Ebullición", "Gas", "Sudor"], phase: 4 },
  { equation: "Libro - Páginas + Voz", answer: "Audiolibro", distractors: ["Podcast", "Radio", "Conferencia", "Narración", "Discurso", "Historia"], phase: 4 },
  { equation: "Cámara - Foto + Movimiento", answer: "Video", distractors: ["Película", "Animación", "Cine", "Secuencia", "Grabación", "Clip"], phase: 4 },
  { equation: "Puente + Río + Camino", answer: "Cruce", distractors: ["Conexión", "Paso", "Enlace", "Tránsito", "Trayecto", "Ruta"], phase: 4 },
  { equation: "Reloj + Arena + Gravedad", answer: "Cronómetro", distractors: ["Temporizador", "Clepsidra", "Péndulo", "Cronógrafo", "Minutero", "Tiempo"], phase: 4 },
  { equation: "Código + Lógica + Error", answer: "Debug", distractors: ["Bug", "Fallo", "Test", "Parche", "Revisión", "Análisis"], phase: 4 },
];

// ─── COMPONENTES INTERNOS ───

function ParticleCanvas({ active, cx, cy }: { active: boolean; cx: number; cy: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    const colors = ['#22d3ee', '#d946ef', '#8b5cf6', '#06b6d4', '#a855f7'];
    const particles = Array.from({ length: 80 }, () => ({
      x: (cx / 400) * canvas.width,
      y: (cy / 400) * canvas.height,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 12,
      life: 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 2 + Math.random() * 3,
    }));

    let frame: number;
    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= 0.018;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      if (alive) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [active, cx, cy]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-50 pointer-events-none rounded-xl" />;
}

function StabilityBar({ value }: { value: number }) {
  const hue = Math.round((value / 100) * 120); // 120 = green, 0 = red
  return (
    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden shrink-0">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: `hsl(${hue}, 80%, 50%)` }}
        animate={{ width: `${value}%` }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      />
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ───

export default function VectorLink({ onBack, currentUser, onRefreshUser }: VectorLinkProps) {
  // ─── ESTADOS ───
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'evaluating' | 'gameover'>('idle');
  const [phase, setPhase] = useState(1);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [stability, setStability] = useState(100);
  const [currentEq, setCurrentEq] = useState<Equation>(EQUATIONS[0]);
  const [nodes, setNodes] = useState<VectorNode[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFailure, setShowFailure] = useState(false);
  const [connectionTarget, setConnectionTarget] = useState<{ x: number; y: number } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  const haptic = useHaptic();
  const fieldRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const usedIndices = useRef<Set<number>>(new Set());
  const dragState = useRef<{ nodeId: string | null }>({ nodeId: null });

  // ─── PLAY SOUND ───
  const playSound = useCallback((type: 'success' | 'failure' | 'levelup') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtxRef.current;

    if (type === 'success') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(); osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'failure') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(); osc.stop(ctx.currentTime + 0.25);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.1);
      osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(); osc.stop(ctx.currentTime + 0.25);
    }
  }, [soundEnabled]);

  // ─── GENERAR POSICIONES DE NODOS ───
  const generateNodePositions = useCallback((eq: Equation, numNodes: number) => {
    const radius = Math.max(70, 130 - phase * 10);
    const centerX = 200;
    const centerY = 200;
    const nodes: VectorNode[] = [];
    const angleStep = (2 * Math.PI) / numNodes;
    // Correct answer position — random angle
    const correctAngle = Math.random() * 2 * Math.PI;

    for (let i = 0; i < numNodes; i++) {
      const angle = correctAngle + i * angleStep + (Math.random() - 0.5) * 0.3;
      const isAnswer = i === 0;
      const text = isAnswer ? eq.answer : eq.distractors[i - 1];
      nodes.push({
        id: `node-${i}`,
        text,
        homeX: centerX + Math.cos(angle) * radius,
        homeY: centerY + Math.sin(angle) * radius,
        isAnswer,
        isDistractor: !isAnswer,
      });
    }

    // Shuffle so answer isn't always at index 0
    for (let i = nodes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
    }

    return nodes;
  }, [phase]);

  // ─── SELECCIONAR ECUACIÓN (evitando repetición) ───
  const pickEquation = useCallback(() => {
    const available = EQUATIONS.filter(e => e.phase <= phase);
    if (available.length === 0) return EQUATIONS[0];

    // Preferir las menos usadas
    const scored = available.map((eq, i) => ({
      eq,
      score: usedIndices.current.has(EQUATIONS.indexOf(eq)) ? 1 : 0,
    }));
    scored.sort((a, b) => a.score - b.score);

    // Elegir aleatoriamente entre las no usadas, o todas si ya se usaron
    const candidates = scored.filter(s => s.score === 0);
    const pool = candidates.length > 0 ? candidates : scored;
    const chosen = pool[Math.floor(Math.random() * pool.length)].eq;
    usedIndices.current.add(EQUATIONS.indexOf(chosen));

    // Reset si ya se usaron todas
    if (usedIndices.current.size >= EQUATIONS.length * 0.7) {
      usedIndices.current.clear();
    }

    return chosen;
  }, [phase]);

  // ─── INICIAR RONDA ───
  const startRound = useCallback(() => {
    const eq = pickEquation();
    setCurrentEq(eq);
    const numNodes = 3 + eq.distractors.length; // answer + distractors
    const newNodes = generateNodePositions(eq, numNodes);
    setNodes(newNodes);
    setShowSuccess(false);
    setShowFailure(false);
    setConnectionTarget(null);
    dragState.current.nodeId = null;
    setGameState('playing');
    setTimerActive(false);
    setTimeLeft(0);

    // Timer solo en fases 2+
    if (phase >= 2) {
      const seconds = Math.max(6, 15 - round * 0.3);
      setTimeLeft(seconds);
      setTimerActive(true);
    }
  }, [phase, round, pickEquation, generateNodePositions]);

  // ─── TIMER ───
  useEffect(() => {
    if (!timerActive || gameState !== 'playing') return;
    if (timeLeft <= 0) {
      // Time's up — cuanta como error
      handleFail();
      return;
    }
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timerActive, timeLeft, gameState]);

  // ─── MANEJAR ACIERTO / ERROR ───
  const handleSuccess = useCallback(() => {
    if (gameState !== 'playing') return;
    setGameState('evaluating');
    setShowSuccess(true);
    setShowFailure(false);
    const streakBonus = Math.floor(streak / 3) * 50;
    const phaseMultiplier = phase;
    const timeBonus = phase >= 2 ? Math.max(0, Math.floor(timeLeft * 10)) : 0;
    const earned = 100 * phaseMultiplier + streakBonus + timeBonus;
    setScore(s => s + earned);
    setStreak(s => s + 1);
    setStability(s => Math.min(100, s + 5));
    playSound('success');
    haptic.success();

    // Connection ray to center
    const answerNode = nodes.find(n => n.isAnswer);
    if (answerNode) {
      setConnectionTarget({ x: answerNode.homeX, y: answerNode.homeY });
    }

    setTimeout(() => {
      setConnectionTarget(null);
      setShowSuccess(false);

      // Progresión de fase
      const newRound = round + 1;
      setRound(newRound);
      if (newRound >= 4 && phase < 4) {
        setPhase(p => Math.min(4, p + 1));
        playSound('levelup');
      }

      startRound();
    }, 800);
  }, [gameState, streak, phase, timeLeft, nodes, playSound, haptic, round, startRound]);

  const handleFail = useCallback(() => {
    if (gameState !== 'playing') return;
    setGameState('evaluating');
    setShowFailure(true);
    setShowSuccess(false);
    setStreak(0);
    const newStability = stability - (phase >= 3 ? 20 : 15);
    setStability(newStability);
    playSound('failure');
    haptic.error();

    if (newStability <= 0) {
      setTimeout(() => {
        setGameState('gameover');
        setShowFailure(false);
      }, 600);
    } else {
      setTimeout(() => {
        setShowFailure(false);
        startRound();
      }, 1000);
    }
  }, [gameState, stability, phase, playSound, haptic, startRound]);

  // ─── VALIDAR ARRASTRE ───
  const handleDrop = useCallback((nodeId: string, pixelDx: number, pixelDy: number) => {
    if (gameState !== 'playing') return;

    const field = fieldRef.current;
    if (!field) return;
    const fieldWidth = field.clientWidth;
    const scale = 400 / fieldWidth;

    // Find the node
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Convert pixel movement to SVG coordinates
    const svgDx = pixelDx * scale;
    const svgDy = pixelDy * scale;
    const finalX = node.homeX + svgDx;
    const finalY = node.homeY + svgDy;
    const dist = Math.sqrt((finalX - 200) ** 2 + (finalY - 200) ** 2);

    if (dist < 50) {
      if (node.isAnswer) {
        handleSuccess();
      } else {
        handleFail();
      }
    } else {
      // Too far from center — snap back, no penalty
      // The drag animation already handles the snap-back
    }
  }, [gameState, nodes, handleSuccess, handleFail]);

  // ─── INICIAR JUEGO ───
  const startGame = useCallback(() => {
    setPhase(1);
    setRound(0);
    setScore(0);
    setStreak(0);
    setStability(100);
    usedIndices.current.clear();
    startRound();
  }, [startRound]);

  // ─── ECUACIÓN FORMATEADA ───
  const equationParts = useMemo(() => {
    return currentEq.equation.split(/([+\-:])/).map(s => s.trim()).filter(Boolean);
  }, [currentEq]);

  // ─── RENDER ───
  return (
    <div
      className="w-full min-h-[100dvh] flex flex-col bg-[#0b1120] text-white select-none overflow-hidden font-sans"
      style={{ touchAction: 'manipulation' }}
    >
      {/* ═══ HEADER ═══ */}
      <header className="h-12 flex items-center justify-between px-4 shrink-0 border-b border-cyan-950/40">
        <button
          onClick={onBack}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] text-zinc-500 hover:text-cyan-400 transition-colors"
          style={{ touchAction: 'manipulation' }}
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-2">
          {gameState !== 'idle' && (
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-cyan-500/60">
              F{phase} · R{round + 1}
            </span>
          )}
          <h1 className="text-xs sm:text-sm font-black uppercase text-cyan-400 tracking-[0.2em] ml-2">
            Vector Link
          </h1>
        </div>

        <div className="flex items-center gap-1">
          {/* Timer display (fase 2+) */}
          {timerActive && (
            <span className={`text-[10px] font-mono font-bold tabular-nums ${timeLeft <= 3 ? 'text-red-400' : 'text-zinc-500'}`}>
              {timeLeft}s
            </span>
          )}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] text-zinc-500 hover:text-cyan-400 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </header>

      {/* ═══ BARRA DE ESTABILIDAD ═══ */}
      <div className="px-4 pt-3 pb-2 shrink-0 space-y-1">
        <StabilityBar value={stability} />
        <div className="flex justify-between text-[8px] font-mono text-zinc-600 uppercase tracking-wider">
          <span>Estabilidad Cuántica</span>
          <span>{Math.round(stability)}%</span>
        </div>
        <AnimatePresence>
          {showFailure && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="text-[10px] text-red-400 font-mono font-bold"
            >
              ⚡ COLAPSO PARCIAL — REORDENANDO VECTORES
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ ECUACIÓN SEMÁNTICA ═══ */}
      <div className="px-4 py-2 shrink-0">
        <div className="flex items-center justify-center gap-1.5 flex-wrap text-sm sm:text-base font-mono">
          {equationParts.map((part, i) => {
            const isOperator = ['+', '-', ':'].includes(part);
            return (
              <span
                key={i}
                className={`${
                  isOperator
                    ? 'text-cyan-500 font-black text-base'
                    : 'text-zinc-200 font-bold'
                }`}
              >
                {part}
              </span>
            );
          })}
          <span className="text-cyan-500 font-black text-base mx-1">→</span>
          <span className="px-3 py-1 rounded-lg border border-dashed border-cyan-500/40 bg-cyan-950/20 text-cyan-400 font-bold text-sm">
            [?]
          </span>
        </div>
      </div>

      {/* ═══ CAMPO DE VECTORES (SVG + DRAG) ═══ */}
      <div
        ref={fieldRef}
        className="flex-1 mx-4 mb-2 relative rounded-xl border border-zinc-800/60 bg-[#0a0e1a] overflow-hidden"
        style={{ minHeight: '260px' }}
      >
        {gameState === 'idle' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-16 h-16 rounded-full border-2 border-cyan-500/30 flex items-center justify-center"
            >
              <Zap size={28} className="text-cyan-400" />
            </motion.div>
            <p className="text-xs text-zinc-500 font-mono text-center max-w-[240px]">
              Arrastrá el concepto correcto al núcleo cuántico
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={startGame}
              className="px-8 h-12 rounded-xl border border-cyan-500/50 bg-cyan-950/20 text-cyan-400 font-bold text-sm uppercase tracking-widest hover:bg-cyan-950/40 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              Iniciar Calibración
            </motion.button>
          </div>
        ) : (
          <>
            {/* SVG de fondo */}
            <svg
              viewBox="0 0 400 400"
              className="absolute inset-0 w-full h-full"
              style={{ touchAction: 'none' }}
            >
              <defs>
                <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
                  <stop offset="60%" stopColor="#22d3ee" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </radialGradient>
                <filter id="neonGlow">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#22d3ee" floodOpacity="0.5" />
                </filter>
                <filter id="magentaGlow">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#d946ef" floodOpacity="0.5" />
                </filter>
                {/* Líneas de conexión decorativas */}
                <pattern id="gridDots" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="0.8" fill="#1e293b" />
                </pattern>
              </defs>

              {/* Background grid */}
              <rect width="400" height="400" fill="url(#gridDots)" />

              {/* Conexiones entre nodos (líneas decorativas de neón tenue) */}
              {nodes.map((n, i) => (
                <line
                  key={`line-${i}`}
                  x1={n.homeX}
                  y1={n.homeY}
                  x2={200}
                  y2={200}
                  stroke={n.isAnswer ? '#22d3ee' : '#1e293b'}
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                  opacity={0.3}
                />
              ))}

              {/* Núcleo de validación */}
              <circle cx="200" cy="200" r="60" fill="url(#coreGlow)" />
              <motion.circle
                cx="200"
                cy="200"
                r="30"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="1"
                opacity={0.6}
                animate={{ r: [28, 32, 28], opacity: [0.4, 0.8, 0.4] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
              />
              <motion.circle
                cx="200"
                cy="200"
                r="20"
                fill="#22d3ee"
                opacity={0.15}
                animate={{ r: [18, 22, 18] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              />
              <text x="200" y="204" textAnchor="middle" fill="#22d3ee" fontSize="10" fontWeight="bold" opacity={0.7}>
                VALIDAR
              </text>

              {/* Rayo de conexión en acierto */}
              {connectionTarget && (
                <motion.line
                  x1={connectionTarget.x}
                  y1={connectionTarget.y}
                  x2={200}
                  y2={200}
                  stroke="#22d3ee"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#neonGlow)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3 }}
                />
              )}
            </svg>

            {/* Nodos draggables (overlay de divs sobre SVG) */}
            {nodes.map(node => (
              <DraggableNode
                key={node.id}
                node={node}
                fieldRef={fieldRef}
                onDrop={handleDrop}
                gameState={gameState}
                phase={phase}
              />
            ))}

            {/* Partículas */}
            <ParticleCanvas active={showSuccess} cx={200} cy={200} />

            {/* Glitch overlay en error */}
            {showFailure && (
              <motion.div
                className="absolute inset-0 z-40 pointer-events-none"
                animate={{ opacity: [0, 0.15, 0, 0.1, 0] }}
                transition={{ duration: 0.4 }}
              >
                <div className="w-full h-full bg-red-500/10 mix-blend-overlay" />
              </motion.div>
            )}
          </>
        )}

        {/* Game Over Overlay */}
        <AnimatePresence>
          {gameState === 'gameover' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-[#0b1120]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="text-4xl"
              >
                <Crown size={48} className="text-cyan-400" />
              </motion.div>
              <h2 className="text-lg font-black uppercase tracking-widest text-cyan-400">Colapso Cuántico</h2>
              <p className="text-xs text-zinc-500 font-mono">
                Puntaje final: <span className="text-cyan-300 font-bold">{score}</span>
              </p>
              <p className="text-[10px] text-zinc-600 font-mono">
                Fase {phase} · {round} rondas · Mejor racha: {streak}
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={startGame}
                className="mt-4 px-6 h-12 rounded-xl border border-cyan-500/40 bg-cyan-950/20 text-cyan-400 font-bold text-xs uppercase tracking-widest hover:bg-cyan-950/40 transition-colors flex items-center gap-2"
                style={{ touchAction: 'manipulation' }}
              >
                <RotateCcw size={14} />
                Recalibrar
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ SCORE Y STREAK ═══ */}
      <div className="px-4 pb-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-xs font-mono text-zinc-500">
            <span className="text-cyan-400 font-bold">
              {score.toLocaleString()}
            </span>{' '}
            <span className="hidden sm:inline">QP</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {streak >= 3 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 text-[10px] font-black text-amber-400"
            >
              <Zap size={12} fill="#fbbf24" />
              x{Math.floor(streak / 3) + 1}
            </motion.div>
          )}
          <div className="text-[10px] font-mono text-zinc-600">
            Fase <span className="text-zinc-400">{phase}/4</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE DE NODO ARRASTRABLE ───

function DraggableNode({
  node,
  fieldRef,
  onDrop,
  gameState,
  phase,
}: {
  node: VectorNode;
  fieldRef: React.RefObject<HTMLDivElement | null>;
  onDrop: (nodeId: string, dx: number, dy: number) => void;
  gameState: string;
  phase: number;
}) {
  const isPlaying = gameState === 'playing';
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Oscilación para fase 3+
  const oscillate = phase >= 3 && node.isAnswer;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isPlaying) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
  }, [isPlaying]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isPlaying || !isDragging) return;
    setIsDragging(false);
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    // If dragged more than 10px, evaluate drop position
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      onDrop(node.id, dx, dy);
    }

    // Reset transform via ref
    if (nodeRef.current) {
      nodeRef.current.style.transform = '';
    }
  }, [isPlaying, isDragging, node.id, onDrop]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !nodeRef.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    nodeRef.current.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
  }, [isDragging]);

  // Convertir coordenadas SVG a porcentaje para posicionamiento
  const leftPct = `${(node.homeX / 400) * 100}%`;
  const topPct = `${(node.homeY / 400) * 100}%`;

  return (
    <motion.div
      ref={nodeRef}
      className="absolute z-30"
      style={{
        left: leftPct,
        top: topPct,
        transform: 'translate(-50%, -50%)',
        touchAction: 'none',
      }}
      {...(oscillate ? {
        animate: {
          x: [0, 8, -8, 4, -4, 0],
          y: [0, -6, 6, -3, 3, 0],
        },
        transition: {
          repeat: Infinity,
          duration: 3 + Math.random(),
          ease: 'easeInOut',
        },
      } : {})}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className={`
          flex items-center justify-center
          min-w-[48px] min-h-[48px]
          px-3 py-2
          rounded-xl
          text-xs sm:text-sm font-bold
          transition-shadow
          ${!isPlaying ? 'opacity-50' : ''}
          ${node.isAnswer
            ? 'border-2 border-emerald-500/30 bg-emerald-950/30 text-emerald-300'
            : 'border border-zinc-700/60 bg-zinc-900/80 text-zinc-300'
          }
          ${isDragging ? 'shadow-2xl shadow-cyan-500/30 scale-110 z-50' : 'shadow-lg shadow-black/30'}
          ${isPlaying ? 'cursor-grab active:cursor-grabbing' : ''}
        `}
        style={{
          touchAction: 'none',
          backdropFilter: 'blur(4px)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {node.text}
      </div>
    </motion.div>
  );
}
