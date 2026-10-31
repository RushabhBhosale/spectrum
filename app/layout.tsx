import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';
import './globals.css';
import './cinema.css';

const hanken = localFont({ src: './fonts/HankenGrotesk.ttf', weight: '100 900', display: 'swap', variable: '--font-hanken' });
const serif = localFont({
  src: [
    { path: './fonts/InstrumentSerif-Regular.ttf', style: 'normal' },
    { path: './fonts/InstrumentSerif-Italic.ttf', style: 'italic' },
  ],
  weight: '400',
  display: 'swap',
  variable: '--font-serif',
});

export const metadata: Metadata = { title: SITE_NAME, description: SITE_DESCRIPTION };

export const viewport: Viewport = { themeColor: '#070605', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${hanken.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
