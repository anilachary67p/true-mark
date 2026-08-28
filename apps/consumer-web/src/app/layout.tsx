import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrueMark — Verify Your Product',
  description: 'Verify product authenticity with TrueMark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
