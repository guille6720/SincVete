import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SincVete',
  description: 'Plataforma veterinaria SaaS profesional',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
