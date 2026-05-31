// 📂 /app/auth/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/SupabaseProvider';
import { Brain, Mail, Lock, UserPlus, LogIn, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useSupabase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { error: err } = await signUp(email, password);
        if (err) {
          setError(err);
        } else {
          setSuccess('Cuenta creada. Revisá tu email para confirmar el registro.');
        }
      } else {
        const { error: err } = await signIn(email, password);
        if (err) {
          setError(err);
        } else {
          router.push('/');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#D4D1CA] flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          onClick={() => router.push('/')}
          className="mb-8 text-xs text-[#1A1A1A]/60 hover:text-[#FF5028] font-bold inline-flex items-center gap-1.5 cursor-pointer uppercase tracking-wider font-mono"
        >
          <ArrowLeft size={13} />
          <span>Volver al Santuario</span>
        </button>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 mx-auto bg-[#1A1A1A] flex items-center justify-center text-white border border-[#1A1A1A] mb-4">
            <Brain size={28} fill="currentColor" />
          </div>
          <h1 className="text-3xl font-black text-[#1A1A1A] uppercase tracking-wider">
            MS.ENGINE
          </h1>
          <p className="font-serif italic text-sm text-[#1A1A1A]/60 mt-2">
            {isSignUp
              ? 'Creá tu cuenta permanente en Supabase'
              : 'Iniciá sesión en tu cuenta del Santuario'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/30 border border-[#1A1A1A] rounded-none p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] block font-mono">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@ejemplo.com"
                  required
                  className="w-full bg-white/50 border border-[#1A1A1A] rounded-none pl-9 pr-4 py-3 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] block font-mono">
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-white/50 border border-[#1A1A1A] rounded-none pl-9 pr-4 py-3 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A]"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-100/90 text-red-700 text-xs rounded-none border border-red-500 font-mono">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-100/90 text-green-700 text-xs rounded-none border border-green-500 font-mono">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#FF5028] hover:bg-[#1A1A1A] text-white font-black text-xs rounded-none transition-all flex items-center justify-center gap-2 border border-[#1A1A1A] cursor-pointer uppercase font-mono tracking-wider disabled:opacity-50"
            >
              {isSignUp ? <UserPlus size={14} /> : <LogIn size={14} />}
              <span>
                {loading
                  ? 'Procesando...'
                  : isSignUp
                    ? 'Crear Cuenta'
                    : 'Iniciar Sesión'}
              </span>
            </button>
          </form>

          {/* Toggle sign-up / sign-in */}
          <div className="mt-6 pt-5 border-t border-[#1A1A1A]/30 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccess(null);
              }}
              className="text-xs text-[#1A1A1A] hover:text-[#FF5028] font-bold cursor-pointer uppercase tracking-wider font-mono underline decoration-dotted"
            >
              {isSignUp
                ? '¿Ya tenés cuenta? Iniciá sesión'
                : '¿No tenés cuenta? Registrate'}
            </button>
          </div>

          {/* Guest mode link */}
          <div className="mt-4 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-[10px] text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70 font-mono cursor-pointer uppercase tracking-widest"
            >
              Seguir como Invitado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
