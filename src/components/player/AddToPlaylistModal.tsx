'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { X, Plus, FolderHeart, Loader2, Music, Check } from 'lucide-react';
import { useLanguageStore } from '@/store/languageStore';

interface Playlist {
  id: string;
  name: string;
  cover_url: string;
  playlist_songs?: any[];
}

interface AddToPlaylistModalProps {
  songId: string | number;
  songTitle: string;
  onClose: () => void;
}

export default function AddToPlaylistModal({ songId, songTitle, onClose }: AddToPlaylistModalProps) {
  const { t } = useLanguageStore();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  
  // New playlist creation inside modal
  const [showCreate, setShowCreate] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);

  const supabase = createClient();

  const fetchPlaylists = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert(t('common.login_required') || 'Please log in first');
        onClose();
        return;
      }

      const res = await fetch('/api/playlists/list?type=mine', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const result = await res.json();
      if (result.success) {
        setPlaylists(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch playlists:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const handleAddToPlaylist = async (playlistId: string) => {
    setAddingId(playlistId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/playlists/songs/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          playlistId,
          songId
        })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setAddedIds(prev => [...prev, playlistId]);
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        alert(result.error || t('playlist.remove_failed') || 'Add failed');
      }
    } catch (err: any) {
      alert((t('playlist.remove_failed') || 'Add error: ') + err.message);
    } finally {
      setAddingId(null);
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 默认使用一个高画质的 AI 炫彩抽象背景作为新歌单的占位封面
      const fallbackCovers = [
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1614149162883-504ce4d13909?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80'
      ];
      const randomCover = fallbackCovers[Math.floor(Math.random() * fallbackCovers.length)];

      const res = await fetch('/api/playlists/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: newPlaylistName.trim(),
          description: t('discover.default_playlist_desc') || 'A curated collection',
          cover_url: randomCover,
          is_public: true
        })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setNewPlaylistName('');
        setShowCreate(false);
        // Automatically add the song to the newly created playlist
        await handleAddToPlaylist(result.data.id);
        await fetchPlaylists();
      } else {
        alert(result.error || t('playlist.remove_failed') || 'Create failed');
      }
    } catch (err: any) {
      alert((t('playlist.remove_failed') || 'Create failed: ') + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-md glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl bg-[#09090c]/95 overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-echo-primary/10 rounded-full blur-[60px] pointer-events-none"></div>

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-echo-primary/10 border border-echo-primary/20 flex items-center justify-center text-echo-primary">
              <FolderHeart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-tighter">{t('playlist.add_to_collection')}</h3>
              <p className="text-[10px] text-gray-500 truncate max-w-[200px]">{t('playlist.adding_song').replace('{songTitle}', songTitle)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 relative z-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-echo-primary animate-spin" />
              <p className="text-xs text-gray-500 font-bold">{t('playlist.loading')}</p>
            </div>
          ) : showCreate ? (
            /* Create new playlist inside modal */
            <form onSubmit={handleCreatePlaylist} className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{t('playlist.new_name')}</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={t('playlist.placeholder') || "e.g. Midnight Ambient"}
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-xs focus:border-echo-primary/50 focus:outline-none placeholder-gray-600 font-bold"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 text-xs font-bold transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 rounded-xl bg-echo-primary hover:bg-echo-primary/95 text-black text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {t('playlist.confirm_create_add')}
                </button>
              </div>
            </form>
          ) : (
            /* Playlist options list */
            <>
              <div className="max-h-[300px] overflow-y-auto space-y-2 scrollbar-hide">
                {playlists.length === 0 ? (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-xs text-gray-500 font-bold">{t('playlist.empty')}</p>
                    <button
                      onClick={() => setShowCreate(true)}
                      className="py-2 px-4 rounded-xl bg-echo-primary/10 border border-echo-primary/20 text-echo-primary text-xs font-bold hover:bg-echo-primary/20 transition-all flex items-center gap-1 mx-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t('playlist.create_first')}
                    </button>
                  </div>
                ) : (
                  playlists.map((playlist) => {
                    const isAdded = addedIds.includes(playlist.id);
                    const isAdding = addingId === playlist.id;

                    return (
                      <div
                        key={playlist.id}
                        onClick={() => !isAdded && !isAdding && handleAddToPlaylist(playlist.id)}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                          isAdded
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <img
                            src={playlist.cover_url}
                            alt={playlist.name}
                            className="w-10 h-10 rounded-xl object-cover shrink-0 bg-white/5"
                          />
                          <div className="truncate">
                            <p className="text-xs font-bold text-white truncate">{playlist.name}</p>
                            <p className="text-[10px] text-gray-500 font-mono">
                              {t('playlist.songs_count').replace('{count}', (playlist.playlist_songs?.length || 0).toString())}
                            </p>
                          </div>
                        </div>
                        <div>
                          {isAdded ? (
                            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                              <Check className="w-3.5 h-3.5" /> {t('playlist.added')}
                            </span>
                          ) : isAdding ? (
                            <Loader2 className="w-4 h-4 text-echo-primary animate-spin" />
                          ) : (
                            <button className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {playlists.length > 0 && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-xs text-white font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-echo-primary" />
                  {t('playlist.new_playlist')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
