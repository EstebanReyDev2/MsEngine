// 📂 /components/games/CafeExpreso.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';
import { 
  ArrowLeft, Play, Pause, RotateCcw, HelpCircle, 
  Volume2, VolumeX, Trophy, Sparkles, CheckCircle2, 
  XCircle, Zap, RefreshCw, Layers, Coffee, Flame, CupSoda, Snowflake
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
interface ActiveOrder {
  id: string;
  orderNum: string;
  timeLeft: number;
  maxTime: number;
  recipe: Record<string, number>; // ingredientId -> quantity
  title: string;
  status: 'active' | 'expiring';
}

interface PrepStation {
  id: number;
  assignedOrderId: string | null;  // linked order
  ingredients: Record<string, number>; // recipe gathered so far
  isBrewing: boolean;
  brewProgress: number; // 0 to 100
  isReady: boolean; // waiting for delivery
  lastActionError?: boolean;
}

interface InventoryState {
  stock: number;
  isRefilling: boolean;
  refillProgress: number; // 0 to 100
}

interface GameParticle {
  id: string;
  x: number;
  y: number;
  color: string;
  scale: number;
}

interface PointPopup {
  id: string;
  x: number;
  y: number;
  text: string;
  colorClass: string;
}

interface CafeExpresoProps {
  onBack: () => void;
  currentUser: any;
  onRefreshUser: () => void;
}

// Fixed Ingredients Definition
const INGREDIENTS = [
  { id: 'coffee', label: 'Café Grano', symbol: '☕', color: '#B45309', darkColor: 'bg-[#78350F]' },
  { id: 'milk', label: 'Sexto Leche', symbol: '🥛', color: '#38BDF8', darkColor: 'bg-[#0369A1]' },
  { id: 'sugar', label: 'Sirope Azúcar', symbol: '🍬', color: '#F8FAFC', darkColor: 'bg-[#475569]' },
  { id: 'caramel', label: 'Toffee Caramelo', symbol: '🍯', color: '#FBBF24', darkColor: 'bg-[#78350F]' },
  { id: 'cocoa', label: 'Polvo Cacao', symbol: '🍫', color: '#D97706', darkColor: 'bg-[#451A03]' },
  { id: 'ice', label: 'Hielo Iceberg', symbol: '❄️', color: '#22D3EE', darkColor: 'bg-[#0891B2]' }
];

interface RecipePreset {
  title: string;
  recipe: Record<string, number>;
}

// Flat lists of potential recipes
const RECIPE_PRESETS: RecipePreset[] = [
  { title: 'Expreso Simple', recipe: { coffee: 2 } },
  { title: 'Capuchino Dulce', recipe: { coffee: 1, milk: 2, sugar: 1 } },
  { title: 'Toffee Macchiato', recipe: { coffee: 1, milk: 1, caramel: 2 } },
  { title: 'Cacao Latte Helado', recipe: { coffee: 1, milk: 1, cocoa: 1, ice: 1 } },
  { title: 'Moka Glacé', recipe: { coffee: 2, milk: 1, cocoa: 1 } },
  { title: 'Expreso Extremo', recipe: { coffee: 3, sugar: 1 } },
  { title: 'Ice Vanilla Brew', recipe: { coffee: 1, sugar: 1, ice: 2 } }
];

// Pure deterministic generators declared outside the React hook scope to avoid compilation purity errors
function generateOrderId(): string {
  return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateOrderNumber(): string {
  return `O-${Math.floor(100 + Math.random() * 900)}`;
}

function selectRandomRecipe() {
  const idx = Math.floor(Math.random() * RECIPE_PRESETS.length);
  return RECIPE_PRESETS[idx];
}

function generateNewOrder(elapsedSeconds: number): ActiveOrder {
  const preset = selectRandomRecipe();
  // Speed scales with elapsed duration
  const baseTime = 40;
  const scalingFactor = Math.max(22, baseTime - Math.floor(elapsedSeconds / 6));
  
  return {
    id: generateOrderId(),
    orderNum: generateOrderNumber(),
    timeLeft: scalingFactor,
    maxTime: scalingFactor,
    recipe: { ...preset.recipe },
    title: preset.title,
    status: 'active'
  };
}

function generateStationParticles(stationX: number, stationY: number, color: string): GameParticle[] {
  const list: GameParticle[] = [];
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 10 + Math.random() * 45;
    list.push({
      id: `part_${Date.now()}_${i}_${Math.random()}`,
      x: stationX + Math.cos(angle) * distance,
      y: stationY + Math.sin(angle) * distance,
      color,
      scale: 0.5 + Math.random() * 0.8
    });
  }
  return list;
}

export default function CafeExpreso({ onBack, currentUser, onRefreshUser }: CafeExpresoProps) {
  // Game state
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'paused' | 'gameover'>('lobby');
  const [secondsLeft, setSecondsLeft] = useState<number>(90);
  const [score, setScore] = useState<number>(0);
  const [completedOrders, setCompletedOrders] = useState<number>(0);
  const [totalPlacedCount, setTotalPlacedCount] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showTutorial, setShowTutorial] = useState<boolean>(true);

  // Active Orders (Max 4 slots on top banner)
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);

  // Preparation Stations (4 fixed stations center)
  const [stations, setStations] = useState<PrepStation[]>([
    { id: 1, assignedOrderId: null, ingredients: { coffee: 0, milk: 0, sugar: 0, caramel: 0, cocoa: 0, ice: 0 }, isBrewing: false, brewProgress: 0, isReady: false },
    { id: 2, assignedOrderId: null, ingredients: { coffee: 0, milk: 0, sugar: 0, caramel: 0, cocoa: 0, ice: 0 }, isBrewing: false, brewProgress: 0, isReady: false },
    { id: 3, assignedOrderId: null, ingredients: { coffee: 0, milk: 0, sugar: 0, caramel: 0, cocoa: 0, ice: 0 }, isBrewing: false, brewProgress: 0, isReady: false },
    { id: 4, assignedOrderId: null, ingredients: { coffee: 0, milk: 0, sugar: 0, caramel: 0, cocoa: 0, ice: 0 }, isBrewing: false, brewProgress: 0, isReady: false }
  ]);

  // Inventory Stocks (Max 10)
  const [inventory, setInventory] = useState<Record<string, InventoryState>>({
    coffee: { stock: 10, isRefilling: false, refillProgress: 0 },
    milk: { stock: 10, isRefilling: false, refillProgress: 0 },
    sugar: { stock: 10, isRefilling: false, refillProgress: 0 },
    caramel: { stock: 10, isRefilling: false, refillProgress: 0 },
    cocoa: { stock: 10, isRefilling: false, refillProgress: 0 },
    ice: { stock: 10, isRefilling: false, refillProgress: 0 }
  });

  // Selected Ingredient for click fallback matching
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(null);

  // FX States
  const [particles, setParticles] = useState<GameParticle[]>([]);
  const [pointPopups, setPointPopups] = useState<PointPopup[]>([]);

  // Clock state tracker refs
  const gameLoopRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const spawnTimerAccumulator = useRef<number>(0);

  // Sound Synthesizer function
  const playSound = (freq: number, type: 'sine' | 'square' | 'triangle' | 'sawtooth' = 'sine', duration = 0.15) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Ignored audio restrictions fallback
    }
  };

  // Add floating point indicators
  const addPointPopup = (x: number, y: number, text: string, colorClass: string) => {
    setPointPopups(prev => [...prev, { id: `popup_${Date.now()}_${Math.random()}`, x, y, text, colorClass }]);
  };

  // Safe cleaner of point popups
  useEffect(() => {
    if (pointPopups.length > 0) {
      const timer = setTimeout(() => {
        setPointPopups(prev => prev.slice(1));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [pointPopups]);

  // Start the actual game run
  const startGame = () => {
    setGameState('playing');
    setSecondsLeft(90);
    setScore(0);
    setCompletedOrders(0);
    setTotalPlacedCount(0);
    setSelectedIngredient(null);
    setParticles([]);
    setPointPopups([]);
    
    // Initial 4 jars stocked
    setInventory({
      coffee: { stock: 10, isRefilling: false, refillProgress: 0 },
      milk: { stock: 10, isRefilling: false, refillProgress: 0 },
      sugar: { stock: 10, isRefilling: false, refillProgress: 0 },
      caramel: { stock: 10, isRefilling: false, refillProgress: 0 },
      cocoa: { stock: 10, isRefilling: false, refillProgress: 0 },
      ice: { stock: 10, isRefilling: false, refillProgress: 0 }
    });

    // Reset Stations
    setStations([
      { id: 1, assignedOrderId: null, ingredients: { coffee: 0, milk: 0, sugar: 0, caramel: 0, cocoa: 0, ice: 0 }, isBrewing: false, brewProgress: 0, isReady: false },
      { id: 2, assignedOrderId: null, ingredients: { coffee: 0, milk: 0, sugar: 0, caramel: 0, cocoa: 0, ice: 0 }, isBrewing: false, brewProgress: 0, isReady: false },
      { id: 3, assignedOrderId: null, ingredients: { coffee: 0, milk: 0, sugar: 0, caramel: 0, cocoa: 0, ice: 0 }, isBrewing: false, brewProgress: 0, isReady: false },
      { id: 4, assignedOrderId: null, ingredients: { coffee: 0, milk: 0, sugar: 0, caramel: 0, cocoa: 0, ice: 0 }, isBrewing: false, brewProgress: 0, isReady: false }
    ]);

    // Initial 2 Orders loaded right away
    const ord1 = generateNewOrder(0);
    const ord2 = generateNewOrder(5);
    setActiveOrders([ord1, ord2]);
    setTotalPlacedCount(2);

    playSound(523.25, 'triangle', 0.15); // C5
    setTimeout(() => playSound(659.25, 'triangle', 0.15), 100); // E5
    setTimeout(() => playSound(783.99, 'triangle', 0.25), 200); // G5
  };

  // Conclude game
  const endGame = (finalScore: number) => {
    setGameState('gameover');
    playSound(180, 'sawtooth', 0.5);

    // Database push setup
    if (currentUser) {
      try {
        supabaseClient.db.saveScore(
          currentUser.id, 
          'Café expreso', 
          finalScore, 
          Math.min(10, Math.floor(finalScore / 100) + 1)
        );
        onRefreshUser();
      } catch (err) {
        console.error('Error saving game index score:', err);
      }
    }
  };

  // Refill Ingredient Stock trigger
  const triggerRefill = (id: string) => {
    if (inventory[id].isRefilling) return;

    setInventory(prev => ({
      ...prev,
      [id]: { ...prev[id], isRefilling: true, refillProgress: 0 }
    }));

    playSound(380, 'square', 0.3);
  };

  // Select an ingredient jar to deposit on station click optionally
  const handleSelectJar = (id: string) => {
    // If it's refilling, prevent selection
    if (inventory[id].isRefilling) {
      playSound(150, 'sawtooth', 0.2);
      return;
    }
    // If stock is empty, automatically suggest refilling click!
    if (inventory[id].stock <= 0) {
      triggerRefill(id);
      return;
    }

    setSelectedIngredient(id);
    playSound(440, 'sine', 0.08);
  };

  // Deposit ingredient directly inside a chosen prep station
  const handleDepositStation = (stationId: number, clickedIngredientId?: string) => {
    const ingredientId = clickedIngredientId || selectedIngredient;
    if (!ingredientId) return;

    // Retrieve active inventory
    const currentItem = inventory[ingredientId];
    if (currentItem.stock <= 0 || currentItem.isRefilling) {
      playSound(150, 'sawtooth', 0.25);
      return;
    }

    const station = stations.find(s => s.id === stationId);
    if (!station) return;

    // Checks: station cannot accept ingredients if it's currently brewing or ready to serve
    if (station.isBrewing || station.isReady) {
      playSound(180, 'sawtooth', 0.2);
      // Brief error alert visual on station
      setStations(prev => prev.map(s => s.id === stationId ? { ...s, lastActionError: true } : s));
      setTimeout(() => {
        setStations(prev => prev.map(s => s.id === stationId ? { ...s, lastActionError: false } : s));
      }, 300);
      return;
    }

    // Process logic
    setStations(prev => prev.map(s => {
      if (s.id !== stationId) return s;

      // Decrement inventory stock count
      setInventory(inv => ({
        ...inv,
        [ingredientId]: { ...inv[ingredientId], stock: Math.max(0, inv[ingredientId].stock - 1) }
      }));

      // Gather current recipe list
      const nextIng = { ...s.ingredients, [ingredientId]: (s.ingredients[ingredientId] || 0) + 1 };
      
      // Look up if any of the active orders match this configuration OR if we can automatically bind to a compatible order!
      let boundOrderId = s.assignedOrderId;

      if (!boundOrderId) {
        // Try to find an order that can accommodate this ingredient and has no station assigned yet!
        const alreadySpentOrderIds = prev.map(st => st.assignedOrderId).filter(Boolean);
        const candidates = activeOrders.filter(ord => !alreadySpentOrderIds.includes(ord.id));
        
        // Find one where the recipe expects this ingredient
        const matchingOrd = candidates.find(ord => (ord.recipe[ingredientId] || 0) > 0);
        if (matchingOrd) {
          boundOrderId = matchingOrd.id;
          playSound(587.33, 'triangle', 0.1); // high chime to confirm order lock!
        }
      }

      // Check if all ingredients required for the bound order are fully met!
      let nowComplete = false;
      if (boundOrderId) {
        const order = activeOrders.find(o => o.id === boundOrderId);
        if (order) {
          // Compare complete recipe requirement count vs gathered count
          const isCompatible = Object.keys(order.recipe).every(ingKey => {
            const requiredNum = order.recipe[ingKey] || 0;
            const absoluteGatheredNum = nextIng[ingKey] || 0;
            return absoluteGatheredNum >= requiredNum;
          });
          if (isCompatible) {
            nowComplete = true;
          }
        }
      }

      // Visual particle blast feedback on deposit
      const colorGlow = INGREDIENTS.find(i => i.id === ingredientId)?.color || '#fff';
      const blastParticles = generateStationParticles(80 + stationId * 150, 420, colorGlow);
      setParticles(p => [...p, ...blastParticles]);
      setTimeout(() => {
        setParticles(p => p.filter(it => !blastParticles.includes(it)));
      }, 700);

      playSound(330, 'sine', 0.1);

      return {
        ...s,
        assignedOrderId: boundOrderId,
        ingredients: nextIng,
        // If recipe fully met, automatically start brewing!
        isBrewing: nowComplete ? true : false,
        brewProgress: 0
      };
    }));

    // Reset selected tracking pointer
    setSelectedIngredient(null);
  };

  // Reset/Empty a preparation station
  const clearStation = (stationId: number) => {
    setStations(prev => prev.map(s => {
      if (s.id !== stationId) return s;
      playSound(200, 'sawtooth', 0.2);
      return {
        ...s,
        assignedOrderId: null,
        ingredients: { coffee: 0, milk: 0, sugar: 0, caramel: 0, cocoa: 0, ice: 0 },
        isBrewing: false,
        brewProgress: 0,
        isReady: false
      };
    }));
  };

  // Serve the complete prepared coffee to target customer order
  const handleServeOrder = (stationId: number) => {
    const station = stations.find(s => s.id === stationId);
    if (!station || !station.isReady || !station.assignedOrderId) return;
    
    const targetOrderId = station.assignedOrderId;
    const order = activeOrders.find(o => o.id === targetOrderId);

    if (order) {
      // Completed calculation
      const bonusScore = Math.floor(15 + (order.timeLeft / order.maxTime) * 35); // faster is way better points!
      setScore(prev => prev + bonusScore);
      setCompletedOrders(prev => prev + 1);

      // Chime combo victory audio
      playSound(523.25, 'triangle', 0.1);
      setTimeout(() => playSound(659.25, 'triangle', 0.1), 80);
      setTimeout(() => playSound(880.00, 'triangle', 0.25), 160);

      // Flash success indicators on target station coordinates
      const targetStationX = 80 + stationId * 150;
      const cleanBlast = generateStationParticles(targetStationX, 360, '#10B981');
      setParticles(p => [...p, ...cleanBlast]);
      setTimeout(() => {
        setParticles(p => p.filter(it => !cleanBlast.includes(it)));
      }, 800);

      addPointPopup(targetStationX, 300, `+${bonusScore} PUNTOS`, 'text-emerald-400 font-extrabold font-mono text-sm');

      // Erase order
      setActiveOrders(prev => prev.filter(o => o.id !== targetOrderId));
    }

    // Clean station entirely for next run
    clearStation(stationId);
  };

  // Core Game Loop Effect Timer Updater
  useEffect(() => {
    if (gameState !== 'playing') {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = (timestamp - lastTimeRef.current) / 1000; // standard seconds tick
      lastTimeRef.current = timestamp;

      // Capped dt stabilizer
      const cappedDt = Math.min(dt, 0.1);

      // 1. Decline Timer Limit
      setSecondsLeft(prev => {
        const next = prev - cappedDt;
        if (next <= 0) {
          setTimeout(() => endGame(score), 50);
          return 0;
        }
        return next;
      });

      // 2. Refresh Inventory Jars Refilling Progress
      setInventory(prev => {
        const updated = { ...prev };
        let changed = false;

        Object.keys(updated).forEach(key => {
          const item = updated[key];
          if (item.isRefilling) {
            changed = true;
            // Refill takes speed rate
            const increment = (cappedDt / 2.5) * 100; // takes 2.5 seconds per jar
            const nextProgress = item.refillProgress + increment;

            if (nextProgress >= 100) {
              updated[key] = {
                stock: 10, // max stock reload
                isRefilling: false,
                refillProgress: 0
              };
              playSound(480, 'sine', 0.15); // finish notify sound
            } else {
              updated[key] = {
                ...item,
                refillProgress: nextProgress
              };
            }
          }
        });

        return changed ? updated : prev;
      });

      // 3. Process Stations Active Brewing progress
      setStations(prev => {
        let changed = false;
        const nextStations = prev.map(s => {
          if (s.isBrewing) {
            changed = true;
            // Brew takes 3.5 seconds
            const nextProgress = s.brewProgress + (cappedDt / 3.5) * 100;
            if (nextProgress >= 100) {
              playSound(640, 'triangle', 0.15); // hot coffee dripping done!
              return {
                ...s,
                isBrewing: false,
                brewProgress: 100,
                isReady: true
              };
            }
            return {
              ...s,
              brewProgress: nextProgress
            };
          }
          return s;
        });

        return changed ? nextStations : prev;
      });

      // 4. Update order cards timetables and spawn additions
      setActiveOrders(prevOrders => {
        const updated: ActiveOrder[] = [];
        let expiredActive = false;

        prevOrders.forEach(ord => {
          const nextTime = ord.timeLeft - cappedDt;
          if (nextTime <= 0) {
            // Expired order! Penalty applied
            setScore(scoreVal => Math.max(0, scoreVal - 15));
            expiredActive = true;
            playSound(120, 'sawtooth', 0.4); // mistake buzz noise

            // Detach stations that worked on this expired order id
            setStations(stList => stList.map(st => {
              if (st.assignedOrderId === ord.id) {
                return {
                  ...st,
                  assignedOrderId: null,
                  ingredients: { coffee: 0, milk: 0, sugar: 0, caramel: 0, cocoa: 0, ice: 0 },
                  isBrewing: false,
                  brewProgress: 0,
                  isReady: false
                };
              }
              return st;
            }));
          } else {
            updated.push({
              ...ord,
              timeLeft: nextTime,
              status: nextTime <= 10 ? 'expiring' : 'active'
            });
          }
        });

        return updated;
      });

      // 5. Spawn new orders periodically inside constraints (Max 4 active cards)
      spawnTimerAccumulator.current += cappedDt;
      // Duration scale factor speeds up orders rate
      const currentSecondsElapsed = 90 - secondsLeft;
      const spawnFrequencyLimit = Math.max(4.5, 9.0 - (currentSecondsElapsed / 90) * 4.0);

      if (spawnTimerAccumulator.current >= spawnFrequencyLimit) {
        spawnTimerAccumulator.current = 0;
        
        setActiveOrders(prevList => {
          if (prevList.length >= 4) return prevList; // wait for space on bar interface
          
          setTotalPlacedCount(v => v + 1);
          playSound(587.33, 'sine', 0.1);
          return [...prevList, generateNewOrder(currentSecondsElapsed)];
        });
      }

      gameLoopRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    gameLoopRef.current = requestAnimationFrame(loop);

    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState, score, secondsLeft, activeOrders]);

  // Derived indicator variables
  const efficiency = totalPlacedCount > 0 ? Math.round((completedOrders / totalPlacedCount) * 100) : 100;

  return (
    <div id="cafe-espresso-root" className="w-full max-w-[1050px] mx-auto bg-[#141414] text-[#F3F2EE] border-4 border-[#1A1A1A] p-4 md:p-6 select-none font-sans overflow-hidden relative">
      <div className="absolute inset-0 bg-stone-900/40 pointer-events-none" />
      
      {/* 📊 Top HUD Statistics & Control */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-stretch gap-4 pb-4 border-b border-[#F3F2EE]/10 mb-5">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 border border-white/10 hover:border-white/30 text-white/70 hover:text-white transition-all cursor-pointer rounded-none bg-white/5"
            title="Volver al Panel"
            id="espresso-back-btn"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[2px] text-[#FF5028] block">{"// DEPARTAMENTO COGNITIVO"}</span>
            <h1 className="text-xl font-bold font-mono text-white tracking-tight uppercase flex items-center gap-2">
              <Coffee className="text-[#FBBF24] animate-bounce" size={18} />
              <span>Café Expreso</span>
            </h1>
          </div>
        </div>

        {/* Level diagnostics readout */}
        <div className="grid grid-cols-4 gap-2 md:gap-4 flex-grow md:max-w-xl text-center font-mono">
          <div className="bg-white/5 border border-white/10 p-2">
            <span className="text-[8px] block text-white/50 uppercase tracking-wider">CRONÓMETRO</span>
            <span className="text-sm font-black text-rose-400">{Math.ceil(secondsLeft)} s</span>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <span className="text-[8px] block text-white/50 uppercase tracking-wider">SCORE</span>
            <span className="text-sm font-black text-emerald-400">{score}</span>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <span className="text-[8px] block text-white/50 uppercase tracking-wider">ENTREGAS</span>
            <span className="text-sm font-black text-[#00A3FF]">{completedOrders}</span>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <span className="text-[8px] block text-white/50 uppercase tracking-wider">EFICIENCIA</span>
            <span className="text-sm font-black text-amber-400">{efficiency}%</span>
          </div>
        </div>

        {/* Audio Toggle Options */}
        <div className="flex items-center gap-1.5 self-center">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 border border-white/10 hover:bg-white/5 text-[#F3F2EE]/70 hover:text-white cursor-pointer"
            id="espresso-sound-toggle-btn"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button 
            onClick={() => setShowTutorial(prev => !prev)}
            className="p-2.5 border border-white/10 hover:bg-white/5 text-[#F3F2EE]/70 hover:text-white cursor-pointer"
            id="espresso-help-btn"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {/* ☕ Main Stage Interactive Interface Column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10 items-start">
        
        {/* Playboard Column */}
        <div className="lg:col-span-9 space-y-5">
          
          <div className="bg-[#18181B] border border-white/10 p-4 relative min-h-[460px]">
            
            {/* LOBBY / SETUP STATUS */}
            <AnimatePresence>
              {gameState === 'lobby' && (
                <motion.div 
                  className="absolute inset-0 bg-[#121212]/98 text-center flex flex-col items-center justify-center p-6 z-30"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  id="espresso-lobby"
                >
                  <div className="max-w-md space-y-6">
                    <div className="w-16 h-16 rounded-none bg-[#78350F]/20 border-2 border-[#D97706] text-[#FBBF24] flex items-center justify-center mx-auto shadow-xl shadow-amber-900/10 animate-pulse">
                      <Coffee size={36} />
                    </div>
                    
                    <div className="space-y-1.5">
                      <h2 className="text-2xl font-black uppercase font-mono tracking-tight text-white">{"// CAFÉ EXPRESO — ALTA COMPLEJIDAD"}</h2>
                      <p className="font-serif italic text-xs text-white/60">
                        Coordinación sináptica de flujos múltiples en tiempo real. Gestiona recursos limitados bajo alerta de caducidad.
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/15 p-4 text-left font-mono text-xs space-y-2 text-white/80">
                      <p className="text-amber-400 font-bold uppercase text-center border-b border-white/10 pb-1.5">PARÁMETROS DE ATENCIÓN</p>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>⏱️ DURACIÓN: <span className="text-white font-bold">90 Segundos</span></div>
                        <div>🔌 ESTACIONES: <span className="text-white font-bold">4 Máquinas Activas</span></div>
                        <div>🔧 RECARGA: <span className="text-white font-bold">Interservicial</span></div>
                        <div>🧬 ENFOQUE: <span className="text-white font-bold">Atención Dividida</span></div>
                      </div>
                    </div>

                    <button 
                      onClick={startGame}
                      className="w-full py-4 bg-[#FF5028] text-white font-black text-sm uppercase tracking-wider rounded-none hover:bg-white hover:text-black transition-all border border-[#1A1A1A] cursor-pointer"
                    >
                      ACTIVAR INSTALACIÓN COMERCIAL
                    </button>
                  </div>
                </motion.div>
              )}

              {/* PAUSE OVERLAY */}
              {gameState === 'paused' && (
                <motion.div 
                  className="absolute inset-0 bg-[#121212]/95 text-center flex flex-col items-center justify-center p-6 z-30"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="max-w-xs space-y-4 font-mono">
                    <span className="text-amber-400 text-xs tracking-widest block animate-pulse">{"// PROCESAMIENTO DETENIDO"}</span>
                    <h3 className="text-lg font-black text-white uppercase">SISTEMA SUSPENDIDO</h3>
                    <div className="flex flex-col gap-2 pt-2">
                      <button 
                        onClick={() => setGameState('playing')}
                        className="py-3 bg-white text-black font-extrabold text-xs uppercase cursor-pointer hover:bg-amber-400 hover:text-black transition-all"
                      >
                        Reanudar Simulación
                      </button>
                      <button 
                        onClick={startGame}
                        className="py-3 bg-white/5 border border-white/10 hover:border-white/30 text-white font-extrabold text-xs uppercase cursor-pointer transition-all"
                      >
                        Reiniciar Máquinas
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* GAME OVER DIAGNOSTIC */}
              {gameState === 'gameover' && (
                <motion.div 
                  className="absolute inset-0 bg-[#121212]/98 text-center flex flex-col items-center justify-center p-6 z-30"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="max-w-sm space-y-5">
                    <div className="w-12 h-12 bg-white/5 border border-amber-500/30 text-[#FBBF24] flex items-center justify-center mx-auto rounded-none">
                      <Trophy size={26} />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[#FF5028] text-[9px] font-black uppercase tracking-widest block font-mono">{"// AUDITORÍA COMERCIAL FINAL"}</span>
                      <h2 className="text-2xl font-black font-mono text-white uppercase tracking-tight">Cierre de Inventario</h2>
                    </div>

                    <div className="bg-white/5 border border-white/10 p-5 rounded-none font-mono text-xs text-left space-y-2.5">
                      <div className="flex justify-between">
                        <span className="text-white/60">PUNTUACIÓN OBTENIDA:</span>
                        <span className="text-emerald-400 font-bold text-sm">{score} Puntos</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">TAZAS SERVIDAS:</span>
                        <span className="text-white font-bold">{completedOrders}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">EFICENCIA OPERATIVA:</span>
                        <span className="text-amber-400 font-bold">{efficiency}%</span>
                      </div>
                      <div className="flex justify-between border-t border-white/10 pt-2 text-[10px]">
                        <span className="text-white/40">SINCRO COGNITIVA CLOUD:</span>
                        <span className="text-blue-400 font-semibold">{currentUser?.is_guest ? 'LOCAL TEMP SESSION' : 'POSTGRES EXTREME DATA'}</span>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <button 
                        onClick={startGame}
                        className="flex-1 py-3.5 bg-[#FF5028] text-white font-black text-xs uppercase tracking-wider hover:bg-white hover:text-black transition-all border border-[#1A1A1A] cursor-pointer"
                      >
                        REANUDAR TURNO
                      </button>
                      <button 
                        onClick={onBack}
                        className="flex-1 py-3.5 bg-white/5 border border-white/10 hover:border-white/20 text-white font-black text-xs uppercase tracking-wider cursor-pointer"
                      >
                        SALIR DEL TEMPLO
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 📋 TOP ACTIVE ORDERS SLOT BAR (Max 4 orders side-by-side) */}
            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 bg-black/40 p-3 border border-white/5">
              {[0, 1, 2, 3].map(slotIndex => {
                const order = activeOrders[slotIndex];
                if (!order) {
                  return (
                    <div key={slotIndex} className="border border-white/5 bg-dashed h-28 flex flex-col items-center justify-center text-white/10 font-mono text-[9px] uppercase tracking-widest bg-zinc-950/20">
                      <span>{"[ VACANTE ]"}</span>
                    </div>
                  );
                }

                const progressPct = (order.timeLeft / order.maxTime) * 100;
                const isUrgent = order.timeLeft <= 10;

                return (
                  <motion.div 
                    key={order.id}
                    className={`border p-2.5 font-mono text-left flex flex-col justify-between h-28 relative ${isUrgent ? 'border-rose-500 bg-rose-950/20' : 'border-white/15 bg-white/5'}`}
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                  >
                    <div>
                      {/* Sub id and display timers */}
                      <div className="flex justify-between items-center text-[9px] mb-1">
                        <span className="text-[#00A3FF] font-black">{order.orderNum}</span>
                        <span className={`font-black ${isUrgent ? 'text-rose-500 animate-pulse' : 'text-neutral-400'}`}>
                          {Math.ceil(order.timeLeft)}s
                        </span>
                      </div>
                      <h4 className="text-[11px] font-black text-white truncate max-w-full uppercase">{order.title}</h4>
                      
                      {/* Recipe required list */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(order.recipe).map(([ingId, count]) => {
                          const ingredientInfo = INGREDIENTS.find(i => i.id === ingId);
                          return (
                            <span 
                              key={ingId} 
                              className="text-[9px] px-1 bg-black/40 border border-white/10 rounded-sm text-amber-300"
                              title={ingredientInfo?.label}
                            >
                              {ingredientInfo?.symbol} x{count}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Progress visual line */}
                    <div className="w-full bg-stone-800 h-1 mt-2.5">
                      <div 
                        className={`h-full transition-all duration-300 ${isUrgent ? 'bg-rose-500' : 'bg-[#00A3FF]'}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* 🧪 MIDDLE PREPARATION STATIONS (4 interactive vertical zones) */}
            <h3 className="text-[10px] font-black tracking-widest text-[#FF5028] font-mono mb-2 uppercase">{"// ESTACIONES DE PREPARACIÓN DE CAFÉ"}</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stations.map(station => {
                const isAssigned = !!station.assignedOrderId;
                const relevantOrder = activeOrders.find(o => o.id === station.assignedOrderId);
                const isError = station.lastActionError;

                return (
                  <div 
                    key={station.id}
                    onClick={() => handleDepositStation(station.id)}
                    className={`border p-3 transition-colors relative flex flex-col justify-between min-h-[220px] cursor-pointer ${
                      isError ? 'bg-rose-950/50 border-rose-500 animate-shake' : 
                      selectedIngredient ? 'border-amber-500/50 hover:border-amber-500 bg-amber-500/5' : 
                      isAssigned ? 'border-[#00A3FF]/40 bg-zinc-900' : 'border-white/10 bg-black/20'
                    }`}
                  >
                    {/* Head Header nozzle */}
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="text-[9px] font-mono font-black text-white/50">ESTACIÓN_0{station.id}</span>
                      
                      {isAssigned && (
                        <span className="text-[9px] bg-[#00A3FF] px-1.5 py-0.5 font-bold text-black rounded-sm font-mono tracking-tighter">
                          {relevantOrder?.orderNum || 'LINK_ERR'}
                        </span>
                      )}
                    </div>

                    {/* Visual cup with ingredients stacked in bubble graph */}
                    <div className="my-3 flex flex-col items-center justify-center relative py-2">
                      
                      {/* Interactive Clear Button */}
                      {isAssigned && !station.isBrewing && !station.isReady && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            clearStation(station.id);
                          }}
                          className="absolute right-0 top-0 text-[8px] bg-white/10 hover:bg-[#FF5028] text-white px-1 py-0.5 font-mono cursor-pointer"
                          title="Vaciar vaso"
                        >
                          ✕ LIMP
                        </button>
                      )}

                      {/* Nozzle liquid dripping SVG icon */}
                      <div className="w-8 h-8 flex items-center justify-center text-white/20">
                        {station.isBrewing ? (
                          <motion.div 
                            className="text-amber-500"
                            animate={{ y: [0, 4, 0] }}
                            transition={{ repeat: Infinity, duration: 0.6 }}
                          >
                            <Zap size={14} />
                          </motion.div>
                        ) : station.isReady ? (
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        ) : (
                          <div className="w-1.5 h-4 bg-stone-700 rounded-b" />
                        )}
                      </div>

                      {/* Real Cup/Glass UI element */}
                      <div className={`w-16 h-16 border-2 border-t-0 border-x-indigo-400/50 rounded-b-xl flex flex-col-reverse p-1.5 items-center gap-1 bg-stone-900/40 relative mt-2 ${station.isReady ? 'border-emerald-500 bg-emerald-950/25' : ''}`}>
                        
                        {/* Cup Content items list (mini dots layered) */}
                        <div className="flex flex-wrap items-center justify-center gap-1 w-full">
                          {Object.entries(station.ingredients).map(([ingId, count]) => {
                            if (count <= 0) return null;
                            const ingDef = INGREDIENTS.find(i => i.id === ingId);
                            
                            return (
                              <div 
                                key={ingId}
                                className="w-5 h-5 flex items-center justify-center text-[10px] bg-black/60 rounded-full border border-white/10"
                                title={`${ingDef?.label}: ${count}`}
                              >
                                {ingDef?.symbol}
                              </div>
                            );
                          })}
                        </div>

                        {/* Liquid steam when brewing */}
                        {station.isBrewing && (
                          <div className="absolute inset-x-0 bottom-0 bg-amber-900/50 h-3/4 rounded-b-lg flex flex-col items-center justify-center animate-pulse">
                            <span className="text-[7px] text-white font-mono animate-bounce">INFUSIÓN</span>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Footer Progress or Action Button */}
                    <div className="pt-2 border-t border-white/5 font-mono">
                      {station.isBrewing && (
                        <div>
                          <span className="text-[8px] text-amber-500 block mb-1 font-bold">PROCESANDO RECETA...</span>
                          <div className="w-full bg-stone-800 h-1.5">
                            <div className="h-full bg-amber-500" style={{ width: `${station.brewProgress}%` }} />
                          </div>
                        </div>
                      )}

                      {station.isReady && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleServeOrder(station.id);
                          }}
                          className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase cursor-pointer transition-all flex items-center justify-center gap-1 rounded-sm animate-pulse"
                        >
                          <CupSoda size={12} />
                          <span>SERVIR TAZA</span>
                        </button>
                      )}

                      {!station.isBrewing && !station.isReady && (
                        <div className="text-[9px] text-white/40 text-center py-1">
                          {isAssigned ? (
                            <div>
                              <span className="text-[#00A3FF] font-bold block">REQUERIDOS:</span>
                              <div className="flex gap-1 justify-center mt-1">
                                {relevantOrder && Object.entries(relevantOrder.recipe).map(([ingId, requiredCount]) => {
                                  const gathered = station.ingredients[ingId] || 0;
                                  const symbol = INGREDIENTS.find(i => i.id === ingId)?.symbol;
                                  return (
                                    <span key={ingId} className={gathered >= requiredCount ? 'text-emerald-400 font-bold' : 'text-stone-400'}>
                                      {symbol}{gathered}/{requiredCount}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <span className="italic block text-[9px]">Suelte ingredientes aquí</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Float messages display absolute layers overlay */}
            <div className="absolute inset-0 pointer-events-none z-25 overflow-hidden">
              {pointPopups.map(p => (
                <div 
                  key={p.id}
                  className={`absolute font-mono font-black text-xs ${p.colorClass}`}
                  style={{ left: `${p.x}px`, top: `${p.y}px` }}
                >
                  {p.text}
                </div>
              ))}
            </div>

          </div>

          {/* 📦 INGREDIENTS SOURCE SHELF CONTAINER (6 drag actions / double-clicks) */}
          <div className="bg-[#1C1C1E] border border-white/10 p-4">
            <div className="flex justify-between items-center mb-2 font-mono">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block font-sans">{"// LIBRERÍA DE INGREDIENTES INVENTARIALES"}</span>
              <span className="text-[9px] text-white/40">Haz clic para seleccionar y luego toca una tartera para verter</span>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {INGREDIENTS.map(ing => {
                const state = inventory[ing.id] || { stock: 10, isRefilling: false, refillProgress: 0 };
                const isSelected = selectedIngredient === ing.id;

                return (
                  <div 
                    key={ing.id}
                    onClick={() => handleSelectJar(ing.id)}
                    className={`border p-2.5 transition-all text-center relative cursor-pointer font-mono ${
                      state.isRefilling ? 'border-amber-400/20 bg-zinc-900/40 text-stone-500' :
                      isSelected ? 'border-amber-400 bg-amber-400/10 text-white' :
                      state.stock <= 0 ? 'border-rose-500/30 bg-rose-950/10 text-rose-300' : 'border-white/10 hover:border-white/20 bg-black/40 text-stone-300'
                    }`}
                  >
                    {/* Inner progress meter when refilling */}
                    {state.isRefilling && (
                      <div className="absolute inset-0 bg-black/80 flex flex-col justify-center items-center px-1">
                        <span className="text-[8px] text-amber-500 font-extrabold block mb-1">RECARGANDO...</span>
                        <div className="w-full bg-stone-800 h-1">
                          <div className="h-full bg-amber-400" style={{ width: `${state.refillProgress}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Stock counter indicators */}
                    <div className="flex justify-between items-center text-[9px] mb-1.5">
                      <span className={`px-1 rounded-sm text-black font-black uppercase text-[8px] ${ing.darkColor}`}>{ing.symbol}</span>
                      <span className={state.stock <= 2 ? 'text-rose-400 font-bold animate-pulse' : 'text-neutral-500'}>
                        {state.stock}/10
                      </span>
                    </div>

                    <h5 className="text-[10px] font-bold text-white uppercase mb-1">{ing.label}</h5>
                    
                    {/* Stock level representation pills */}
                    <div className="flex gap-0.5 justify-center mt-2">
                      {[...Array(5)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`h-1 w-2 rounded-sm ${i < Math.ceil(state.stock / 2) ? 'bg-amber-400' : 'bg-stone-800'}`} 
                        />
                      ))}
                    </div>

                    {/* Manual refill trigger button */}
                    {state.stock <= 2 && !state.isRefilling && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerRefill(ing.id);
                        }}
                        className="w-full py-0.5 bg-[#FF5028] hover:bg-white text-white hover:text-black font-black text-[8px] uppercase font-mono mt-2 cursor-pointer transition-colors"
                      >
                        RELLENAR
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* 📋 RIGHT METRICS & TUTORIAL PANEL */}
        <div className="lg:col-span-3 space-y-4">
          
          {showTutorial && (
            <div className="bg-[#FF5028]/10 border border-[#FF5028] p-5 relative overflow-hidden">
              <button 
                onClick={() => setShowTutorial(false)}
                className="absolute right-3 top-3 text-[10px] uppercase font-black tracking-widest text-[#FF5028] font-mono hover:underline cursor-pointer"
                id="espresso-close-tutorial"
              >
                ✕ Cerrar
              </button>

              <span className="text-[9px] font-black text-[#FF5028] uppercase tracking-widest block mb-2 font-mono">CONSOLA DE APRENDIZAJE</span>
              <h4 className="text-xs font-bold uppercase tracking-tight text-white mb-2 font-mono">{"// MANUAL DE BARISTA"}</h4>

              <ul className="text-[11px] font-mono space-y-3 leading-relaxed text-[#F3F2EE]/85">
                <li className="flex items-start gap-2">
                  <span className="text-[#FF5028] font-black">1.</span>
                  <span><strong>Lee la Receta:</strong> Observa la barra superior con 4 pedidos activos antes de que caduquen.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00A3FF] font-black">2.</span>
                  <span><strong>Carga Estaciones:</strong> Selecciona un tarro del estante inferior y toca una estación vaso para añadirlo.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-black">3.</span>
                  <span><strong>Proceso automático:</strong> Al verter el primer ingrediente correcto para un pedido, la máquina bloquea ese pedido.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-black">4.</span>
                  <span><strong>Alerta Stock:</strong> Si los tarros se vacían, pulsa <strong>RELLENAR</strong>; tardará 2.5s mientras atiendes otros vasos.</span>
                </li>
              </ul>
            </div>
          )}

          {/* Quick Stats Panel */}
          <div className="bg-white/5 border border-white/10 p-5 rounded-none font-mono space-y-3.5">
            <span className="text-[9px] font-sans font-black tracking-widest text-white/40 block">{"// CONTROL DE SISTEMAS"}</span>
            <h4 className="text-xs font-black uppercase text-amber-400 font-mono">METRADAS ESTÁNDAR</h4>

            <div className="text-xs space-y-2.5 text-white/80">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Total Pedidos:</span>
                <span className="font-bold text-white">{totalPlacedCount}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Tazas Servidas:</span>
                <span className="font-bold text-emerald-400">{completedOrders}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Racha Obtenida:</span>
                <span className="font-bold text-amber-400">{Math.floor(score / 45)} pts combo</span>
              </div>
            </div>
          </div>

          {/* Biométrica local register info */}
          <div className="bg-white/5 border border-white/10 p-5 rounded-none space-y-3 font-mono">
            <span className="text-[9px] font-black text-rose-400 block tracking-widest uppercase">{"// BIOMETRÍA TEMPLO"}</span>
            <div className="text-xs leading-relaxed text-white/50 space-y-1">
              <p>OPERADOR: <span className="text-white font-black">{currentUser?.username || 'Invitado del Templo'}</span></p>
              <p>RANGO CLARO: <span className="text-emerald-400 font-black">{currentUser?.cerebra_rank || 'INICIADO'}</span></p>
              <p>STORAGE: <span className="text-white/60 text-[10px]">{currentUser?.is_guest ? 'ALMACENADO LOCALMENTE' : 'SUPABASE CLOUD'}</span></p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
