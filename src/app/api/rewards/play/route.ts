import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { songId } = await request.json();
    if (!songId) {
      return NextResponse.json({ error: 'Missing songId' }, { status: 400 });
    }

    // 防御性校验：如果是前端 Mock 歌曲（ID 非数字，如 'mock-1'），直接返回成功，不操作数据库
    if (isNaN(Number(songId))) {
      return NextResponse.json({ success: true, message: 'Mock song play ignored' });
    }

    // 使用 adminClient 绕过 RLS 安全查询与插入
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MEMFIRE_SERVICE_ROLE_KEY!
    );

    // 尝试进行 Bearer Token 鉴权，支持游客与已登录用户
    const authHeader = request.headers.get('Authorization');
    let user: any = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.slice(7);
      const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY!
      );
      const { data: { user: authUser }, error: authError } = await anonClient.auth.getUser(accessToken);
      if (!authError && authUser) {
        user = authUser;
      }
    }

    if (!user) {
      // 游客/匿名收听记录，用于累加播放量，无积分收益
      const { error: guestError } = await adminClient.rpc('record_mining_reward', {
        p_user_id: null,
        p_amount: 0,
        p_type: 'listen_reward',
        p_description: `游客收听歌曲 (无收益)`,
        p_song_id: songId
      });
      if (guestError) {
        console.error('Failed to record guest playback:', guestError);
        return NextResponse.json({ error: 'Failed to process guest playback' }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'Guest playback recorded successfully' });
    }

    // [防刷机制 1]：检查该用户连续单曲音效循环 5 次防刷机制
    const { data: txs, error: txsError } = await adminClient
      .from('transactions')
      .select('song_id, created_at')
      .eq('user_id', user.id)
      .eq('type', 'listen_reward')
      .order('created_at', { ascending: true }); // 按时间正序排列以进行连续性分析

    if (txsError) {
      console.error('Failed to verify loop limits:', txsError);
      return NextResponse.json({ error: 'Failed to verify limits' }, { status: 500 });
    }

    if (txs && txs.length >= 5) {
      let consecutiveCount = 0;
      let lastSongId: number | null = null;
      let triggerTimes: { [key: number]: string } = {};

      for (const tx of txs) {
        const currentTxSongId = Number(tx.song_id);
        if (currentTxSongId === lastSongId) {
          consecutiveCount++;
        } else {
          consecutiveCount = 1;
          lastSongId = currentTxSongId;
        }

        if (consecutiveCount === 5) {
          // 达成 5 次连续播放，这第 5 次的创建时间即为触发点
          triggerTimes[currentTxSongId] = tx.created_at;
        }
      }

      const songTriggerTimeStr = triggerTimes[Number(songId)];
      if (songTriggerTimeStr) {
        const triggerTime = new Date(songTriggerTimeStr);
        const timeDiffMs = new Date().getTime() - triggerTime.getTime();
        const hoursDiff = timeDiffMs / (1000 * 60 * 60);

        if (hoursDiff < 24) {
          return NextResponse.json({ 
            error: 'loop_limit', 
            message: '该单曲连续循环5次触发防刷保护，收益已锁定24小时。触发点后24小时恢复。' 
          }, { status: 429 });
        }
      }
    }

    // [防刷机制 2]：检查该用户今天听这首歌是否已超过 20 次
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error: countError } = await adminClient
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('song_id', songId)
      .eq('type', 'listen_reward')
      .gte('created_at', today.toISOString());

    if (countError) {
      console.error('Failed to verify daily limit:', countError);
      return NextResponse.json({ error: 'Failed to verify limits' }, { status: 500 });
    }

    if (count !== null && count >= 20) {
      // 达到单日上限，不发放奖励，直接返回特殊状态码
      return NextResponse.json({ 
        error: 'daily_limit', 
        message: '单日单曲收益次数已达上限 (20次)' 
      }, { status: 429 });
    }

    // 1. 记录听众奖励 (0.3 ECHO)
    const { error: listenerError } = await adminClient.rpc('record_mining_reward', {
      p_user_id: user.id,
      p_amount: 0.3,
      p_type: 'listen_reward',
      p_description: `收听歌曲奖励`,
      p_song_id: songId
    });

    if (listenerError) {
      console.error('Failed to record listener reward:', listenerError);
      return NextResponse.json({ error: 'Failed to process listener reward' }, { status: 500 });
    }

    // 2. 查询歌曲信息（含份额数据，用于按比例拆分 0.7 ECHO）
    const { data: songData, error: songError } = await adminClient
      .from('songs')
      .select('creator_id, is_ipo_active, total_shares, remaining_shares')
      .eq('id', songId)
      .single();

    if (songError || !songData) {
      console.error('Failed to fetch song data:', songError);
      return NextResponse.json({ error: 'Failed to fetch song data' }, { status: 500 });
    }

    // 3. 按已售/未售比例拆分 0.7 ECHO
    // - 未开启 IPO：0.7 全部归创作者（creator_reward）
    // - 已开启 IPO：按 (已售份额 / 总份额) 比例拆分
    //   · 已售比例 × 0.7 → 版权池（T+1 结算给投资者）
    //   · 未售比例 × 0.7 → 创作者（creator_reward，T+1 结算）
    if (!songData.is_ipo_active) {
      // 独创歌曲：0.7 全给创作者
      const { error: creatorError } = await adminClient.rpc('record_mining_reward', {
        p_user_id: songData.creator_id,
        p_amount: 0.7,
        p_type: 'creator_reward',
        p_description: '收听分成 (独创歌曲)',
        p_song_id: songId
      });
      if (creatorError) {
        console.error('Failed to record creator reward:', creatorError);
        return NextResponse.json({ error: 'Failed to process creator reward' }, { status: 500 });
      }
    } else {
      // 已开启 IPO：计算已售/未售比例
      const totalShares = songData.total_shares || 100;
      const remainingShares = songData.remaining_shares ?? totalShares;
      const soldShares = Math.max(0, totalShares - remainingShares);
      const soldRatio = totalShares > 0 ? soldShares / totalShares : 0;

      const investorAmount = parseFloat((0.7 * soldRatio).toFixed(6));
      const creatorAmount = parseFloat((0.7 * (1 - soldRatio)).toFixed(6));

      // 投资者版权池份额（T+1 结算）
      if (investorAmount > 0) {
        const { error: poolError } = await adminClient.rpc('record_mining_reward', {
          p_user_id: null,
          p_amount: investorAmount,
          p_type: 'dividend_pool_reward',
          p_description: `版权分红（已售 ${soldShares}/${totalShares} 份）`,
          p_song_id: songId
        });
        if (poolError) {
          console.error('Failed to record investor pool reward:', poolError);
          return NextResponse.json({ error: 'Failed to process pool reward' }, { status: 500 });
        }
      }

      // 创作者未售份额收益（T+1 结算）
      if (creatorAmount > 0) {
        const { error: creatorError } = await adminClient.rpc('record_mining_reward', {
          p_user_id: songData.creator_id,
          p_amount: creatorAmount,
          p_type: 'creator_reward',
          p_description: `收听分成（未售出 ${remainingShares}/${totalShares} 份归创作者）`,
          p_song_id: songId
        });
        if (creatorError) {
          console.error('Failed to record creator proportional reward:', creatorError);
          return NextResponse.json({ error: 'Failed to process creator reward' }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Rewards recorded successfully' });

  } catch (error: any) {
    console.error('Play reward error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
