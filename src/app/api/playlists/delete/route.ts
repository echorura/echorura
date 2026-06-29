import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/utils/supabase/sync';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录，无法删除歌单' }, { status: 401 });
    }
    const accessToken = authHeader.slice(7);

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json({ error: '身份验证失败，请重新登录' }, { status: 401 });
    }

    const body = await request.json();
    const { playlistId } = body;

    if (!playlistId) {
      return NextResponse.json({ error: '歌单 ID 不能为空' }, { status: 400 });
    }

    // 1. Verify ownership first
    const { data: playlist, error: fetchError } = await supabaseAdmin
      .from('playlists')
      .select('creator_id')
      .eq('id', playlistId)
      .single();

    if (fetchError || !playlist) {
      return NextResponse.json({ error: '找不到指定的歌单' }, { status: 404 });
    }

    if (playlist.creator_id !== user.id) {
      return NextResponse.json({ error: '权限不足，无法删除他人的歌单' }, { status: 403 });
    }

    // 2. Perform deletion
    const { error: deleteError } = await supabaseAdmin
      .from('playlists')
      .delete()
      .eq('id', playlistId);

    if (deleteError) {
      console.error('[Playlist Delete API] Database delete error:', deleteError);
      return NextResponse.json({ error: `删除歌单失败: ${deleteError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '歌单已成功删除！' });

  } catch (err: any) {
    console.error('[Playlist Delete API] Unexpected error:', err);
    return NextResponse.json({ error: `服务器处理失败: ${err.message}` }, { status: 500 });
  }
}
