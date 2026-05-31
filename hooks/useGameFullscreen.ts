// 📂 /hooks/useGameFullscreen.ts
// Lock/unlock viewport scroll during gameplay on mobile.
// Must be called inside a 'use client' component.

import { useEffect, useRef } from 'react';

interface UseGameFullscreenOptions {
  /** Whether the game is actively playing (fullscreen locked) */
  active: boolean;
  /** Element ref to attempt native Fullscreen API on (optional) */
  elementRef?: React.RefObject<HTMLElement | null>;
}

/**
 * When `active` turns true:
 *   - Blocks document scroll (body fixed + overflow hidden)
 *   - Adds `.game-active` class to <html> and <body>
 *   - Optionally attempts native Fullscreen API
 *
 * When `active` turns false or component unmounts:
 *   - Restores all original body styles
 *   - Exits native fullscreen if active
 */
export function useGameFullscreen({ active, elementRef }: UseGameFullscreenOptions) {
  // Store original body state for restoration
  const originalRef = useRef({
    overflow: '',
    position: '',
    width: '',
    height: '',
    top: '',
    scrollY: 0,
  });

  useEffect(() => {
    if (active) {
      // Save original state only once (if not already saved)
      if (originalRef.current.overflow === '') {
        originalRef.current = {
          overflow: document.body.style.overflow,
          position: document.body.style.position,
          width: document.body.style.width,
          height: document.body.style.height,
          top: document.body.style.top,
          scrollY: window.scrollY,
        };
      }

      // Lock body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;

      // Add game-active class
      document.documentElement.classList.add('game-active');
      document.body.classList.add('game-active');

      // Attempt native Fullscreen API
      if (elementRef?.current && document.fullscreenEnabled) {
        elementRef.current.requestFullscreen().catch(() => {
          // Fullscreen API not available or denied → CSS fallback is enough
        });
      }

      // Prevent back gesture / pull-to-refresh via CSS
      document.body.style.overscrollBehavior = 'none';
    } else {
      // Restore body
      document.body.style.overflow = originalRef.current.overflow;
      document.body.style.position = originalRef.current.position;
      document.body.style.width = originalRef.current.width;
      document.body.style.height = originalRef.current.height;
      document.body.style.top = originalRef.current.top;
      document.body.style.overscrollBehavior = '';

      // Remove game-active class
      document.documentElement.classList.remove('game-active');
      document.body.classList.remove('game-active');

      // Scroll back to saved position
      window.scrollTo(0, originalRef.current.scrollY);

      // Reset saved state so next activation re-saves
      originalRef.current = { overflow: '', position: '', width: '', height: '', top: '', scrollY: 0 };

      // Exit native fullscreen if we entered it
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }

    return () => {
      // Cleanup on unmount: always restore
      if (active) {
        document.body.style.overflow = originalRef.current.overflow;
        document.body.style.position = originalRef.current.position;
        document.body.style.width = originalRef.current.width;
        document.body.style.height = originalRef.current.height;
        document.body.style.top = originalRef.current.top;
        document.body.style.overscrollBehavior = '';
        document.documentElement.classList.remove('game-active');
        document.body.classList.remove('game-active');
        window.scrollTo(0, originalRef.current.scrollY);

        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
  }, [active, elementRef]);
}
