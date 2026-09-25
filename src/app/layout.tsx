import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from 'next/font/google';

import './globals.css';

const plex = IBM_Plex_Sans({ variable: '--font-plex', subsets: ['latin'], weight: ['400', '500', '600'] });
const plexMono = IBM_Plex_Mono({ variable: '--font-plex-mono', subsets: ['latin'], weight: ['400', '500', '600'] });
const newsreader = Newsreader({ variable: '--font-newsreader', subsets: ['latin'], weight: ['400', '500'] });

export const metadata: Metadata = {
  title: { default: 'OPflow admin', template: '%s · OPflow admin' },
  robots: { index: false, follow: false, nocache: true },
  // same-origin (not no-referrer): browsers send Origin: null with no-referrer, and Server Actions rightly refuse that.
  referrer: 'same-origin',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-IN" className={`${plex.variable} ${plexMono.variable} ${newsreader.variable}`}>
      <body>{children}</body>
    </html>
  );
}
