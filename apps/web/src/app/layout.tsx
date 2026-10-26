import type { Metadata, Viewport } from 'next';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import Providers from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Metabolic Intelligence — Personal metabolic health, decoded',
  description:
    'An explainable personal metabolic model that learns how your body responds to food, sleep, activity, and lifestyle. Focused on diabetes, obesity, and preventive health.',
  applicationName: 'Metabolic Intelligence',
  manifest: '/manifest.webmanifest',
  // P7-b: real favicons + touch icons (previously 1x1 placeholders, which also
  // blocked Chrome's PWA installability check).
  icons: {
    icon: ['/favicon-32.png', '/favicon-16.png', { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Metabolic Intelligence',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0f0d' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--background)] font-sans text-[var(--foreground)]">
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
