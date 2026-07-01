import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/utils/supabase/sync';

export async function POST(request: NextRequest) {
  try {
    // 1. 从请求头获取 JWT Token 进行身份验证（确保投票的人已登录）
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '请登录后再参与听审打分投票' }, { status: 401 });
    }
    const accessToken = authHeader.slice(7);

    // 2. 使用匿名客户端验证 Token，确认是真实有效的注册用户
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(accessToken);

    if (authError || !user) {
      console.error('[Curation Vote API] Auth failed:', authError?.message);
      return NextResponse.json({ error: '身份验证已过期，请重新登录后再试' }, { status: 401 });
    }

    // 3. 解析请求参数
    const body = await request.json();
    const { songId, type } = body; // type 应为 'up' 或 'down'

    if (!songId || !type || (type !== 'up' && type !== 'down')) {
      return NextResponse.json({ error: '请求参数有误（缺少歌曲 ID 或无效的投票类型）' }, { status: 400 });
    }

    console.log(`[Curation Vote API] User ${user.id} voted ${type} for song ${songId}`);

    // 4. 调用底层的 vote_for_song RPC 存储过程执行投票
    // RPC 函数定义为 SECURITY DEFINER，在服务器端自动提权运行，绕过 RLS 对普通用户 update songs 表的权限限制
    const { data: newVotes, error: rpcError } = await supabaseAdmin.rpc('vote_for_song', {
      p_song_id: Number(songId),
      p_type: type
    });

    if (rpcError) {
      console.error('[Curation Vote API] RPC execution failed:', rpcError);
      return NextResponse.json({ error: `数据库投票失败: ${rpcError.message}` }, { status: 500 });
    }

    console.log(`[Curation Vote API] Atomic update completed. Song ID: ${songId}, New Votes: ${newVotes}`);

    return NextResponse.json({
      success: true,
      message: '打分投票成功，票数已实时计入排名系统！',
      newVotes: typeof newVotes === 'number' ? newVotes : 0
    });

  } catch (err: any) {
    console.error('[Curation Vote API] Unhandled exception:', err);
    return NextResponse.json({ error: `服务器处理异常: ${err.message}` }, { status: 500 });
  }
}
