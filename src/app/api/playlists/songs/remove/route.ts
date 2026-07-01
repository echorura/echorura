import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/utils/supabase/sync';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录，无法管理歌单作品' }, { status: 401 });
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

    const body = await request.json();
    const { playlistId, songId } = body;

    if (!playlistId || !songId) {
      return NextResponse.json({ error: '歌单 ID 和歌曲 ID 不能为空' }, { status: 400 });
    }

    // 1. Verify ownership of the playlist
    const { data: playlist, error: fetchError } = await supabaseAdmin
      .from('playlists')
      .select('creator_id')
      .eq('id', playlistId)
      .single();

    if (fetchError || !playlist) {
      return NextResponse.json({ error: '找不到指定的歌单' }, { status: 404 });
    }

    if (playlist.creator_id !== user.id) {
      return NextResponse.json({ error: '权限不足，只能从自己的歌单移除歌曲' }, { status: 403 });
    }

    // 2. Perform deletion
    const { error: deleteError } = await supabaseAdmin
      .from('playlist_songs')
      .delete()
      .eq('playlist_id', playlistId)
      .eq('song_id', songId);

    if (deleteError) {
      console.error('[Playlist Remove Song API] Database delete error:', deleteError);
      return NextResponse.json({ error: `歌曲从歌单中移除失败: ${deleteError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '成功从歌单中移除！' });

  } catch (err: any) {
    console.error('[Playlist Remove Song API] Unexpected error:', err);
    return NextResponse.json({ error: `服务器处理失败: ${err.message}` }, { status: 500 });
  }
}
