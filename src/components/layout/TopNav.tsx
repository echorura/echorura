'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePlayerStore } from '@/store/playerStore';
import { useLanguageStore, translations } from '@/store/languageStore';
import { createClient } from '@/utils/supabase/client';
import AuthModal from '@/components/auth/AuthModal';
import { LogOut, User as UserIcon, Search, Bell, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TopNav() {
  const router = useRouter();
  const { echoBalance, earnedThisSession } = usePlayerStore();
  const { language, setLanguage, t } = useLanguageStore();
  const [isMounted, setIsMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [showLangMenu, setShowLangMenu] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const tSafe = (key: string) => {
    if (!isMounted) {
      return translations[key]?.zh || key;
    }
    return t(key);
  };
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const supabase = createClient();

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('avatar_url').eq('id', userId).single();
    if (data) setProfile(data);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        fetchProfile(user.id);
        fetchNotifications(user.id);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const fetchNotifications = async (userId: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(display_name, avatar_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setNotifications(data);
  };

  const markNotificationsAsRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);
      
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };



  return (
    <>
      <header className="sticky top-0 z-50 glass-panel border-b-0 border-white/10">
        {/* Row 1: Navigation Links & Actions */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-b border-white/5">
          <div className="flex items-center justify-between h-16">
            {/* Left side: Logo & Nav */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-3 group shrink-0">
                <div className="w-9 h-9 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(0,240,255,0.3)] group-hover:scale-105 transition-transform border border-white/10">
                  <img src="/logo_small.jpg" alt="ECHORURA Logo" className="w-full h-full object-cover" />
                </div>
                 <div className="flex flex-col justify-center">
                  <span className="text-base font-black tracking-tighter text-white uppercase leading-none mb-1">
                    ECHO<span className="text-gradient">RURA</span>
                  </span>
                  <span className="text-[7px] md:text-[8px] text-gray-500 font-bold uppercase tracking-[0.02em] leading-none">
                    Decentralized Music
                  </span>
                </div>
              </Link>
              <nav className="hidden md:flex space-x-8">
                <Link href="/discover" className="text-gray-300 hover:text-echo-primary transition-colors text-sm font-bold uppercase">{tSafe('nav.discover')}</Link>
                <Link href="/community" className="text-gray-300 hover:text-echo-primary transition-colors text-sm font-bold uppercase">{tSafe('nav.community')}</Link>
              </nav>
            </div>

            {/* Right side: Language, Wallet, Profile */}
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              
              <Link href="/search" className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-300 hover:text-white">
                <Search className="w-5 h-5" />
              </Link>

              {/* Language Switcher */}
              <div 
                className="relative"
                onMouseEnter={() => setShowLangMenu(true)}
                onMouseLeave={() => setShowLangMenu(false)}
              >
                <button 
                  onClick={() => setShowLangMenu(!showLangMenu)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-300 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <Globe className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-wider">{isMounted ? language : 'zh'}</span>
                </button>
                {showLangMenu && (
                  <div className="absolute right-0 mt-1 w-24 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl transition-all duration-200 z-50">
                    <button 
                      onClick={() => {
                        setLanguage('zh');
                        setShowLangMenu(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs font-bold transition-colors cursor-pointer ${language === 'zh' ? 'text-echo-primary bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                      简体中文
                    </button>
                    <button 
                      onClick={() => {
                        setLanguage('en');
                        setShowLangMenu(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs font-bold transition-colors cursor-pointer ${language === 'en' ? 'text-echo-primary bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                      English
                    </button>
                    <button 
                      onClick={() => {
                        setLanguage('ja');
                        setShowLangMenu(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs font-bold transition-colors cursor-pointer ${language === 'ja' ? 'text-echo-primary bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                      日本語
                    </button>
                  </div>
                )}
              </div>

              <Link href="/wallet" className="glass-panel px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full flex items-center gap-1.5 sm:gap-2 hover:border-echo-primary/50 transition-colors cursor-pointer relative overflow-hidden group">
                <div className="absolute inset-0 bg-echo-primary/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-echo-primary/20 flex items-center justify-center border border-echo-primary relative z-10">
                  <span className="text-[9px] sm:text-[10px] text-echo-primary font-bold">E</span>
                </div>
                <span className="text-xs sm:text-sm font-bold text-white relative z-10 flex items-center gap-1">
                  {echoBalance.toFixed(2)} 
                  <span className="text-gray-400 text-[9px] sm:text-[10px] hidden sm:inline">ECHO</span>
                </span>
              </Link>
              
              {user ? (
                <div className="flex items-center gap-3">
                  {/* Notifications */}
                  <div className="relative">
                    <button 
                      onClick={() => {
                        setShowNotifications(!showNotifications);
                        if (!showNotifications) markNotificationsAsRead();
                      }}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors relative"
                    >
                      <Bell className="w-5 h-5 text-gray-300 hover:text-white" />
                      {notifications.filter(n => !n.is_read).length > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-[#09090c]" />
                      )}
                    </button>
                    
                    {showNotifications && (
                      <div className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-black/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-[60] custom-scrollbar p-2">
                        <div className="px-3 py-2 border-b border-white/5 mb-2">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">通知 (Notifications)</h4>
                        </div>
                        {notifications.length > 0 ? notifications.map((n) => (
                          <div key={n.id} className={`p-3 rounded-xl flex items-start gap-3 transition-colors ${n.is_read ? 'opacity-70 hover:bg-white/5' : 'bg-white/5 hover:bg-white/10'}`}>
                            <img src={n.actor?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=N'} alt="Actor" className="w-8 h-8 rounded-full border border-white/10 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-white leading-relaxed">
                                <span className="font-bold text-echo-primary">{n.actor?.display_name}</span> {n.message}
                              </p>
                              <p className="text-[9px] text-gray-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                        )) : (
                          <div className="py-8 text-center text-gray-500 text-xs">暂无新通知</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <Link href="/profile" className="block w-9 h-9 rounded-full bg-gray-800 border border-gray-700 overflow-hidden cursor-pointer hover:border-echo-primary transition-colors">
                      <img src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} alt="User" className="w-full h-full object-cover" />
                    </Link>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setIsAuthOpen(true)}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-4 rounded-full transition-all border border-white/10"
                >
                  {tSafe('nav.login')}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
