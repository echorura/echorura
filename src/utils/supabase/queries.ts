import { SupabaseClient } from '@supabase/supabase-js';

/**
 * 弹性查询所有歌曲并内存合并创作者 Profile
 */
export async function fetchSongsResilient(
  supabase: SupabaseClient,
  options?: {
    limit?: number;
    orderField?: string;
    ascending?: boolean;
    eqField?: string;
    eqValue?: any;
    gtField?: string;
    gtValue?: any;
  }
) {
  try {
    let query = supabase.from('songs').select('*');

    if (options?.eqField && options?.eqValue !== undefined) {
      query = query.eq(options.eqField, options.eqValue);
    }
    if (options?.gtField && options?.gtValue !== undefined) {
      query = query.gt(options.gtField, options.gtValue);
    }
    if (options?.orderField) {
      query = query.order(options.orderField, { ascending: !!options.ascending });
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data: songs, error: songsErr } = await query;
    if (songsErr) throw songsErr;
    if (!songs || songs.length === 0) return { data: [], error: null };

    // 获取所有去重创作者 ID
    const creatorIds = Array.from(new Set(songs.map(s => s.creator_id).filter(Boolean)));

    let profilesMap: Record<string, any> = {};
    if (creatorIds.length > 0) {
      const { data: profiles, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', creatorIds);
      
      if (!profilesErr && profiles) {
        profiles.forEach(p => {
          profilesMap[p.id] = p;
        });
      }
    }

    // 内存合并
    const merged = songs.map(song => ({
      ...song,
      creator: profilesMap[song.creator_id] || {
        display_name: song.artist || 'Unknown Artist',
        avatar_url: null
      }
    }));

    return { data: merged, error: null };
  } catch (err: any) {
    console.error('[fetchSongsResilient] Failed:', err.message);
    return { data: null, error: err };
  }
}

/**
 * 弹性查询单首歌曲并合并创作者 Profile
 */
export async function fetchSingleSongResilient(supabase: SupabaseClient, songId: string | number) {
  try {
    const { data: song, error: songErr } = await supabase
      .from('songs')
      .select('*')
      .eq('id', songId)
      .single();

    if (songErr) throw songErr;
    if (!song) return { data: null, error: new Error('Song not found') };

    let creator = { display_name: song.artist || 'Unknown Artist', avatar_url: null };
    if (song.creator_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', song.creator_id)
        .single();
      if (profile) {
        creator = profile;
      }
    }

    return { data: { ...song, creator }, error: null };
  } catch (err: any) {
    console.error('[fetchSingleSongResilient] Failed:', err.message);
    return { data: null, error: err };
  }
}

/**
 * 弹性查询歌单并合并创作者 Profile
 */
export async function fetchPlaylistResilient(supabase: SupabaseClient, playlistId: string | number) {
  try {
    const { data: playlist, error: playlistErr } = await supabase
      .from('playlists')
      .select('*')
      .eq('id', playlistId)
      .single();

    if (playlistErr) throw playlistErr;
    if (!playlist) return { data: null, error: new Error('Playlist not found') };

    let creator = { display_name: 'Unknown User', avatar_url: null };
    if (playlist.creator_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', playlist.creator_id)
        .single();
      if (profile) {
        creator = profile;
      }
    }

    return { data: { ...playlist, creator }, error: null };
  } catch (err: any) {
    console.error('[fetchPlaylistResilient] Failed:', err.message);
    return { data: null, error: err };
  }
}

/**
 * 弹性查询听审竞技场报名记录并合并歌曲及创作者 Profile
 */
export async function fetchArenaRegistrationsResilient(
  supabase: SupabaseClient,
  options?: {
    status?: string;
    limit?: number;
    orderField?: string;
    ascending?: boolean;
  }
) {
  try {
    let query = supabase.from('arena_registrations').select('*');
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.orderField) {
      query = query.order(options.orderField, { ascending: !!options.ascending });
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data: regs, error: regsErr } = await query;
    if (regsErr) throw regsErr;
    if (!regs || regs.length === 0) return { data: [], error: null };

    // 获取所有涉及的 song_id 和 creator_id
    const songIds = Array.from(new Set(regs.map(r => r.song_id).filter(Boolean)));
    const creatorIds = Array.from(new Set(regs.map(r => r.creator_id).filter(Boolean)));

    let songsMap: Record<number, any> = {};
    if (songIds.length > 0) {
      const { data: songs } = await supabase
        .from('songs')
        .select('*')
        .in('id', songIds);
      if (songs) {
        songs.forEach(s => {
          songsMap[s.id] = s;
        });
      }
    }

    let profilesMap: Record<string, any> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', creatorIds);
      if (profiles) {
        profiles.forEach(p => {
          profilesMap[p.id] = p;
        });
      }
    }

    // 内存合并
    const merged = regs.map(reg => {
      const song = songsMap[reg.song_id] || null;
      const creator = profilesMap[reg.creator_id] || {
        display_name: song?.artist || 'Unknown Artist',
        avatar_url: null
      };

      return {
        ...reg,
        song: song ? {
          ...song,
          creator
        } : null
      };
    });

    return { data: merged, error: null };
  } catch (err: any) {
    console.error('[fetchArenaRegistrationsResilient] Failed:', err.message);
    return { data: null, error: err };
  }
}
