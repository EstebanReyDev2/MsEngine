// ─── RECETAS — 25 recetas en 3 tiers ───

export type RecipeTier = 'easy' | 'medium' | 'hard';

export interface Recipe {
  name: string;
  ingredients: Partial<Record<'coffee' | 'milk' | 'sugar' | 'caramel' | 'cocoa' | 'ice', number>>;
  tier: RecipeTier;
}

export const RECIPES: Recipe[] = [
  // ── TIER EASY (≤2 ingredientes) ──
  { name: 'Expreso Simple',     ingredients: { coffee: 2 },           tier: 'easy' },
  { name: 'Expreso Doble',      ingredients: { coffee: 3 },           tier: 'easy' },
  { name: 'Cortado Clásico',    ingredients: { coffee: 1, milk: 1 },  tier: 'easy' },
  { name: 'Espresso Macchiato', ingredients: { coffee: 2, milk: 1 },  tier: 'easy' },
  { name: 'Flat White',         ingredients: { coffee: 2, milk: 1 },  tier: 'easy' },

  // ── TIER MEDIUM (3 ingredientes) ──
  { name: 'Capuchino Dulce',    ingredients: { coffee: 1, milk: 2, sugar: 1 },    tier: 'medium' },
  { name: 'Latte Vainilla',     ingredients: { coffee: 1, milk: 2, sugar: 1 },    tier: 'medium' },
  { name: 'Toffee Macchiato',   ingredients: { coffee: 1, milk: 1, caramel: 2 },  tier: 'medium' },
  { name: 'Moka Glacé',         ingredients: { coffee: 2, milk: 1, cocoa: 1 },    tier: 'medium' },
  { name: 'Expreso Extremo',    ingredients: { coffee: 3, sugar: 1 },              tier: 'medium' },
  { name: 'Caramel Latte',      ingredients: { coffee: 1, milk: 2, caramel: 1 },   tier: 'medium' },
  { name: 'Ice Vanilla Brew',   ingredients: { coffee: 1, sugar: 1, ice: 2 },      tier: 'medium' },
  { name: 'Moccaccino',         ingredients: { coffee: 1, milk: 1, cocoa: 2 },     tier: 'medium' },
  { name: 'Latte Macchiato',    ingredients: { milk: 2, coffee: 1 },               tier: 'medium' },
  { name: 'Espresso Romano',    ingredients: { coffee: 2, sugar: 1 },              tier: 'medium' },
  { name: 'Cold Brew',          ingredients: { coffee: 2, ice: 2, sugar: 1 },      tier: 'medium' },
  { name: 'Latte Helado',       ingredients: { coffee: 1, milk: 2, ice: 1 },       tier: 'medium' },
  { name: 'Affogato',           ingredients: { coffee: 1, ice: 1, caramel: 1 },    tier: 'medium' },

  // ── TIER HARD (4+ ingredientes o combinaciones complejas) ──
  { name: 'Cacao Latte Helado', ingredients: { coffee: 1, milk: 1, cocoa: 1, ice: 1 },      tier: 'hard' },
  { name: 'Carajillo Glacé',    ingredients: { coffee: 2, ice: 2, sugar: 1 },               tier: 'hard' },
  { name: 'Triple Expresso',    ingredients: { coffee: 4 },                                  tier: 'hard' },
  { name: 'Bombón Helado',      ingredients: { coffee: 1, milk: 1, caramel: 1, ice: 1 },    tier: 'hard' },
  { name: 'Irish Coffee',       ingredients: { coffee: 2, sugar: 1, caramel: 1 },            tier: 'hard' },
  { name: 'Mocha Blanco',       ingredients: { coffee: 1, milk: 2, cocoa: 1, sugar: 1 },    tier: 'hard' },
  { name: 'Caramel Frappé',     ingredients: { coffee: 1, milk: 1, caramel: 2, ice: 2 },    tier: 'hard' },
];
