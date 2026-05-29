// 📂 /components/ExercisesView.tsx
'use client';

import React, { useState } from 'react';
import { Search, Heart, ShieldAlert, Sparkles, Trophy, Play } from 'lucide-react';

interface ExercisesViewProps {
  onStartGame: (gameId: string) => void;
}

export default function ExercisesView({ onStartGame }: ExercisesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>(['Beginner', 'Medium', 'Advanced']);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(['spatial', 'horizon', 'quantum']);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const toggleDifficulty = (dif: string) => {
    setSelectedDifficulties(prev => {
      if (prev.includes(dif)) {
        return prev.filter(d => d !== dif);
      } else {
        return [...prev, dif];
      }
    });
  };

  const exercises = [
    {
      id: 'spatial',
      title: 'Spatial Recall',
      category: 'Memory',
      difficulty: 'Medium',
      time: '3m',
      rating: '9.8',
      description: 'Memoriza destellos en matrices espaciales para entrenar tu lóbulo parietal.',
      icon: '🧠',
      isPlayable: true
    },
    {
      id: 'quantum',
      title: 'Quantum Trace',
      category: 'Memory',
      difficulty: 'Advanced',
      time: '2m',
      rating: '9.9',
      description: 'Rastrea y reproduce caminos secuenciales de nodos cuánticos bajo distractores de distorsión y rotación espacial.',
      icon: '🌀',
      isPlayable: true
    },
    {
      id: 'thought',
      title: 'Train of Thought',
      category: 'Flexibility',
      difficulty: 'Advanced',
      time: '3m',
      rating: '9.9',
      description: 'Guía trenes a sus estaciones correspondientes operando agujas de cambio en tiempo real.',
      icon: '🚂',
      isPlayable: true
    },
    {
      id: 'express',
      title: 'Café expreso',
      category: 'Flexibility',
      difficulty: 'Advanced',
      time: '1.5m',
      rating: '9.8',
      description: 'Atención dividida y coordinación preparando recetas dinámicas bajo presión comercial.',
      icon: '☕',
      isPlayable: true
    },
    {
      id: 'horizon',
      title: 'Neural Horizon',
      category: 'Speed',
      difficulty: 'Advanced',
      time: '2m',
      rating: '9.9',
      description: 'Atención dividida, velocidad de procesamiento sutil y Campo de Visión Útil radial cuántico.',
      icon: '🛰️',
      isPlayable: true
    },
    {
      id: 'task',
      title: 'Task Shifting',
      category: 'Flexibility',
      difficulty: 'Advanced',
      time: '5m',
      rating: '9.5',
      description: 'Alterna entre reglas lógicas cambiantes para forzar la agilidad sin perder precisión.',
      icon: '🔄',
      isPlayable: false
    },
    {
      id: 'reaction',
      title: 'Reaction Flow',
      category: 'Speed',
      difficulty: 'Beginner',
      time: '2m',
      rating: '9.2',
      description: 'Responde a flujos dinámicos de información aislando el ruido ambiental.',
      icon: '⚡',
      isPlayable: false
    },
    {
      id: 'chronos',
      title: 'Chronos Sync',
      category: 'Focus',
      difficulty: 'Advanced',
      time: '3m',
      rating: '9.9',
      description: 'El clásico Dual N-Back estructurado como un simulador táctico de sincronización de datos cuánticos.',
      icon: '⏳',
      isPlayable: true
    },
    {
      id: 'vcore',
      title: 'Vector Core',
      category: 'Focus',
      difficulty: 'Advanced',
      time: '2m',
      rating: '9.9',
      description: 'Filtro de Atención Selectiva adaptativo. Resiste la interferencia visual de distractores colaterales.',
      icon: '🎯',
      isPlayable: true
    },
    {
      id: 'cipher',
      title: 'Cipher Flux',
      category: 'Speed',
      difficulty: 'Medium',
      time: '2m',
      rating: '9.8',
      description: 'Entrenamiento de velocidad de procesamiento visual comparando matrices espejo con directivas cambiantes.',
      icon: '⚡',
      isPlayable: true
    },
    {
      id: 'nexus',
      title: 'Nexus Shift',
      category: 'Flexibility',
      difficulty: 'Advanced',
      time: '2m',
      rating: '9.9',
      description: 'Entrenamiento de flexibilidad cognitiva cambiando reglas de clasificación en tiempo real.',
      icon: '🔄',
      isPlayable: true
    },
    {
      id: 'circuit',
      title: 'Circuit Forge',
      category: 'Focus',
      difficulty: 'Advanced',
      time: '3m',
      rating: '9.8',
      description: 'Satisfacción de restricciones lógicas y diseño de circuitos cuánticos en red.',
      icon: '🔌',
      isPlayable: true
    },
    {
      id: 'lexicon',
      title: 'Lexicon Core',
      category: 'Logic',
      difficulty: 'Advanced',
      time: '3m',
      rating: '9.9',
      description: 'Deducción lógica formal y control de sesgo de creencia.',
      icon: '🧠',
      isPlayable: true
    },
    {
      id: 'vlink',
      title: 'Vector Link',
      category: 'Logic',
      difficulty: 'Advanced',
      time: '3m',
      rating: '9.9',
      description: 'Alineación vectorial y abstracción relacional.',
      icon: '🔗',
      isPlayable: true
    },
    {
      id: 'semantic',
      title: 'Semantic Firewall',
      category: 'Logic',
      difficulty: 'Advanced',
      time: '3m',
      rating: '9.8',
      description: 'Filtrado de falacias lógicas en transmisiones de datos corruptas.',
      icon: '🛡️',
      isPlayable: true
    }
  ];

  // Filtering logic
  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = ex.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          ex.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ex.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? ex.category === selectedCategory : true;
    const matchesDifficulty = selectedDifficulties.length === 0 ? true : selectedDifficulties.includes(ex.difficulty);
    const matchesFavorite = favoritesOnly ? favorites.includes(ex.id) : true;
    return matchesSearch && matchesCategory && matchesDifficulty && matchesFavorite;
  });

  return (
    <div className="animate-fade-in max-w-[1120px] mx-auto pb-12">
      
      {/* 🔮 Top Featured Exercise Hero featuring our newest creation: Neural Horizon */}
      <section className="relative overflow-hidden rounded-none bg-[#FF5028] text-white min-h-[360px] flex flex-col justify-end p-8 md:p-12 mb-10 group border-2 border-[#1A1A1A]">
        <div className="absolute inset-0 bg-transparent opacity-10 pointer-events-none z-0">
          <div className="w-full h-full bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:16px_16px]" />
        </div>

        <div className="relative z-20 w-full lg:w-2/3 space-y-4">
          <span className="inline-block px-3 py-1 rounded-none bg-white/30 text-white text-[9px] font-bold uppercase tracking-[1.5px] border border-white/50">
            ENTRENAMIENTO EXCLUSIVO (ACTIVO)
          </span>
          <h1 className="text-5xl md:text-7.5xl font-black leading-none uppercase tracking-tighter text-white font-sans">
            Neural Horizon
          </h1>
          <p className="font-serif italic text-sm text-white max-w-lg leading-relaxed">
            Nuestro módulo más avanzado de atención dividida y velocidad de procesamiento selectivo cuántico. Entrena tu Campo de Visión Útil radial bajo desvíos y ruido dinámico.
          </p>
          
          <button 
            onClick={() => onStartGame('horizon')}
            className="bg-[#1A1A1A] text-white px-8 py-3.5 mt-2 rounded-none font-bold text-xs hover:bg-white hover:text-[#1a1a1a] transition-all flex items-center gap-2 active:scale-95 border border-[#1a1a1a] cursor-pointer tracking-wider uppercase"
          >
            <Play size={14} fill="currentColor" />
            <span>PLAY NOW</span>
          </button>
        </div>
      </section>

      {/* 🛠️ Category filters & Search catalog section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* Left sidebar filters */}
        <aside className="md:col-span-3 space-y-6 bg-white/30 rounded-none border border-[#1A1A1A] p-5">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[1.5px] text-[#1A1A1A] block mb-3">{"// CATEGORÍAS"}</span>
            <ul className="space-y-1.5 text-xs font-semibold">
              <li>
                <button 
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-3 py-2 rounded-none transition-colors flex items-center justify-between cursor-pointer border ${selectedCategory === null ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'text-[#1A1A1A] hover:bg-white/40 border-transparent'}`}
                >
                  <span className="font-sans font-bold uppercase text-[10px] tracking-wide">TODAS LAS PRÁCTICAS</span>
                  <span className="text-[10px] font-mono opacity-70">
                    [{exercises.length}]
                  </span>
                </button>
              </li>
              {['Memory', 'Focus', 'Speed', 'Flexibility', 'Logic'].map(cat => (
                <li key={cat}>
                  <button 
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left px-3 py-2 rounded-none transition-colors flex items-center justify-between cursor-pointer border ${selectedCategory === cat ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'text-[#1A1A1A] hover:bg-white/40 border-transparent'}`}
                  >
                    <span className="font-sans font-bold uppercase text-[10px] tracking-wide">{cat === 'Memory' ? 'Cerebro / Memoria' : cat === 'Focus' ? 'Aislamiento / Enfoque' : cat === 'Speed' ? 'Tiempo / Velocidad' : cat === 'Flexibility' ? 'Agilidad / Cambio' : 'Lógica / Inferencia'}</span>
                    <span className="text-[10px] font-mono opacity-70">
                      [{exercises.filter(e => e.category === cat).length}]
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <hr className="border-[#1A1A1A]/15" />

          <div>
            <span className="text-[10px] font-black uppercase tracking-[1.5px] text-[#1A1A1A] block mb-3">{"// DIFICULTAD"}</span>
            <div className="space-y-2.5">
              {['Beginner', 'Medium', 'Advanced'].map(dif => (
                <label key={dif} className="flex items-center gap-2.5 text-xs text-[#1A1A1A] font-bold cursor-pointer group uppercase tracking-wider">
                  <input 
                    type="checkbox"
                    checked={selectedDifficulties.includes(dif)}
                    onChange={() => toggleDifficulty(dif)}
                    className="w-4 h-4 rounded-none border-[#1A1A1A] text-[#1A1A1A] focus:ring-0 cursor-pointer"
                  />
                  <span className="group-hover:text-[#FF5028] transition-colors">
                    {dif === 'Beginner' ? 'Inicial' : dif === 'Medium' ? 'Intermedio' : 'Avanzado'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <hr className="border-[#1A1A1A]/15" />

          <div className="flex items-center justify-between">
            <span className="text-xs text-[#1A1A1A] font-bold uppercase tracking-wider">Favoritos</span>
            <button 
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              className={`w-10 h-6 rounded-none border border-[#1A1A1A] relative p-0.5 transition-colors cursor-pointer ${favoritesOnly ? 'bg-[#FF5028]' : 'bg-white/40'}`}
            >
              <div className={`w-4 h-4 bg-[#1A1A1A] rounded-none transition-transform ${favoritesOnly ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </aside>

        {/* Exercises list column */}
        <div className="md:col-span-9 space-y-6">
          
          {/* Search bar & info matching mockup */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/30 border border-[#1A1A1A] p-2.5 rounded-none shadow-none">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/60" size={16} />
              <input 
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar prácticas..."
                className="w-full bg-white/50 border border-[#1A1A1A] rounded-none pl-9 pr-4 py-2 text-xs text-[#1A1A1A] placeholder-[#1A1A1A]/50 outline-none focus:bg-white transition-all font-sans font-bold"
              />
            </div>

            <div className="flex gap-2 items-center text-xs text-[#1A1A1A]/60 font-semibold font-mono">
              <span>FILTRO DE AGILIDAD:</span>
              <kbd className="bg-white/60 border border-[#1A1A1A] px-2 py-0.5 rounded-none font-mono text-[10px] text-[#1A1A1A]">ACTIVE</kbd>
            </div>
          </div>

          {/* Grid results */}
          {filteredExercises.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredExercises.map(ex => {
                const isFav = favorites.includes(ex.id);
                return (
                  <div 
                    key={ex.id}
                    onClick={() => ex.isPlayable && onStartGame(ex.id)}
                    className="bg-white/30 rounded-none border border-[#1A1A1A] p-5 flex flex-col justify-between group transition-all duration-300 shadow-none cursor-pointer hover:bg-white/50"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-5">
                        <div className="w-10 h-10 rounded-none bg-[#1A1A1A] text-white flex items-center justify-center text-lg border border-[#1A1A1A]">
                          {ex.icon}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {ex.isPlayable ? (
                            <span className="inline-block px-1.5 py-0.5 text-[8px] font-black bg-[#1A1A1A] text-[#10B981] border border-[#10B981] font-mono tracking-widest uppercase">
                              ACTIVO
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 text-[8px] font-bold bg-[#D4D1CA]/60 text-[#1A1A1A]/60 border border-[#1A1A1A]/20 font-mono tracking-widest uppercase">
                              SPOOL
                            </span>
                          )}
                          <button 
                            onClick={(e) => toggleFavorite(ex.id, e)}
                            className={`text-[#1A1A1A]/60 hover:text-[#FF5028] transition-colors p-1 rounded-none cursor-pointer ${isFav ? 'text-[#FF5028]' : ''}`}
                          >
                            <Heart size={16} fill={isFav ? "currentColor" : "none"} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 font-mono text-[9px] font-bold text-[#1A1A1A]/70">
                          <span className="uppercase">{ex.category}</span>
                          <span className="w-1 h-1 bg-[#1A1A1A]/60" />
                          <span className="uppercase text-[#FF5028]">{ex.difficulty}</span>
                        </div>
                        <h3 className="text-base font-extrabold text-[#1A1A1A] uppercase tracking-tight font-sans transition-colors group-hover:text-[#FF5028]">{ex.title}</h3>
                        <p className="font-serif italic text-xs text-[#1A1A1A]/70 line-clamp-2 leading-relaxed">
                          {ex.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-5 pt-3.5 border-t border-[#1A1A1A]/15 text-[11px] font-bold font-mono text-[#1A1A1A]/60">
                      <span className="flex items-center gap-1">⏱️ {ex.time}</span>
                      {ex.isPlayable ? (
                        <span className="text-[#FF5028] text-[9px] font-black tracking-wider uppercase group-hover:underline">
                          PLAY NOW →
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-[8px] font-bold tracking-wider uppercase">
                          CERRADO
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[#1A1A1A]">★ {ex.rating}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-white/30 border border-[#1A1A1A] rounded-none">
              <span className="text-3xl">🧩</span>
              <p className="text-sm font-bold text-[#1A1A1A] mt-3 uppercase tracking-wider">Ningún ejercicio coincide con tus filtros</p>
              <button 
                onClick={() => { setSelectedCategory(null); setSelectedDifficulties(['Beginner', 'Medium', 'Advanced']); setSearchQuery(''); setFavoritesOnly(false); }}
                className="mt-4 text-xs text-[#FF5028] font-bold hover:underline cursor-pointer uppercase tracking-wider"
              >
                Resetear búsquedas
              </button>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
