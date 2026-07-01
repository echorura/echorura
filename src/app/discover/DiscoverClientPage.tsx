'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import {
  Search,
  Music,
  Heart,
  Zap,
  Moon,
  Cloud,
  Flame,
  Smile,
  Award,
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
  Sparkles,
  Info,
  Play,
  Disc3,
  ListFilter,
  Users,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Lock,
  Loader2,
  FolderPlus
} from 'lucide-react';
import AddToPlaylistModal from '@/components/player/AddToPlaylistModal';
import PlaylistDetailModal from '@/components/player/PlaylistDetailModal';
import { usePlayerStore } from '@/store/playerStore';
import { useSearchParams } from 'next/navigation';
import { FALLBACK_SONGS } from '@/utils/mockData';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguageStore } from '@/store/languageStore';



const SongRow = ({ song, onPlay, currentTrack, isPlaying, onAddToPlaylist }: any) => {
  const { t } = useLanguageStore();
  const isActive = currentTrack?.id === song.id;
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all cursor-pointer group ${isActive ? 'bg-echo-primary/10 border border-echo-primary/20' : 'hover:bg-white/5 border border-transparent'
        }`}
      onClick={onPlay}
    >
      <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-md">
        <img src={song.cover_url || song.cover} alt={song.title} loading="lazy" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className={`w-4 h-4 fill-white text-white ${!isActive && 'ml-0.5'}`} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={`font-bold text-sm truncate ${isActive ? 'text-echo-primary' : 'text-white'}`}>{song.title}</h4>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-gray-500 text-[11px] truncate">{song.creator?.display_name || song.artist}</p>
          <span className="text-gray-700 text-[9px]">•</span>
          <span className="text-gray-500 text-[9px] font-mono">{song.play_count ?? 0} {t('discover.play_count')}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {(song.tags?.[0] || song.genre) && <span className="text-[8px] bg-echo-primary/10 text-echo-primary px-1.5 py-0.5 rounded-md">{song.tags?.[0] || song.genre?.split('/')[0]?.trim()}</span>}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToPlaylist(song);
          }}
          className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          title={t('discover.add_playlist')}
        >
          <FolderPlus className="w-4 h-4 text-echo-primary" />
        </button>
      </div>
    </div>
  );
};

function DiscoverContent() {
  const { t, language } = useLanguageStore();

  const GENRES = [
  { id: 'pop', label: t('genre.pop'), icon: Music, color: 'from-pink-500 to-rose-500' },
  { id: 'hiphop', label: t('genre.hiphop'), icon: Zap, color: 'from-orange-500 to-red-600' },
  { id: 'rnb', label: 'R&B', icon: Heart, color: 'from-fuchsia-500 to-pink-600' },
  { id: 'electro', label: t('genre.electro'), icon: Flame, color: 'from-purple-500 to-indigo-600' },
  { id: 'rock', label: t('genre.rock'), icon: Zap, color: 'from-red-500 to-amber-600' },
  { id: 'kpop', label: 'K-Pop', icon: Sparkles, color: 'from-pink-400 to-purple-500' },
  { id: 'classical', label: t('genre.classical'), icon: ShieldCheck, color: 'from-blue-600 to-indigo-800' },
  { id: 'jazz', label: t('genre.jazz'), icon: Moon, color: 'from-slate-600 to-slate-900' },
  { id: 'folk', label: t('genre.folk'), icon: Cloud, color: 'from-amber-400 to-orange-500' },
  { id: 'ambient', label: t('genre.ambient'), icon: Cloud, color: 'from-teal-400 to-emerald-600' },
  { id: 'soundtrack', label: t('genre.soundtrack'), icon: Disc3, color: 'from-slate-500 to-gray-700' },
  { id: 'china', label: t('genre.china'), icon: Music, color: 'from-emerald-600 to-teal-800' },
  { id: 'acg', label: t('genre.acg'), icon: Sparkles, color: 'from-cyan-400 to-blue-500' },
  { id: 'alternative', label: t('genre.alternative'), icon: ShieldCheck, color: 'from-indigo-400 to-cyan-600' },
  { id: 'soul', label: t('genre.soul'), icon: Heart, color: 'from-rose-400 to-red-500' }
];

const MOODS = [
  { id: 'midnight', label: t('mood.midnight'), icon: Moon, color: 'text-indigo-400', activeBg: 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] border-indigo-500 text-white', hoverBg: 'hover:border-indigo-500/50 hover:bg-indigo-500/10' },
  { id: 'lonely', label: t('mood.lonely'), icon: Cloud, color: 'text-slate-400', activeBg: 'bg-slate-500 shadow-[0_0_15px_rgba(100,116,139,0.4)] border-slate-500 text-white', hoverBg: 'hover:border-slate-500/50 hover:bg-slate-500/10' },
  { id: 'sad', label: t('mood.sad'), icon: Heart, color: 'text-blue-400', activeBg: 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)] border-blue-500 text-white', hoverBg: 'hover:border-blue-500/50 hover:bg-blue-500/10' },
  { id: 'healing', label: t('mood.healing'), icon: Smile, color: 'text-emerald-400', activeBg: 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] border-emerald-500 text-white', hoverBg: 'hover:border-emerald-500/50 hover:bg-emerald-500/10' },
  { id: 'relax', label: t('mood.relax'), icon: Cloud, color: 'text-teal-400', activeBg: 'bg-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.4)] border-teal-500 text-white', hoverBg: 'hover:border-teal-500/50 hover:bg-teal-500/10' },
  { id: 'focus', label: t('mood.focus'), icon: ShieldCheck, color: 'text-cyan-400', activeBg: 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)] border-cyan-500 text-white', hoverBg: 'hover:border-cyan-500/50 hover:bg-cyan-500/10' },
  { id: 'meditation', label: t('mood.meditation'), icon: Moon, color: 'text-purple-400', activeBg: 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)] border-purple-500 text-white', hoverBg: 'hover:border-purple-500/50 hover:bg-purple-500/10' },
  { id: 'sleep', label: t('mood.sleep'), icon: Moon, color: 'text-violet-400', activeBg: 'bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.4)] border-violet-500 text-white', hoverBg: 'hover:border-violet-500/50 hover:bg-violet-500/10' },
  { id: 'hot', label: t('mood.hot'), icon: Flame, color: 'text-orange-500', activeBg: 'bg-orange-600 shadow-[0_0_15px_rgba(234,88,12,0.4)] border-orange-600 text-white', hoverBg: 'hover:border-orange-500/50 hover:bg-orange-500/10' },
  { id: 'workout', label: t('mood.workout'), icon: Zap, color: 'text-red-500', activeBg: 'bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.4)] border-red-600 text-white', hoverBg: 'hover:border-red-500/50 hover:bg-red-500/10' },
  { id: 'party', label: t('discover.genre_party'), icon: Sparkles, color: 'text-pink-500', activeBg: 'bg-pink-600 shadow-[0_0_15px_rgba(219,39,119,0.4)] border-pink-600 text-white', hoverBg: 'hover:border-pink-500/50 hover:bg-pink-500/10' },
  { id: 'joy', label: t('discover.genre_joy'), icon: Smile, color: 'text-yellow-400', activeBg: 'bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)] border-yellow-500 text-black', hoverBg: 'hover:border-yellow-500/50 hover:bg-yellow-500/10' },
  { id: 'cyber', label: t('discover.genre_cyber'), icon: Zap, color: 'text-echo-primary', activeBg: 'bg-echo-primary shadow-[0_0_15px_rgba(0,240,255,0.4)] border-echo-primary text-black', hoverBg: 'hover:border-echo-primary/50 hover:bg-echo-primary/10' },
];

  const searchParams = useSearchParams();
  const queryParam = searchParams.get('q') || '';

  const { setTrack, currentTrack, isPlaying, playSong } = usePlayerStore();
  const [songs, setSongs] = useState<any[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'main' | 'curate'>('main');
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  const [playlistSong, setPlaylistSong] = useState<any | null>(null);
  const [recommendedPlaylists, setRecommendedPlaylists] = useState<any[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  const [curateSongs, setCurateSongs] = useState<any[]>([]);
  const [votedSongIds, setVotedSongIds] = useState<number[]>([]);
  const [arenaPhase, setArenaPhase] = useState<'day1' | 'day2' | 'day3'>('day2');
  const [myEligibleSongs, setMyEligibleSongs] = useState<any[]>([]);
  const [registeringSongId, setRegisteringSongId] = useState<number | null>(null);

  const [votingSongs, setVotingSongs] = useState<any[]>([]);
  const [pendingSongs, setPendingSongs] = useState<any[]>([]);
  const [settledSongs, setSettledSongs] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);

  const supabase = createClient();

  // Load and sync localStorage voted list
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPhase = localStorage.getItem('arena_phase') as 'day1' | 'day2' | 'day3' | null;
      if (storedPhase) {
        setArenaPhase(storedPhase);
      } else {
        localStorage.setItem('arena_phase', 'day2');
        setArenaPhase('day2');
      }

      const loadVotedRecords = () => {
        const votes = localStorage.getItem('voted_song_ids');
        if (votes) setVotedSongIds(JSON.parse(votes));
      };

      loadVotedRecords();

      const handleStorageUpdate = () => {
        const phase = localStorage.getItem('arena_phase') as 'day1' | 'day2' | 'day3';
        if (phase) setArenaPhase(phase);
        
        const votes = localStorage.getItem('voted_song_ids');
        if (votes) setVotedSongIds(JSON.parse(votes));
      };

      window.addEventListener('storage', handleStorageUpdate);
      return () => window.removeEventListener('storage', handleStorageUpdate);
    }
  }, []);

  const handlePhaseChange = (phase: 'day1' | 'day2' | 'day3') => {
    setArenaPhase(phase);
    if (typeof window !== 'undefined') {
      localStorage.setItem('arena_phase', phase);
      window.dispatchEvent(new Event('storage'));
    }
    showPremiumToast(`🌌 已切换听审阶段为：${phase === 'day1' ? '【第一天：报名期】' : phase === 'day2' ? '【第二天：听审投票期】' : '【第三天：公示结算期】'}`, 'success');
  };

  const fetchSongs = async () => {
    try {
      // 🌟 自动对决状态流转与结算自愈（Self-Healing Engine）
      try {
        const [transRes, settleRes] = await Promise.all([
          fetch('/api/cron/arena-transition').then(r => r.json()).catch(() => ({})),
          fetch('/api/cron/arena-settle').then(r => r.json()).catch(() => ({}))
        ]);
        if ((transRes.transitioned_dates && transRes.transitioned_dates.length > 0) || 
            (settleRes.settled_dates && settleRes.settled_dates.length > 0)) {
          console.log('🎉 听审竞技场成功自动完成阶段流转与结算自愈：', transRes, settleRes);
        }
      } catch (e) {
        console.error('Self-healing process error:', e);
      }

      // 1. 获取全局作品数据及播放量
      const { data } = await supabase
        .from('songs')
        .select('*, creator:profiles(display_name, avatar_url)')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        const songIds = data.map(s => s.id);
        const { data: txsData } = await supabase
          .from('transactions')
          .select('song_id')
          .eq('type', 'listen_reward')
          .in('song_id', songIds);

        const playCounts: { [key: number]: number } = {};
        txsData?.forEach(tx => {
          if (tx.song_id) {
            playCounts[tx.song_id] = (playCounts[tx.song_id] || 0) + 1;
          }
        });

        const songsWithCounts = data.map(song => ({
          ...song,
          play_count: playCounts[song.id] || 0,
          votes: song.votes || 0
        }));
        setSongs(songsWithCounts);
      } else {
        setSongs([]);
      }

      // 2. 🌟 从数据库加载全部听审竞技场记录并在内存中分区存储
      const { data: regsData, error: regsError } = await supabase
        .from('arena_registrations')
        .select('*, song:songs(*, creator:profiles(display_name, avatar_url))')
        .order('votes_count', { ascending: false });

      if (!regsError && regsData) {
        const allRegs = regsData
          .filter((reg: any) => reg.song !== null)
          .map((reg: any) => ({
            ...reg.song,
            votes: reg.votes_count,
            arena_date: reg.arena_date,
            status: reg.status,
            registration_id: reg.id
          }));

        const votingAll = allRegs.filter(r => r.status === 'voting');
        const latestVotingDate = votingAll.reduce((max, r) => r.arena_date > max ? r.arena_date : max, '');
        const voting = votingAll.filter(r => r.arena_date === latestVotingDate);

        const pending = allRegs.filter(r => r.status === 'pending')
          .sort((a, b) => a.arena_date.localeCompare(b.arena_date));

        const settledAll = allRegs.filter(r => r.status === 'winner' || r.status === 'loser');
        const latestSettledDate = settledAll.reduce((max, r) => r.arena_date > max ? r.arena_date : max, '');
        const settled = settledAll.filter(r => r.arena_date === latestSettledDate);

        setVotingSongs(voting);
        setPendingSongs(pending);
        setSettledSongs(settled);
        setPendingCount(pending.length);

        // 为兼容现有逻辑，绑定 curateSongs 状态到当前模拟的阶段列表
        if (arenaPhase === 'day1') {
          setCurateSongs(pending);
        } else if (arenaPhase === 'day2') {
          setCurateSongs(voting);
        } else {
          setCurateSongs(settled);
        }
      } else {
        setVotingSongs([]);
        setPendingSongs([]);
        setSettledSongs([]);
        setPendingCount(0);
        setCurateSongs([]);
      }

      // 3. 加载当前登录用户的原创歌曲以供报名 (Day 1 专属)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: mySongsData } = await supabase
          .from('songs')
          .select('*, creator:profiles(display_name, avatar_url)')
          .eq('creator_id', session.user.id);
        
        if (mySongsData) {
          const formatter = new Intl.DateTimeFormat('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
          const parts = formatter.formatToParts(new Date());
          const year = parts.find(p => p.type === 'year')?.value;
          const month = parts.find(p => p.type === 'month')?.value;
          const day = parts.find(p => p.type === 'day')?.value;
          const todayStr = `${year}-${month}-${day}`;

          const { data: registeredToday } = await supabase
            .from('arena_registrations')
            .select('song_id')
            .eq('creator_id', session.user.id)
            .eq('arena_date', todayStr);

          const registeredIds = registeredToday?.map(r => r.song_id) || [];
          const eligible = mySongsData.filter(s => !registeredIds.includes(s.id));
          setMyEligibleSongs(eligible);
        }
      } else {
        setMyEligibleSongs([]);
      }

      // 4. 🌟 加载公开歌单，并按热度（歌曲数量）排序，取前 4 个作为推荐歌单
      const { data: playlistsData } = await supabase
        .from('playlists')
        .select(`
          *,
          creator:profiles(display_name, avatar_url),
          playlist_songs(
            *,
            song:songs(
              *,
              creator:profiles(display_name, avatar_url)
            )
          )
        `)
        .eq('is_public', true);

      if (playlistsData) {
        const popularPlaylists = playlistsData
          .map((pl: any) => ({
            ...pl,
            songCount: pl.playlist_songs?.length || 0
          }))
          .sort((a: any, b: any) => b.songCount - a.songCount || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 4);

        setRecommendedPlaylists(popularPlaylists);
      } else {
        setRecommendedPlaylists([]);
      }

    } catch (e) {
      console.error('[Discover Page] Error loading data:', e);
      setSongs([]);
      setCurateSongs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();

    window.addEventListener('play-count-updated', fetchSongs);
    return () => {
      window.removeEventListener('play-count-updated', fetchSongs);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arenaPhase]);

  useEffect(() => {
    let result = songs;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        (s.title?.toLowerCase().includes(q)) ||
        (s.artist?.toLowerCase().includes(q)) ||
        (s.creator?.display_name?.toLowerCase().includes(q))
      );
    }
    if (selectedGenre) {
      const genre = GENRES.find(g => g.label === selectedGenre || g.id === selectedGenre);
      result = result.filter(s =>
        s.tags?.includes(genre?.label) || s.tags?.includes(genre?.id) ||
        s.genre?.toLowerCase().includes(genre?.label?.toLowerCase() || '') ||
        s.genre?.toLowerCase().includes(genre?.id?.toLowerCase() || '')
      );
    }
    if (selectedMood) {
      const mood = MOODS.find(m => m.label === selectedMood || m.id === selectedMood);
      result = result.filter(s =>
        s.moods?.includes(mood?.label) || s.moods?.includes(mood?.id) ||
        s.genre?.toLowerCase().includes(mood?.label?.toLowerCase() || '')
      );
    }
    setFilteredSongs(result);
  }, [searchQuery, selectedGenre, selectedMood, songs]);

  const handleClearAll = () => {
    setSelectedGenre(null);
    setSelectedMood(null);
    setSearchQuery('');
  };

  const handlePlay = (song: any) => {
    setTrack({
      id: song.id,
      title: song.title,
      artist: song.artist,
      cover: song.cover_url,
      src: song.audio_url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      earnRate: song.earn_rate || 0.01,
      lyrics: song.lyrics
    });
  };

  const handlePlayPlaylist = (playlist: any) => {
    const allSongs = playlist.playlist_songs?.map((ps: any) => ps.song).filter(Boolean) || [];
    // Bug #4 fix: only pass songs that have a valid audio_url, so playSong doesn't silently skip them
    const playableSongs = allSongs.filter((s: any) => !!s.audio_url);
    if (playableSongs.length > 0) {
      playSong(playableSongs[0], playableSongs);
      showPremiumToast(`🎧 正在为您播放推荐歌单《${playlist.name}》`, "success");
    } else if (allSongs.length > 0) {
      showPremiumToast("⚠️ 该歌单的歌曲暂无音频，无法播放", "error");
    } else {
      showPremiumToast("⚠️ 该歌单暂无歌曲，无法播放", "error");
    }
  };

  const showPremiumToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4500);
  };

  const handleRegisterForArena = async (songId: number) => {
    setRegisteringSongId(songId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        showPremiumToast("🔒 请先登录后再报名参赛！", "error");
        return;
      }

      const res = await fetch('/api/arena/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ songId })
      });

      const result = await res.json();
      if (!res.ok) {
        showPremiumToast(`❌ 报名失败: ${result.error || '余额不足或今日已满'}`, "error");
        return;
      }

      showPremiumToast(`🎉 报名成功！已成功质押 10.00 ECHO。作品在今日报名队列第 ${result.position} 位！`, "success");
      
      // 更新全局钱包余额显示 (如果有 store 里的 setBalance 方法则更新)
      if (result.remaining_balance !== undefined && (usePlayerStore.getState() as any).setBalance) {
        (usePlayerStore.getState() as any).setBalance(result.remaining_balance);
      }

      fetchSongs();
    } catch (err: any) {
      showPremiumToast(`❌ 报名失败: ${err.message || '网络连接错误'}`, "error");
    } finally {
      setRegisteringSongId(null);
    }
  };

  const handleVote = (e: React.MouseEvent, songId: number, type: 'up' | 'down') => {
    e.preventDefault();
    e.stopPropagation();

    if (arenaPhase !== 'day2') {
      showPremiumToast("⚠️ 当前不是听审投票期！只有在 [第二天：听审投票期] 才能对歌曲进行评价打分哦！", "error");
      return;
    }

    if (votedSongIds.includes(songId)) {
      showPremiumToast("您已对该作品进行过听审打分，感谢您的支持！", "error");
      return;
    }

    const fetchSessionAndVote = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          showPremiumToast("🔒 请先登录后再参与听审打分！", "error");
          return;
        }

        const res = await fetch('/api/arena/vote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ songId, type })
        });

        const result = await res.json();
        if (!res.ok) {
          showPremiumToast(`❌ 投票失败: ${result.error || '服务器异常'}`, "error");
          return;
        }

        // 成功投票后，更新本地已投记录以防重复投票
        setVotedSongIds(prevVoted => {
          const newVoted = [...prevVoted, songId];
          if (typeof window !== 'undefined') {
            localStorage.setItem('voted_song_ids', JSON.stringify(newVoted));
          }
          return newVoted;
        });

        // 成功后，更新本地及竞技场曲目的票数状态
        const serverVotes = result.votes_count;
        setCurateSongs(prevSongs =>
          prevSongs.map(s => (s.id === songId ? { ...s, votes: serverVotes } : s))
        );
        setSongs(prevSongs =>
          prevSongs.map(s => (s.id === songId ? { ...s, votes: serverVotes } : s))
        );

        if (type === 'up') {
          showPremiumToast("🎉 伯乐投票支持成功！当前票数已计入结算排名，排位实时刷新中！", "success");
        } else {
          showPremiumToast("🔽 评价成功，该歌曲评分已下沉。若本批次结算未能杀入前10，锁定质押金将作为报酬均分给您在内的听审员！", "success");
        }
      } catch (err: any) {
        showPremiumToast(`❌ 投票失败: ${err.message || '网络连接异常'}`, "error");
      }
    };

    fetchSessionAndVote();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24 px-4 relative">
      {/* Premium Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 20, scale: 0.9, filter: "blur(10px)" }}
            className={`fixed bottom-8 right-8 z-[250] flex items-center gap-3 px-6 py-4 rounded-2xl border backdrop-blur-md shadow-2xl max-w-md ${toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-950/90 border-rose-500/30 text-rose-400'
              }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            )}
            <span className="text-xs font-black uppercase tracking-wider leading-relaxed">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Slide Selector (Tab Toggle) */}
      <div className="flex justify-center pt-2 sm:pt-6">
        <div className="bg-white/5 border border-white/10 p-1 rounded-[1.8rem] flex relative backdrop-blur-md">
          <button
            onClick={() => setActiveTab('main')}
            className={`px-4 sm:px-8 py-2.5 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-wider sm:tracking-widest transition-all relative z-10 flex items-center gap-1.5 sm:gap-2 ${activeTab === 'main' ? 'text-black font-black' : 'text-gray-400 hover:text-white'
              }`}
          >
            <Disc3 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTab === 'main' ? 'animate-spin-slow text-black' : 'text-gray-400'}`} />
            <span>{t('discover.main_stage')}<span className="hidden sm:inline"> (Main Stage)</span></span>
          </button>
          <button
            onClick={() => setActiveTab('curate')}
            className={`px-4 sm:px-8 py-2.5 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-wider sm:tracking-widest transition-all relative z-10 flex items-center gap-1.5 sm:gap-2 ${activeTab === 'curate' ? 'text-black font-black' : 'text-gray-400 hover:text-white'
              }`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{t('discover.arena')}<span className="hidden sm:inline"> (Curation Arena)</span></span>
            <span className="absolute -top-1 -right-1 bg-echo-secondary text-black font-black text-[6px] sm:text-[7px] px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded-full uppercase scale-75 sm:scale-90">
              AI + DAO
            </span>
          </button>

          {/* Animated Slider Background */}
          <motion.div
            className="absolute top-1 bottom-1 rounded-2xl bg-gradient-to-r from-echo-primary to-echo-secondary"
            initial={false}
            animate={{
              left: activeTab === 'main' ? '4px' : 'calc(50% + 2px)',
              width: 'calc(50% - 6px)'
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'main' ? (
          <motion.div
            key="main-stage-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35 }}
            className="space-y-12"
          >
            {/* Genre Explorer */}
            <section>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 bg-echo-primary rounded-full"></div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">{t('discover.genre')}</h2>
                </div>
                {selectedGenre && (
                  <button onClick={handleClearAll} className="text-xs font-black text-echo-primary uppercase tracking-widest hover:underline">
                    {t('discover.clear_filters')}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10 gap-3">
                {GENRES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedGenre(cat.label === selectedGenre ? null : cat.label)}
                      className={`group relative overflow-hidden rounded-xl p-3 md:p-4 transition-all border border-white/5 ${selectedGenre === cat.label
                          ? 'ring-2 ring-echo-primary scale-105 shadow-[0_0_20px_rgba(0,240,255,0.2)]'
                          : 'hover:scale-105 hover:border-white/10'
                        }`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-70 group-hover:opacity-90 transition-opacity`}></div>
                      <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 h-full">
                        <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        <span className="text-[10px] md:text-[11px] font-black text-white uppercase text-center leading-tight">{cat.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Mood Explorer */}
            <section>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 bg-echo-secondary rounded-full"></div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">{t('discover.soul_state')}</h2>
                </div>
                {selectedMood && (
                  <button onClick={handleClearAll} className="text-xs font-black text-echo-secondary uppercase tracking-widest hover:underline">
                    {t('discover.clear_filters')}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {MOODS.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedMood(cat.label === selectedMood ? null : cat.label)}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all duration-300 ${selectedMood === cat.label
                          ? cat.activeBg
                          : `bg-white/5 border-white/10 ${cat.color} ${cat.hoverBg}`
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className={`text-[11px] font-bold tracking-widest ${selectedMood === cat.label ? '' : 'text-gray-300'}`}>
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Recommended Playlists */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-8 bg-echo-primary rounded-full"></div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">{t('discover.playlists')}</h2>
              </div>

              {recommendedPlaylists.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {recommendedPlaylists.map((playlist) => {
                    const songsList = playlist.playlist_songs?.map((ps: any) => ps.song).filter(Boolean) || [];
                    const songCount = songsList.length;
                    
                    return (
                      <div 
                        key={playlist.id} 
                        onClick={() => setSelectedPlaylistId(playlist.id)}
                        className="glass-panel p-5 rounded-[2.5rem] border border-white/5 bg-white/[0.01] hover:border-echo-primary/30 hover:bg-white/5 transition-all duration-300 group flex flex-col justify-between h-full relative cursor-pointer"
                      >
                        {/* Vinyl Artwork / Album Cover */}
                        <div className="w-full aspect-square rounded-3xl overflow-hidden relative bg-black/40 border border-white/10 shrink-0">
                          <img 
                            src={playlist.cover_url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400&h=400'} 
                            alt={playlist.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                          />
                          {songCount > 0 && (
                            <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlayPlaylist(playlist);
                                }}
                              className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-echo-primary text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-echo-primary/40 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-pointer"
                              title={t('discover.arena_title')}
                            >
                              <Play className="w-5 h-5 fill-black ml-0.5" />
                            </button>
                          )}
                          {songCount === 0 && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-[10px] text-gray-400 font-bold px-2 py-1 bg-black/80 rounded border border-white/10">{t('discover.no_songs')}</span>
                            </div>
                          )}
                        </div>

                        {/* Title and details */}
                        <div className="mt-4 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="text-white text-base font-black truncate tracking-tight group-hover:text-echo-primary transition-colors">{playlist.name}</h4>
                            <p className="text-xs text-gray-400 line-clamp-2 mt-1.5 leading-relaxed">{playlist.description || t('discover.default_playlist_desc')}</p>
                          </div>

                          <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/5">
                            <span className="text-[10px] bg-white/5 text-gray-400 font-bold px-2.5 py-1 rounded-full border border-white/5 flex items-center gap-1">
                              <Music className="w-3 h-3 text-echo-primary" />
                              {songCount} {t('discover.songs_count')}
                            </span>
                            
                            <div className="flex items-center gap-1.5 overflow-hidden max-w-[120px]">
                              <img 
                                src={playlist.creator?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aria'} 
                                alt={playlist.creator?.display_name} 
                                className="w-4 h-4 rounded-full object-cover shrink-0 border border-white/10" 
                              />
                              <span className="text-[10px] text-gray-500 font-bold truncate">@{playlist.creator?.display_name || t('discover.echorura_user')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center glass-panel rounded-3xl border border-white/5 bg-white/2 space-y-3">
                  <p className="text-xs text-gray-500">{t('discover.no_playlists')}</p>
                </div>
              )}
            </section>

            {/* Results Grid */}
            <section>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <ListFilter className="w-6 h-6 text-echo-primary animate-pulse" />
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                    {language === 'zh' ? '探索结果' : (language === 'ja' ? '探索結果' : 'Explore Results')} {(selectedGenre || selectedMood) && `(${[selectedGenre, selectedMood].filter(Boolean).join(' + ')})`}
                  </h2>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="w-8 h-8 border-4 border-echo-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredSongs.length > 0 ? (
                <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-2 space-y-0.5">
                  {filteredSongs.map((song) => (
                    <SongRow 
                      key={song.id} 
                      song={song} 
                      currentTrack={currentTrack} 
                      isPlaying={isPlaying} 
                      onPlay={() => handlePlay(song)} 
                      onAddToPlaylist={(s: any) => setPlaylistSong(s)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
                  <p className="text-gray-500 font-medium">{t('discover.no_results')}</p>
                </div>
              )}
            </section>
          </motion.div>
        ) : (
          <motion.div
            key="curation-arena-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35 }}
            className="space-y-12"
          >

            {/* Curation Arena Explanation Card */}
            <section className="relative rounded-[2.5rem] bg-gradient-to-br from-purple-950/10 via-black to-echo-secondary/5 border border-white/10 p-8 md:p-12 overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-80 h-80 bg-echo-secondary/5 blur-[100px] rounded-full -mr-40 -mt-40 pointer-events-none"></div>

              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="max-w-2xl space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black text-echo-secondary uppercase tracking-widest">
                    <Award className="w-3.5 h-3.5 text-echo-secondary animate-pulse" />
                    {t('discover.dao_badge')}
                  </div>
                  <h1 className="text-3xl md:text-5xl font-black text-white leading-none tracking-tighter uppercase italic">
                    {t('discover.arena_title')} <br />
                    <span className="text-gradient inline-block py-2 pr-6 pl-1">
                      {arenaPhase === 'day1' && t('discover.day1_label')}
                      {arenaPhase === 'day2' && t('discover.day2_label')}
                      {arenaPhase === 'day3' && t('discover.day3_label')}
                    </span>
                  </h1>

                  {arenaPhase === 'day1' && (
                    <p className="text-gray-400 text-xs leading-relaxed">
                      {t('discover.day1_desc')}
                    </p>
                  )}
                  {arenaPhase === 'day2' && (
                    <p className="text-gray-400 text-xs leading-relaxed">
                      {t('discover.day2_desc')}
                    </p>
                  )}
                  {arenaPhase === 'day3' && (
                    <p className="text-gray-400 text-xs leading-relaxed">
                      {t('discover.day3_desc')}
                    </p>
                  )}
                </div>

                <div className="shrink-0 bg-white/5 border border-white/10 p-5 rounded-3xl space-y-3 max-w-[240px] w-full md:w-auto">
                  <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-widest">
                    <Zap className="w-4 h-4 text-echo-secondary" />
                    {t('discover.dashboard')}
                  </div>
                  <div className="space-y-1 text-[10px] text-gray-400 font-mono">
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span>{t('discover.songs_today')}</span>
                      <span className="text-white font-bold">{votingSongs.length}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 py-1">
                      <span>{t('discover.rank_rule')}</span>
                      <span className={`${votingSongs.length === 0 ? 'text-gray-500' : votingSongs.length < 10 ? 'text-emerald-400' : 'text-amber-400'} font-bold`}>
                        {votingSongs.length === 0 ? t('discover.no_duel') : votingSongs.length < 10 ? t('discover.all_qualify') : t('discover.top10')}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span>{t('discover.queue_status')}</span>
                      <span className="text-white font-bold">{pendingCount}/20</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Day 1: Creator Registration Section */}
            {arenaPhase === 'day1' && (
              <section className="glass-panel p-6 rounded-[2.5rem] border border-white/10 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-echo-secondary animate-pulse" />
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    {t('discover.creator_channel')}
                  </h3>
                </div>
                {myEligibleSongs.length === 0 ? (
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {t('discover.no_songs_to_register')}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {myEligibleSongs.map((song) => (
                      <div 
                        key={song.id} 
                        className="flex flex-col justify-between p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-echo-primary/30 transition-all space-y-3"
                      >
                        <div>
                          <p className="text-xs font-bold text-white line-clamp-1">{song.title}</p>
                          <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">{t('discover.artist_label')} {song.artist || 'Indie'}</p>
                        </div>
                        <button
                          disabled={registeringSongId !== null}
                          onClick={() => handleRegisterForArena(song.id)}
                          className="w-full py-2 bg-echo-secondary hover:bg-echo-secondary-hover text-black font-black text-[9px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50 cursor-pointer"
                        >
                          {registeringSongId === song.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-black" />
                              {t('discover.staking')}
                            </>
                          ) : (
                            <>
                              <span>{t('discover.stake_register')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Curating List - Dual-List Architecture */}
            <div className="space-y-12">
              
              {/* Section 1: 本日待投票对决金曲 (LIVE VOTING) */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-echo-secondary rounded-full"></div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">
                      {arenaPhase === 'day3' ? t('discover.settled') : t('discover.live_duels')}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-2xl border border-white/5 text-[10px] font-bold text-gray-400">
                    <span className="text-echo-primary font-mono">{t('discover.deadline')}</span>
                  </div>
                </div>

                {(arenaPhase === 'day3' ? settledSongs : votingSongs).length === 0 ? (
                  <div className="glass-panel p-12 rounded-[2.5rem] border border-white/10 text-center flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-echo-primary/10 flex items-center justify-center text-echo-primary border border-echo-primary/20">
                      <Zap className="w-6 h-6 animate-pulse" />
                    </div>
                    <h3 className="text-sm font-bold text-white uppercase italic tracking-wider">{t('discover.no_duel_songs')}</h3>
                    <p className="text-[11px] text-gray-500 max-w-sm">
                      {t('discover.no_duel_desc')}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {(arenaPhase === 'day3' ? settledSongs : votingSongs)
                      .slice()
                      .sort((a, b) => b.votes - a.votes)
                      .map((song, index) => {
                        const rank = index + 1;
                        const hasVoted = votedSongIds.includes(song.id);
                        
                        let isWinner = false;
                        let isFallbackFeatured = false;
                        const activeList = arenaPhase === 'day3' ? settledSongs : votingSongs;
                        if (activeList.length < 10) {
                          isFallbackFeatured = true;
                          isWinner = true;
                        } else if (rank <= 10) {
                          isWinner = true;
                        }

                        return (
                          <div
                            key={song.id}
                            className={`glass-panel p-6 rounded-[2.5rem] border transition-all flex flex-col md:flex-row items-center gap-6 relative overflow-hidden group ${
                              arenaPhase === 'day3'
                                ? isWinner
                                  ? 'border-echo-secondary/50 shadow-[0_0_30px_rgba(235,0,255,0.1)] bg-echo-secondary/5'
                                  : 'border-white/5 opacity-50 bg-black/40'
                                : isWinner
                                  ? 'border-echo-primary/40 shadow-[0_0_25px_rgba(0,240,255,0.06)]'
                                  : 'border-white/10 hover:border-echo-secondary/40'
                            }`}
                          >
                            {/* Rank Badge */}
                            <div className={`absolute top-0 left-0 px-5 py-2.5 rounded-br-2xl text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 z-10 ${
                              isFallbackFeatured
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-[0_4px_10px_rgba(16,185,129,0.3)]'
                                : rank <= 10
                                  ? 'bg-gradient-to-r from-echo-primary to-echo-secondary text-black shadow-[0_4px_10px_rgba(0,240,255,0.3)]'
                                  : 'bg-white/10 text-gray-400'
                            }`}>
                              <span>{rank.toString().padStart(2, '0')}</span>
                              <span>•</span>
                              <span>
                                {isFallbackFeatured ? t('discover.all_qualify') : rank <= 10 ? t('discover.qualified') : t('discover.pending')}
                              </span>
                            </div>

                            {/* Seal & Staking Badge */}
                            <div className="absolute top-4 right-4 flex items-center gap-3">
                              {arenaPhase === 'day3' ? (
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                                  isWinner
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                }`}>
                                  {isWinner ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                  {isWinner ? t('discover.winner_settled') : t('discover.loser_settled')}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-echo-primary/10 border border-echo-primary/20 text-[9px] font-black text-echo-primary uppercase tracking-widest shadow-[0_0_15px_rgba(0,240,255,0.15)]">
                                  <Sparkles className="w-3.5 h-3.5 text-echo-primary animate-pulse" />
                                  {t('discover.stake_locked')}
                                </div>
                              )}
                              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                {t('discover.ai_pass')}
                              </div>
                            </div>

                            {/* Cover */}
                            <div className="w-28 h-28 md:w-32 md:h-32 rounded-2xl overflow-hidden relative shrink-0 shadow-2xl group/cover border border-white/10 mt-6 md:mt-0">
                              <img src={song.cover_url} loading="lazy" className="w-full h-full object-cover transition-transform group-hover/cover:scale-110" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handlePlay(song)}
                                  className="w-10 h-10 rounded-full bg-echo-secondary text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
                                >
                                  <Play className="w-5 h-5 fill-black text-black ml-0.5" />
                                </button>
                              </div>
                            </div>

                            {/* Song details */}
                            <div className="flex-1 w-full space-y-4 pt-2 md:pt-0">
                              <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                  <h3 className="text-lg font-black text-white truncate uppercase">{song.title}</h3>
                                  <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-gray-400 font-mono">
                                    {song.bitrate || '320kbps'}
                                  </span>
                                  <span className="text-[9px] bg-echo-secondary/15 text-echo-secondary px-2 py-0.5 rounded-md font-mono font-bold">
                                    {t('discover.ai_score')} {song.aiScore || 88}
                                  </span>
                                </div>
                                {song.creator_id ? (
                                  <Link
                                    href={`/artist/${song.creator_id}`}
                                    className="text-echo-primary text-xs font-mono hover:underline inline-block"
                                  >
                                    Uploaded By {song.artist}
                                  </Link>
                                ) : (
                                  <p className="text-echo-primary text-xs font-mono">Uploaded By {song.artist}</p>
                                )}
                                <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">{song.genre || t('discover.genre_pop')}</p>
                              </div>

                              {/* Voting Progress */}
                              {arenaPhase !== 'day3' && (
                                <div className="space-y-2">
                                  <div className="flex justify-between text-[10px] text-gray-500 font-black tracking-widest uppercase">
                                    <span>{t('discover.support_votes')}</span>
                                    <span className="text-white font-mono">{song.votes} {t('discover.votes')}</span>
                                  </div>
                                  <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden relative border border-white/5">
                                    <motion.div
                                      className={`h-full bg-gradient-to-r ${isFallbackFeatured ? 'from-emerald-400 to-teal-400' : 'from-echo-primary to-echo-secondary'}`}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.min(100, (song.votes / Math.max(...activeList.map((s: any) => s.votes), 1)) * 100)}%` }}
                                      transition={{ duration: 0.6 }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Day 3 Settlement explanation */}
                              {arenaPhase === 'day3' && (
                                <div className={`p-4 rounded-2xl border text-[11px] leading-relaxed ${
                                  isWinner
                                    ? isFallbackFeatured
                                      ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400'
                                      : 'bg-echo-secondary/10 border-echo-secondary/20 text-echo-secondary'
                                    : 'bg-rose-950/10 border-rose-500/10 text-gray-500'
                                }`}>
                                  {isWinner ? (
                                    isFallbackFeatured ? (
                                      <p>
                                        {t('discover.protect_msg')}
                                      </p>
                                    ) : (
                                      <p>
                                        {t('discover.winner_msg')}
                                      </p>
                                    )
                                  ) : (
                                    <p>
                                      {t('discover.loser_msg')}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Voting Controls */}
                            <div className="flex flex-row md:flex-col gap-3 w-full md:w-auto shrink-0 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                              {arenaPhase === 'day3' ? (
                                <div className="w-full md:w-36 py-3 text-center text-[10px] text-gray-600 font-bold uppercase border border-dashed border-white/5 rounded-xl">
                                  {t('discover.voting_closed')}
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => handleVote(e, song.id, 'up')}
                                    disabled={hasVoted}
                                    className={`flex-1 md:w-36 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                      hasVoted
                                        ? 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                                        : 'bg-echo-secondary text-black hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(235,0,255,0.2)]'
                                    }`}
                                  >
                                    <ThumbsUp size={14} className="text-current" />
                                    {hasVoted ? t('discover.voted') : t('discover.support')}
                                  </button>
                                  <button
                                    onClick={(e) => handleVote(e, song.id, 'down')}
                                    disabled={hasVoted}
                                    className={`flex-1 md:w-36 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                      hasVoted
                                        ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed opacity-40'
                                        : 'bg-white/5 text-white border border-white/10 hover:bg-rose-950/20 hover:border-rose-500/30 hover:text-rose-400 active:scale-95'
                                    }`}
                                  >
                                    <ThumbsDown size={14} />
                                    {t('discover.sink')}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </section>

              {/* Section 2: 今日新报名已排队歌曲 (REGISTERED QUEUE) */}
              <section className="space-y-6 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-purple-500 rounded-full"></div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">
                      {t('discover.queue_title')}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 bg-purple-500/10 px-4 py-2 rounded-2xl border border-purple-500/20 text-[10px] font-bold text-purple-300">
                    <span>{t('discover.queue_full')} {pendingCount}/20</span>
                  </div>
                </div>

                {pendingSongs.length === 0 ? (
                  <div className="glass-panel p-12 rounded-[2.5rem] border border-white/10 text-center flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                      <Music className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white uppercase italic tracking-wider">{t('discover.queue_empty_title')}</h3>
                    <p className="text-[11px] text-gray-500 max-w-xs mb-2">
                      {t('discover.queue_empty_desc')}
                    </p>
                    <Link
                      href="/profile?action=upload"
                      className="bg-gradient-to-r from-purple-500 to-echo-secondary text-black font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer mt-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('discover.goto_profile')}</span>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {pendingSongs
                      .slice()
                      .map((song, index) => {
                        const rank = index + 1;
                        return (
                          <div
                            key={song.id}
                            className="glass-panel p-6 rounded-[2.5rem] border border-purple-500/10 hover:border-purple-500/30 transition-all flex flex-col md:flex-row items-center gap-6 relative overflow-hidden group bg-purple-950/2"
                          >
                            {/* Rank Badge */}
                            <div className="absolute top-0 left-0 px-5 py-2.5 rounded-br-2xl text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 z-10 bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-[0_4px_10px_rgba(168,85,247,0.3)]">
                              <span>{rank.toString().padStart(2, '0')}</span>
                              <span>•</span>
                              <span>{t('discover.queued')}</span>
                            </div>

                            {/* Futuristic Locking Seal */}
                            <div className="absolute top-4 right-4 flex items-center gap-3">
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[9px] font-black text-purple-400 uppercase tracking-widest shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                                <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                                {t('discover.stake_locked')}
                              </div>
                              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                {t('discover.waiting_transfer')}
                              </div>
                            </div>

                            {/* Song Cover & Audio Trigger */}
                            <div className="w-28 h-28 md:w-32 md:h-32 rounded-2xl overflow-hidden relative shrink-0 shadow-2xl group/cover border border-white/10 mt-6 md:mt-0">
                              <img src={song.cover_url} className="w-full h-full object-cover transition-transform group-hover/cover:scale-110" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handlePlay(song)}
                                  className="w-10 h-10 rounded-full bg-echo-secondary text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
                                >
                                  <Play className="w-5 h-5 fill-black text-black ml-0.5" />
                                </button>
                              </div>
                            </div>

                            {/* Song Details */}
                            <div className="flex-1 w-full space-y-4 pt-2 md:pt-0">
                              <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                  <h3 className="text-lg font-black text-white truncate uppercase">{song.title}</h3>
                                  <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-gray-400 font-mono">
                                    {song.bitrate || '320kbps'}
                                  </span>
                                  <span className="text-[9px] bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded-md font-mono font-bold">
                                    {t('discover.ai_score')} {song.aiScore || 85}
                                  </span>
                                </div>
                                {song.creator_id ? (
                                  <Link
                                    href={`/artist/${song.creator_id}`}
                                    className="text-purple-400 text-xs font-mono hover:underline inline-block"
                                  >
                                    Uploaded By {song.artist}
                                  </Link>
                                ) : (
                                  <p className="text-purple-400 text-xs font-mono">Uploaded By {song.artist}</p>
                                )}
                                <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">{song.genre || t('discover.genre_pop')}</p>
                              </div>

                              <div className="p-4 rounded-2xl border border-purple-500/20 bg-purple-950/10 text-[11px] text-purple-300 leading-relaxed">
                                {t('discover.queue_locked_msg')}
                              </div>
                            </div>

                            {/* Locked indicator column */}
                            <div className="flex flex-row md:flex-col gap-3 w-full md:w-auto shrink-0 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                              <div className="w-full md:w-36 py-4 text-center text-[10px] text-purple-400 font-black uppercase border border-dashed border-purple-500/20 bg-purple-500/5 rounded-xl flex items-center justify-center gap-1.5">
                                <Lock size={12} className="text-purple-400 shrink-0" />
                                {t('discover.waiting_duel')}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </section>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add to Playlist Modal */}
      {playlistSong && (
        <AddToPlaylistModal
          songId={playlistSong.id}
          songTitle={playlistSong.title}
          onClose={() => setPlaylistSong(null)}
        />
      )}

      {/* Playlist Detail Modal */}
      {selectedPlaylistId && (
        <PlaylistDetailModal
          playlistId={selectedPlaylistId}
          onClose={() => setSelectedPlaylistId(null)}
        />
      )}
    </div>
  );
}

export default function DiscoverClientPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20 bg-black min-h-screen">
        <div className="w-8 h-8 border-4 border-echo-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <DiscoverContent />
    </Suspense>
  );
}

