import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin, syncCastVote } from '@/utils/supabase/sync';

export async function POST(request: NextRequest) {
  try {
    // 1. JWT Token 身份验证
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '请登录后再参与听审投票' }, { status: 401 });
    }
    const accessToken = authHeader.slice(7);

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(accessToken);

    if (authError || !user) {
      console.error('[Arena Vote API] Auth failed:', authError?.message);
      return NextResponse.json({ error: '登录已过期，请重新登录后再试' }, { status: 401 });
    }

    // 2. 解析请求体
    const body = await request.json();
    const { songId, type } = body; // type: 'up' (+1) or 'down' (-1)

    if (!songId || !type || (type !== 'up' && type !== 'down')) {
      return NextResponse.json({ error: '请求参数有误，缺少歌曲ID或无效的投票类型' }, { status: 400 });
    }

    // 3. 查询该歌曲是否有处于 'voting' 状态的报名记录，以获取正确的竞技场日期
    const { data: registration, error: regError } = await supabaseAdmin
      .from('arena_registrations')
      .select('arena_date, creator_id')
      .eq('song_id', songId)
      .eq('status', 'voting')
      .single();

    if (regError || !registration) {
      return NextResponse.json({ error: '该歌曲当前不处于听审竞技场的投票阶段，无法投票。' }, { status: 400 });
    }

    // 4. 防自投限制：创作者不能给自己参赛的歌曲投票
    if (registration.creator_id === user.id) {
      return NextResponse.json({ error: '您不能为自己的参赛作品进行听审投票' }, { status: 400 });
    }

    // 5. 校验用户是否已投过票 (利用数据库唯一约束，或提前查询提示)
    const { data: existingVote } = await supabaseAdmin
      .from('arena_votes')
      .select('id')
      .eq('user_id', user.id)
      .eq('song_id', songId)
      .eq('arena_date', registration.arena_date)
      .maybeSingle();

    if (existingVote) {
      return NextResponse.json({ error: '您在本次听审竞技场周期内已对该歌曲投过票，请勿重复投票。' }, { status: 400 });
    }

    console.log(`[Arena Vote API] User ${user.id} cast "${type}" for song ${songId} on arena batch ${registration.arena_date}`);

    // 6. 汇总当前得票数，加上本次投票，计算最新得票数
    const { data: countData, error: countError } = await supabaseAdmin
      .from('arena_votes')
      .select('vote_type')
      .eq('song_id', songId)
      .eq('arena_date', registration.arena_date);

    let newVotes = 0;
    if (!countError && countData) {
      newVotes = countData.reduce((acc, curr) => acc + (curr.vote_type === 'up' ? 1 : -1), 0);
    }
    newVotes += (type === 'up' ? 1 : -1);

    // 7. 使用双引擎投票双写机制
    const syncRes = await syncCastVote({
      userId: user.id,
      songId: Number(songId),
      creatorId: registration.creator_id,
      voteType: type,
      arenaDate: registration.arena_date,
      newVotes
    });

    if (!syncRes.success) {
      return NextResponse.json({ error: `投票记录失败: ${syncRes.error?.message || '数据库写入错误'}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: type === 'up' ? '打分成功，已为主播加油鼓劲！' : '打分成功，建议已妥善记录。',
      votes_count: newVotes
    });

  } catch (err: any) {
    console.error('[Arena Vote API] Unhandled exception:', err);
    return NextResponse.json({ error: `服务器内部错误: ${err.message}` }, { status: 500 });
  }
}
