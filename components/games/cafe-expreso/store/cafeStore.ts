// ─── ZUSTAND STORE — CafeExpreso ───

'use client';

import { create } from 'zustand';
import {
  type GameState, type GameAction, type IngredientId,
  createInitialState, advanceDay, tick, TOTAL_DAYS, DAY_CONFIGS,
} from '../engine';

interface CafeStore extends GameState {
  /** Encola una acción del jugador */
  dispatch: (action: GameAction) => void;
  /** Inicia un nuevo juego (desde lobby) */
  startNewGame: () => void;
  /** Alterna sonido */
  toggleSound: () => void;
  /** Alterna tutorial */
  toggleTutorial: () => void;
  /** El engine llama a esto en cada tick */
  _tick: (dt: number, actions: GameAction[]) => void;
  /** Cola de acciones pendientes (solo lectura para el engine) */
  _pendingActions: GameAction[];
}

const LOBBY_STATIONS = [1, 2, 3, 4].map(id => ({
  id, cupState: 'EMPTY' as const, assignedOrderId: null,
  ingredients: {}, brewProgress: 0, overflowTimer: 0, error: false,
}));

export const useCafeStore = create<CafeStore>((set, get) => ({
  // ─── Estado inicial (lobby) ───
  phase: 'lobby',
  soundEnabled: true,
  difficulty: 1,
  currentDay: 1,
  elapsedTime: 0,
  secondsLeft: 60,
  orders: [],
  totalOrdersPlaced: 0,
  stations: LOBBY_STATIONS,
  ingredients: {} as Record<IngredientId, { stock: number; refilling: boolean; refillProgress: number }>,
  score: 0,
  completedOrders: 0,
  streak: 0,
  showTutorial: true,
  selectedIngredient: null,
  pointPopups: [],
  dayResults: [],

  // ─── Acciones ───
  _pendingActions: [],

  dispatch: (action) => {
    // START_GAME y ADVANCE_DAY se procesan inmediatamente
    // (el loop no está corriendo en lobby ni day_transition)
    if (action.type === 'START_GAME') {
      const state = createInitialState(1);
      set({ ...state, _pendingActions: [] });
      return;
    }
    if (action.type === 'ADVANCE_DAY') {
      const state = get();
      const next = advanceDay(state);
      set({ ...next, _pendingActions: [] });
      return;
    }
    set(state => ({
      _pendingActions: [...state._pendingActions, action],
    }));
  },

  startNewGame: () => {
    const state = createInitialState(1);
    set({ ...state, _pendingActions: [] });
  },

  toggleSound: () => set(s => ({ soundEnabled: !s.soundEnabled })),
  toggleTutorial: () => set(s => ({ showTutorial: !s.showTutorial })),

  _tick: (dt, actions) => {
    const state = get();
    if (state.phase !== 'playing') return;
    const next = tick(state, dt, actions);

    // Si la fase cambió a day_transition, guardar resultado del día
    if (next.phase === 'day_transition' && state.phase === 'playing') {
      next.dayResults = [
        ...state.dayResults,
        {
          day: state.currentDay,
          score: next.score - state.score,
          ordersServed: next.completedOrders - state.completedOrders,
          streak: next.streak,
        },
      ];
    }

    // Si game over, guardar último día
    if (next.phase === 'gameover' && state.phase === 'playing') {
      next.dayResults = [
        ...state.dayResults,
        {
          day: state.currentDay,
          score: next.score - state.score,
          ordersServed: next.completedOrders - state.completedOrders,
          streak: next.streak,
        },
      ];
    }

    set({ ...next, _pendingActions: [] });
  },
}));

// ─── SELECTORS (usar SIEMPRE selectores individuales, no objetos) ───

export const selectTimer = (s: CafeStore) => s.secondsLeft;
export const selectOrders = (s: CafeStore) => s.orders;
export const selectStations = (s: CafeStore) => s.stations;
export const selectIngredients = (s: CafeStore) => s.ingredients;
export const selectStation =
  (id: number) =>
  (s: CafeStore) =>
    s.stations.find(st => st.id === id);
export const selectIngredient =
  (id: string) =>
  (s: CafeStore) =>
    s.ingredients[id as IngredientId];
export const selectPhase = (s: CafeStore) => s.phase;
export const selectSelectedIngredient = (s: CafeStore) => s.selectedIngredient;
export const selectPopups = (s: CafeStore) => s.pointPopups;
export const selectSound = (s: CafeStore) => s.soundEnabled;
export const selectTutorial = (s: CafeStore) => s.showTutorial;
export const selectDayTarget = (s: CafeStore) => DAY_CONFIGS[s.currentDay]?.targetOrders ?? 0;
