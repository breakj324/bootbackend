import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NextJS + NestJS Premium Dashboard',
  description: 'Enterprise dashboard tracking BullMQ job processors, PostgreSQL storage, Redis caching, and Telegram Webhooks.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
