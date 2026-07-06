import { createClient } from '@supabase/supabase-js';

// 1. 初始化主 Admin 客户端 (根据配置自适应，优先选用 Supabase，否则降级到 Memfire)
const primaryUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL;
const primaryKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MEMFIRE_SERVICE_ROLE_KEY;

export const supabaseAdmin = createClient(primaryUrl!, primaryKey!);

// 2. 初始化副 Admin 客户端 (只有当 Supabase 和 Memfire 同时配齐且为不同数据库时激活)
const hasBoth = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_MEMFIRE_URL;
const isDifferent = process.env.NEXT_PUBLIC_SUPABASE_URL !== process.env.NEXT_PUBLIC_MEMFIRE_URL;

export const memfireAdmin = (hasBoth && isDifferent)
  ? createClient(
      primaryUrl === process.env.NEXT_PUBLIC_SUPABASE_URL 
        ? process.env.NEXT_PUBLIC_MEMFIRE_URL! 
        : process.env.NEXT_PUBLIC_SUPABASE_URL!,
      primaryUrl === process.env.NEXT_PUBLIC_SUPABASE_URL 
        ? process.env.MEMFIRE_SERVICE_ROLE_KEY! 
        : process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  : null;

/**
 * 确保副库存在对应的用户 Profile (防止外键 creator_id 物理约束失败)
 */
export async function ensureUserProfileInSecondary(creatorId: string) {
  if (!memfireAdmin) return;
  
  try {
    // 检查副库中是否已有此 profile
    const { data: existingProfile } = await memfireAdmin
      .from('profiles')
      .select('id')
      .eq('id', creatorId)
      .maybeSingle();
      
    if (!existingProfile) {
      console.log(`[Sync Engine] 👥 副库未找到创作者 ${creatorId} 的 Profile，启动主从数据对齐...`);
      
      // 从主库拉取完整 profile
      const { data: mainProfile, error: pullError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', creatorId)
        .single();
        
      if (pullError || !mainProfile) {
        console.warn(`[Sync Engine] ⚠️ 无法从主库拉取创作者 Profile:`, pullError?.message);
        return;
      }
      
      // 写入到副库中
      const { error: pushError } = await memfireAdmin
        .from('profiles')
        .insert(mainProfile);
        
      if (pushError) {
        console.error(`[Sync Engine] ❌ 写入副库 profiles 失败:`, pushError.message);
      } else {
        console.log(`[Sync Engine] ✅ 成功将创作者 Profile 同步至副库`);
      }
    }
  } catch (err: any) {
    console.error(`[Sync Engine] ⚠️ 同步用户 Profile 发生未知异常:`, err.message);
  }
}

/**
 * 确保副库中存在指定的歌曲 (防止报名或投票级联外键约束错误)
 */
export async function ensureSongInSecondary(songId: string | number, creatorId?: string) {
  if (!memfireAdmin) return;
  
  try {
    const { data: existingSong } = await memfireAdmin
      .from('songs')
      .select('id')
      .eq('id', songId)
      .maybeSingle();
      
    if (!existingSong) {
      console.log(`[Sync Engine] 🎵 副库未找到歌曲 ${songId}，启动主从歌曲对齐...`);
      
      // 从主库拉取歌曲详情
      const { data: mainSong, error: pullError } = await supabaseAdmin
        .from('songs')
        .select('*')
        .eq('id', songId)
        .single();
        
      if (pullError || !mainSong) {
        console.warn(`[Sync Engine] ⚠️ 无法从主库拉取歌曲 ${songId}:`, pullError?.message);
        return;
      }

      // 确保创作者 Profile 在副库已存在
      const targetCreatorId = creatorId || mainSong.creator_id;
      if (targetCreatorId) {
        await ensureUserProfileInSecondary(targetCreatorId);
      }
      
      // 插入副库
      const { error: pushError } = await memfireAdmin
        .from('songs')
        .insert(mainSong);
        
      if (pushError) {
        console.error(`[Sync Engine] ❌ 写入副库 songs 失败:`, pushError.message);
      } else {
        console.log(`[Sync Engine] ✅ 成功将歌曲 ${songId} 同步至副库`);
      }
    }
  } catch (err: any) {
    console.error(`[Sync Engine] ⚠️ 同步歌曲发生未知异常:`, err.message);
  }
}

/**
 * 确保副库存在指定的竞技场报名记录
 */
export async function ensureArenaRegistrationInSecondary(
  songId: string | number,
  arenaDate: string,
  creatorId: string
) {
  if (!memfireAdmin) return;
  
  try {
    const { data: existingReg } = await memfireAdmin
      .from('arena_registrations')
      .select('id')
      .eq('song_id', songId)
      .eq('arena_date', arenaDate)
      .maybeSingle();
      
    if (!existingReg) {
      console.log(`[Sync Engine] 📝 副库未找到歌曲 ${songId} 在 ${arenaDate} 的报名记录，启动对齐...`);
      
      // 确保歌曲在副库存在
      await ensureSongInSecondary(songId, creatorId);
      
      // 从主库获取报名信息
      const { data: mainReg, error: pullError } = await supabaseAdmin
        .from('arena_registrations')
        .select('*')
        .eq('song_id', songId)
        .eq('arena_date', arenaDate)
        .single();
        
      if (pullError || !mainReg) {
        console.warn(`[Sync Engine] ⚠️ 无法从主库拉取报名记录:`, pullError?.message);
        return;
      }
      
      // 插入副库
      const { error: pushError } = await memfireAdmin
        .from('arena_registrations')
        .insert(mainReg);
        
      if (pushError) {
        console.error(`[Sync Engine] ❌ 写入副库 arena_registrations 失败:`, pushError.message);
      } else {
        console.log(`[Sync Engine] ✅ 成功将报名记录同步至副库`);
      }
    }
  } catch (err: any) {
    console.error(`[Sync Engine] ⚠️ 同步报名记录异常:`, err.message);
  }
}

/**
 * 钱包充值事务双库双写
 */
export async function syncWalletDeposit(params: {
  userId: string;
  amount: number;
  txHash: string;
  description: string;
}) {
  console.log(`[Sync Engine] 💰 启动充值双写机制: User=${params.userId}, Amount=${params.amount}`);
  
  // 1. 先写入主库
  const primaryPromise = supabaseAdmin.rpc('deposit_user_balance', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_tx_hash: params.txHash,
    p_description: params.description
  });

  // 2. 如果存在副库，写入副库
  let secondaryPromise: Promise<any> = Promise.resolve({ data: null, error: null });
  if (memfireAdmin) {
    secondaryPromise = (async () => {
      try {
        await ensureUserProfileInSecondary(params.userId);
        return await memfireAdmin.rpc('deposit_user_balance', {
          p_user_id: params.userId,
          p_amount: params.amount,
          p_tx_hash: params.txHash,
          p_description: params.description
        });
      } catch (e: any) {
        console.error(`[Sync Engine] ⚠️ 副库充值异常:`, e.message);
        return { data: null, error: e };
      }
    })();
  }

  const [primaryRes, secondaryRes] = await Promise.all([primaryPromise, secondaryPromise]);
  
  if (primaryRes.error) {
    console.error(`[Sync Engine] ❌ 主库充值失败:`, primaryRes.error.message);
  } else {
    console.log(`[Sync Engine] ✅ 主库充值记录写入成功`);
  }

  if (secondaryRes.error) {
    console.warn(`[Sync Engine] ⚠️ 副库充值同步失败:`, secondaryRes.error.message || secondaryRes.error);
  } else if (memfireAdmin) {
    console.log(`[Sync Engine] ✅ 副库充值同步成功`);
  }

  return primaryRes;
}

/**
 * 听歌/上传奖励发放事务双库双写
 */
export async function syncRecordMiningReward(params: {
  userId: string | null;
  amount: number;
  type: string;
  description: string;
  songId: string | number;
  creatorId?: string;
}) {
  // 1. 先写入主库
  const primaryPromise = supabaseAdmin.rpc('record_mining_reward', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_type: params.type,
    p_description: params.description,
    p_song_id: Number(params.songId)
  });

  // 2. 写入副库
  let secondaryPromise: Promise<any> = Promise.resolve({ data: null, error: null });
  if (memfireAdmin) {
    secondaryPromise = (async () => {
      try {
        if (params.userId) {
          await ensureUserProfileInSecondary(params.userId);
        }
        if (params.creatorId) {
          await ensureUserProfileInSecondary(params.creatorId);
        }
        // 发送奖励前，确保歌曲也在副库存在
        const creator = params.creatorId || params.userId;
        if (creator) {
          await ensureSongInSecondary(params.songId, creator);
        }

        return await memfireAdmin.rpc('record_mining_reward', {
          p_user_id: params.userId,
          p_amount: params.amount,
          p_type: params.type,
          p_description: params.description,
          p_song_id: Number(params.songId)
        });
      } catch (e: any) {
        console.error(`[Sync Engine] ⚠️ 副库发放收益分成异常:`, e.message);
        return { data: null, error: e };
      }
    })();
  }

  const [primaryRes, secondaryRes] = await Promise.all([primaryPromise, secondaryPromise]);
  
  if (primaryRes.error) {
    console.error(`[Sync Engine] ❌ 主库奖励录入失败:`, primaryRes.error.message);
  }
  if (secondaryRes.error && memfireAdmin) {
    console.warn(`[Sync Engine] ⚠️ 副库奖励同步失败:`, secondaryRes.error.message || secondaryRes.error);
  }

  return primaryRes;
}

/**
 * 听审竞技场报名事务双写
 */
export async function syncRegisterForArena(params: {
  userId: string;
  songId: string | number;
  creatorId: string;
}) {
  console.log(`[Sync Engine] ⚔️ 启动竞技场报名双写: User=${params.userId}, Song=${params.songId}`);

  // 1. 在主库执行报名与扣款操作
  const primaryRes = await supabaseAdmin.rpc('register_for_arena', {
    p_user_id: params.userId,
    p_song_id: Number(params.songId)
  });

  if (primaryRes.error) {
    console.error(`[Sync Engine] ❌ 主库报名 RPC 失败:`, primaryRes.error.message);
    return primaryRes;
  }

  const resultData = primaryRes.data;
  if (resultData && resultData.success === false) {
    console.warn(`[Sync Engine] ⚠️ 主库报名校验未通过:`, resultData.error);
    return primaryRes;
  }

  // 2. 如果主库报名成功，且存在副库，在副库同步执行报名 RPC
  if (memfireAdmin) {
    try {
      // 确保相关歌曲和用户 Profile 均已在副库对齐
      await ensureUserProfileInSecondary(params.userId);
      await ensureUserProfileInSecondary(params.creatorId);
      await ensureSongInSecondary(params.songId, params.creatorId);

      console.log(`[Sync Engine] 👥 正在副库同步执行 register_for_arena...`);
      const secondaryRes = await memfireAdmin.rpc('register_for_arena', {
        p_user_id: params.userId,
        p_song_id: Number(params.songId)
      });

      if (secondaryRes.error) {
        console.error(`[Sync Engine] ❌ 副库报名 RPC 失败:`, secondaryRes.error.message);
      } else {
        console.log(`[Sync Engine] ✅ 副库报名 RPC 同步成功:`, secondaryRes.data);
      }
    } catch (e: any) {
      console.error(`[Sync Engine] ❌ 副库报名同步出现未捕获异常:`, e.message);
    }
  }

  return primaryRes;
}

/**
 * 听审打分投票事务双写
 */
export async function syncCastVote(params: {
  userId: string;
  songId: string | number;
  creatorId: string;
  voteType: 'up' | 'down';
  arenaDate: string;
  newVotes: number;
}) {
  console.log(`[Sync Engine] 🗳️ 启动打分投票双写: User=${params.userId}, Song=${params.songId}, Type=${params.voteType}`);

  // 1. 主库插入投票并汇总票数 (更新 arena_registrations 及 songs)
  const primaryPromise = (async () => {
    // 写入投票记录
    const { error: insErr } = await supabaseAdmin.from('arena_votes').insert({
      user_id: params.userId,
      song_id: Number(params.songId),
      arena_date: params.arenaDate,
      vote_type: params.voteType
    });
    if (insErr) return { success: false, error: insErr };

    // 更新 arena_registrations 票数
    await supabaseAdmin
      .from('arena_registrations')
      .update({ votes_count: params.newVotes })
      .eq('song_id', Number(params.songId))
      .eq('arena_date', params.arenaDate);

    // 更新 songs 票数
    await supabaseAdmin
      .from('songs')
      .update({ votes: params.newVotes })
      .eq('id', Number(params.songId));

    return { success: true, error: null };
  })();

  // 2. 副库同步插入投票并汇总票数
  let secondaryPromise: Promise<any> = Promise.resolve({ success: true, error: null });
  if (memfireAdmin) {
    secondaryPromise = (async () => {
      try {
        // 对齐用户、歌曲与报名记录
        await ensureUserProfileInSecondary(params.userId);
        await ensureUserProfileInSecondary(params.creatorId);
        await ensureSongInSecondary(params.songId, params.creatorId);
        await ensureArenaRegistrationInSecondary(params.songId, params.arenaDate, params.creatorId);

        // 检查副库中是否已有此投票记录
        const { data: existingVote } = await memfireAdmin
          .from('arena_votes')
          .select('id')
          .eq('user_id', params.userId)
          .eq('song_id', Number(params.songId))
          .eq('arena_date', params.arenaDate)
          .maybeSingle();

        if (!existingVote) {
          const { error: insErr } = await memfireAdmin.from('arena_votes').insert({
            user_id: params.userId,
            song_id: Number(params.songId),
            arena_date: params.arenaDate,
            vote_type: params.voteType
          });
          if (insErr) return { success: false, error: insErr };
        }

        // 更新副库的票数统计
        await memfireAdmin
          .from('arena_registrations')
          .update({ votes_count: params.newVotes })
          .eq('song_id', Number(params.songId))
          .eq('arena_date', params.arenaDate);

        await memfireAdmin
          .from('songs')
          .update({ votes: params.newVotes })
          .eq('id', Number(params.songId));

        return { success: true, error: null };
      } catch (e: any) {
        console.error(`[Sync Engine] ⚠️ 副库打分同步异常:`, e.message);
        return { success: false, error: e };
      }
    })();
  }

  const [primaryRes, secondaryRes] = await Promise.all([primaryPromise, secondaryPromise]);
  return primaryRes;
}

/**
 * 歌曲更新同步工具函数
 * 将特定字段更新在两套数据库中同步执行
 */
export async function syncSongsUpdate(
  songId: string,
  updatePayload: Record<string, any>,
  creatorId: string
) {
  const tasks = [];

  // 主库更新任务
  tasks.push(
    supabaseAdmin
      .from('songs')
      .update(updatePayload)
      .eq('id', songId)
      .eq('creator_id', creatorId)
      .then(({ error }) => {
        if (error) throw new Error(`主库更新失败: ${error.message}`);
        console.log(`[Sync Engine] ✅ 主库成功更新歌曲: ${songId}`);
        return { db: 'primary', status: 'success' };
      })
  );

  // 副库更新任务
  if (memfireAdmin) {
    const secondaryUpdate = (async () => {
      try {
        await ensureUserProfileInSecondary(creatorId);
        const { error } = await memfireAdmin
          .from('songs')
          .update(updatePayload)
          .eq('id', songId)
          .eq('creator_id', creatorId);
          
        if (error) {
          console.error(`[Sync Engine] ⚠️ 副库更新失败:`, error.message);
          return { db: 'secondary', status: 'failed', error };
        }
        console.log(`[Sync Engine] ✅ 副库成功更新歌曲: ${songId}`);
        return { db: 'secondary', status: 'success' };
      } catch (e: any) {
        console.error(`[Sync Engine] ⚠️ 副库更新异常:`, e.message);
        return { db: 'secondary', status: 'failed', error: e };
      }
    })();
    tasks.push(secondaryUpdate);
  }

  const results = await Promise.allSettled(tasks);
  
  results.forEach((res, index) => {
    if (res.status === 'rejected') {
      console.error(`[Sync Engine] ❌ 歌曲更新双写任务 #${index} 失败:`, res.reason);
    }
  });

  return results;
}

/**
 * 歌曲创建同步工具函数
 * 将新歌同时插入到 Supabase 和 Memfire 中
 */
export async function syncSongsInsert(songPayload: Record<string, any>) {
  const tasks = [];

  // 主库插入任务
  tasks.push(
    supabaseAdmin
      .from('songs')
      .insert(songPayload)
      .select()
      .single()
      .then(({ error, data }) => {
        if (error) throw new Error(`主库插入失败: ${error.message}`);
        console.log(`[Sync Engine] ✅ 主库成功创建歌曲: ${data.id}`);
        return { db: 'primary', status: 'success', data };
      })
  );

  // 副库插入任务
  if (memfireAdmin) {
    const secondaryInsert = (async () => {
      try {
        await ensureUserProfileInSecondary(songPayload.creator_id);
        const { error, data } = await memfireAdmin
          .from('songs')
          .insert(songPayload)
          .select()
          .single();
          
        if (error) {
          console.error(`[Sync Engine] ⚠️ 副库插入失败:`, error.message);
          return { db: 'secondary', status: 'failed', error };
        }
        console.log(`[Sync Engine] ✅ 副库成功创建歌曲: ${data.id}`);
        return { db: 'secondary', status: 'success', data };
      } catch (e: any) {
        console.error(`[Sync Engine] ⚠️ 副库插入异常:`, e.message);
        return { db: 'secondary', status: 'failed', error: e };
      }
    })();
    tasks.push(secondaryInsert);
  }

  const results = await Promise.allSettled(tasks);
  
  let createdSongData: any = null;
  results.forEach((res, index) => {
    if (res.status === 'rejected') {
      console.error(`[Sync Engine] ❌ 歌曲创建双写任务 #${index} 失败:`, res.reason);
    } else {
      if (res.value && res.value.data) {
        createdSongData = res.value.data;
      }
    }
  });

  if (!createdSongData) {
    throw new Error('双引擎数据写入均告失败，请检查数据库状态');
  }

  return createdSongData;
}
