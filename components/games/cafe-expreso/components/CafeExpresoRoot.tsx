// ─── CafeExpresoRoot — Orquestador principal ───

'use client';

import GameShell from '@/components/shared/GameShell';
import { ArrowLeft, Pause, Volume2, VolumeX } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useCafeStore, selectPhase, selectSound, selectPopups, selectTutorial } from '../store/cafeStore';
import { useHaptic } from '@/hooks/use-haptic';
import { useGameLoop } from '../hooks/useGameLoop';
import { useFeedbackEffects } from '../hooks/useFeedbackEffects';
import { AudioManager } from '../engine/AudioManager';
import { LobbyScreen } from './LobbyScreen';
import { PauseOverlay } from './PauseOverlay';
import { GameOverScreen } from './GameOverScreen';
import { HUD } from './HUD';
import { OrderBar } from './OrderBar';
import { StationGrid } from './StationGrid';
import { IngredientShelf } from './IngredientShelf';
import { PointPopup } from './PointPopup';
import { ParticleOverlay } from './ParticleOverlay';
import { DayTransitionScreen } from './DayTransitionScreen';

interface Props {
  onBack: () => void;
  currentUser: any;
  onRefreshUser: () => void;
}

export default function CafeExpresoRoot({ onBack, currentUser, onRefreshUser }: Props) {
  // Activar game loop y feedback
  useGameLoop();
  useFeedbackEffects();

  const phase = useCafeStore(selectPhase);
  const soundEnabled = useCafeStore(selectSound);
  const popups = useCafeStore(selectPopups);
  const showTutorial = useCafeStore(selectTutorial);
  const dispatch = useCafeStore(s => s.dispatch);
  const toggleSound = useCafeStore(s => s.toggleSound);
  const toggleTutorial = useCafeStore(s => s.toggleTutorial);
  const selectedIngredient = useCafeStore(s => s.selectedIngredient);

  const isPlaying = phase === 'playing';

  const handleBack = () => {
    AudioManager.getInstance().unlock();
    onBack();
  };

  return (
    <GameShell active={phase === 'playing'}>
    <div
      className="game-area w-full max-w-[1050px] mx-auto bg-[#141414] text-[#F3F2EE] border-4 border-[#1A1A1A] p-3 md:p-5 select-none font-sans overflow-hidden relative min-h-[100dvh] max-md:max-h-[100dvh] max-md:flex max-md:flex-col"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="absolute inset-0 bg-stone-900/40 pointer-events-none" />

      {/* ─── HEADER ─── */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-stretch gap-3 pb-3 border-b border-white/10 mb-4 max-md:flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 border border-white/10 hover:border-white/30 text-white/70 hover:text-white transition-all cursor-pointer bg-white/5 min-w-[44px] min-h-[44px] flex items-center justify-center"
            style={{ touchAction: 'manipulation' }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="text-[9px] font-black uppercase tracking-[2px] text-[#FF5028] block">
              {'// DEPARTAMENTO COGNITIVO'}
            </span>
            <h1 className="text-lg font-bold font-mono text-white tracking-tight uppercase flex items-center gap-2">
              Café Expreso
            </h1>
          </div>
        </div>

        {isPlaying && <HUD />}

        <div className="flex items-center gap-1.5 self-center shrink-0">
          {isPlaying && (
            <button
              onClick={() => dispatch({ type: 'PAUSE' })}
              className="p-2.5 border border-white/10 hover:bg-white/5 text-white/70 hover:text-white cursor-pointer"
              style={{ touchAction: 'manipulation' }}
            >
              <Pause size={16} />
            </button>
          )}
          <button
            onClick={toggleSound}
            className="p-2.5 border border-white/10 hover:bg-white/5 text-white/70 hover:text-white cursor-pointer"
            style={{ touchAction: 'manipulation' }}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            onClick={toggleTutorial}
            className="p-2.5 border border-white/10 hover:bg-white/5 text-white/70 hover:text-white cursor-pointer text-[10px] px-2 font-bold"
            style={{ touchAction: 'manipulation' }}
          >
            ?
          </button>
        </div>
      </div>

      {/* ─── OVERLAYS ─── */}
      <AnimatePresence>
        {phase === 'lobby' && <LobbyScreen />}
        {phase === 'paused' && <PauseOverlay />}
        {phase === 'day_transition' && <DayTransitionScreen />}
        {phase === 'gameover' && <GameOverScreen onBack={handleBack} />}
      </AnimatePresence>

      {/* ─── JUEGO (solo visible en playing) ─── */}
      {phase !== 'lobby' && (
        <div className="relative z-10 max-md:flex-1 max-md:min-h-0 max-md:flex max-md:flex-col md:space-y-4">
          {/* Popups flotantes + partículas */}
          {popups.map(p => (
            <PointPopup key={p.id} popup={p} />
          ))}
          <ParticleOverlay />

          {/* Órdenes */}
          <div className="max-md:flex-shrink-0">
            <OrderBar />
          </div>

          {/* Estaciones */}
          <div className="max-md:flex-1 max-md:min-h-0 max-md:overflow-hidden md:mb-4">
            <StationGrid />
          </div>

          {/* Ingredientes */}
          <div className="max-md:flex-shrink-0 md:mb-4">
            <IngredientShelf />
          </div>

          {/* Tutorial */}
          {showTutorial && phase === 'playing' && (
            <div className="bg-[#FF5028]/10 border border-[#FF5028] p-4 relative max-md:flex-shrink-0">
              <button
                onClick={toggleTutorial}
                className="absolute right-3 top-3 text-[9px] uppercase font-black tracking-widest text-[#FF5028] font-mono cursor-pointer"
                style={{ touchAction: 'manipulation' }}
              >
                ✕ Cerrar
              </button>
              <span className="text-[9px] font-black text-[#FF5028] uppercase tracking-widest block mb-1 font-mono">
                CONSOLA DE APRENDIZAJE
              </span>
              <ol className="text-[10px] font-mono space-y-1.5 text-white/80 list-decimal list-inside">
                <li><strong>Seleccioná</strong> un ingrediente del estante inferior.</li>
                <li><strong>Tocá</strong> una estación para depositarlo.</li>
                <li>Cuando la receta esté completa, la máquina <strong>prepara</strong> automáticamente.</li>
                <li><strong>Serví</strong> apenas esté lista para maximizar puntaje.</li>
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
    </GameShell>
  );
}
