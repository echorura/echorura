'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePlayerStore } from '@/store/playerStore';
import { useLanguageStore } from '@/store/languageStore';
import { Play, Pause, Compass, Home, Users, User } from 'lucide-react';

export default function MobileNav() {
  const { isPlaying, togglePlay, showPlayer, togglePlayerPanel } = usePlayerStore();
  const { t } = useLanguageStore();
  const pathname = usePathname();

  const handlePlayClick = () => {
    togglePlay();
    if (!showPlayer) {
      togglePlayerPanel();
    }
  };

  const navItems = [
    { label: t('nav.home'), icon: Home, path: '/' },
    { label: t('nav.discover'), icon: Compass, path: '/discover' },
    { label: t('nav.community'), icon: Users, path: '/community' },
    { label: t('nav.profile'), icon: User, path: '/profile' },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-black/90 backdrop-blur-2xl border-t border-white/10 px-2 py-2 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
      <div className="flex justify-between items-center relative h-12">
        {/* 左侧：首页 & 发现 */}
        <div className="flex flex-1 justify-around">
          {navItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link key={item.path} href={item.path} className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-echo-primary' : 'text-gray-500'}`}>
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-bold">{item.label}</span>
              </Link>
            );
          })}
        </div>
        
        {/* 中间：播放按钮 */}
        <div className="w-16 h-16 -mt-8 flex items-center justify-center">
          <button 
            onClick={handlePlayClick}
            className={`w-14 h-14 rounded-full bg-gradient-to-tr from-echo-primary to-echo-secondary flex items-center justify-center border-[4px] border-[#030303] text-black shadow-[0_0_20px_rgba(0,240,255,0.4)]`}
          >
            {isPlaying ? <Pause className="w-6 h-6 fill-black" /> : <Play className="w-6 h-6 fill-black ml-1" />}
          </button>
        </div>

        {/* 右侧：社区 & 创作 */}
        <div className="flex flex-1 justify-around">
          {navItems.slice(2).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link key={item.path} href={item.path} className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-echo-primary' : 'text-gray-500'}`}>
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-bold">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
