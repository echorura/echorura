import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/utils/supabase/sync';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录，无法创建歌单' }, { status: 401 });
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
    const { name, description, cover_url, is_public } = body;

    if (!name) {
      return NextResponse.json({ error: '歌单名称不能为空' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('playlists')
      .insert({
        name,
        description: description || '',
        cover_url: cover_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80', // premium default cover
        creator_id: user.id,
        is_public: is_public !== undefined ? !!is_public : true
      })
      .select()
      .single();

    if (error) {
      console.error('[Playlist Create API] Database insert error:', error);
      return NextResponse.json({ error: `创建歌单失败: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '歌单创建成功！',
      data
    });

  } catch (err: any) {
    console.error('[Playlist Create API] Unexpected error:', err);
    return NextResponse.json({ error: `服务器处理失败: ${err.message}` }, { status: 500 });
  }
}
