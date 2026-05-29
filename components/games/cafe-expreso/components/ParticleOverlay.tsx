// ─── ParticleOverlay — Efectos visuales con canvas ───

'use client';

import { useEffect, useRef } from 'react';
import { useCafeStore } from '../store/cafeStore';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

export function ParticleOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completedOrders = useCafeStore(s => s.completedOrders);
  const score = useCafeStore(s => s.score);
  const triggerRef = useRef(0);

  useEffect(() => {
    if (completedOrders === 0 && score === 0) return;
    // Trigger on score increase (serve)
    if (score <= triggerRef.current) return;
    triggerRef.current = score;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = ['#22d3ee', '#10b981', '#fbbf24', '#f472b6', '#a78bfa'];
    const particles: Particle[] = [];
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1, maxLife: 0.6 + Math.random() * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 3,
      });
    }

    let frame: number;
    const animate = () => {
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.vy += 0.05; // gravity
        p.life -= 1 / (p.maxLife * 60);
        ctx!.globalAlpha = Math.max(0, p.life);
        ctx!.fillStyle = p.color;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, Math.max(0, p.size * p.life), 0, Math.PI * 2);
        ctx!.fill();
      }
      if (alive) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score, completedOrders]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-50 pointer-events-none"
      style={{ touchAction: 'none' }}
    />
  );
}
