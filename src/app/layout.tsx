import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: '大師修 顧客評論小助手',
  description: '幫你快速整理今天的真實體驗，30 秒完成評論內容',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
