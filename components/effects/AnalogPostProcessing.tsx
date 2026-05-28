// 📂 /components/effects/AnalogPostProcessing.tsx
'use client';

import React, { useRef, useEffect, useState } from 'react';

interface AnalogPostProcessingProps {
  children?: React.ReactNode;
}

export default function AnalogPostProcessing({ children }: AnalogPostProcessingProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showGrain, setShowGrain] = useState(true);
  const [showCRT, setShowCRT] = useState(true);
  const [showScanlines, setShowScanlines] = useState(true);

  useEffect(() => {
    if (!showGrain) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth / 2); // downscale for performance
    let height = (canvas.height = window.innerHeight / 2);

    // Generate a reusable tiny noise stamp offscreen to minimize performance overhead
    const stampSize = 128;
    const stampCanvas = document.createElement('canvas');
    stampCanvas.width = stampSize;
    stampCanvas.height = stampSize;
    const stampCtx = stampCanvas.getContext('2d')!;
    const stampImgData = stampCtx.createImageData(stampSize, stampSize);

    const updateStamp = () => {
      const data = stampImgData.data;
      for (let i = 0; i < data.length; i += 4) {
        // High frequency white/black noise with soft opacity
        const noise = Math.random() * 255;
        data[i] = noise;     // R
        data[i + 1] = noise; // G
        data[i + 2] = noise; // B
        data[i + 3] = Math.random() < 0.15 ? 18 : 0; // high frequency granularity
      }
      stampCtx.putImageData(stampImgData, 0, 0);
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth / 2;
      height = canvas.height = window.innerHeight / 2;
    };

    window.addEventListener('resize', handleResize);

    // Frame-rate throttle helper (approx 24-30 fps for cinematic realism)
    let lastTime = 0;
    const interval = 1000 / 24; // 24 FPS is the cinematic sweet spot for film grain!

    const render = (time: number) => {
      animationId = requestAnimationFrame(render);

      if (time - lastTime < interval) return;
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      // Refresh stamp randomly to prevent pattern burn-in
      updateStamp();

      // Tile the stamp across the downscaled canvas with random offsets
      for (let x = 0; x < width; x += stampSize) {
        for (let y = 0; y < height; y += stampSize) {
          // Add organic microscopic shifts so the noise dances fluidly
          const xOffset = Math.floor(Math.random() * 16) - 8;
          const yOffset = Math.floor(Math.random() * 16) - 8;
          ctx.drawImage(stampCanvas, x + xOffset, y + yOffset);
        }
      }
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [showGrain]);

  return (
    <div className={`relative min-h-screen w-full overflow-hidden transition-all text-on-surface ${showCRT ? 'crt-glow' : ''}`}>
      {/* 📺 CRT Shaders overlay layers */}
      {showCRT && (
        <>
          {/* Edge shadow & Phosphor overlay */}
          <div className="pointer-events-none absolute inset-0 z-40 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_60%,rgba(27,34,30,0.45)_100%)]" />
          {/* Glass-screen bezel curvature lines */}
          <div className="pointer-events-none absolute inset-0 z-40 shadow-[inset_0_0_80px_rgba(0,37,51,0.15)]" />
        </>
      )}

      {/* 🎞️ Filmic Scanlines */}
      {showScanlines && (
        <div 
          className="pointer-events-none absolute inset-0 z-40 mix-blend-overlay opacity-[0.07]" 
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, #11232d 0px, #11232d 1.5px, transparent 1.5px, transparent 3px)'
          }}
        />
      )}

      {/* 🌀 Real-time WebGL Grain Fallback Canvas */}
      {showGrain && (
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 z-40 h-full w-full opacity-[0.7] mix-blend-color-burn"
          style={{ imageRendering: 'pixelated' }}
        />
      )}

      {/* Control console badge nicely nested in bottom corner of main layouts */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-hairline bg-surface/80 px-3 py-1.5 shadow-sm backdrop-blur-md text-[10px] text-ink-muted">
        <span className="font-semibold uppercase tracking-wider text-[9px] mr-1">Tuning Analógico:</span>
        <button 
          onClick={() => setShowGrain(!showGrain)}
          className={`px-2 py-0.5 rounded transition-colors ${showGrain ? 'bg-mint-deep/15 text-mint-deep font-semibold' : 'bg-surface-soft hover:bg-surface-container'}`}
        >
          Grano {showGrain ? 'ON' : 'OFF'}
        </button>
        <button 
          onClick={() => setShowCRT(!showCRT)}
          className={`px-2 py-0.5 rounded transition-colors ${showCRT ? 'bg-mint-deep/15 text-mint-deep font-semibold' : 'bg-surface-soft hover:bg-surface-container'}`}
        >
          CRT {showCRT ? 'ON' : 'OFF'}
        </button>
        <button 
          onClick={() => setShowScanlines(!showScanlines)}
          className={`px-2 py-0.5 rounded transition-colors ${showScanlines ? 'bg-mint-deep/15 text-mint-deep font-semibold' : 'bg-surface-soft hover:bg-surface-container'}`}
        >
          Líneas {showScanlines ? 'ON' : 'OFF'}
        </button>
      </div>

      {children}
    </div>
  );
}
