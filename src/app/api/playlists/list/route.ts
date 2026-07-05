import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/utils/supabase/sync';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'public';

    // 辅助函数：分步获取歌曲的创作者信息以避免 profiles 关系缓存错误
    const fetchPlaylistsWithCreators = async (queryPromise: Promise<{ data: any[] | null; error: any }>) => {
      const { data, error } = await queryPromise;
      if (error || !data) {
        return { data, error };
      }

      // 提取所有歌曲的 creator_id
      const creatorIds = Array.from(
        new Set(
          data.flatMap((p: any) =>
            p.playlist_songs?.map((ps: any) => ps.song?.creator_id).filter(Boolean) || []
          )
        )
      ) as string[];

      if (creatorIds.length > 0) {
        // 从 profiles 表查询创作者的显示名称和头像
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', creatorIds);

        if (!profilesError && profiles) {
          const profileMap = new Map(profiles.map((p: any) => [p.id, p]));
          data.forEach((p: any) => {
            p.playlist_songs?.forEach((ps: any) => {
              if (ps.song && ps.song.creator_id) {
                ps.song.creator = profileMap.get(ps.song.creator_id) || null;
              }
            });
          });
        } else if (profilesError) {
          console.error('[Playlist List API] Failed to fetch song creators profiles:', profilesError);
        }
      }

      return { data, error: null };
    };

    if (type === 'mine') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: '未登录，无法获取个人歌单' }, { status: 401 });
      }
      const accessToken = authHeader.slice(7);

      const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY!
      );
      const { data: { user }, error: authError } = await anonClient.auth.getUser(accessToken);

      if (authError || !user) {
        return NextResponse.json({ error: '身份验证失败，请重新登录' }, { status: 401 });
      }

      // Fetch user's own playlists
      const query = supabaseAdmin
        .from('playlists')
        .select(`
          *,
          creator:profiles(display_name, avatar_url),
          playlist_songs(
            *,
            song:songs(*)
          )
        `)
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      const { data, error } = await fetchPlaylistsWithCreators(query as any);

      if (error) {
        console.error('[Playlist List API] Database error:', error);
        return NextResponse.json({ error: `获取个人歌单失败: ${error.message}` }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    } else {
      // Fetch all public playlists
      const query = supabaseAdmin
        .from('playlists')
        .select(`
          *,
          creator:profiles(display_name, avatar_url),
          playlist_songs(
            *,
            song:songs(*)
          )
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      const { data, error } = await fetchPlaylistsWithCreators(query as any);

      if (error) {
        console.error('[Playlist List API] Database error:', error);
        return NextResponse.json({ error: `获取公共歌单失败: ${error.message}` }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    }

  } catch (err: any) {
    console.error('[Playlist List API] Unexpected error:', err);
    return NextResponse.json({ error: `服务器处理失败: ${err.message}` }, { status: 500 });
  }
}

