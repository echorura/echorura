'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { usePlayerStore } from '@/store/playerStore';
import { useTranslation } from '@/store/languageStore';
import { Play, TrendingUp, Sparkles, Globe, Pause, Music2 } from 'lucide-react';
import { fetchSongsResilient, fetchArenaRegistrationsResilient } from '@/utils/supabase/queries';

const SongRow = ({ song, index, currentTrack, isPlaying, onPlay, t }: any) => {
  const isActive = currentTrack?.id === song.id;
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all cursor-pointer group ${
        isActive ? 'bg-echo-primary/10 border border-echo-primary/20' : 'hover:bg-white/5 border border-transparent'
      }`}
      onClick={onPlay}
    >
      {index !== undefined && (
        <div className={`w-5 text-xs font-black italic shrink-0 text-center ${isActive ? 'text-echo-primary' : 'text-gray-700 group-hover:text-gray-400'}`}>
          {isActive && isPlaying ? (
            <div className="flex gap-[2px] items-end h-3 justify-center">
              <div className="w-[3px] bg-echo-primary animate-[music-bar_0.6s_ease-in-out_infinite]" />
              <div className="w-[3px] bg-echo-primary animate-[music-bar_0.9s_ease-in-out_infinite]" />
              <div className="w-[3px] bg-echo-primary animate-[music-bar_0.7s_ease-in-out_infinite]" />
            </div>
          ) : (
            String(index + 1).padStart(2, '0')
          )}
        </div>
      )}

      <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-md">
        <img src={song.cover_url || song.cover} alt={song.title} loading="lazy" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {isActive && isPlaying
            ? <Pause className="w-4 h-4 fill-white text-white" />
            : <Play className="w-4 h-4 fill-white text-white ml-0.5" />
          }
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h4 className={`font-bold text-sm truncate ${isActive ? 'text-echo-primary' : 'text-white'}`}>
          {song.title}
        </h4>
        <div className="flex items-center gap-2 mt-0.5">
          {song.creator_id ? (
            <Link 
              href={`/artist/${song.creator_id}`} 
              onClick={(e) => e.stopPropagation()}
              className="text-gray-500 text-[11px] truncate hover:text-echo-primary hover:underline transition-colors inline-block"
            >
              {song.creator?.display_name || song.creator_name || song.artist}
            </Link>
          ) : (
            <p className="text-gray-500 text-[11px] truncate">
              {song.creator?.display_name || song.creator_name || song.artist}
            </p>
          )}
          <span className="text-gray-700 text-[9px]">•</span>
          <span className="text-gray-500 text-[9px] flex items-center font-mono">
            {song.play_count ?? 0} {t('home.play_count')}
          </span>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-echo-secondary/10 border border-echo-secondary/20 text-[9px] font-black text-echo-secondary uppercase">
        <Sparkles size={8} />
        Earn
      </div>
    </div>
  );
};

export default function HomeClientPage() {
  const { setTrack, setPlaylist, currentTrack, isPlaying, togglePlay } = usePlayerStore();
  const { t } = useTranslation();
  const [hotPlays, setHotPlays] = useState<any[]>([]);
  const [trendingDiscoveries, setTrendingDiscoveries] = useState<any[]>([]);
  const [newReleases, setNewReleases] = useState<any[]>([]);
  const [creators, setCreators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [winners, setWinners] = useState<any[]>([]);
  const [totalEcholoop, setTotalEcholoop] = useState<number>(0);
  const [activeCreatorsCount, setActiveCreatorsCount] = useState<number>(0);
  const supabase = createClient();

  useEffect(() => {
    const fetchWinners = async () => {
      try {
        const { data } = await fetchArenaRegistrationsResilient(supabase, {
          status: 'winner',
          limit: 30
        });

        if (data && data.length > 0) {
          const sortedData = [...data].sort((a, b) => {
            const dateA = a.arena_date || '';
            const dateB = b.arena_date || '';
            if (dateA !== dateB) return dateB.localeCompare(dateA);
            return (b.votes_count || 0) - (a.votes_count || 0);
          }).slice(0, 10);

          const winnerSongs = sortedData
            .filter((reg: any) => reg.song !== null)
            .map((reg: any) => ({
              ...reg.song,
              votes: reg.votes_count
            }));
          setWinners(winnerSongs);
        } else {
          setWinners([]);
        }
      } catch (err) {
        console.error('Failed to fetch arena winners:', err);
        setWinners([]);
      }
    };
    fetchWinners();
  }, [supabase]);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        setLoading(true);

        const { data: hotData } = await supabase
          .from('daily_top_songs_with_details')
          .select('*')
          .order('today_plays', { ascending: false })
          .limit(10);
        
        if (hotData && hotData.length > 0) {
          const mappedHot = hotData.map(song => ({
            ...song,
            play_count: song.today_plays || 0
          }));
          setHotPlays(mappedHot);
        } else {
          setHotPlays([]);
        }

        const { data: trendData } = await supabase
          .from('trending_discoveries_score')
          .select('*')
          .limit(10);

        if (trendData && trendData.length > 0) {
          const mappedTrend = trendData.map(song => ({
            id: song.id,
            title: song.title,
            artist: song.artist || t('home.unknown_creator'),
            cover_url: song.cover_url || song.cover,
            audio_url: song.audio_url,
            earn_rate: song.earn_rate,
            tags: song.tags,
            lyrics: song.lyrics,
            creator_id: song.creator_id,
            creator: {
              display_name: song.creator_name,
              avatar_url: song.creator_avatar
            },
            creator_name: song.creator_name || t('home.unknown_creator'),
            creator_avatar: song.creator_avatar,
            play_count: song.play_count || 0,
            created_at: song.created_at,
          }));
          setTrendingDiscoveries(mappedTrend);
        } else {
          setTrendingDiscoveries([]);
        }        const { data: freshData } = await fetchSongsResilient(supabase, {
          limit: 10,
          orderField: 'created_at',
          ascending: false
        });
 
        if (freshData && freshData.length > 0) {
          const mappedFresh = freshData.map(song => ({
            id: song.id,
            title: song.title,
            artist: song.artist || t('home.unknown_creator'),
            cover_url: song.cover_url || song.cover,
            audio_url: song.audio_url,
            earn_rate: song.earn_rate,
            tags: song.tags,
            lyrics: song.lyrics,
            creator_id: song.creator_id,
            creator: song.creator,
            creator_name: song.creator?.display_name || t('home.unknown_creator'),
            creator_avatar: song.creator?.avatar_url,
            play_count: song.likes || 0,
            created_at: song.created_at,
          }));
          setNewReleases(mappedFresh);
        } else {
          setNewReleases([]);
        }

      } catch (err) {
        console.error('Error fetching homepage lists:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchCreators = async () => {
      const { data } = await supabase
        .from('emerging_artists_score')
        .select('*')
        .limit(10);
      
      if (data && data.length > 0) {
        const mappedCreators = data.map((c: any) => ({
          id: c.creator_id,
          name: c.creator_name,
          avatar: c.creator_avatar,
          tag: `${t('home.creator_score')} ${c.artist_score} | ${t('home.creator_fans')}${c.total_follows}`,
          score: c.artist_score
        }));
        setCreators(mappedCreators);
      }
    };

    const fetchGlobalStats = async () => {
      try {
        const { data: txs } = await supabase
          .from('transactions')
          .select('amount')
          .eq('type', 'listen_reward');
        const sum = txs?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
        setTotalEcholoop(sum);

        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        setActiveCreatorsCount(count || 0);
      } catch (e) {
        console.error('Error fetching global stats:', e);
      }
    };

    fetchSongs();
    fetchCreators();
    fetchGlobalStats();

    const handleRefresh = () => {
      fetchSongs();
      fetchGlobalStats();
    };

    window.addEventListener('play-count-updated', handleRefresh);
    return () => {
      window.removeEventListener('play-count-updated', handleRefresh);
    };
  }, [supabase]);
 
  // 自动播放分享歌曲逻辑（主要面向跳过了开屏动画的已登录老用户）
  useEffect(() => {
    const playSharedSong = async () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const songId = params.get('songId');
        
        if (songId) {
          // Clear only the songId parameter from URL immediately to prevent infinite loop / override on subsequent song clicks
          params.delete('songId');
          const newSearch = params.toString();
          const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
          window.history.replaceState({}, '', newUrl);

          if (String(currentTrack?.id) !== String(songId)) {
            try {
              const { data: song } = await supabase
                .from('songs')
                .select('*')
                .eq('id', songId)
                .single();
                
              if (song) {
                const track = {
                  id: song.id,
                  title: song.title,
                  artist: song.artist,
                  cover: song.cover_url || song.cover,
                  src: song.audio_url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                  earnRate: Number(song.earn_rate) || 0.005,
                  lyrics: song.lyrics,
                };
                setPlaylist([track]);
                setTrack(track);
              }
            } catch (err) {
              console.error('Failed to load and play shared song on HomeClientPage:', err);
            }
          }
        }
      }
    };
    
    const timer = setTimeout(() => {
      playSharedSong();
    }, 500);
    return () => clearTimeout(timer);
  }, [supabase, currentTrack, setTrack, setPlaylist]);

  // 本日热播：优先从 daily_top_songs_with_details 视图，若为空则降级使用 trending 数据
  const hotPlaysDisplay = hotPlays.length > 0 ? hotPlays : trendingDiscoveries;
  const freshSongs = newReleases;

  const handlePlay = (song: any) => {
    if (currentTrack?.id === song.id) {
      togglePlay();
    } else {
      setTrack({
        id: song.id,
        title: song.title,
        artist: song.artist,
        cover: song.cover_url || song.cover,
        src: song.audio_url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        earnRate: Number(song.earn_rate) || 0.005,
        lyrics: song.lyrics,
      });
    }
  };

  return (
    <div className="space-y-10 pb-20">
      <section className="relative rounded-[2rem] bg-gradient-to-r from-amber-950/15 via-black to-purple-950/15 border border-amber-500/20 p-5 md:p-8 overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.06)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative z-10 space-y-5">
          <div className="flex items-center">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-[9px] font-black text-amber-400 uppercase tracking-widest animate-pulse">
                <Sparkles className="w-3 h-3" />
                {t('home.dao_badge')}
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white leading-none uppercase tracking-tighter italic">
                {t('home.top_picks')}
              </h2>
            </div>
          </div>

          {winners.length > 0 ? (
            <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1">
              {winners.map((song, index) => (
                <div
                  key={song.id}
                  className="w-24 shrink-0 bg-white/5 border border-white/10 hover:border-amber-500/40 rounded-xl p-2 transition-all group cursor-pointer"
                  onClick={() => handlePlay(song)}
                >
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-2 shadow-md">
                    <img src={song.cover_url || song.cover} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-amber-400 text-black text-[7px] font-black rounded">
                      #{index + 1}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                    </div>
                  </div>
                  <p className="text-white text-[10px] font-bold truncate leading-tight">{song.title}</p>
                  <p className="text-amber-400 text-[9px] font-mono truncate">{song.artist}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center flex flex-col items-center justify-center space-y-2 border border-dashed border-amber-500/20 rounded-2xl bg-amber-500/5">
              <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
              <h3 className="text-sm font-bold text-white italic">{t('home.empty_join')}</h3>
              <p className="text-[10px] text-gray-500">{t('home.empty_arena')}</p>
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-5 rounded-[2rem] border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-black text-white uppercase italic flex items-center gap-2">
              <div className="w-1.5 h-5 bg-echo-primary rounded-full" />
              {t('home.hot_plays')}
            </h2>
            <span className="text-[9px] text-gray-600 font-mono uppercase">Real-time</span>
          </div>
          <div className="space-y-1">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-14 bg-white/5 rounded-2xl animate-pulse" />)
            ) : hotPlays.length > 0 ? (
              hotPlays.slice(0, 10).map((song, index) => (
                <SongRow key={song.id} song={song} index={index} currentTrack={currentTrack} isPlaying={isPlaying} onPlay={() => handlePlay(song)} t={t} />
              ))
            ) : (
              <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
                <Music2 className="w-8 h-8 text-echo-primary/40 animate-pulse" />
                <h3 className="text-xs font-bold text-white italic">{t('home.empty_join')}</h3>
                <p className="text-[10px] text-gray-500">{t('home.empty_hot')}</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-[2rem] border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-black text-white uppercase italic flex items-center gap-2">
              <div className="w-1.5 h-5 bg-echo-secondary rounded-full" />
              {t('home.rising_artists')}
            </h2>
            <span className="text-[9px] text-gray-600 font-mono uppercase">Rising Stars</span>
          </div>
          <div className="flex flex-col gap-3">
            {creators.length > 0 ? creators.map((creator) => (
              <Link href={`/artist/${creator.id}`} key={creator.id} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-white/5 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-gray-800 border border-white/10 overflow-hidden shrink-0">
                  <img src={creator.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${creator.id}`} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-bold text-sm truncate group-hover:text-echo-primary transition-colors">{creator.name || t('home.unknown_creator')}</h4>
                  <p className="text-echo-secondary text-[10px] font-mono">{creator.tag}</p>
                </div>
                <div className="px-3 py-1 rounded-full bg-echo-secondary/10 border border-echo-secondary/30 text-echo-secondary text-[10px] font-bold uppercase shrink-0 group-hover:bg-echo-secondary group-hover:text-black transition-colors">
                  {t('home.visit_profile')}
                </div>
              </Link>
            )) : (
              [
                { name: 'CyberNomad', tag: 'Electronic / Synthwave', seed: 'cybernomad' },
                { name: 'Guqin Wanderer', tag: 'Chinese / Ambient', seed: 'guqin' },
                { name: 'LoFi Coffee', tag: 'Jazz / LoFi', seed: 'lofi' },
              ].map((c) => (
                <div key={c.seed} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-white/5 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-gray-800 border border-white/10 overflow-hidden shrink-0">
                    <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${c.seed}`} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-bold text-sm truncate">{c.name}</h4>
                    <p className="text-echo-secondary text-[10px] font-mono">{c.tag}</p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-echo-secondary/10 border border-echo-secondary/30 text-echo-secondary text-[10px] font-bold uppercase shrink-0">
                    {t('home.follow')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-echo-primary" />
            {t('home.trending')}
          </h2>
          <Link href="/discover" className="text-[10px] font-bold text-gray-500 uppercase hover:text-echo-primary transition-colors">
            {t('home.view_all')}
          </Link>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-2 space-y-0.5">
          {hotPlaysDisplay.length > 0 ? (
            hotPlaysDisplay.map((song, i) => (
              <SongRow key={song.id} song={song} index={i} currentTrack={currentTrack} isPlaying={isPlaying} onPlay={() => handlePlay(song)} t={t} />
            ))
          ) : (
            <div className="py-10 text-center flex flex-col items-center justify-center space-y-2">
              <TrendingUp className="w-6 h-6 text-echo-primary/30 animate-pulse" />
              <h3 className="text-xs font-bold text-white italic">{t('home.empty_join')}</h3>
              <p className="text-[9px] text-gray-500">{t('home.empty_trending')}</p>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
            <Globe className="w-5 h-5 text-echo-secondary" />
            {t('home.new_releases')}
          </h2>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-2 space-y-0.5">
          {freshSongs.length > 0 ? (
            freshSongs.map((song, i) => (
              <SongRow key={song.id} song={song} index={i} currentTrack={currentTrack} isPlaying={isPlaying} onPlay={() => handlePlay(song)} t={t} />
            ))
          ) : (
            <div className="py-10 text-center flex flex-col items-center justify-center space-y-2">
              <Globe className="w-6 h-6 text-echo-secondary/30 animate-pulse" />
              <h3 className="text-xs font-bold text-white italic">{t('home.empty_join')}</h3>
              <p className="text-[9px] text-gray-500">{t('home.empty_new')}</p>
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-white/5 bg-gradient-to-br from-echo-primary/5 to-transparent text-center">
          <p className="text-[9px] text-gray-600 font-bold uppercase mb-1">{t('home.stat_listen_rewards')}</p>
          <div className="text-lg font-black text-white tracking-tighter">
            {totalEcholoop > 0 ? totalEcholoop.toFixed(2) : '0.00'}{' '}
            <span className="text-[10px] text-echo-primary">ECHO</span>
          </div>
          <p className="text-[8px] text-emerald-400 font-bold mt-0.5">{t('home.stat_smart_contract')}</p>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-white/5 text-center">
          <p className="text-[9px] text-gray-600 font-bold uppercase mb-1">{t('home.stat_active_nodes')}</p>
          <div className="text-lg font-black text-white tracking-tighter">
            {activeCreatorsCount > 0 ? activeCreatorsCount : '0'}{' '}
            <span className="text-[10px] text-echo-secondary">Nodes</span>
          </div>
          <p className="text-[8px] text-indigo-400 font-bold mt-0.5">{t('home.stat_decentralized')}</p>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-white/5 text-center">
          <p className="text-[9px] text-gray-600 font-bold uppercase mb-1">{t('home.stat_community_share')}</p>
          <div className="text-lg font-black text-white tracking-tighter">
            100.0% <span className="text-[10px] text-green-500">Live</span>
          </div>
          <p className="text-[8px] text-green-400 font-bold mt-0.5">{t('home.stat_profit_back')}</p>
        </div>
      </section>
    </div>
  );
}
