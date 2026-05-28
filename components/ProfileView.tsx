// 📂 /components/ProfileView.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';
import { User, Medal, Trophy, Database, KeyRound, CheckSquare, LogOut } from 'lucide-react';

interface ProfileViewProps {
  currentUser: any;
  onSignOut: () => void;
  onRefreshUser: () => void;
}

export default function ProfileView({ currentUser, onSignOut, onRefreshUser }: ProfileViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [streak, setStreak] = useState(1);
  const [scores, setScores] = useState<any[]>([]);

  useEffect(() => {
    if (currentUser) {
      const t = setTimeout(() => {
        setScores(supabaseClient.db.getScores(currentUser.id));
        setStreak(supabaseClient.db.getStreak(currentUser.id).current_streak);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [currentUser]);

  const handleLinkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !username) {
      setErrMsg('Por favor, rellena todos los campos.');
      return;
    }
    setSyncStatus('loading');
    setErrMsg('');
    try {
      const { user, error } = await supabaseClient.auth.signUp(email, username);
      if (error) {
        setSyncStatus('failed');
        setErrMsg(error.message);
      } else {
        setSyncStatus('success');
        onRefreshUser(); // update main view profile
      }
    } catch (err) {
      setSyncStatus('failed');
      setErrMsg('Error de conexión.');
    }
  };

  const sqlCode = `-- 🛠️ Mental Sanctuary Initial Schema Migration
-- Database: PostgreSQL (Supabase Compatible)

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    cerebra_rank TEXT DEFAULT 'Novato del Enfoque',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.game_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    game_type TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    level_reached INTEGER NOT NULL DEFAULT 1,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);`;

  return (
    <div className="animate-fade-in space-y-8 max-w-[1120px] mx-auto pb-12">
      
      {/* 🧭 Header */}
      <header className="border-b border-[#1A1A1A] pb-6">
        <h1 className="text-3xl font-black text-[#1A1A1A] uppercase tracking-wider">Tu Registro Mental</h1>
        <div className="font-serif italic text-xs text-[#1A1A1A]/60 mt-1">Estadísticas personales, rachas de juego y sincronización de base de datos.</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column: Profile overview metadata */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white/30 border border-[#1A1A1A] rounded-none p-8 text-center relative overflow-hidden">
            <div className="w-20 h-20 rounded-none bg-[#D4D1CA] border border-[#1A1A1A] flex items-center justify-center mx-auto mb-4 text-[#1A1A1A]">
              <User size={38} strokeWidth={1.5} />
            </div>

            <h2 className="text-xl font-bold font-mono text-[#1A1A1A] uppercase">{"// "}{currentUser?.username}</h2>
            <span className="text-xs font-black text-[#FF5028] bg-white/50 px-3 py-1 rounded-none border border-[#1A1A1A] inline-block mt-2 font-mono">
              {currentUser?.cerebra_rank?.toUpperCase()}
            </span>

            {currentUser?.is_guest && (
              <div className="mt-4 text-[9px] text-[#FF5028] font-mono font-black bg-[#FF5028]/10 py-1.5 px-3 border border-[#FF5028] inline-flex items-center gap-1 uppercase">
                ⚠️ PERFIL DE INVITADO (LOCAL)
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-[#1A1A1A]">
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-[#1A1A1A]/60 tracking-wider block font-serif italic">Sesiones</span>
                <span className="text-xl font-black text-[#1A1A1A] block mt-1 font-mono">{scores.length}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-[#1A1A1A]/60 tracking-wider block font-serif italic">Racha de Días</span>
                <span className="text-xl font-black text-[#FF5028] block mt-1 font-mono">★ {streak}</span>
              </div>
            </div>

            <button 
              onClick={onSignOut}
              className="mt-6 text-xs text-[#1A1A1A]/60 hover:text-[#FF5028] font-bold inline-flex items-center gap-1.5 cursor-pointer uppercase tracking-wider font-mono decoration-dotted underline"
            >
              <LogOut size={13} />
              <span>Cerrar sesión</span>
            </button>
          </div>

          {/* Database Schema Viewer widget */}
          <div className="bg-white/30 border border-[#1A1A1A] rounded-none p-6 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-none bg-[#D4D1CA] border border-[#1A1A1A] flex items-center justify-center text-[#1A1A1A]">
                <Database size={20} />
              </div>
              <div>
                <span className="text-xs font-black text-[#1A1A1A] block uppercase font-mono">SUPABASE SQL SCHEMA</span>
                <span className="text-[10px] text-[#1A1A1A]/60 block mt-0.5 font-serif italic">Revisa la migración de tablas creadas</span>
              </div>
            </div>
            <button 
              onClick={() => setShowSqlModal(true)}
              className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#FF5028] text-white border border-[#1A1A1A] rounded-none text-xs font-bold font-mono transition-all cursor-pointer uppercase"
            >
              Ver SQL
            </button>
          </div>
        </div>

        {/* Right column: Sincronización flow */}
        <div className="lg:col-span-7 space-y-6">
          {currentUser?.is_guest ? (
            <div className="bg-white/30 border border-[#1A1A1A] rounded-none p-8">
              <h2 className="text-lg font-black text-[#1A1A1A] uppercase tracking-wide">{"// "}Crear tu Cuenta del Santuario</h2>
              <div className="font-serif italic text-xs text-[#1A1A1A]/60 leading-relaxed mb-6">
                Regístrate con tu correo para vincular tu racha de días, estadísticas de juego y agilidad visoespacial directamente a una cuenta permanente en Supabase.
              </div>

              <form onSubmit={handleLinkAccount} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] block font-mono">Usuario de Cerebra</label>
                    <input 
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="e.g. quantum_explorer"
                      className="w-full bg-white/50 border border-[#1A1A1A] rounded-none px-4 py-3 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] block font-mono">Email</label>
                    <input 
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="e.g. name@example.com"
                      className="w-full bg-white/50 border border-[#1A1A1A] rounded-none px-4 py-3 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] block font-mono">Contraseña</label>
                  <input 
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Contraseña segura"
                    className="w-full bg-white/50 border border-[#1A1A1A] rounded-none px-4 py-3 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A]"
                  />
                </div>

                {errMsg && (
                  <div className="p-3 bg-red-100/90 text-red-700 text-xs rounded-none border border-red-500 font-mono">
                    {errMsg}
                  </div>
                )}

                {syncStatus === 'success' && (
                  <div className="p-3 bg-green-100/90 text-green-700 text-xs rounded-none border border-green-500 font-mono">
                    ✓ ¡Sincronizado! Tu racha y estadísticas ahora son permanentes.
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={syncStatus === 'loading'}
                  className="w-full py-3.5 bg-[#FF5028] hover:bg-[#1A1A1A] text-white font-black text-xs rounded-none transition-all flex items-center justify-center gap-2 border border-[#1A1A1A] cursor-pointer uppercase font-mono tracking-wider disabled:opacity-50"
                >
                  <KeyRound size={14} />
                  <span>{syncStatus === 'loading' ? 'Registrando en Postgres...' : 'Registrar y Sincronizar'}</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white/30 border border-[#1A1A1A] rounded-none p-8">
              <h2 className="text-lg font-black text-[#1A1A1A] flex items-center gap-2 uppercase tracking-wide">
                <Medal className="text-[#FF5028] animate-pulse" />
                <span>Perfil Sincronizado</span>
              </h2>
              <p className="font-serif italic text-xs text-[#1A1A1A]/60 leading-relaxed mt-2 mb-6">
                Tu perfil de Cerebra está permanentemente conectado a Supabase Cloud DB. Todas tus puntuaciones de agilidad y rachas diarias están respaldadas en tiempo real.
              </p>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-4 bg-white/50 border border-[#1A1A1A] rounded-none">
                  <span className="text-xs text-[#1A1A1A] font-bold font-mono">MAIL VINCULADO:</span>
                  <span className="text-xs text-[#1A1A1A]/80 font-mono">{currentUser?.email}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-white/50 border border-[#1A1A1A] rounded-none">
                  <span className="text-xs text-[#1A1A1A] font-bold font-mono">BASE DE DATOS:</span>
                  <span className="text-xs text-[#FF5028] font-black font-mono">● ONLINE (Postgres SQL)</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* SQL Migration script view modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-5 animate-fade-in">
          <div className="bg-[#D4D1CA] border-4 border-[#1A1A1A] rounded-none w-full max-w-xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#1A1A1A] pb-3">
              <h3 className="text-base font-black text-[#1A1A1A] flex items-center gap-2 uppercase font-mono">
                <Database size={16} />
                <span>Supabase SQL Initial Schema</span>
              </h3>
              <button 
                onClick={() => setShowSqlModal(false)}
                className="text-xs text-[#1A1A1A] hover:text-[#FF5028] font-black uppercase font-mono cursor-pointer"
              >
                ✕ Cerrar
              </button>
            </div>

            <pre className="text-[10px] font-mono bg-[#1A1A1A] text-slate-100 p-4 rounded-none overflow-x-auto max-h-64 leading-relaxed border border-[#1A1A1A]">
              <code>{sqlCode}</code>
            </pre>

            <div className="text-right">
              <button 
                onClick={() => setShowSqlModal(false)}
                className="px-5 py-2.5 bg-[#FF5028] hover:bg-[#1A1A1A] text-white border border-[#1A1A1A] rounded-none text-xs font-bold font-mono uppercase cursor-pointer transition-all"
              >
                Cerrar Código
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
