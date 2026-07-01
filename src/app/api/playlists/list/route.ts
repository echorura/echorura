import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/utils/supabase/sync';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'public';

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
      const { data, error } = await supabaseAdmin
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
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Playlist List API] Database error:', error);
        return NextResponse.json({ error: `获取个人歌单失败: ${error.message}` }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    } else {
      // Fetch all public playlists
      const { data, error } = await supabaseAdmin
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
        .eq('is_public', true)
        .order('created_at', { ascending: false });

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
