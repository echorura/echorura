import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Track {
  id: string;
  title: string;
  artist: string;
  cover: string;
  src: string; // URL to audio file
  earnRate: number; // ECHO per second
  lyrics?: string;
  remaining_shares?: number;
  ipo_percentage?: number;
  total_shares?: number;
}

export interface Equity {
  id: string;
  songTitle: string;
  artist: string;
  shares: number;
  currentPrice: number;
  totalDividends: number;
  cover: string;
}

interface PlayerState {
  isPlaying: boolean;
  currentTrack: Track | null;
  playlist: Track[];
  progress: number;
  duration: number;
  echoBalance: number;
  earnedThisSession: number;
  showPlayer: boolean;
  isFullScreen: boolean;
  
  // ECHORURA MUSICCHAIN Assets
  equities: Equity[];
  maxCreditLimit: number;
  usedCredit: number;
  
  // Actions
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  setTrack: (track: Track) => void;
  setPlaylist: (tracks: Track[]) => void;
  playSong: (song: any, playlist?: any[]) => void;
  playNext: () => void;
  playPrev: () => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  addEcho: (amount: number) => void;
  setBalance: (balance: number) => void;
  togglePlayerPanel: () => void;
  toggleFullScreen: () => void;
  spendEcho: (amount: number) => void;
  
  // Play Queue Actions
  addToQueue: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
  
  // Asset Hub Actions
  addEquity: (newEquity: Omit<Equity, 'totalDividends'>) => void;
  useCredit: (amount: number) => void;
  addDividends: (songId: string, amount: number) => void;
  setEquities: (equities: Equity[]) => void;
  setUsedCredit: (usedCredit: number) => void;
}

// Dummy tracks for demo
export const DEMO_TRACKS: Track[] = [
  {
    id: '1',
    title: 'Neon Dreamscape #1',
    artist: '@AI_Mozart',
    cover: 'https://picsum.photos/seed/11/400/400',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // reliable demo audio
    earnRate: 0.005, // 0.005 ECHO per second
  },
  {
    id: '2',
    title: 'Cyber Symphony',
    artist: '@Echo_Creator',
    cover: 'https://picsum.photos/seed/12/400/400',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    earnRate: 0.008,
  }
];

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      isPlaying: false,
      currentTrack: DEMO_TRACKS[0], // Start with a default track loaded
      playlist: [],
      progress: 0,
      duration: 0,
      echoBalance: 0,
      earnedThisSession: 0,
      showPlayer: false, // Whether the mini player panel is expanded
      isFullScreen: false, // Whether the full screen player is expanded

      // ECHORURA Assets Initial State
      equities: [],
      maxCreditLimit: 500.00,
      usedCredit: 0.00,

      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      play: () => set({ isPlaying: true }),
      pause: () => set({ isPlaying: false }),
      setTrack: (track) => set({ 
        currentTrack: { ...track, id: String(track.id) }, 
        isPlaying: true, 
        progress: 0, 
        showPlayer: true 
      }),
      setPlaylist: (tracks) => set({ 
        playlist: tracks.map(t => ({ ...t, id: String(t.id) })) 
      }),
      playSong: (song, playlist) => {
        if (!song || !song.audio_url) return;
        const track: Track = {
          id: String(song.id),
          title: song.title,
          artist: song.artist || song.profiles?.display_name || 'Unknown Artist',
          cover: song.cover_url || 'https://picsum.photos/seed/11/400/400',
          src: song.audio_url,
          earnRate: song.earnRate || 0.005,
          lyrics: song.lyrics || '',
        };
        
        let trackList: Track[] = [];
        if (playlist && playlist.length > 0) {
          trackList = playlist.filter(s => s.audio_url).map(s => ({
            id: String(s.id),
            title: s.title,
            artist: s.artist || s.profiles?.display_name || 'Unknown Artist',
            cover: s.cover_url || 'https://picsum.photos/seed/11/400/400',
            src: s.audio_url,
            earnRate: s.earnRate || 0.005,
            lyrics: s.lyrics || '',
          }));
        } else {
          trackList = [track];
        }

        set({ currentTrack: track, playlist: trackList, isPlaying: true, progress: 0, showPlayer: true });
      },
      playNext: () => set((state) => {
        console.log('[usePlayerStore] playNext triggered, playlist size:', state.playlist?.length);
        if (!state.playlist || state.playlist.length === 0) return { isPlaying: false };
        const currentIndex = state.playlist.findIndex(t => String(t.id) === String(state.currentTrack?.id));
        const nextIndex = (currentIndex + 1) % state.playlist.length;
        console.log('[usePlayerStore] playNext calculated:', { currentIndex, nextIndex, track: state.playlist[nextIndex]?.title });
        return { currentTrack: state.playlist[nextIndex], isPlaying: true, progress: 0 };
      }),
      playPrev: () => set((state) => {
        console.log('[usePlayerStore] playPrev triggered, playlist size:', state.playlist?.length);
        if (!state.playlist || state.playlist.length === 0) return { isPlaying: false };
        const currentIndex = state.playlist.findIndex(t => String(t.id) === String(state.currentTrack?.id));
        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) {
          prevIndex = state.playlist.length - 1;
        }
        console.log('[usePlayerStore] playPrev calculated:', { currentIndex, prevIndex, track: state.playlist[prevIndex]?.title });
        return { currentTrack: state.playlist[prevIndex], isPlaying: true, progress: 0 };
      }),
      setProgress: (progress) => set({ progress }),
      setDuration: (duration) => set({ duration }),
      addEcho: (amount) => set((state) => ({ 
        echoBalance: state.echoBalance + amount,
        earnedThisSession: state.earnedThisSession + amount 
      })),
      setBalance: (balance) => set({ echoBalance: balance }),
      togglePlayerPanel: () => set((state) => ({ showPlayer: !state.showPlayer })),
      toggleFullScreen: () => set((state) => ({ isFullScreen: !state.isFullScreen })),
      spendEcho: (amount) => set((state) => ({ echoBalance: state.echoBalance - amount })),

      // Play Queue Actions Implementation
      addToQueue: (track) => set((state) => {
        const normalizedTrack = { ...track, id: String(track.id) };
        if (state.playlist.some(t => String(t.id) === normalizedTrack.id)) return {};
        const newPlaylist = [...state.playlist, normalizedTrack];
        return { playlist: newPlaylist };
      }),
      removeFromQueue: (trackId) => set((state) => {
        const targetId = String(trackId);
        const newPlaylist = state.playlist.filter(t => String(t.id) !== targetId);
        let nextTrack = state.currentTrack;
        if (state.currentTrack && String(state.currentTrack.id) === targetId) {
          if (newPlaylist.length > 0) {
            const currentIndex = state.playlist.findIndex(t => String(t.id) === targetId);
            const nextIndex = currentIndex % newPlaylist.length;
            nextTrack = newPlaylist[nextIndex];
          } else {
            nextTrack = null;
          }
        }
        return { 
          playlist: newPlaylist, 
          currentTrack: nextTrack, 
          isPlaying: nextTrack ? state.isPlaying : false 
        };
      }),
      clearQueue: () => set({ playlist: [], currentTrack: null, isPlaying: false }),

      // Asset Hub Actions Implementation
      addEquity: (newEquity) => set((state) => {
        const normalizedEquity = { ...newEquity, id: String(newEquity.id) };
        const existingIndex = state.equities.findIndex(e => String(e.id) === normalizedEquity.id);
        if (existingIndex > -1) {
          const updatedEquities = [...state.equities];
          updatedEquities[existingIndex].shares += normalizedEquity.shares;
          return { equities: updatedEquities };
        }
        return { 
          equities: [...state.equities, { ...normalizedEquity, totalDividends: 0 }] 
        };
      }),
      useCredit: (amount) => set((state) => ({ usedCredit: state.usedCredit + amount })),
      addDividends: (songId, amount) => set((state) => {
        const targetSongId = String(songId);
        const index = state.equities.findIndex(e => String(e.id) === targetSongId);
        if (index === -1) return state;
        
        const updatedEquities = [...state.equities];
        updatedEquities[index] = {
          ...updatedEquities[index],
          totalDividends: updatedEquities[index].totalDividends + amount
        };
        return { equities: updatedEquities };
      }),
      setEquities: (equities) => set({ equities: equities.map(e => ({ ...e, id: String(e.id) })) }),
      setUsedCredit: (usedCredit) => set({ usedCredit }),
    }),
    {
      name: 'echorura-assets-storage',
      // Only persist financial/asset states to avoid audio autoplay issues on refresh
      partialize: (state) => ({ 
        echoBalance: state.echoBalance,
        equities: state.equities,
        usedCredit: state.usedCredit,
        playlist: state.playlist // Also persist the generated playlist so the user's startup mix is saved
      }),
    }
  )
);
