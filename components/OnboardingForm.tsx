// 📂 /components/OnboardingForm.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/SupabaseProvider';
import {
  ArrowRight, ArrowLeft, Check, User, MapPin, Ruler, ClipboardList, Shield,
  Brain, Globe, BookOpen, Weight,
} from 'lucide-react';

// ── Tipos ──
type Gender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | 'other' | '';
type EduLevel = 'primaria' | 'secundaria' | 'universidad' | 'postgrado' | '';
type UnitSystem = 'metric' | 'imperial';

interface FormData {
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: Gender;
  education_level: EduLevel;
  occupation: string;
  country: string;
  city: string;
  timezone: string;
  preferred_language: string;
  unit_system: UnitSystem;
  weight_kg: string;
  height_cm: string;
  consent_data: boolean;
}

const INITIAL_FORM: FormData = {
  first_name: '',
  last_name: '',
  birth_date: '',
  gender: '',
  education_level: '',
  occupation: '',
  country: '',
  city: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  preferred_language: (typeof navigator !== 'undefined' ? navigator.language?.split('-')[0] : 'es') || 'es',
  unit_system: 'metric',
  weight_kg: '',
  height_cm: '',
  consent_data: false,
};

// Timezones comunes
const COMMON_TIMEZONES = [
  'UTC', 'America/Argentina/Buenos_Aires', 'America/Mexico_City', 'America/Bogota',
  'America/Santiago', 'America/Lima', 'America/Caracas', 'America/Montevideo',
  'America/Asuncion', 'America/La_Paz', 'America/Guatemala', 'America/Sao_Paulo',
  'Europe/Madrid', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
];

const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
];

// ── Steps configuration ──
const STEPS = [
  { id: 'personal', icon: User, title: 'Datos Personales', desc: 'Identidad y fecha de nacimiento' },
  { id: 'demographics', icon: BookOpen, title: 'Escolaridad', desc: 'Formación y ocupación' },
  { id: 'location', icon: MapPin, title: 'Ubicación', desc: 'País, ciudad y preferencias regionales' },
  { id: 'physical', icon: Weight, title: 'Datos Físicos', desc: 'Opcional — métricas corporales' },
  { id: 'review', icon: Shield, title: 'Revisión', desc: 'Verificá tus datos antes de continuar' },
];

interface StepProps {
  form: FormData;
  onChange: (updates: Partial<FormData>) => void;
  errors: Record<string, string>;
}

// ── Step 1: Personal ──
function StepPersonal({ form, onChange, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider block font-mono text-[#1A1A1A]/80">
            Nombre *
          </label>
          <input
            type="text"
            value={form.first_name}
            onChange={(e) => onChange({ first_name: e.target.value })}
            placeholder="Tu nombre"
            className={`w-full bg-white/50 border rounded-none px-3 py-2.5 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A] ${
              errors.first_name ? 'border-red-500' : 'border-[#1A1A1A]'
            }`}
          />
          {errors.first_name && <p className="text-[10px] text-red-600 font-mono">{errors.first_name}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider block font-mono text-[#1A1A1A]/80">
            Apellido *
          </label>
          <input
            type="text"
            value={form.last_name}
            onChange={(e) => onChange({ last_name: e.target.value })}
            placeholder="Tu apellido"
            className={`w-full bg-white/50 border rounded-none px-3 py-2.5 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A] ${
              errors.last_name ? 'border-red-500' : 'border-[#1A1A1A]'
            }`}
          />
          {errors.last_name && <p className="text-[10px] text-red-600 font-mono">{errors.last_name}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider block font-mono text-[#1A1A1A]/80">
          Fecha de Nacimiento *
        </label>
        <input
          type="date"
          value={form.birth_date}
          onChange={(e) => onChange({ birth_date: e.target.value })}
          className={`w-full bg-white/50 border rounded-none px-3 py-2.5 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A] ${
            errors.birth_date ? 'border-red-500' : 'border-[#1A1A1A]'
          }`}
        />
        {errors.birth_date && <p className="text-[10px] text-red-600 font-mono">{errors.birth_date}</p>}
        <p className="text-[9px] text-[#1A1A1A]/40 font-mono italic">
          La edad se calcula automáticamente. Nunca compartimos tu fecha de nacimiento.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider block font-mono text-[#1A1A1A]/80">
          Género
        </label>
        <select
          value={form.gender}
          onChange={(e) => onChange({ gender: e.target.value as Gender })}
          className="w-full bg-white/50 border border-[#1A1A1A] rounded-none px-3 py-2.5 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A]"
        >
          <option value="">Seleccioná una opción...</option>
          <option value="male">Masculino</option>
          <option value="female">Femenino</option>
          <option value="non-binary">No binario</option>
          <option value="prefer-not-to-say">Prefiero no decirlo</option>
          <option value="other">Otro</option>
        </select>
      </div>
    </div>
  );
}

// ── Step 2: Demographics ──
function StepDemographics({ form, onChange, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider block font-mono text-[#1A1A1A]/80">
          Nivel Educativo *
        </label>
        <select
          value={form.education_level}
          onChange={(e) => onChange({ education_level: e.target.value as EduLevel })}
          className={`w-full bg-white/50 border rounded-none px-3 py-2.5 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A] ${
            errors.education_level ? 'border-red-500' : 'border-[#1A1A1A]'
          }`}
        >
          <option value="">Seleccioná tu nivel...</option>
          <option value="primaria">Primaria</option>
          <option value="secundaria">Secundaria</option>
          <option value="universidad">Universidad</option>
          <option value="postgrado">Postgrado</option>
        </select>
        {errors.education_level && <p className="text-[10px] text-red-600 font-mono">{errors.education_level}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider block font-mono text-[#1A1A1A]/80">
          Ocupación *
        </label>
        <input
          type="text"
          value={form.occupation}
          onChange={(e) => onChange({ occupation: e.target.value })}
          placeholder="Ej: Ingeniero, Estudiante, Diseñador..."
          className={`w-full bg-white/50 border rounded-none px-3 py-2.5 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A] ${
            errors.occupation ? 'border-red-500' : 'border-[#1A1A1A]'
          }`}
        />
        {errors.occupation && <p className="text-[10px] text-red-600 font-mono">{errors.occupation}</p>}
      </div>

      <div className="bg-white/20 border border-[#1A1A1A]/30 rounded-none p-4">
        <p className="text-[10px] text-[#1A1A1A]/50 font-mono italic leading-relaxed">
          Estos datos nos ayudan a entender correlaciones entre el perfil socioeducativo
          y el rendimiento cognitivo. Todo es anónimo a nivel de investigación.
        </p>
      </div>
    </div>
  );
}

// ── Step 3: Location ──
function StepLocation({ form, onChange, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider block font-mono text-[#1A1A1A]/80">
            País *
          </label>
          <input
            type="text"
            value={form.country}
            onChange={(e) => onChange({ country: e.target.value })}
            placeholder="ARG, USA, etc."
            maxLength={3}
            className={`w-full bg-white/50 border rounded-none px-3 py-2.5 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A] ${
              errors.country ? 'border-red-500' : 'border-[#1A1A1A]'
            }`}
          />
          {errors.country && <p className="text-[10px] text-red-600 font-mono">{errors.country}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider block font-mono text-[#1A1A1A]/80">
            Ciudad *
          </label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="Tu ciudad"
            className={`w-full bg-white/50 border rounded-none px-3 py-2.5 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A] ${
              errors.city ? 'border-red-500' : 'border-[#1A1A1A]'
            }`}
          />
          {errors.city && <p className="text-[10px] text-red-600 font-mono">{errors.city}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider block font-mono text-[#1A1A1A]/80">
          Zona Horaria
        </label>
        <select
          value={form.timezone}
          onChange={(e) => onChange({ timezone: e.target.value })}
          className="w-full bg-white/50 border border-[#1A1A1A] rounded-none px-3 py-2.5 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A]"
        >
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
          ))}
        </select>
        <p className="text-[9px] text-[#1A1A1A]/40 font-mono">
          Detectada automáticamente: {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider block font-mono text-[#1A1A1A]/80">
          Idioma Preferido *
        </label>
        <select
          value={form.preferred_language}
          onChange={(e) => onChange({ preferred_language: e.target.value })}
          className="w-full bg-white/50 border border-[#1A1A1A] rounded-none px-3 py-2.5 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A]"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>{lang.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Step 4: Physical ──
function StepPhysical({ form, onChange }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white/20 border border-[#1A1A1A]/30 rounded-none p-4">
        <p className="text-[10px] text-[#1A1A1A]/50 font-mono italic leading-relaxed">
          Datos opcionales. Sirven para calcular IMC y analizar correlaciones
          entre el estado físico y el rendimiento cognitivo. Solo vos podés ver esta información.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider block font-mono text-[#1A1A1A]/80">
          Sistema de Unidades
        </label>
        <div className="flex gap-3">
          {(['metric', 'imperial'] as UnitSystem[]).map((sys) => (
            <button
              key={sys}
              type="button"
              onClick={() => onChange({ unit_system: sys })}
              className={`px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                form.unit_system === sys
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                  : 'bg-white/30 text-[#1A1A1A]/60 border-[#1A1A1A]/40 hover:bg-white/50'
              }`}
            >
              {sys === 'metric' ? 'Métrico (kg/cm)' : 'Imperial (lb/in)'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider block font-mono text-[#1A1A1A]/80">
            Peso {form.unit_system === 'metric' ? '(kg)' : '(lbs)'}
          </label>
          <input
            type="number"
            step="0.1"
            min="20"
            max="400"
            value={form.weight_kg}
            onChange={(e) => onChange({ weight_kg: e.target.value })}
            placeholder="—"
            className="w-full bg-white/50 border border-[#1A1A1A] rounded-none px-3 py-2.5 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider block font-mono text-[#1A1A1A]/80">
            Altura {form.unit_system === 'metric' ? '(cm)' : '(in)'}
          </label>
          <input
            type="number"
            step="1"
            min="50"
            max="280"
            value={form.height_cm}
            onChange={(e) => onChange({ height_cm: e.target.value })}
            placeholder="—"
            className="w-full bg-white/50 border border-[#1A1A1A] rounded-none px-3 py-2.5 text-xs outline-none focus:bg-white focus:border-[#FF5028] transition-all font-mono text-[#1A1A1A]"
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 5: Review + Consent ──
function StepReview({ form, onChange, errors }: StepProps) {
  const fields = [
    { label: 'Nombre', value: `${form.first_name} ${form.last_name}`, icon: User },
    { label: 'Nacimiento', value: form.birth_date, icon: User },
    { label: 'Género', value: form.gender || '—', icon: User },
    { label: 'Educación', value: form.education_level || '—', icon: BookOpen },
    { label: 'Ocupación', value: form.occupation || '—', icon: BookOpen },
    { label: 'País', value: form.country || '—', icon: MapPin },
    { label: 'Ciudad', value: form.city || '—', icon: MapPin },
    { label: 'Zona Horaria', value: form.timezone, icon: Globe },
    { label: 'Idioma', value: form.preferred_language, icon: Globe },
    { label: 'Peso', value: form.weight_kg || '—', icon: Weight },
    { label: 'Altura', value: form.height_cm || '—', icon: Ruler },
  ].filter((f) => f.value && f.value !== '—' || !form.consent_data);

  return (
    <div className="space-y-6">
      <div className="bg-white/20 border border-[#1A1A1A]/30 rounded-none p-4">
        <h3 className="text-xs font-black uppercase font-mono text-[#1A1A1A] mb-3">Datos Ingresados</h3>
        <div className="grid grid-cols-2 gap-2">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center gap-2">
              <f.icon size={11} className="text-[#1A1A1A]/40 shrink-0" />
              <span className="text-[10px] font-mono text-[#1A1A1A]/70">{f.label}:</span>
              <span className="text-[10px] font-mono font-bold text-[#1A1A1A] truncate">{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Consentimiento */}
      <div className="space-y-1.5">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={form.consent_data}
            onChange={(e) => onChange({ consent_data: e.target.checked })}
            className="mt-0.5 w-4 h-4 border-[#1A1A1A] text-[#FF5028] focus:ring-[#FF5028]"
          />
          <span className="text-[11px] text-[#1A1A1A]/70 font-mono leading-relaxed group-hover:text-[#1A1A1A]">
            Acepto que mis datos demográficos y de rendimiento cognitivo sean almacenados
            de forma segura en Supabase para el funcionamiento de la plataforma.
            Entiendo que puedo solicitar la eliminación de mis datos en cualquier momento.
          </span>
        </label>
        {errors.consent_data && <p className="text-[10px] text-red-600 font-mono">{errors.consent_data}</p>}
      </div>
    </div>
  );
}

// ── Main Component ──
export default function OnboardingForm({ onComplete }: { onComplete: () => void }) {
  const router = useRouter();
  const { updateProfile } = useSupabase();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateField = useCallback((updates: Partial<FormData>) => {
    setForm((prev) => ({ ...prev, ...updates }));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(updates).forEach((key) => delete next[key]);
      return next;
    });
  }, []);

  // ── Validación por paso ──
  const validateStep = useCallback((): boolean => {
    const errs: Record<string, string> = {};

    if (step === 0) {
      if (!form.first_name.trim()) errs.first_name = 'El nombre es obligatorio';
      if (!form.last_name.trim()) errs.last_name = 'El apellido es obligatorio';
      if (!form.birth_date) errs.birth_date = 'La fecha de nacimiento es obligatoria';
      else {
        const age = new Date().getFullYear() - new Date(form.birth_date).getFullYear();
        if (age < 8) errs.birth_date = 'Debés tener al menos 8 años';
        if (age > 120) errs.birth_date = 'Verificá la fecha ingresada';
      }
    }

    if (step === 1) {
      if (!form.education_level) errs.education_level = 'Seleccioná tu nivel educativo';
      if (!form.occupation.trim()) errs.occupation = 'La ocupación es obligatoria';
    }

    if (step === 2) {
      if (!form.country.trim()) errs.country = 'El país es obligatorio';
      if (!form.city.trim()) errs.city = 'La ciudad es obligatoria';
    }

    if (step === 4) {
      if (!form.consent_data) errs.consent_data = 'Debés aceptar los términos para continuar';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [step, form]);

  const nextStep = useCallback(() => {
    if (validateStep()) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  }, [validateStep]);

  const prevStep = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
    setErrors({});
  }, []);

  // ── Helper: timeout para promesas colgadas ──
  const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`⏱ Timeout after ${ms}ms`)), ms)
      ),
    ]);
  };

  // ── Guardar en Supabase ──
  const handleSubmit = useCallback(async () => {
    if (!validateStep()) return;

    console.log('[Onboarding] handleSubmit INICIADO — saving...');
    setSaving(true);
    setSaveError(null);

    const payload: Record<string, unknown> = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      birth_date: form.birth_date,
      gender: form.gender || null,
      education_level: form.education_level,
      occupation: form.occupation.trim(),
      country: form.country.trim().toUpperCase(),
      city: form.city.trim(),
      timezone: form.timezone,
      preferred_language: form.preferred_language,
      unit_system: form.unit_system,
      consent_data_at: form.consent_data ? new Date().toISOString() : null,
    };

    // Datos físicos solo si el usuario los completó
    if (form.weight_kg) payload.weight_kg = parseFloat(form.weight_kg);
    if (form.height_cm) payload.height_cm = parseFloat(form.height_cm);

    console.log('[Onboarding] Payload:', JSON.stringify(payload, null, 2));

    try {
      console.log('[Onboarding] Llamando a updateProfile...');
      const result = await withTimeout(updateProfile(payload), 15000);
      console.log('[Onboarding] updateProfile respondió:', result);

      if (result.error) {
        console.error('[Onboarding] updateProfile error:', result.error);
        setSaveError(result.error);
        setSaving(false);
        return;
      }

      console.log('[Onboarding] Éxito — redirigiendo...');
      setSaving(false);
      onComplete();
      router.push('/');
    } catch (err) {
      console.error('[Onboarding] handleSubmit EXCEPCIÓN:', err);
      setSaveError(err instanceof Error ? err.message : 'Error desconocido. Revisá la consola (F12).');
      setSaving(false);
    }
  }, [form, updateProfile, validateStep, onComplete, router]);

  const isLastStep = step === STEPS.length - 1;
  const progressPercent = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono font-bold text-[#1A1A1A]/60 uppercase tracking-wider">
            Paso {step + 1} de {STEPS.length}
          </span>
          <span className="text-[10px] font-mono text-[#1A1A1A]/40">{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-1 bg-[#1A1A1A]/10 rounded-none overflow-hidden">
          <div
            className="h-full bg-[#FF5028] transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {/* Step labels */}
        <div className="flex justify-between mt-3">
          {STEPS.map((s, i) => {
            const isActive = i === step;
            const isDone = i < step;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  isActive ? 'opacity-100' : isDone ? 'opacity-60 hover:opacity-90' : 'opacity-30'
                } ${i > step ? 'cursor-not-allowed' : ''}`}
              >
                <div
                  className={`w-7 h-7 flex items-center justify-center border transition-all ${
                    isActive
                      ? 'bg-[#FF5028] text-white border-[#FF5028]'
                      : isDone
                        ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                        : 'bg-white/30 text-[#1A1A1A]/40 border-[#1A1A1A]/20'
                  }`}
                >
                  {isDone ? <Check size={12} /> : <Icon size={12} />}
                </div>
                <span className={`text-[7px] font-mono uppercase tracking-widest hidden sm:block ${
                  isActive ? 'text-[#FF5028] font-bold' : 'text-[#1A1A1A]/60'
                }`}>
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step title */}
      <div className="mb-8">
        <h2 className="text-lg font-black text-[#1A1A1A] uppercase tracking-wide font-sans">
          {STEPS[step].title}
        </h2>
        <p className="font-serif italic text-xs text-[#1A1A1A]/60 mt-1">{STEPS[step].desc}</p>
      </div>

      {/* Step content */}
      <div className="bg-white/30 border border-[#1A1A1A] rounded-none p-6 min-h-[260px]">
        {step === 0 && <StepPersonal form={form} onChange={updateField} errors={errors} />}
        {step === 1 && <StepDemographics form={form} onChange={updateField} errors={errors} />}
        {step === 2 && <StepLocation form={form} onChange={updateField} errors={errors} />}
        {step === 3 && <StepPhysical form={form} onChange={updateField} errors={errors} />}
        {step === 4 && <StepReview form={form} onChange={updateField} errors={errors} />}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between items-center mt-6">
        <button
          onClick={prevStep}
          disabled={step === 0}
          className="px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A]/60 hover:text-[#1A1A1A] border border-[#1A1A1A]/30 hover:border-[#1A1A1A] bg-white/30 hover:bg-white/50 transition-all rounded-none disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
        >
          <ArrowLeft size={13} />
          Atrás
        </button>

        {isLastStep ? (
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-3 bg-[#FF5028] hover:bg-[#1A1A1A] text-white font-black text-xs rounded-none transition-all flex items-center gap-2 border border-[#1A1A1A] cursor-pointer uppercase font-mono tracking-wider disabled:opacity-60"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 rounded-none border-2 border-white border-t-transparent animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check size={14} />
                Completar Perfil
              </>
            )}
          </button>
        ) : (
          <button
            onClick={nextStep}
            className="px-6 py-3 bg-[#1A1A1A] hover:bg-[#FF5028] text-white font-black text-xs rounded-none transition-all flex items-center gap-2 border border-[#1A1A1A] cursor-pointer uppercase font-mono tracking-wider"
          >
            Siguiente
            <ArrowRight size={13} />
          </button>
        )}
      </div>

      {/* Save error */}
      {saveError && (
        <div className="mt-4 p-3 bg-red-100/90 text-red-700 text-xs rounded-none border border-red-500 font-mono">
          {saveError}
        </div>
      )}
    </div>
  );
}
