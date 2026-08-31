import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/ui/toast';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Bursary-Bridge — Find funding. Build your future.',
    template: '%s · Bursary-Bridge',
  },
  description:
    'Bursary-Bridge connects students with bursaries, scholarships and funding opportunities, and helps organisations invest in tomorrow’s leaders.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'Bursary-Bridge — Find funding. Build your future.',
    description:
      'Connecting students with bursaries, scholarships and funding opportunities.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#5B2EDB',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className={inter.variable}>
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
