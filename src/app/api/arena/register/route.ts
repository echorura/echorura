import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin, syncRegisterForArena } from '@/utils/supabase/sync';

export async function POST(request: NextRequest) {
  try {
    // 1. JWT Token 身份验证
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '请登录后再进行听审竞技场报名' }, { status: 401 });
    }
    const accessToken = authHeader.slice(7);

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(accessToken);

    if (authError || !user) {
      console.error('[Arena Register API] Auth failed:', authError?.message);
      return NextResponse.json({ error: '登录状态已过期，请重新登录' }, { status: 401 });
    }

    // 2. 解析参数
    const body = await request.json();
    const { songId } = body;

    if (!songId) {
      return NextResponse.json({ error: '请求参数有误，缺少 songId' }, { status: 400 });
    }

    console.log(`[Arena Register API] User ${user.id} registering song ${songId} for curation arena`);

    // 3. 查询歌曲的 creator_id
    const { data: songData } = await supabaseAdmin
      .from('songs')
      .select('creator_id')
      .eq('id', Number(songId))
      .single();
    const creatorId = songData?.creator_id || user.id;

    // 4. 调用同步双写竞技场报名 RPC
    const { data, error: rpcError } = await syncRegisterForArena({
      userId: user.id,
      songId: Number(songId),
      creatorId
    });

    if (rpcError) {
      console.error('[Arena Register API] RPC execution failed:', rpcError);
      return NextResponse.json({ error: `报名失败: ${rpcError.message}` }, { status: 500 });
    }

    if (data && data.success === false) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    console.log('[Arena Register API] Registration successful:', data);

    return NextResponse.json({
      success: true,
      message: '恭喜！您的原创作品已成功报名今日听审竞技场并完成 10.00 ECHO 质押锁仓。',
      remaining_balance: data.remaining_balance,
      position: data.position
    });

  } catch (err: any) {
    console.error('[Arena Register API] Unhandled exception:', err);
    return NextResponse.json({ error: `服务器内部错误: ${err.message}` }, { status: 500 });
  }
}
