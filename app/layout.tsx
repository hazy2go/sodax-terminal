import type { Metadata } from 'next';
import { Geist, Geist_Mono, Archivo } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

// Display voice: a real grotesk with a width axis, run wide. Carries the
// instrument character without sci-fi costume.
const archivo = Archivo({
  variable: '--font-display',
  subsets: ['latin'],
  axes: ['wdth'],
});

export const metadata: Metadata = {
  title: 'SODAX Terminal',
  description:
    'Cross-chain DeFi terminal — swaps, xStocks, limit orders, lending and analytics, built on the SODAX SDK.',
};

const DIRECTION_CONTRACT = `<!--
THESIS: The hub is the beamline — every intent is one event fanning from centre
through rings of chains. Refuses the stat-card dashboard and the centred swap
card the category always ships.
OWN-WORLD: Vacuum #0B0F14 ground, detector-steel concentric rings, signal yellow
and cyan tracks, energy-red calorimeter bars, 1px hairlines everywhere, Archivo
run wide for display, Geist Mono tabular for every figure.
STORY: A trader reads live cross-chain flow as one detector cross-section, then
acts in the docked instrument column without ever leaving the event.
FIRST VIEWPORT: Status strip top; instrument rail left; detector cross-section
filling the left 55% with Sonic at core and eleven chain rings; instrument column
right carrying the primary action; live intents tape along the bottom.
FORM: Event Display — candidate 7 of the grounded list, seed key 8ff96446.
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, and DESIGN.md
-->`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable}`}
    >
      <body>
        {/* Direction contract — emitted as a real HTML comment so it survives the
            production build and stays auditable in the shipped markup. */}
        <div
          style={{ display: 'none' }}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
