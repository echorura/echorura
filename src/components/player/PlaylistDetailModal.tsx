'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { X, Play, Music, Share2, Copy, Check, Loader2, Trash2, Volume2, Plus } from 'lucide-react';
import { useTranslation } from '@/store/languageStore';
import { usePlayerStore } from '@/store/playerStore';

interface Track {
  id: string;
  title: string;
  artist: string;
  cover: string;
  src: string;
  earnRate: number;
  lyrics?: string;
}

interface PlaylistDetailModalProps {
  playlistId: string;
  onClose: () => void;
}

export default function PlaylistDetailModal({ playlistId, onClose }: PlaylistDetailModalProps) {
  const { t } = useTranslation();
  const [playlist, setPlaylist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [removingSongId, setRemovingSongId] = useState<string | null>(null);

  const supabase = createClient();
  const { playSong, currentTrack, isPlaying, togglePlay } = usePlayerStore();

  useEffect(() => {
    const fetchUserAndPlaylist = async () => {
      setLoading(true);
      try {
        // Fetch current user
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);

        // Fetch playlist details
        const { data, error } = await supabase
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
          .eq('id', playlistId)
          .single();

        if (error) throw error;
        setPlaylist(data);
      } catch (err) {
        console.error('[Playlist Detail Modal] Error fetching details:', err);
      } finally {
        setLoading(false);
      }
    };

    if (playlistId) {
      fetchUserAndPlaylist();
    }
  }, [playlistId]);

  const playlistSongs = playlist?.playlist_songs
    ?.map((ps: any) => ps.song)
    .filter(Boolean) || [];

  const handlePlayAll = () => {
    if (playlistSongs.length === 0) return;
    playSong(playlistSongs[0], playlistSongs);
  };

  const handlePlaySong = (song: any) => {
    playSong(song, playlistSongs);
  };

  const handleSharePlaylist = async () => {
    if (!playlist) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.echora.cn';
    const shareUrl = `${origin}/discover?playlistId=${playlist.id}`;
    const shareTitle = t('playlist.share_title').replace('{name}', playlist.name);
    const shareText = t('playlist.share_desc').replace('{name}', playlist.name);
    const plainText = `${shareTitle}\n${shareText}\n${t('playlist.share_link')}${shareUrl}`;

    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    try {
      if (navigator.share && isMobile) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(plainText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) {
      try {
        await navigator.clipboard.writeText(plainText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    }
  };

  const handleRemoveSong = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('playlist.confirm_remove') || 'Are you sure you want to remove this song?')) return;

    setRemovingSongId(songId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/playlists/songs/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          playlistId: playlist.id,
          songId
        })
      });

      if (res.ok) {
        // Refresh local playlist data
        setPlaylist((prev: any) => ({
          ...prev,
          playlist_songs: prev.playlist_songs.filter((ps: any) => ps.song_id !== songId)
        }));
      } else {
        const errData = await res.json();
        alert(errData.error || t('playlist.remove_failed') || 'Remove failed');
      }
    } catch (err: any) {
      alert((t('playlist.remove_failed') || 'Remove failed: ') + err.message);
    } finally {
      setRemovingSongId(null);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
        <div className="w-full max-w-2xl glass-panel rounded-3xl p-12 border border-white/10 shadow-2xl bg-[#09090c]/95 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 text-echo-primary animate-spin" />
          <p className="text-sm text-gray-400 font-bold">{t('playlist.loading_content')}</p>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
        <div className="w-full max-w-md glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl bg-[#09090c]/95 text-center space-y-4">
          <div className="text-red-500 font-black text-lg">{t('playlist.not_found')}</div>
          <p className="text-xs text-gray-500">{t('playlist.not_found_desc')}</p>
          <button onClick={onClose} className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition-all">
            {t('playlist.back_to_page')}
          </button>
        </div>
      </div>
    );
  }

  const isOwner = currentUser && playlist.creator_id === currentUser.id;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl bg-[#09090c]/95 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Decorative Glow */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-echo-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-echo-secondary/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors z-20 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header/Details */}
        <div className="flex flex-col sm:flex-row gap-6 pb-6 border-b border-white/5 relative z-10">
          {/* Cover Art */}
          <div className="w-32 h-32 rounded-2xl overflow-hidden bg-black/40 border border-white/10 shrink-0 mx-auto sm:mx-0 shadow-lg relative group/cover">
            <img
              src={playlist.cover_url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400&h=400'}
              alt={playlist.name}
              className="w-full h-full object-cover"
            />
            {playlistSongs.length > 0 && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={handlePlayAll}
                  className="w-12 h-12 rounded-full bg-echo-primary text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md shadow-echo-primary/30"
                >
                  <Play className="w-5 h-5 fill-black ml-0.5" />
                </button>
              </div>
            )}
          </div>

          {/* Text Metadata */}
          <div className="flex-1 min-w-0 flex flex-col justify-between text-center sm:text-left">
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="text-[9px] bg-echo-primary/10 text-echo-primary font-black uppercase tracking-widest px-2 py-0.5 rounded border border-echo-primary/20">{t('playlist.label')}</span>
                <span className="text-[10px] text-gray-500 font-mono">ID: {playlist.id.slice(0, 8)}...</span>
              </div>
              <h2 className="text-white text-xl md:text-2xl font-black mt-2 leading-tight tracking-tight truncate">
                {playlist.name}
              </h2>
              <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">
                {playlist.description || t('discover.default_playlist_desc')}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-4 text-[11px] text-gray-500">
              {/* Creator details */}
              <div className="flex items-center gap-1.5">
                <img
                  src={playlist.creator?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aria'}
                  alt={playlist.creator?.display_name}
                  className="w-5 h-5 rounded-full object-cover border border-white/10"
                />
                <span className="text-white font-bold">@{playlist.creator?.display_name || t('discover.echorura_user')}</span>
              </div>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Music className="w-3.5 h-3.5 text-echo-primary" />
                {t('playlist.songs_count').replace('{count}', playlistSongs.length.toString())}
              </span>
            </div>
          </div>
        </div>

        {/* Main Action Buttons */}
        <div className="flex gap-3 my-4 relative z-10">
          <button
            onClick={handlePlayAll}
            disabled={playlistSongs.length === 0}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-echo-primary to-echo-secondary disabled:from-gray-800 disabled:to-gray-800 text-black disabled:text-gray-500 font-black text-xs hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.15)] cursor-pointer"
          >
            <Play className="w-4 h-4 fill-black" />
            {t('playlist.play_all')}
          </button>
          <button
            onClick={handleSharePlaylist}
            className="py-3 px-5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            {copied ? t('playlist.link_copied') : t('playlist.share')}
          </button>
        </div>

        {/* Songs List */}
        <div className="flex-1 overflow-y-auto min-h-0 relative z-10 pr-1 space-y-2 scrollbar-thin">
          <h3 className="text-gray-500 text-[10px] uppercase font-bold tracking-widest pb-1.5">{t('playlist.songs_list').replace('{count}', playlistSongs.length.toString())}</h3>
          
          {playlistSongs.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs italic flex flex-col items-center justify-center gap-2 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
              <Music className="w-8 h-8 text-gray-700 animate-pulse" />
              {t('playlist.no_songs')}
            </div>
          ) : (
            playlistSongs.map((song: any, index: number) => {
              const isCurrent = currentTrack?.id === song.id;
              
              return (
                <div
                  key={song.id}
                  onClick={() => handlePlaySong(song)}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer group/item ${
                    isCurrent
                      ? 'bg-echo-primary/10 border-echo-primary/20'
                      : 'bg-white/2 border-transparent hover:bg-white/5 hover:border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    {/* Index or volume wave */}
                    <div className="w-5 text-center text-xs shrink-0 text-gray-500 font-mono">
                      {isCurrent && isPlaying ? (
                        <Volume2 className="w-4 h-4 text-echo-primary mx-auto animate-pulse" />
                      ) : (
                        String(index + 1).padStart(2, '0')
                      )}
                    </div>

                    {/* Song Cover */}
                    <img
                      src={song.cover_url || song.cover}
                      alt={song.title}
                      className="w-10 h-10 rounded-xl object-cover bg-white/5 shrink-0"
                    />

                    {/* Song Titles */}
                    <div className="truncate min-w-0">
                      <p className={`text-xs font-bold truncate ${isCurrent ? 'text-echo-primary' : 'text-white'}`}>
                        {song.title}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate mt-0.5">
                        {song.creator?.display_name || song.creator_name || song.artist || t('home.unknown_creator')}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] text-gray-600 font-mono mr-2 hidden sm:inline-block">
                      {song.likes ?? 0} {t('discover.votes')}
                    </span>
                    {isOwner && (
                      <button
                        onClick={(e) => handleRemoveSong(song.id, e)}
                        disabled={removingSongId === song.id}
                        className="w-7 h-7 rounded-lg text-gray-600 hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all opacity-0 group-hover/item:opacity-100 focus:opacity-100"
                        title={t('playlist.remove') || "Remove from Playlist"}
                      >
                        {removingSongId === song.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
