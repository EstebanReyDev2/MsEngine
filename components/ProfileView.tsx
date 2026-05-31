// 📂 /components/ProfileView.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/SupabaseProvider';
import { supabaseClient } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { User as UserIcon, Medal, Database, KeyRound, LogOut, Edit3, Check, X } from 'lucide-react';

interface ProfileViewProps {
  currentUser: any;
  supabaseUser: User | null;
  supabaseProfile: any;
  onSignOut: () => void;
  onRefreshUser: () => void;
  onLogin: () => void;
}

export default function ProfileView({
  currentUser,
  supabaseUser,
  supabaseProfile,
  onSignOut,
  onRefreshUser,
  onLogin,
}: ProfileViewProps) {
  const router = useRouter();
  const { updateProfile } = useSupabase();
  const [streak, setStreak] = useState(1);
  const [scores, setScores] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (currentUser) {
      setScores(supabaseClient.db.getScores(currentUser.id));
      setStreak(supabaseClient.db.getStreak(currentUser.id).current_streak);
      setEditDisplayName(supabaseProfile?.display_name || '');
    }
  }, [currentUser, supabaseProfile]);

  const handleSaveProfile = async () => {
    setSaveStatus('loading');
    setSaveError('');
    const { error } = await updateProfile({ display_name: editDisplayName });
    if (error) {
      setSaveStatus('error');
      setSaveError(error);
    } else {
      setSaveStatus('success');
      setEditing(false);
      onRefreshUser();
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const isSupabaseAuth = !!supabaseUser;

  return (
    <div className="animate-fade-in space-y-8 max-w-[1120px] mx-auto pb-12">

      {/* 🧭 Header */}
      <header className="border-b border-[#1A1A1A] pb-6">
        <h1 className="text-3xl font-black text-[#1A1A1A] uppercase tracking-wider">Tu Registro Mental</h1>
        <div className="font-serif italic text-xs text-[#1A1A1A]/60 mt-1">Estadísticas personales, rachas de juego y perfil de Santuario.</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left column: Profile overview */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white/30 border border-[#1A1A1A] rounded-none p-8 text-center relative overflow-hidden">
            <div className="w-20 h-20 rounded-none bg-[#D4D1CA] border border-[#1A1A1A] flex items-center justify-center mx-auto mb-4 text-[#1A1A1A]">
              <UserIcon size={38} strokeWidth={1.5} />
            </div>

            <h2 className="text-xl font-bold font-mono text-[#1A1A1A] uppercase">
              {'// '}{supabaseProfile?.display_name || currentUser?.username}
            </h2>
            {supabaseProfile?.display_name && currentUser?.username && supabaseProfile.display_name !== currentUser.username && (
              <span className="text-[9px] font-mono text-[#1A1A1A]/40 block mt-0.5">
                @{currentUser.username}
              </span>
            )}
            <span className="text-xs font-black text-[#FF5028] bg-white/50 px-3 py-1 rounded-none border border-[#1A1A1A] inline-block mt-2 font-mono">
              {currentUser?.cerebra_rank?.toUpperCase()}
            </span>

            {!isSupabaseAuth && (
              <div className="mt-4 text-[9px] text-[#FF5028] font-mono font-black bg-[#FF5028]/10 py-1.5 px-3 border border-[#FF5028] inline-flex items-center gap-1 uppercase">
                PERFIL DE INVITADO (LOCAL)
              </div>
            )}

            {/* Editable display name */}
            {isSupabaseAuth && (
              <div className="mt-4">
                {editing ? (
                  <div className="flex items-center gap-2 justify-center">
                    <input
                      type="text"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      placeholder="Nombre visible"
                      className="bg-white border border-[#1A1A1A] rounded-none px-3 py-1.5 text-xs outline-none font-mono w-40"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveProfile}
                      disabled={saveStatus === 'loading'}
                      className="w-7 h-7 bg-[#1A1A1A] hover:bg-[#FF5028] text-white flex items-center justify-center border border-[#1A1A1A] cursor-pointer disabled:opacity-50"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="w-7 h-7 bg-white/50 hover:bg-white text-[#1A1A1A] flex items-center justify-center border border-[#1A1A1A] cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="text-[10px] text-[#1A1A1A]/60 hover:text-[#FF5028] font-bold inline-flex items-center gap-1 cursor-pointer uppercase tracking-wider font-mono"
                  >
                    <Edit3 size={11} />
                    <span>Editar perfil</span>
                  </button>
                )}
                {saveStatus === 'success' && (
                  <span className="text-[10px] text-green-700 font-mono block mt-1">✓ Guardado</span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-[10px] text-red-600 font-mono block mt-1">{saveError}</span>
                )}
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
              <span>{isSupabaseAuth ? 'Cerrar sesión' : 'Reiniciar invitado'}</span>
            </button>
          </div>

          {/* Database Schema Viewer */}
          <div className="bg-white/30 border border-[#1A1A1A] rounded-none p-6 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-none bg-[#D4D1CA] border border-[#1A1A1A] flex items-center justify-center text-[#1A1A1A]">
                <Database size={20} />
              </div>
              <div>
                <span className="text-xs font-black text-[#1A1A1A] block uppercase font-mono">SUPABASE</span>
                <span className="text-[10px] text-[#1A1A1A]/60 block mt-0.5 font-serif italic">Plataforma cognitiva en la nube</span>
              </div>
            </div>
            <span className={`text-[9px] font-black font-mono uppercase ${isSupabaseAuth ? 'text-green-700' : 'text-[#1A1A1A]/40'}`}>
              {isSupabaseAuth ? '● Conectado' : '○ Local'}
            </span>
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-7 space-y-6">
          {!isSupabaseAuth ? (
            // Guest view — prompt to login/signup
            <div className="bg-white/30 border border-[#1A1A1A] rounded-none p-8">
              <h2 className="text-lg font-black text-[#1A1A1A] uppercase tracking-wide">
                {'// '}Crear tu Cuenta del Santuario
              </h2>
              <p className="font-serif italic text-xs text-[#1A1A1A]/60 leading-relaxed mb-6">
                Registrate con tu correo para vincular tu racha de días, estadísticas de juego y perfil
                directamente a una cuenta permanente en Supabase.
              </p>

              <div className="space-y-3">
                <button
                  onClick={onLogin}
                  className="w-full py-3.5 bg-[#FF5028] hover:bg-[#1A1A1A] text-white font-black text-xs rounded-none transition-all flex items-center justify-center gap-2 border border-[#1A1A1A] cursor-pointer uppercase font-mono tracking-wider"
                >
                  <KeyRound size={14} />
                  <span>Iniciar Sesión / Registrarse</span>
                </button>

                <div className="text-center">
                  <button
                    onClick={() => router.push('/auth/login')}
                    className="text-[10px] text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70 font-mono cursor-pointer uppercase tracking-widest"
                  >
                    Ir a la página de login
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Supabase authenticated view
            <div className="bg-white/30 border border-[#1A1A1A] rounded-none p-8">
              <h2 className="text-lg font-black text-[#1A1A1A] flex items-center gap-2 uppercase tracking-wide">
                <Medal className="text-[#FF5028]" />
                <span>Perfil Sincronizado</span>
              </h2>
              <p className="font-serif italic text-xs text-[#1A1A1A]/60 leading-relaxed mt-2 mb-6">
                Tu cuenta está conectada a Supabase Cloud. Tus datos son persistentes.
              </p>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-4 bg-white/50 border border-[#1A1A1A] rounded-none">
                  <span className="text-xs text-[#1A1A1A] font-bold font-mono">MAIL:</span>
                  <span className="text-xs text-[#1A1A1A]/80 font-mono">{supabaseUser?.email}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-white/50 border border-[#1A1A1A] rounded-none">
                  <span className="text-xs text-[#1A1A1A] font-bold font-mono">USUARIO:</span>
                  <span className="text-xs text-[#1A1A1A]/80 font-mono">@{supabaseProfile?.username || currentUser?.username}</span>
                </div>
                {supabaseProfile?.display_name && (
                  <div className="flex justify-between items-center p-4 bg-white/50 border border-[#1A1A1A] rounded-none">
                    <span className="text-xs text-[#1A1A1A] font-bold font-mono">NOMBRE:</span>
                    <span className="text-xs text-[#1A1A1A]/80 font-mono">{supabaseProfile.display_name}</span>
                  </div>
                )}
                {supabaseProfile?.country && (
                  <div className="flex justify-between items-center p-4 bg-white/50 border border-[#1A1A1A] rounded-none">
                    <span className="text-xs text-[#1A1A1A] font-bold font-mono">PAÍS:</span>
                    <span className="text-xs text-[#1A1A1A]/80 font-mono">{supabaseProfile.country}</span>
                  </div>
                )}
                <div className="flex justify-between items-center p-4 bg-white/50 border border-[#1A1A1A] rounded-none">
                  <span className="text-xs text-[#1A1A1A] font-bold font-mono">BASE DE DATOS:</span>
                  <span className="text-xs text-[#FF5028] font-black font-mono">● ONLINE (Postgres SQL)</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
