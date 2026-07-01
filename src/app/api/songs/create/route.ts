import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncSongsInsert, supabaseAdmin } from '@/utils/supabase/sync';

export async function POST(request: NextRequest) {
  try {
    // 1. 从请求头取客户端 JWT token（用于身份验证）
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录，无法上传作品' }, { status: 401 });
    }
    const accessToken = authHeader.slice(7);

    // 2. 用 anon key + bearer token 验证用户身份（只为鉴权）
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(accessToken);

    if (authError || !user) {
      console.error('[Song Create API] Auth failed:', authError?.message);
      return NextResponse.json({ error: '身份验证失败，请重新登录' }, { status: 401 });
    }

    console.log(`[Song Create API] Authenticated user ${user.id} uploading song...`);

    // 3. 解析请求体
    const body = await request.json();
    const {
      title,
      artist,
      lyrics,
      tags,
      moods,
      audio_url,
      cover_url,
      is_ipo_active,
      total_shares,
      ipo_percentage,
      push_to_followers
    } = body;

    // 必填参数校验
    if (!title || !audio_url || !cover_url) {
      return NextResponse.json({ error: '必填字段缺失（标题、音频地址或封面地址）' }, { status: 400 });
    }

    // 4. 构造统一数据载荷
    const songPayload = {
      title,
      artist: artist || user.email?.split('@')[0] || 'Unknown Artist',
      lyrics: lyrics || '',
      tags: Array.isArray(tags) ? tags : [],
      moods: Array.isArray(moods) ? moods : [],
      audio_url,
      cover_url,
      earn_rate: 0.01, // 默认听歌挖矿收益系数
      creator_id: user.id,
      is_ipo_active: !!is_ipo_active,
      total_shares: typeof total_shares === 'number' ? total_shares : 100,
      remaining_shares: typeof total_shares === 'number' ? total_shares : 100,
      ipo_percentage: typeof ipo_percentage === 'number' ? ipo_percentage : 50
    };

    console.log(`[Song Create API] Executing dual-write insertion for song "${title}"`);

    // 5. 调用双引擎并发同步写入模块
    const createdData = await syncSongsInsert(songPayload);

    console.log(`[Song Create API] ✅ Song "${title}" created and synced successfully with ID: ${createdData.id}`);

    // 发放 1 ECHO 的上传奖励
    const { error: rewardError } = await supabaseAdmin.rpc('record_mining_reward', {
      p_user_id: user.id,
      p_amount: 1,
      p_type: 'upload_reward',
      p_description: '发布原创作品奖励',
      p_song_id: createdData.id
    });
    if (rewardError) {
      console.error('[Song Create API] ⚠️ 发放上传奖励失败:', rewardError);
    }

    // 如果歌曲启用了共创 (IPO)，初始化创作者全部股份（以歌曲实际 total_shares 为准）
    if (!!is_ipo_active) {
      const { error: equityError } = await supabaseAdmin
        .from('equities')
        .insert({
          song_id: createdData.id,
          user_id: user.id,
          shares: songPayload.total_shares  // 使用实际总份额，而非固定 100
        });
      if (equityError) {
        console.error('[Song Create API] ⚠️ 创作者初始股份注入失败:', equityError);
      }
    }

    // 粉丝推送逻辑 (Fan Push)
    if (push_to_followers) {
      console.log(`[Song Create API] Initiating fan push for artist ${user.id}`);
      
      const { data: followers } = await supabaseAdmin
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id);
        
      if (followers && followers.length > 0) {
        const notifications = followers.map(f => ({
          user_id: f.follower_id,
          actor_id: user.id,
          type: 'new_song',
          message: `发布了全新音乐作品《${title}》，快去听听吧！`,
          song_id: createdData.id,
          link: `/discover?q=${encodeURIComponent(title)}`
        }));
        
        const { error: notifyError } = await supabaseAdmin
          .from('notifications')
          .insert(notifications);
          
        if (notifyError) {
          console.error('[Song Create API] ⚠️ 发送粉丝通知失败:', notifyError);
        } else {
          console.log(`[Song Create API] ✅ 成功向 ${followers.length} 位粉丝发送了新歌通知`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '作品上传成功并已同步至全球节点！',
      data: createdData
    });

  } catch (err: any) {
    console.error('[Song Create API] Unexpected error during song creation:', err);
    return NextResponse.json({ error: `服务器上传处理失败: ${err.message}` }, { status: 500 });
  }
}
