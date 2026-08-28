import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrueMark Admin',
  description: 'Enterprise product authentication administration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
