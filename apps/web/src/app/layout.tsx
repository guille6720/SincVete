import type { Metadata } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import { Providers } from '@/components/providers';
import { PwaRegister } from '@/components/pwa-register';
import { APP_NAME } from '@sincvete/shared';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://syncvete.opusorg.com'),
  title: APP_NAME,
  description: 'Modern veterinary management for clinics and professionals.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [{ url: '/icons/syncvete.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/syncvete.svg' }],
  },
};

const themeBootScript = `(function(){try{var raw=localStorage.getItem('syncvete-theme')||localStorage.getItem('sincvete-theme');var prefs=raw?JSON.parse(raw):{mode:'light',accent:'teal'};var mode=prefs.mode==='dark'?'dark':'light';var accent=typeof prefs.accent==='string'?prefs.accent:'teal';var root=document.documentElement;if(mode==='dark')root.classList.add('dark');else root.classList.remove('dark');root.setAttribute('data-accent',accent);root.style.colorScheme=mode;}catch(e){document.documentElement.setAttribute('data-accent','teal');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${dmSans.variable} ${fraunces.variable} font-sans antialiased`}>
        <Providers>
          <PwaRegister />
          {children}
        </Providers>
      </body>
    </html>
  );
}
