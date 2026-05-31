import type {Metadata} from 'next';
import './globals.css'; // Global styles
import SupabaseProvider from '@/components/SupabaseProvider';

export const metadata: Metadata = {
  title: 'MS.ENGINE — Santuario Cognitivo',
  description: 'Plataforma de entrenamiento mental con tracking cognitivo en Supabase',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="es">
      <body suppressHydrationWarning>
        <SupabaseProvider>
          {children}
        </SupabaseProvider>
      </body>
    </html>
  );
}
