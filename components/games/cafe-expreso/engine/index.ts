// ─── GAME ENGINE — CafeExpreso — Lógica pura, sin React ───
// Sistema de 3 días con dificultad progresiva y desbloqueo de estaciones.

import type { Recipe, RecipeTier } from '../data/recipes';
import { RECIPES } from '../data/recipes';
import { INGREDIENT_DEFS } from '../data/ingredients';

// ═══════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════

export type CupState = 'EMPTY' | 'ADDING_INGREDIENTS' | 'BREWING' | 'READY' | 'OVERFLOW' | 'TRASHED' | 'SERVED';
export type GamePhase = 'lobby' | 'playing' | 'paused' | 'day_transition' | 'gameover';
export type IngredientId = 'coffee' | 'milk' | 'sugar' | 'caramel' | 'cocoa' | 'ice';

export interface Order {
  id: string;
  orderNum: string;
  recipe: Recipe;
  timeLeft: number;
  maxTime: number;
  status: 'active' | 'expiring';
}

export interface Station {
  id: number;
  cupState: CupState;
  assignedOrderId: string | null;
  ingredients: Partial<Record<IngredientId, number>>;
  brewProgress: number;
  overflowTimer: number;
  error: boolean;
}

export interface IngredientStock {
  stock: number;
  refilling: boolean;
  refillProgress: number;
}

export interface Popup {
  id: string;
  x: number;
  y: number;
  text: string;
  variant: 'score' | 'penalty' | 'combo';
}

export interface DayResult {
  day: number;
  score: number;
  ordersServed: number;
  streak: number;
}

export interface DayConfig {
  day: number;
  duration: number;
  activeStations: number;
  allowedTiers: RecipeTier[];
  targetOrders: number;
  baseSpawnInterval: number;
  baseBrewTime: number;
  baseOrderTimeout: number;
  overflowGrace: number;
}

export interface DifficultyConfig {
  spawnInterval: number;
  brewTime: number;
  orderTimeout: number;
  maxActiveOrders: number;
  overflowGrace: number;
}

export interface GameState {
  phase: GamePhase;
  soundEnabled: boolean;
  difficulty: number;
  currentDay: number;
  elapsedTime: number;
  secondsLeft: number;
  orders: Order[];
  totalOrdersPlaced: number;
  stations: Station[];
  ingredients: Record<IngredientId, IngredientStock>;
  score: number;
  completedOrders: number;
  streak: number;
  showTutorial: boolean;
  selectedIngredient: IngredientId | null;
  pointPopups: Popup[];
  dayResults: DayResult[];
}

export type GameAction =
  | { type: 'SELECT_INGREDIENT'; ingredientId: IngredientId }
  | { type: 'DEPOSIT_INGREDIENT'; stationId: number }
  | { type: 'CLEAR_STATION'; stationId: number }
  | { type: 'SERVE_ORDER'; stationId: number }
  | { type: 'TRIGGER_REFILL'; ingredientId: IngredientId }
  | { type: 'ADVANCE_DAY' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'START_GAME' };

// ═══════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════

export const TOTAL_DAYS = 3;
export const MAX_STOCK = 10;
export const REFILL_DURATION = 2.5;

export const DAY_CONFIGS: Record<number, DayConfig> = {
  1: {
    day: 1,
    duration: 60,
    activeStations: 2,
    allowedTiers: ['easy'],
    targetOrders: 3,
    baseSpawnInterval: 7,
    baseBrewTime: 4,
    baseOrderTimeout: 50,
    overflowGrace: 12,
  },
  2: {
    day: 2,
    duration: 75,
    activeStations: 3,
    allowedTiers: ['easy', 'medium'],
    targetOrders: 5,
    baseSpawnInterval: 5.5,
    baseBrewTime: 3.2,
    baseOrderTimeout: 40,
    overflowGrace: 8,
  },
  3: {
    day: 3,
    duration: 90,
    activeStations: 4,
    allowedTiers: ['easy', 'medium', 'hard'],
    targetOrders: 7,
    baseSpawnInterval: 4,
    baseBrewTime: 2.5,
    baseOrderTimeout: 30,
    overflowGrace: 5,
  },
};

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

let orderCounter = 0;
function nextOrderId(): string {
  orderCounter++;
  return `O-${String(orderCounter).padStart(4, '0')}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRecipe(dayConfig: DayConfig): Recipe {
  const candidates = RECIPES.filter(r => dayConfig.allowedTiers.includes(r.tier));
  return candidates[randInt(0, candidates.length - 1)] || RECIPES[0];
}

function generateOrder(dayConfig: DayConfig): Order {
  const recipe = pickRecipe(dayConfig);
  const timeout = clamp(dayConfig.baseOrderTimeout, 20, 50);
  const name = recipe.name.slice(0, 4).toUpperCase();
  return {
    id: nextOrderId(),
    orderNum: `#${name}-${randInt(100, 999)}`,
    recipe: { ...recipe, ingredients: { ...recipe.ingredients } },
    timeLeft: timeout,
    maxTime: timeout,
    status: 'active',
  };
}

// ═══════════════════════════════════════════════════════════
// DIFICULTAD PROGRESIVA (intra-day)
// ═══════════════════════════════════════════════════════════

export function getDifficultyConfig(elapsedSeconds: number, dayConfig: DayConfig): DifficultyConfig {
  const level = Math.floor(elapsedSeconds / 15);
  return {
    spawnInterval: clamp(dayConfig.baseSpawnInterval - level * 0.4, 3, dayConfig.baseSpawnInterval),
    brewTime: clamp(dayConfig.baseBrewTime - level * 0.15, 1.8, dayConfig.baseBrewTime),
    orderTimeout: clamp(dayConfig.baseOrderTimeout - level * 2, 15, dayConfig.baseOrderTimeout),
    maxActiveOrders: dayConfig.activeStations,
    overflowGrace: clamp(dayConfig.overflowGrace - level * 0.5, 3, dayConfig.overflowGrace),
  };
}

// ═══════════════════════════════════════════════════════════
// ESTADO INICIAL
// ═══════════════════════════════════════════════════════════

export function createInitialState(day: number = 1): GameState {
  const dayConfig = DAY_CONFIGS[day];
  const ingredients = Object.fromEntries(
    INGREDIENT_DEFS.map(ing => [ing.id, { stock: MAX_STOCK, refilling: false, refillProgress: 0 }])
  ) as Record<IngredientId, IngredientStock>;

  const stations: Station[] = [];
  for (let i = 1; i <= dayConfig.activeStations; i++) {
    stations.push({
      id: i, cupState: 'EMPTY', assignedOrderId: null,
      ingredients: {}, brewProgress: 0, overflowTimer: 0, error: false,
    });
  }

  return {
    phase: 'playing',
    soundEnabled: true,
    difficulty: 1,
    currentDay: day,
    elapsedTime: 0,
    secondsLeft: dayConfig.duration,
    orders: [generateOrder(dayConfig), generateOrder(dayConfig)],
    totalOrdersPlaced: 2,
    stations,
    ingredients,
    score: 0,
    completedOrders: 0,
    streak: 0,
    showTutorial: true,
    selectedIngredient: null,
    pointPopups: [],
    dayResults: [],
  };
}

// ═══════════════════════════════════════════════════════════
// REDUCER — Procesa acción del jugador
// ═══════════════════════════════════════════════════════════

function reduce(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SELECT_INGREDIENT': {
      const ing = state.ingredients[action.ingredientId];
      if (!ing || ing.stock <= 0 || ing.refilling) return state;
      return {
        ...state,
        selectedIngredient: state.selectedIngredient === action.ingredientId ? null : action.ingredientId,
      };
    }

    case 'DEPOSIT_INGREDIENT': {
      const { stationId } = action;
      const selected = state.selectedIngredient;
      if (!selected) return state;
      const stock = state.ingredients[selected];
      if (!stock || stock.stock <= 0 || stock.refilling) return state;

      const station = state.stations.find(s => s.id === stationId);
      if (!station) return state;
      if (station.cupState === 'BREWING' || station.cupState === 'READY' || station.cupState === 'OVERFLOW' || station.cupState === 'SERVED') {
        return state;
      }

      const newStock = { ...state.ingredients, [selected]: { ...stock, stock: stock.stock - 1 } };
      const newIngredients = { ...station.ingredients, [selected]: (station.ingredients[selected] || 0) + 1 };

      // Auto-assign order if not yet assigned
      let assigned = station.assignedOrderId;
      if (!assigned) {
        const busy = new Set(state.stations.map(s => s.assignedOrderId).filter(Boolean));
        const free = state.orders.find(o => !busy.has(o.id));
        if (free) assigned = free.id;
      }

      // Check recipe complete → brewing
      const order = state.orders.find(o => o.id === assigned);
      let cupState: CupState = 'ADDING_INGREDIENTS';
      let brewProgress = 0;
      if (order) {
        const req = order.recipe.ingredients;
        const complete = Object.entries(req).every(([id, qty]) => (newIngredients[id as IngredientId] || 0) >= (qty || 0));
        if (complete) {
          cupState = 'BREWING';
        }
      }

      return {
        ...state,
        selectedIngredient: null,
        ingredients: newStock,
        stations: state.stations.map(s =>
          s.id === stationId
            ? { ...s, cupState, assignedOrderId: assigned, ingredients: newIngredients, brewProgress, error: false }
            : s.id === stationId ? { ...s, error: false } : s
        ),
      };
    }

    case 'CLEAR_STATION': {
      return {
        ...state,
        stations: state.stations.map(s =>
          s.id === action.stationId
            ? { id: s.id, cupState: 'EMPTY', assignedOrderId: null, ingredients: {}, brewProgress: 0, overflowTimer: 0, error: false }
            : s
        ),
      };
    }

    case 'SERVE_ORDER': {
      const station = state.stations.find(s => s.id === action.stationId);
      if (!station || station.cupState !== 'READY' || !station.assignedOrderId) return state;
      const order = state.orders.find(o => o.id === station.assignedOrderId);
      if (!order) return state;

      const timeRatio = order.timeLeft / order.maxTime;
      const comboMult = 1 + Math.floor(state.streak / 3) * 0.5;
      const points = Math.floor((100 + timeRatio * 50) * comboMult);

      return {
        ...state,
        score: state.score + points,
        completedOrders: state.completedOrders + 1,
        streak: state.streak + 1,
        orders: state.orders.filter(o => o.id !== station.assignedOrderId),
        stations: state.stations.map(s =>
          s.id === action.stationId
            ? { id: s.id, cupState: 'SERVED', assignedOrderId: null, ingredients: {}, brewProgress: 0, overflowTimer: 0, error: false }
            : s
        ),
        pointPopups: [
          ...state.pointPopups,
          {
            id: `pop-${Date.now()}-${Math.random()}`,
            x: 10 + station.id * 20,
            y: 30,
            text: state.streak >= 2 ? `+${points} 🔥x${state.streak + 1}` : `+${points}`,
            variant: state.streak >= 2 ? 'combo' : 'score',
          },
        ],
      };
    }

    case 'TRIGGER_REFILL': {
      const ing = state.ingredients[action.ingredientId];
      if (!ing || ing.refilling || ing.stock >= MAX_STOCK) return state;
      return {
        ...state,
        ingredients: {
          ...state.ingredients,
          [action.ingredientId]: { ...ing, refilling: true, refillProgress: 0 },
        },
      };
    }

    case 'ADVANCE_DAY':
      return advanceDay(state);

    case 'PAUSE':
      return { ...state, phase: 'paused' };

    case 'RESUME':
      return { ...state, phase: 'playing' };

    case 'START_GAME':
      return createInitialState(1);

    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════
// ADVANCE DAY
// ═══════════════════════════════════════════════════════════

export function advanceDay(state: GameState): GameState {
  const nextDay = state.currentDay + 1;
  const dayConfig = DAY_CONFIGS[nextDay];
  if (!dayConfig) return { ...state, phase: 'gameover' };

  // Resetear estaciones (solo las activas para el nuevo día)
  const stations: Station[] = [];
  for (let i = 1; i <= dayConfig.activeStations; i++) {
    stations.push({
      id: i, cupState: 'EMPTY', assignedOrderId: null,
      ingredients: {}, brewProgress: 0, overflowTimer: 0, error: false,
    });
  }

  // Re-stock completo
  const ingredients = Object.fromEntries(
    INGREDIENT_DEFS.map(ing => [ing.id, { stock: MAX_STOCK, refilling: false, refillProgress: 0 }])
  ) as Record<IngredientId, IngredientStock>;

  // Nuevas órdenes iniciales acorde al día
  const orders = [generateOrder(dayConfig), generateOrder(dayConfig)];

  return {
    ...state,
    currentDay: nextDay,
    phase: 'playing',
    secondsLeft: dayConfig.duration,
    elapsedTime: 0,
    orders,
    totalOrdersPlaced: state.totalOrdersPlaced + 2,
    stations,
    ingredients,
    selectedIngredient: null,
    pointPopups: [],
  };
}

// ═══════════════════════════════════════════════════════════
// AVANCE DE TIMERS
// ═══════════════════════════════════════════════════════════

function advanceTimers(state: GameState, dt: number): GameState {
  if (state.phase === 'day_transition' || state.phase === 'gameover') return state;

  let { secondsLeft, orders, stations, ingredients, pointPopups, elapsedTime } = state;
  let { score, streak } = state;

  const dayConfig = DAY_CONFIGS[state.currentDay];

  // 1. Timer global
  secondsLeft = Math.max(0, secondsLeft - dt);

  // 2. Órdenes: expiración
  const expiredIds: string[] = [];
  orders = orders.filter(o => {
    o = { ...o, timeLeft: o.timeLeft - dt };
    if (o.timeLeft <= 0) {
      expiredIds.push(o.id);
      score = Math.max(0, score - 15);
      streak = 0;
      return false;
    }
    o.status = o.timeLeft <= 10 ? 'expiring' : 'active';
    return true;
  });

  // Liberar estaciones vinculadas a órdenes expiradas
  if (expiredIds.length > 0) {
    stations = stations.map(s =>
      expiredIds.includes(s.assignedOrderId || '')
        ? { id: s.id, cupState: 'EMPTY' as const, assignedOrderId: null, ingredients: {}, brewProgress: 0, overflowTimer: 0, error: false }
        : s
    );
  }

  // 3. Estaciones: brewing + overflow
  const config = getDifficultyConfig(elapsedTime, dayConfig);
  stations = stations.map(s => {
    if (s.cupState === 'BREWING') {
      const next = s.brewProgress + (dt / config.brewTime) * 100;
      if (next >= 100) return { ...s, cupState: 'READY' as const, brewProgress: 100 };
      return { ...s, brewProgress: next };
    }
    if (s.cupState === 'READY') {
      const next = s.overflowTimer + dt;
      if (next >= config.overflowGrace) return { ...s, cupState: 'OVERFLOW' as const, overflowTimer: next };
      return { ...s, overflowTimer: next };
    }
    return s;
  });

  // 4. Inventario: refill
  ingredients = Object.fromEntries(
    Object.entries(ingredients).map(([id, ing]) => {
      if (!ing.refilling) return [id, ing];
      const next = ing.refillProgress + (dt / REFILL_DURATION) * 100;
      if (next >= 100) return [id, { stock: MAX_STOCK, refilling: false, refillProgress: 0 }];
      return [id, { ...ing, refillProgress: next }];
    })
  ) as Record<IngredientId, IngredientStock>;

  // 5. Spawn de nuevas órdenes
  let { totalOrdersPlaced } = state;
  if (orders.length < config.maxActiveOrders) {
    const spawnChance = dt / config.spawnInterval;
    if (Math.random() < spawnChance) {
      orders = [...orders, generateOrder(dayConfig)];
      totalOrdersPlaced++;
    }
  }

  // 6. Popups fade (keep last 5)
  pointPopups = pointPopups.slice(-5);

  // 7. Día completado o game over
  let phase: GamePhase = state.phase;
  if (secondsLeft <= 0) {
    if (state.currentDay < TOTAL_DAYS && state.completedOrders >= dayConfig.targetOrders) {
      phase = 'day_transition';
    } else {
      phase = 'gameover';
    }
  }

  return {
    ...state,
    secondsLeft,
    orders,
    stations,
    ingredients,
    score,
    streak,
    totalOrdersPlaced,
    elapsedTime: secondsLeft > 0 ? elapsedTime + dt : elapsedTime,
    pointPopups,
    phase,
  };
}

// ═══════════════════════════════════════════════════════════
// TICK PRINCIPAL
// ═══════════════════════════════════════════════════════════

export function tick(state: GameState, dt: number, actions: GameAction[]): GameState {
  if (state.phase !== 'playing') return state;
  let next = state;
  for (const action of actions) {
    next = reduce(next, action);
  }
  next = advanceTimers(next, dt);
  return next;
}
