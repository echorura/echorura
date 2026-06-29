-- ==========================================
-- ECHORURA MUSICCHAIN User Playlists & Playlist Songs Schema
-- ==========================================

-- 1. Create Playlists Table
CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Playlist Songs Junction Table
CREATE TABLE IF NOT EXISTS public.playlist_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  song_id BIGINT NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(playlist_id, song_id)
);

-- 3. Enable Row-Level Security
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;

-- 4. Set Up RLS Policies for playlists
DROP POLICY IF EXISTS "Playlists are viewable by everyone if public, or by creator" ON public.playlists;
CREATE POLICY "Playlists are viewable by everyone if public, or by creator"
  ON public.playlists FOR SELECT
  USING (is_public = true OR creator_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own playlists" ON public.playlists;
CREATE POLICY "Users can insert their own playlists"
  ON public.playlists FOR INSERT
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own playlists" ON public.playlists;
CREATE POLICY "Users can update their own playlists"
  ON public.playlists FOR UPDATE
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own playlists" ON public.playlists;
CREATE POLICY "Users can delete their own playlists"
  ON public.playlists FOR DELETE
  USING (creator_id = auth.uid());

-- 5. Set Up RLS Policies for playlist_songs
DROP POLICY IF EXISTS "Playlist songs are viewable if the playlist is viewable" ON public.playlist_songs;
CREATE POLICY "Playlist songs are viewable if the playlist is viewable"
  ON public.playlist_songs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_songs.playlist_id
      AND (p.is_public = true OR p.creator_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert songs into their own playlists" ON public.playlist_songs;
CREATE POLICY "Users can insert songs into their own playlists"
  ON public.playlist_songs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_songs.playlist_id
      AND p.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete songs from their own playlists" ON public.playlist_songs;
CREATE POLICY "Users can delete songs from their own playlists"
  ON public.playlist_songs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_songs.playlist_id
      AND p.creator_id = auth.uid()
    )
  );

-- 6. Trigger to automatically update updated_at timestamp on playlists
CREATE OR REPLACE FUNCTION public.handle_playlist_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_playlist_update ON public.playlists;
CREATE TRIGGER on_playlist_update
  BEFORE UPDATE ON public.playlists
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_playlist_update();
