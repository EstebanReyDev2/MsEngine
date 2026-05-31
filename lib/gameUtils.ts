// 📂 /lib/gameUtils.ts
// Shared utilities: game name ↔ slug mapping, score normalization

/** Map display names (used in game components) to DB slugs (used in games table) */
const GAME_SLUG_MAP: Record<string, string> = {
  'Quantum Trace': 'quantum-trace',
  'Vector Link': 'vector-link',
  'Semantic Firewall': 'semantic-firewall',
  'Chronos Sync': 'chronos-sync',
  'Circuit Forge': 'circuit-forge',
  'Nexus Shift': 'nexus-shift',
  'Café expreso': 'cafe-expreso',
  'Café Expreso': 'cafe-expreso',
  'Lexicon Core': 'lexicon-core',
  'Pattern Recall': 'pattern-recall',
  'Neural Horizon': 'neural-horizon',
  'Train of Thought': 'train-of-thought',
  'Cipher Flux': 'cipher-flux',
  'Vector Core': 'vector-core',
};

export function getGameSlug(displayName: string): string | undefined {
  return GAME_SLUG_MAP[displayName];
}
