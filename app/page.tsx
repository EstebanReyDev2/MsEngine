// 📂 /app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';
import AnalogPostProcessing from '@/components/effects/AnalogPostProcessing';
import TodayView from '@/components/TodayView';
import InsightsView from '@/components/InsightsView';
import ExercisesView from '@/components/ExercisesView';
import ProfileView from '@/components/ProfileView';
import PatternRecall from '@/components/games/PatternRecall';
import TrainOfThought from '@/components/games/TrainOfThought';
import { CafeExpresoRoot } from '@/components/games/cafe-expreso';
import NeuralHorizon from '@/components/games/NeuralHorizon';
import QuantumTrace from '@/components/games/QuantumTrace';
import ChronosSync from '@/components/games/ChronosSync';
import VectorCore from '@/components/games/VectorCore';
import CipherFlux from '@/components/games/CipherFlux';
import NexusShift from '@/components/games/NexusShift';
import CircuitForge from '@/components/games/CircuitForge';
import LexiconCore from '@/components/games/LexiconCore';
import VectorLink from '@/components/games/VectorLink';
import SemanticFirewall from '@/components/games/SemanticFirewall';
import { Calendar, BarChart2, Sparkles, Trophy, Settings, Brain, User } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'today' | 'insights' | 'practice' | 'profile' | 'game'>('today');
  const [currentGame, setCurrentGame] = useState<string>('spatial');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [customUsername, setCustomUsername] = useState('');

  // Sincronizar credentials on startup
  const refreshUser = async () => {
    const { user: curr } = await supabaseClient.auth.getUser();
    if (curr) {
      setUser(curr);
      setCustomUsername(curr.username);
    } else {
      // Automatic anonymous guest login for 100% friction-free access
      const { user: guest } = await supabaseClient.auth.signInAnonymously();
      setUser(guest);
      if (guest) setCustomUsername(guest.username);
    }
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      refreshUser();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleSignOut = async () => {
    setLoading(true);
    await supabaseClient.auth.signOut();
    await refreshUser();
    setActiveTab('today');
  };

  const handleUpdateUsername = () => {
    if (!customUsername.trim()) return;
    const db = JSON.parse(localStorage.getItem('mental_sanctuary_db') || '{}');
    if (db && db.currentUser) {
      db.currentUser.username = customUsername;
      const profile = db.profiles.find((p: any) => p.id === db.currentUser.id);
      if (profile) profile.username = customUsername;
      localStorage.setItem('mental_sanctuary_db', JSON.stringify(db));
      setUser(db.currentUser);
      setShowSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf9f6] flex flex-col items-center justify-center font-sans">
        <div className="w-12 h-12 rounded-full border-2 border-mint-deep border-t-transparent animate-spin" />
        <span className="text-xs font-mono text-ink-muted mt-4 uppercase tracking-widest">Sincronizando Santuario...</span>
      </div>
    );
  }

  // Immersive gameplay bypasses layout architecture
  if (activeTab === 'game') {
    return (
      <AnalogPostProcessing>
        {currentGame === 'express' ? (
          <CafeExpresoRoot 
            currentUser={user}
            onBack={() => setActiveTab('practice')}
            onRefreshUser={refreshUser}
          />
        ) : currentGame === 'thought' ? (
          <TrainOfThought 
            currentUser={user}
            onBack={() => setActiveTab('practice')}
            onRefreshUser={refreshUser}
          />
        ) : currentGame === 'horizon' ? (
          <NeuralHorizon 
            currentUser={user}
            onBack={() => setActiveTab('practice')}
            onRefreshUser={refreshUser}
          />
        ) : currentGame === 'quantum' ? (
          <QuantumTrace 
            currentUser={user}
            onBack={() => setActiveTab('practice')}
            onRefreshUser={refreshUser}
          />
        ) : currentGame === 'chronos' ? (
          <ChronosSync 
            currentUser={user}
            onBack={() => setActiveTab('practice')}
            onRefreshUser={refreshUser}
          />
        ) : currentGame === 'vcore' ? (
          <VectorCore
            currentUser={user}
            onBack={() => setActiveTab('practice')}
            onRefreshUser={refreshUser}
          />
        ) : currentGame === 'cipher' ? (
          <CipherFlux
            currentUser={user}
            onBack={() => setActiveTab('practice')}
            onRefreshUser={refreshUser}
          />
        ) : currentGame === 'nexus' ? (
          <NexusShift
            currentUser={user}
            onBack={() => setActiveTab('practice')}
            onRefreshUser={refreshUser}
          />
        ) : currentGame === 'circuit' ? (
          <CircuitForge
            currentUser={user}
            onBack={() => setActiveTab('practice')}
            onRefreshUser={refreshUser}
          />
        ) : currentGame === 'lexicon' ? (
          <LexiconCore
            currentUser={user}
            onBack={() => setActiveTab('practice')}
            onRefreshUser={refreshUser}
          />
        ) : currentGame === 'vcore' ? (
          <VectorCore
            currentUser={user}
            onBack={() => setActiveTab('practice')}
            onRefreshUser={refreshUser}
          />
        ) : currentGame === 'vlink' ? (
          <VectorLink
            currentUser={user}
            onBack={() => setActiveTab('practice')}
            onRefreshUser={refreshUser}
          />
        ) : currentGame === 'semantic' ? (
          <SemanticFirewall
            currentUser={user}
            onBack={() => setActiveTab('practice')}
            onRefreshUser={refreshUser}
          />
        ) : (
          <PatternRecall 
            currentUser={user}
            onBack={() => setActiveTab('practice')}
            onRefreshUser={refreshUser}
          />
        )}
      </AnalogPostProcessing>
    );
  }

  return (
    <AnalogPostProcessing>
      <div className="min-h-screen flex flex-col bg-[#D4D1CA] text-[#1A1A1A] selection:bg-[#FF5028] selection:text-white font-sans">
        
        {/* 🧭 Desktop top-bar & Mobile hybrid navbar */}
        <header className="sticky top-0 left-0 w-full z-30 bg-white/30 backdrop-blur-md border-b border-[#1A1A1A] h-16 flex items-center">
          <div className="max-w-[1120px] mx-auto w-full px-5 md:px-10 flex justify-between items-center">
            
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('today')}>
              <div className="w-8 h-8 rounded-none bg-[#1A1A1A] flex items-center justify-center text-white border border-[#1A1A1A]">
                <Brain size={16} fill="currentColor" />
              </div>
              <h1 className="text-base font-black text-[#1A1A1A] uppercase tracking-wider font-sans">
                MS.ENGINE
              </h1>
            </div>

            {/* Desktop only direct link badges */}
            <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-[#1A1A1A]/60">
              <button 
                onClick={() => setActiveTab('today')}
                className={`hover:text-[#FF5028] cursor-pointer transition-colors ${activeTab === 'today' ? 'text-[#FF5028] font-extrabold border-b-2 border-[#1A1A1A] pb-1' : ''}`}
              >
                Hoy
              </button>
              <button 
                onClick={() => setActiveTab('insights')}
                className={`hover:text-[#FF5028] cursor-pointer transition-colors ${activeTab === 'insights' ? 'text-[#FF5028] font-extrabold border-b-2 border-[#1A1A1A] pb-1' : ''}`}
              >
                Espectro
              </button>
              <button 
                onClick={() => setActiveTab('practice')}
                className={`hover:text-[#FF5028] cursor-pointer transition-colors ${activeTab === 'practice' ? 'text-[#FF5028] font-extrabold border-b-2 border-[#1A1A1A] pb-1' : ''}`}
              >
                Práctica
              </button>
              <button 
                onClick={() => setActiveTab('profile')}
                className={`hover:text-[#FF5028] cursor-pointer transition-colors ${activeTab === 'profile' ? 'text-[#FF5028] font-extrabold border-b-2 border-[#1A1A1A] pb-1' : ''}`}
              >
                Registro
              </button>
            </nav>

            {/* Settings interactive switch */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="w-9 h-9 flex items-center justify-center border border-[#1A1A1A] bg-white/30 hover:bg-white/60 text-[#1A1A1A] transition-all active:scale-95 cursor-pointer"
              >
                <Settings size={18} />
              </button>
              <div 
                onClick={() => setActiveTab('profile')}
                className="w-8 h-8 bg-[#FF5028] text-white flex items-center justify-center font-black text-xs uppercase cursor-pointer border border-[#1A1A1A] hover:scale-105 transition-all"
              >
                {user?.username?.[0] || 'G'}
              </div>
            </div>

          </div>
        </header>

        {/* ⚙️ Under-header Settings Overlay Panel */}
        {showSettings && (
          <div className="bg-[#D4D1CA]/90 border-b border-[#1A1A1A] py-4 shadow-none backdrop-blur-md animate-fade-in z-20">
            <div className="max-w-[1120px] mx-auto px-5 md:px-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/60">Santuario Personalizado:</span>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={customUsername}
                    onChange={(e) => setCustomUsername(e.target.value)}
                    className="bg-white/40 hover:bg-white/65 focus:bg-white/80 border border-[#1A1A1A] px-3 py-1.5 rounded-none text-xs outline-none"
                    placeholder="Cambiar apodo"
                  />
                  <button 
                    onClick={handleUpdateUsername}
                    className="bg-[#1A1A1A] text-white text-xs px-4 py-1.5 rounded-none font-bold hover:bg-[#FF5028] cursor-pointer border border-[#1A1A1A]"
                  >
                    Guardar
                  </button>
                </div>
              </div>

              <div className="text-xs text-[#1A1A1A]/60 font-medium">
                Sesión: <span className="text-[#1A1A1A] font-semibold">{user?.is_guest ? 'Invitado Local (LocalStorage)' : 'Email Verificado (Cloud)'}</span>
              </div>
            </div>
          </div>
        )}

        {/* 🔮 Center Main Panel Layout */}
        <main className="flex-grow max-w-[1120px] mx-auto w-full px-5 md:px-10 py-8">
          {activeTab === 'today' && (
            <TodayView 
              currentUser={user}
              onStartGame={() => setActiveTab('practice')}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'insights' && (
            <InsightsView 
              currentUser={user}
            />
          )}

          {activeTab === 'practice' && (
            <ExercisesView 
              onStartGame={(gameId) => {
                setCurrentGame(gameId);
                setActiveTab('game');
              }}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView 
              currentUser={user}
              onSignOut={handleSignOut}
              onRefreshUser={refreshUser}
            />
          )}
        </main>

        {/* 🧭 Bottom Navigation Bar (Mobile only viewport) */}
        <nav className="fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-4 pb-safe pt-2.5 h-16 bg-[#D4D1CA]/90 backdrop-blur-md border-t border-[#1A1A1A] md:hidden">
          <button 
            onClick={() => setActiveTab('today')}
            className={`flex flex-col items-center justify-center flex-1 cursor-pointer transition-all ${activeTab === 'today' ? 'text-[#FF5028] font-black scale-105' : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'}`}
          >
            <Calendar size={18} />
            <span className="text-[9px] font-bold uppercase tracking-wider mt-1.5">Hoy</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('insights')}
            className={`flex flex-col items-center justify-center flex-1 cursor-pointer transition-all ${activeTab === 'insights' ? 'text-[#FF5028] font-black scale-105' : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'}`}
          >
            <BarChart2 size={18} />
            <span className="text-[9px] font-bold uppercase tracking-wider mt-1.5">Espectro</span>
          </button>

          <button 
            onClick={() => setActiveTab('practice')}
            className={`flex flex-col items-center justify-center flex-1 cursor-pointer transition-all ${activeTab === 'practice' ? 'text-[#FF5028] font-black scale-105' : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'}`}
          >
            <Brain size={18} />
            <span className="text-[9px] font-bold uppercase tracking-wider mt-1.5">Práctica</span>
          </button>

          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center flex-1 cursor-pointer transition-all ${activeTab === 'profile' ? 'text-[#FF5028] font-black scale-105' : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'}`}
          >
            <User size={18} />
            <span className="text-[9px] font-bold uppercase tracking-wider mt-1.5">Registro</span>
          </button>
        </nav>

        {/* Bezel padding spacer for Mobile Bottom Bar coverage */}
        <div className="h-16 md:hidden" />
        
      </div>
    </AnalogPostProcessing>
  );
}
