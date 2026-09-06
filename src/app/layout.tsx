import type { Metadata, Viewport } from 'next';
import WorldApp from '@/components/WorldApp';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL('https://gitcity.co'),
  title: 'Gitcity — an open world, built by you.',
  icons: { icon: { url: '/favicon.svg', type: 'image/svg+xml' } },
  description:
    'Explore GitHub as a living 3D landscape. Every repository a city. Every contribution leaves a mark.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b1217' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WorldApp />
        {children}
      </body>
    </html>
  );
}
