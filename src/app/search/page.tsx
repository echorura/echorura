'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Music, User, Play } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { usePlayerStore } from '@/store/playerStore';

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [songResults, setSongResults] = useState<any[]>([]);
  const [artistResults, setArtistResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const supabase = createClient();
  const { setTrack } = usePlayerStore();

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim()) {
        performSearch(query.trim());
      } else {
        setSongResults([]);
        setArtistResults([]);
        setHasSearched(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const performSearch = async (searchTerm: string) => {
    setIsLoading(true);
    setHasSearched(true);
    
    try {
      // Search songs
      const { data: songs } = await supabase
        .from('songs')
        .select('*, creator:profiles(display_name, avatar_url)')
        .or(`title.ilike.%${searchTerm}%,artist.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(20);
        
      // Search artists
      const { data: artists } = await supabase
        .from('profiles')
        .select('*')
        .ilike('display_name', `%${searchTerm}%`)
        .limit(10);
        
      setSongResults(songs || []);
      setArtistResults(artists || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
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

  const hasNoResults = hasSearched && !isLoading && songResults.length === 0 && artistResults.length === 0;

  return (
    <div className="min-h-screen bg-black text-white px-4 md:px-8 py-6 max-w-5xl mx-auto">
      {/* Search Header */}
      <div className="flex items-center gap-4 mb-10">
        <div className="relative flex-1 group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="w-6 h-6 text-gray-500 group-focus-within:text-echo-primary transition-colors" />
          </div>
          <input 
            type="text" 
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索歌曲、艺人、专辑..." 
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-12 text-lg font-bold text-white focus:outline-none focus:border-echo-primary/50 focus:bg-white/10 transition-all shadow-inner placeholder:font-normal"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-4 flex items-center text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <button 
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white font-bold text-sm px-2 shrink-0 transition-colors"
        >
          取消
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-echo-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Empty State */}
      {hasNoResults && (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <Search className="w-16 h-16 text-gray-600 mb-6" />
          <h2 className="text-xl font-black text-white mb-2">没有与你搜索相符结果</h2>
          <p className="text-sm text-gray-500">请尝试更换关键词，或者检查拼写错误。</p>
        </div>
      )}

      {/* Results */}
      {!isLoading && (songResults.length > 0 || artistResults.length > 0) && (
        <div className="space-y-12">
          {/* Artists Section */}
          {artistResults.length > 0 && (
            <section>
              <h2 className="text-xl font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-echo-secondary" />
                相关艺人
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {artistResults.map(artist => (
                  <Link href={`/artist/${artist.id}`} key={artist.id} className="flex flex-col items-center gap-3 group">
                    <div className="w-24 h-24 rounded-full bg-gray-800 border border-white/10 overflow-hidden relative shadow-lg group-hover:shadow-[0_0_20px_rgba(0,240,255,0.2)] transition-all">
                      <img 
                        src={artist.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${artist.id}`} 
                        alt={artist.display_name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                    <div className="text-center">
                      <h4 className="font-bold text-sm text-white group-hover:text-echo-primary transition-colors line-clamp-1">{artist.display_name}</h4>
                      <p className="text-[10px] text-gray-500 font-mono mt-1">ARTIST</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Songs Section */}
          {songResults.length > 0 && (
            <section>
              <h2 className="text-xl font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                <Music className="w-5 h-5 text-echo-primary" />
                相关作品
              </h2>
              <div className="flex flex-col gap-2">
                {songResults.map(song => (
                  <div key={song.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors group cursor-pointer border border-transparent hover:border-white/5" onClick={() => handlePlay(song)}>
                    <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden relative shrink-0">
                      <img src={song.cover_url} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-white truncate group-hover:text-echo-primary transition-colors">{song.title}</h4>
                      {song.creator_id ? (
                        <Link 
                          href={`/artist/${song.creator_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-gray-500 hover:underline hover:text-white transition-colors truncate inline-block"
                        >
                          {song.creator?.display_name || song.artist}
                        </Link>
                      ) : (
                        <p className="text-xs text-gray-500 truncate">{song.creator?.display_name || song.artist}</p>
                      )}
                    </div>
                    <div className="hidden md:block">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-gray-600 border border-white/5 px-2 py-1 rounded-md">
                        {song.genre || 'UNKNOWN'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
