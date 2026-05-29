// 📂 /hooks/use-responsive-scale.ts
// Escala coordenadas SVG según viewport real para garantizar touch targets ≥ 44px

'use client';

import { useState, useEffect } from 'react';
import { useIsMobile } from './use-mobile';

interface ResponsiveScaleOptions {
  /** Ancho del viewBox SVG (ej: 1000) */
  baseWidth: number;
  /** Alto del viewBox SVG (ej: 700) */
  baseHeight: number;
  /** Radio mínimo para nodos interactivos en px CSS (default: 7) */
  minNodeRadius?: number;
  /** Radio mínimo táctil en px CSS (default: 22 = 44px diámetro) */
  minHitAreaRadius?: number;
  /** Factor de escala adicional para mobile (default: 1.6) */
  mobileScaleFactor?: number;
}

interface ResponsiveScaleResult {
  /** Escala X (viewport real / baseWidth) */
  scale: number;
  /** Escala individual X */
  scaleX: number;
  /** Escala individual Y */
  scaleY: number;
  /** Radio del nodo visual en px SVG */
  nodeRadius: number;
  /** Radio del hit area (táctil) en px SVG */
  hitAreaRadius: number;
  /** Si es mobile */
  isMobile: boolean;
  /** Ancho actual del contenedor en px */
  containerWidth: number;
  /** Factor aplicado a nodos en mobile */
  mobileFactor: number;
}

export function useResponsiveScale(options: ResponsiveScaleOptions): ResponsiveScaleResult {
  const {
    baseWidth,
    baseHeight,
    minNodeRadius = 7,
    minHitAreaRadius = 22,
    mobileScaleFactor = 1.6,
  } = options;

  const isMobile = useIsMobile();
  const [containerWidth, setContainerWidth] = useState(1024);

  useEffect(() => {
    const update = () => {
      // Estimamos el ancho disponible: 100vw menos padding (32px en mobile, 96px en desktop)
      const padding = isMobile ? 32 : 96;
      const available = Math.min(window.innerWidth - padding, 1050);
      setContainerWidth(Math.max(320, available));
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isMobile]);

  // Escala base: qué tan grande se ve el SVG en relación al viewBox
  const rawScale = containerWidth / baseWidth;
  
  // En mobile, agrandamos los nodos visuales
  const mobileFactor = isMobile ? mobileScaleFactor : 1;

  // El nodeRadius visual escala con el viewport pero con un mínimo
  const nodeRadius = Math.max(minNodeRadius, Math.round(minNodeRadius * rawScale * mobileFactor));

  // El hitAreaRadius debe garantizar 44px reales en pantalla
  // 44px / rawScale = cuánto necesitamos en coordenadas SVG para que se vea de 44px
  const hitAreaRadius = Math.max(
    minHitAreaRadius,
    Math.ceil(44 / rawScale)
  );

  return {
    scale: rawScale,
    scaleX: rawScale,
    scaleY: containerWidth * (baseHeight / baseWidth) / baseHeight,
    nodeRadius,
    hitAreaRadius,
    isMobile,
    containerWidth,
    mobileFactor,
  };
}
