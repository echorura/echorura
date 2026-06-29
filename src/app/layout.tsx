import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/layout/TopNav";
import MobileNav from "@/components/layout/MobileNav";
import StartupSequence from "@/components/layout/StartupSequence";
import GlobalAudioPlayer from "@/components/player/GlobalAudioPlayer";
import AuthSync from "@/components/auth/AuthSync";
import PWAInstallPrompt from "@/components/layout/PWAInstallPrompt";
import { Web3Provider } from "@/components/providers/Web3Provider";

// 使用本地系统字体变量，避免因网络连接问题导致 Google Fonts 构建失败
const geistSans = {
  variable: "font-sans",
};

const geistMono = {
  variable: "font-mono",
};

export const metadata: Metadata = {
  title: "极声音乐 / 去中心化音乐分发平台",
  description: "极声音乐 · Web3 驱动 of 去中心化音乐分发与 ECHO 积分生态",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "极声音乐",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body suppressHydrationWarning className="antialiased min-h-screen flex flex-col">
        <Web3Provider>
          {/* <SplashScreen /> */}
          <StartupSequence />
          <TopNav />
          
          {/* Main Content */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 pb-24 md:p-6 md:pb-8 lg:p-8 relative">
            {children}
          </main>

          <MobileNav />
          <GlobalAudioPlayer />
          <AuthSync />
          <PWAInstallPrompt />
        </Web3Provider>
      </body>
    </html>
  );
}
