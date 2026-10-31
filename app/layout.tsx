import type { Metadata, Viewport } from 'next';
import { Anton, IBM_Plex_Mono, Spectral } from 'next/font/google';
import './globals.css';

const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-anton' });
const mono = IBM_Plex_Mono({ weight: ['400', '500'], subsets: ['latin'], variable: '--font-plex' });
const spectral = Spectral({ weight: '300', style: 'italic', subsets: ['latin'], variable: '--font-spectral' });

export const metadata: Metadata = {
  title: "Rushabh's Spectrum",
  description: 'Everything I have watched, as one wall of colour.',
};

export const viewport: Viewport = { themeColor: '#09090b', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${mono.variable} ${spectral.variable}`}>
      <body>{children}</body>
    </html>
  );
}
