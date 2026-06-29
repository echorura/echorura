// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguageStore } from '@/store/languageStore';
import { createClient } from '@/utils/supabase/client';
import { usePlayerStore } from '@/store/playerStore';
import { useRouter, usePathname } from 'next/navigation';
import { FALLBACK_SONGS } from '@/utils/mockData';

export default function StartupSequence() {
  const [phase, setPhase] = useState<'logo' | 'text' | 'done'>('logo');
  const [isClient, setIsClient] = useState(false);
  const [sharedSongId, setSharedSongId] = useState<string | null>(null);
  const { language, t } = useLanguageStore();
  const { setTrack, setPlaylist } = usePlayerStore();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  // 初始化检查
  useEffect(() => {
    setIsClient(true);
    if (sessionStorage.getItem('hasSeenStartup') === 'true') {
      setPhase('done');
    }
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const songId = params.get('songId');
      if (songId) {
        setSharedSongId(songId);
      }

      // Detect timezone and set default language if not already stored
      const storedLang = localStorage.getItem('echo-language-storage');
      if (!storedLang) {
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          let detected: 'zh' | 'en' | 'ja' = 'en';
          if (tz && (tz.includes('Tokyo') || tz.includes('Asia/Tokyo'))) {
            detected = 'ja';
          } else if (
            tz && (
              tz.includes('Shanghai') ||
              tz.includes('Hong_Kong') ||
              tz.includes('Taipei') ||
              tz.includes('Macau') ||
              tz.includes('Chongqing') ||
              tz.includes('Beijing') ||
              tz.includes('Harbin') ||
              tz.includes('Urumqi') ||
              tz.includes('Asia/Singapore')
            )
          ) {
            detected = 'zh';
          }
          useLanguageStore.getState().setLanguage(detected);
          console.log(`[Language Auto-Detect] Detected timezone: ${tz}. Setting language to: ${detected}`);
        } catch (err) {
          console.error('Timezone auto-detect error:', err);
        }
      }
    }
  }, []);

  // 自动从 logo 阶段过渡到文本口号阶段（仅在首页且未完成时）
  useEffect(() => {
    if (phase === 'logo' && pathname === '/') {
      const timer = setTimeout(() => {
        setPhase('text');
      }, 3000); // 展示 3 秒的 Logo 品牌唤醒动效
      return () => clearTimeout(timer);
    }
  }, [phase, pathname]);

  // 仅在首页展示开屏动画，避免跳转其他页面（如注册、钱包页）时重复触发
  if (!isClient) return null; // 避免 SSR hydration mismatch
  if (pathname !== '/') return null;
  if (phase === 'done') return null;

  const markDone = () => {
    setPhase('done');
    sessionStorage.setItem('hasSeenStartup', 'true');
  };

  const handleStartJourney = async () => {
    // 检查用户是否登录
    const { data: { session } } = await supabase.auth.getSession();

    // 如果是通过分享歌曲链接进入的，直接尝试加载并播放
    if (sharedSongId) {
      // Clear only the songId parameter from URL immediately (if still present)
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.has('songId')) {
          params.delete('songId');
          const newSearch = params.toString();
          const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
          window.history.replaceState({}, '', newUrl);
        }
      }

      try {
        const { data: songData } = await supabase
          .from('songs')
          .select('*')
          .eq('id', sharedSongId)
          .single();

        if (songData) {
          const track = {
            id: songData.id,
            title: songData.title,
            artist: songData.artist,
            cover: songData.cover_url || songData.cover,
            src: songData.audio_url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            earnRate: Number(songData.earn_rate) || 0.005,
            lyrics: songData.lyrics,
          };
          setPlaylist([track]);
          setTrack(track);
        }
      } catch (err) {
        console.error('Failed to load shared song in startup journey:', err);
      }
      markDone();
      return;
    }

    if (!session) {
      markDone();
      router.push('/register');
      return;
    }

    // 已登录，开始播放逻辑
    const { data: songsData } = await supabase
      .from('songs')
      .select('*')
      .limit(50);

    // 合并真实数据与后备数据
    const allSongs = [...(songsData || []), ...FALLBACK_SONGS];

    if (allSongs.length > 0) {
      // 模拟分析用户偏好：随机挑选一个偏好流派
      const mockGenres = ['电子', '流行', '国风', '爵士'];
      const preferredGenre = mockGenres[Math.floor(Math.random() * mockGenres.length)];
      console.log(`[ECHORURA] 开启旅程：模拟用户偏好流派 -> ${preferredGenre}`);

      // 将歌曲格式化为 Track[]
      const formattedTracks = allSongs.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        cover: s.cover_url || s.cover,
        src: s.audio_url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        earnRate: Number(s.earn_rate) || 0.005,
        lyrics: s.lyrics,
        _genre: s.genre || s.tags?.[0] || '' // 内部使用，方便排序
      }));

      // 将符合偏好的歌曲排在前面，其余随机打乱在后
      const preferredTracks = formattedTracks.filter(t => t._genre.includes(preferredGenre));
      const otherTracks = formattedTracks.filter(t => !t._genre.includes(preferredGenre)).sort(() => 0.5 - Math.random());

      const finalPlaylist = [...preferredTracks, ...otherTracks];

      // 避免全是 otherTracks 导致未完全打乱，如果没有符合偏好的则完全打乱
      if (preferredTracks.length === 0) {
        finalPlaylist.sort(() => 0.5 - Math.random());
      }

      // 保存到全局播放列表并开始播放第一首
      setPlaylist(finalPlaylist);
      setTrack(finalPlaylist[0]);
    }

    // 关闭开屏页面进入主应用
    markDone();
  };

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          key="startup-overlay"
          className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center pointer-events-auto"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          style={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05, filter: "blur(20px)" }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* 动态背景光晕 - 保持常驻以避免转场闪烁 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
            <motion.div
              className="w-[80vw] h-[40vh] blur-[120px] bg-gradient-to-br from-echo-primary/30 via-echo-secondary/20 to-echo-primary/30 rounded-full"
              initial={{ scale: 0.8, rotate: 0 }}
              animate={{ scale: 1.2, rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, repeatType: "loop", ease: "linear" }}
            />
          </div>

          <AnimatePresence mode="wait">
            {/* 阶段 1：Logo 品牌觉醒动画 */}
            {phase === 'logo' && (
              <motion.div
                key="logo-content"
                className="flex flex-col items-center gap-6 relative z-10"
                initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.95, filter: "blur(15px)" }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* 炫酷的玻璃态外圈 Logo */}
                <div className="w-28 h-28 md:w-36 md:h-36 rounded-[2rem] overflow-hidden p-1 bg-gradient-to-br from-echo-primary to-echo-secondary shadow-[0_0_50px_rgba(0,240,255,0.3)] border border-white/10">
                  <img src="/logo_small.jpg" alt="ECHORURA Logo" className="w-full h-full object-cover rounded-[1.8rem]" />
                </div>

                {/* 品牌名称 */}
                <div className="text-center mt-4">
                  <h2 className="text-3xl md:text-5xl font-black tracking-[0.15em] text-white uppercase italic">
                    ECHO<span className="text-gradient pr-4">RURA</span>
                  </h2>
                  <p className="text-[9px] md:text-[11px] text-gray-500 font-bold uppercase tracking-[0.4em] mt-3 mr-[-0.4em] opacity-60">
                    Decentralized Music Ecosystem
                  </p>
                </div>

                {/* 极速进度条 */}
                <div className="w-48 h-[2px] bg-white/10 rounded-full overflow-hidden mt-8">
                  <motion.div
                    className="h-full bg-gradient-to-r from-echo-primary to-echo-secondary"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2.5, ease: "easeInOut" }}
                  />
                </div>
              </motion.div>
            )}

            {/* 阶段 2：大字口号与交互开始页面 */}
            {phase === 'text' && (
              <motion.div
                key="text-content"
                className="relative z-10 max-w-5xl px-6 text-center flex flex-col items-center"
                initial={{ opacity: 0, scale: 1.05, filter: "blur(15px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.95, filter: "blur(15px)" }}
                transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.h1
                  className="text-4xl sm:text-6xl md:text-8xl lg:text-[7rem] font-black text-white mb-6 leading-tight tracking-tighter italic py-4 pr-8 md:pr-12 lg:pr-16"
                  initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: 0.2, duration: 1.2, ease: "easeOut" }}
                >
                  {language === 'zh' ? (
                    <>创作与收听，<br /><span className="text-gradient inline-block py-4 pr-8">皆为价值</span></>
                  ) : (
                    <span className="text-gradient inline-block py-4 pr-8">{t('hero.title')}</span>
                  )}
                </motion.h1>

                <motion.p
                  className="text-gray-400 text-lg md:text-2xl mb-12 leading-relaxed max-w-2xl font-light"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 1.0, ease: "easeOut" }}
                >
                  {t('hero.desc')}
                </motion.p>

                <motion.div
                  className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full justify-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
                >
                  <button
                    onClick={handleStartJourney}
                    className="px-10 py-5 rounded-2xl bg-echo-primary text-black font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(0,240,255,0.4)]"
                  >
                    {t('hero.start')}
                  </button>
                  <button
                    onClick={() => {
                      markDone();
                      router.push('/market');
                    }}
                    className="px-10 py-5 rounded-2xl bg-white/5 text-white font-bold text-lg border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center"
                  >
                    {t('hero.ipo_info')}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
