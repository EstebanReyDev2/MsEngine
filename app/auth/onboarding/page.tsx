// 📂 /app/auth/onboarding/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/SupabaseProvider';
import OnboardingForm from '@/components/OnboardingForm';
import { Brain } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoading, profile, isAdmin } = useSupabase();

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [isLoading, user, router]);

  // Redirect if profile already complete
  useEffect(() => {
    if (!isLoading && profile?.first_name && profile?.birth_date) {
      router.push('/');
    }
  }, [isLoading, profile, router]);

  if (isLoading || !user || (profile?.first_name && profile?.birth_date)) {
    return (
      <div className="min-h-screen bg-[#D4D1CA] flex items-center justify-center">
        <div className="w-10 h-10 rounded-none border-2 border-[#1A1A1A] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#D4D1CA] flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto bg-[#1A1A1A] flex items-center justify-center text-white border border-[#1A1A1A] mb-3">
            <Brain size={24} fill="currentColor" />
          </div>
          <h1 className="text-2xl font-black text-[#1A1A1A] uppercase tracking-wider">
            Completá tu Perfil
          </h1>
          <p className="font-serif italic text-sm text-[#1A1A1A]/60 mt-1 max-w-sm mx-auto">
            Estos datos nos permiten personalizar tu experiencia de entrenamiento
            y analizar correlaciones entre tu perfil y rendimiento cognitivo.
          </p>
          {isAdmin && (
            <span className="inline-block mt-2 text-[9px] font-black text-[#FF5028] bg-white/50 px-2 py-0.5 border border-[#FF5028] font-mono tracking-wider uppercase">
              Admin — Dashboard global disponible
            </span>
          )}
        </div>

        {/* Form */}
        <OnboardingForm
          onComplete={() => {
            router.push('/');
          }}
        />

        {/* Skip link */}
        <div className="text-center mt-8">
          <button
            onClick={() => router.push('/')}
            className="text-[10px] text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70 font-mono cursor-pointer uppercase tracking-widest underline decoration-dotted"
          >
            Completar después / Seguir como invitado
          </button>
        </div>
      </div>
    </div>
  );
}
