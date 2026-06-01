// 📂 /components/ProfileView.tsx
// Vista completa del perfil: identidad, demografía, físicos, académicos y seguridad

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/SupabaseProvider';
import { createClient } from '@/lib/supabase/client';
import { useCognitiveMetrics } from '@/hooks/useCognitiveMetrics';
import { getGameScores, getGameStreak } from '@/lib/gameScoreService';
import type { User } from '@supabase/supabase-js';
import {
  User as UserIcon, Medal, Database, KeyRound, LogOut, Edit3, Check, X,
  MapPin, Weight, BookOpen, Shield,
  Lock, ArrowRight, ChevronDown, ChevronUp,
} from 'lucide-react';

interface ProfileViewProps {
  currentUser: any;
  supabaseUser: User | null;
  supabaseProfile: any;
  onSignOut: () => void;
  onRefreshUser: () => void;
  onLogin: () => void;
}

// ── Helpers ──
const genderLabels: Record<string, string> = {
  male: 'Masculino',
  female: 'Femenino',
  'non-binary': 'No binario',
  'prefer-not-to-say': 'Prefiero no decirlo',
  other: 'Otro',
};

const educationLabels: Record<string, string> = {
  primaria: 'Primaria',
  secundaria: 'Secundaria',
  universidad: 'Universidad',
  postgrado: 'Postgrado',
};

const statusColors: Record<string, string> = {
  active: 'text-green-700 border-green-600 bg-green-100/50',
  suspended: 'text-yellow-700 border-yellow-600 bg-yellow-100/50',
  banned: 'text-red-700 border-red-600 bg-red-100/50',
  deleted: 'text-[#1A1A1A]/40 border-[#1A1A1A]/30 bg-white/20',
};

// ── Section wrapper ──
function SectionCard({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white/30 border border-[#1A1A1A] rounded-none">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-white/20 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon size={14} className="text-[#1A1A1A]/60" />
          <span className="text-xs font-black uppercase tracking-wider font-sans text-[#1A1A1A]">{title}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-[#1A1A1A]/40" /> : <ChevronDown size={14} className="text-[#1A1A1A]/40" />}
      </button>
      {open && <div className="border-t border-[#1A1A1A]/20 p-4 space-y-3">{children}</div>}
    </div>
  );
}

// ── Field row ──
function FieldRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  if (value === null || value === undefined || value === '' || value === '—') return null;
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-[#1A1A1A]/60">{label}</span>
      <span className={`text-xs font-mono text-right max-w-[55%] truncate ${highlight ? 'text-[#FF5028] font-black' : 'text-[#1A1A1A]'}`}>
        {value}
      </span>
    </div>
  );
}

// ── Empty state ──
function EmptyField({ label, onFill }: { label: string; onFill: () => void }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-[#1A1A1A]/60">{label}</span>
      <button
        onClick={onFill}
        className="text-[10px] text-[#FF5028] font-mono font-bold cursor-pointer hover:underline flex items-center gap-1"
      >
        Completar <ArrowRight size={10} />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function ProfileView({
  currentUser,
  supabaseUser,
  supabaseProfile,
  onSignOut,
  onRefreshUser,
  onLogin,
}: ProfileViewProps) {
  const router = useRouter();
  const { updateProfile, profile, isAdmin, user } = useSupabase();
  const { streak: realStreak } = useCognitiveMetrics(user?.id);
  const [streak, setStreak] = useState(1);
  const [scores, setScores] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  // Usar el profile del hook (más completo) o fallback a props
  const p = profile || supabaseProfile;

  useEffect(() => {
    if (currentUser) {
      setScores(getGameScores(currentUser.id));
      setEditDisplayName(p?.display_name || '');
    }
  }, [currentUser, p]);

  // Usar racha real desde cognitive_metrics, o fallback a localStorage para invitados
  useEffect(() => {
    if (user?.id) {
      setStreak(realStreak);
    } else if (currentUser?.id) {
      setStreak(getGameStreak(currentUser.id).current_streak);
    }
  }, [user, realStreak, currentUser]);

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
  const needsProfile = p && !p.first_name;

  // Calcular edad desde birth_date
  const age = p?.birth_date
    ? new Date().getFullYear() - new Date(p.birth_date).getFullYear()
    : null;

  return (
    <div className="animate-fade-in space-y-8 max-w-[1120px] mx-auto pb-12">
      {/* 🧭 Header */}
      <header className="border-b border-[#1A1A1A] pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#1A1A1A] uppercase tracking-wider">Tu Registro Mental</h1>
          <p className="font-serif italic text-xs text-[#1A1A1A]/60 mt-1">
            Datos demográficos, preferencias y estado de la cuenta.
          </p>
        </div>
        {isAdmin && (
          <span className="text-[9px] font-black text-[#FF5028] bg-white/50 px-2 py-1 border border-[#FF5028] font-mono uppercase tracking-wider">
            ADMIN
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ─── LEFT COLUMN: Avatar + quick stats ─── */}
        <div className="lg:col-span-5 space-y-6">
          {/* Avatar card */}
          <div className="bg-white/30 border border-[#1A1A1A] rounded-none p-8 text-center relative overflow-hidden">
            <div className="w-20 h-20 rounded-none bg-[#D4D1CA] border border-[#1A1A1A] flex items-center justify-center mx-auto mb-4 text-[#1A1A1A]">
              <UserIcon size={38} strokeWidth={1.5} />
            </div>

            <h2 className="text-xl font-bold font-mono text-[#1A1A1A] uppercase">
              {'// '}{p?.display_name || currentUser?.username || '—'}
            </h2>
            {p?.username && (
              <span className="text-[9px] font-mono text-[#1A1A1A]/40 block mt-0.5">@{p.username}</span>
            )}

            {/* Badges */}
            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              <span className="text-[9px] font-black text-[#FF5028] bg-white/50 px-2 py-0.5 border border-[#1A1A1A] font-mono uppercase tracking-wider">
                {currentUser?.cerebra_rank || 'NOVATO'}
              </span>
              {isAdmin && (
                <span className="text-[9px] font-black text-white bg-[#1A1A1A] px-2 py-0.5 border border-[#1A1A1A] font-mono uppercase tracking-wider">
                  ADMIN
                </span>
              )}
              {p?.account_status && (
                <span className={`text-[9px] font-black px-2 py-0.5 border font-mono uppercase tracking-wider ${statusColors[p.account_status as keyof typeof statusColors] || 'text-[#1A1A1A]/40'}`}>
                  {p.account_status === 'active' ? 'Activo' : p.account_status}
                </span>
              )}
            </div>

            {/* Editar display name */}
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
                    <span>Editar alias</span>
                  </button>
                )}
                {saveStatus === 'success' && <span className="text-[10px] text-green-700 font-mono block mt-1">✓ Guardado</span>}
                {saveStatus === 'error' && <span className="text-[10px] text-red-600 font-mono block mt-1">{saveError}</span>}
              </div>
            )}

            {!isSupabaseAuth && (
              <div className="mt-4 text-[9px] text-[#FF5028] font-mono font-black bg-[#FF5028]/10 py-1.5 px-3 border border-[#FF5028] inline-flex items-center gap-1 uppercase">
                PERFIL DE INVITADO (LOCAL)
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-[#1A1A1A]">
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-[#1A1A1A]/60 tracking-wider block font-serif italic">Sesiones</span>
                <span className="text-xl font-black text-[#1A1A1A] block mt-1 font-mono">{scores.length}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-[#1A1A1A]/60 tracking-wider block font-serif italic">Racha</span>
                <span className="text-xl font-black text-[#FF5028] block mt-1 font-mono">★ {streak}</span>
              </div>
            </div>

            {age && (
              <div className="mt-4 text-[10px] text-[#1A1A1A]/50 font-mono">
                Edad: <span className="font-bold text-[#1A1A1A]">{age} años</span>
              </div>
            )}

            {/* Incomplete profile warning */}
            {isSupabaseAuth && needsProfile && (
              <div className="mt-6 p-3 bg-yellow-100/70 border border-yellow-600 text-[10px] font-mono text-yellow-800 rounded-none">
                Perfil incompleto —{' '}
                <button onClick={() => router.push('/auth/onboarding')} className="underline font-bold cursor-pointer">
                  completalo ahora
                </button>
              </div>
            )}

            <button
              onClick={onSignOut}
              className="mt-6 text-xs text-[#1A1A1A]/60 hover:text-[#FF5028] font-bold inline-flex items-center gap-1.5 cursor-pointer uppercase tracking-wider font-mono decoration-dotted underline"
            >
              <LogOut size={13} />
              <span>{isSupabaseAuth ? 'Cerrar sesión' : 'Reiniciar invitado'}</span>
            </button>
          </div>

          {/* Database status */}
          <div className="bg-white/30 border border-[#1A1A1A] rounded-none p-6 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-none bg-[#D4D1CA] border border-[#1A1A1A] flex items-center justify-center text-[#1A1A1A]">
                <Database size={20} />
              </div>
              <div>
                <span className="text-xs font-black text-[#1A1A1A] block uppercase font-mono">SUPABASE</span>
                <span className="text-[10px] text-[#1A1A1A]/60 block mt-0.5 font-serif italic">Plataforma cognitiva</span>
              </div>
            </div>
            <span className={`text-[9px] font-black font-mono uppercase ${isSupabaseAuth ? 'text-green-700' : 'text-[#1A1A1A]/40'}`}>
              {isSupabaseAuth ? '● Conectado' : '○ Local'}
            </span>
          </div>
        </div>

        {/* ─── RIGHT COLUMN: Data sections ─── */}
        <div className="lg:col-span-7 space-y-4">
          {!isSupabaseAuth ? (
            // ── GUEST VIEW ──
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
            // ── AUTHENTICATED VIEW ──
            <>
              {/* ════════════════════ */}
              {/* 1. IDENTIDAD */}
              {/* ════════════════════ */}
              <SectionCard title="Identidad" icon={UserIcon}>
                <FieldRow label="Email" value={supabaseUser?.email} highlight />
                <FieldRow label="Usuario" value={p?.username ? `@${p.username}` : null} />
                {p?.first_name ? (
                  <>
                    <FieldRow label="Nombre" value={p.first_name} />
                    <FieldRow label="Apellido" value={p.last_name} />
                    <FieldRow label="Fecha de Nac." value={p.birth_date} />
                    {age && <FieldRow label="Edad" value={`${age} años`} highlight />}
                    <FieldRow label="Género" value={genderLabels[p.gender] || p.gender} />
                  </>
                ) : (
                  <>
                    <EmptyField label="Nombre" onFill={() => router.push('/auth/onboarding')} />
                    <EmptyField label="Fecha de Nac." onFill={() => router.push('/auth/onboarding')} />
                  </>
                )}
              </SectionCard>

              {/* ════════════════════ */}
              {/* 2. CONTACTO / UBICACIÓN */}
              {/* ════════════════════ */}
              <SectionCard title="Ubicación & Preferencias" icon={MapPin}>
                <FieldRow label="País" value={p?.country} />
                <FieldRow label="Ciudad" value={p?.city} />
                <FieldRow label="Zona Horaria" value={p?.timezone} />
                <FieldRow label="Idioma" value={p?.preferred_language} />
                <FieldRow label="Unidad de Medida" value={p?.unit_system === 'imperial' ? 'Imperial (lb/in)' : 'Métrico (kg/cm)'} />
              </SectionCard>

              {/* ════════════════════ */}
              {/* 3. DATOS FÍSICOS */}
              {/* ════════════════════ */}
              <SectionCard title="Datos Físicos" icon={Weight} defaultOpen={!!p?.weight_kg || !!p?.height_cm}>
                {p?.weight_kg || p?.height_cm ? (
                  <>
                    <FieldRow label="Peso" value={p?.weight_kg ? `${p.weight_kg} ${p?.unit_system === 'imperial' ? 'lbs' : 'kg'}` : null} />
                    <FieldRow label="Altura" value={p?.height_cm ? `${p.height_cm} ${p?.unit_system === 'imperial' ? 'in' : 'cm'}` : null} />
                  </>
                ) : (
                  <p className="text-[10px] text-[#1A1A1A]/40 font-mono italic">
                    No registraste datos físicos todavía.{' '}
                    <button onClick={() => router.push('/auth/onboarding')} className="text-[#FF5028] underline cursor-pointer font-bold">
                      Completar
                    </button>
                  </p>
                )}
              </SectionCard>

              {/* ════════════════════ */}
              {/* 4. ACADÉMICO */}
              {/* ════════════════════ */}
              <SectionCard title="Formación & Ocupación" icon={BookOpen}>
                {p?.education_level || p?.occupation ? (
                  <>
                    <FieldRow label="Nivel Educativo" value={educationLabels[p.education_level] || p.education_level} />
                    <FieldRow label="Ocupación" value={p?.occupation} />
                  </>
                ) : (
                  <p className="text-[10px] text-[#1A1A1A]/40 font-mono italic">
                    No registraste tu formación todavía.{' '}
                    <button onClick={() => router.push('/auth/onboarding')} className="text-[#FF5028] underline cursor-pointer font-bold">
                      Completar
                    </button>
                  </p>
                )}
              </SectionCard>

              {/* ════════════════════ */}
              {/* 5. SEGURIDAD */}
              {/* ════════════════════ */}
              <SectionCard title="Seguridad & Auditoría" icon={Shield}>
                <FieldRow label="Role" value={p?.role === 'admin' ? 'Admin' : 'Usuario'} highlight={p?.role === 'admin'} />
                <FieldRow label="Estado" value={
                  p?.account_status === 'active' ? 'Activo' : p?.account_status || null
                } />
                <FieldRow label="Email Verificado" value={p?.is_verified ? '✓ Sí' : '✗ No'} />
                <FieldRow label="Último Acceso" value={
                  supabaseUser?.last_sign_in_at
                    ? new Date(supabaseUser.last_sign_in_at).toLocaleString('es-AR')
                    : null
                } />
                <FieldRow label="Cuenta Creada" value={
                  p?.created_at ? new Date(p.created_at).toLocaleString('es-AR') : null
                } />
                <FieldRow label="Consent. Datos" value={
                  p?.consent_data_at ? new Date(p.consent_data_at).toLocaleString('es-AR') : 'Pendiente'
                } />
              </SectionCard>

              {/* ════════════════════ */}
              {/* 6. CREDENCIALES */}
              {/* ════════════════════ */}
              <SectionCard title="Credenciales" icon={Lock} defaultOpen={false}>
                <FieldRow label="ID de Usuario" value={p?.id ? p.id.substring(0, 12) + '…' : null} />
                <FieldRow label="Auth Provider" value="Email / Password" />
                {supabaseUser?.email && (
                  <div className="pt-2 border-t border-[#1A1A1A]/20 text-center">
                    <button
                      onClick={() => {
                        const client = createClient();
                        if (client) {
                          client.auth.resetPasswordForEmail(supabaseUser.email!, {
                            redirectTo: `${window.location.origin}/auth/callback`,
                          });
                        }
                      }}
                      className="text-[10px] text-[#1A1A1A]/40 hover:text-[#FF5028] font-mono cursor-pointer underline decoration-dotted"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
