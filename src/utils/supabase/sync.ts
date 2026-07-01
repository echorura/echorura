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
async function ensureUserProfileInSecondary(creatorId: string) {
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
  
  // 打印日志报告
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
  
  // 打印日志报告
  let createdSongData: any = null;
  results.forEach((res, index) => {
    if (res.status === 'rejected') {
      console.error(`[Sync Engine] ❌ 歌曲创建双写任务 #${index} 失败:`, res.reason);
    } else {
      // 优先保留成功结果中的数据，返回给前端展示
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
