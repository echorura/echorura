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
      return NextResponse.json({ error: '权限不足，只能向自己的歌单添加歌曲' }, { status: 403 });
    }

    // 2. Check if song already exists in the playlist to avoid unique constraint violations
    const { data: existing, error: existError } = await supabaseAdmin
      .from('playlist_songs')
      .select('id')
      .eq('playlist_id', playlistId)
      .eq('song_id', songId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: '该歌曲已存在于此歌单中' }, { status: 400 });
    }

    // 3. Get maximum position
    const { data: posData } = await supabaseAdmin
      .from('playlist_songs')
      .select('position')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: false })
      .limit(1);

    const nextPos = posData && posData.length > 0 ? (posData[0].position || 0) + 1 : 0;

    // 4. Perform insertion
    const { error: insertError } = await supabaseAdmin
      .from('playlist_songs')
      .insert({
        playlist_id: playlistId,
        song_id: songId,
        position: nextPos
      });

    if (insertError) {
      console.error('[Playlist Add Song API] Database insert error:', insertError);
      return NextResponse.json({ error: `歌曲添加失败: ${insertError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '成功添加到歌单！' });

  } catch (err: any) {
    console.error('[Playlist Add Song API] Unexpected error:', err);
    return NextResponse.json({ error: `服务器处理失败: ${err.message}` }, { status: 500 });
  }
}
