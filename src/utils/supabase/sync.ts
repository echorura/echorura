import { createClient } from '@supabase/supabase-js';

const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL;
const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MEMFIRE_SERVICE_ROLE_KEY;

export const supabaseAdmin = createClient(
  adminUrl!,
  adminKey!
);

export const memfireAdmin = null;


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

  // 全球库更新
  tasks.push(
    supabaseAdmin
      .from('songs')
      .update(updatePayload)
      .eq('id', songId)
      .eq('creator_id', creatorId)
      .then(({ error, data }) => {
        if (error) throw new Error(`Supabase 更新失败: ${error.message}`);
        console.log(`[Sync Engine] ✅ Supabase 成功更新歌曲: ${songId}`);
        return { db: 'supabase', status: 'success' };
      })
  );



  const results = await Promise.allSettled(tasks);
  
  // 打印日志报告
  results.forEach((res, index) => {
    if (res.status === 'rejected') {
      console.error(`[Sync Engine] ❌ 双写任务 #${index} 失败:`, res.reason);
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

  // 全球库插入
  tasks.push(
    supabaseAdmin
      .from('songs')
      .insert(songPayload)
      .select()
      .single()
      .then(({ error, data }) => {
        if (error) throw new Error(`Supabase 插入失败: ${error.message}`);
        console.log(`[Sync Engine] ✅ Supabase 成功创建歌曲: ${data.id}`);
        return { db: 'supabase', status: 'success', data };
      })
  );



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
