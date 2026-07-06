import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, memfireAdmin } from '@/utils/supabase/sync';

// 此接口每天凌晨自动触发，将昨日报名的歌曲状态从 pending 转为 voting
export async function GET(request: NextRequest) {
  try {
    // 1. 安全校验：防止外部恶意触发阶段流转
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized access to Arena Transition Engine' }, { status: 401 });
    }

    // 2. 获取东八区北京时间 (Asia/Shanghai) 的当前日期 YYYY-MM-DD
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const todayString = `${year}-${month}-${day}`;

    console.log(`[ARENA TRANSITION ENGINE] 正在扫描早于今日 (${todayString}) 且处于 pending 的报名记录...`);

    // 3. 定义统一的流转引擎函数
    async function processDatabase(client: any, dbName: string) {
      try {
        const { data: pendingRegs, error: fetchError } = await client
          .from('arena_registrations')
          .select('arena_date')
          .eq('status', 'pending')
          .lt('arena_date', todayString);

        if (fetchError) {
          console.error(`[ARENA TRANSITION ENGINE] [${dbName}] Fetch outdated pending registrations failed:`, fetchError.message);
          return { success: false, error: fetchError.message, transitionedDates: [], reports: [] };
        }

        const transitionedDates: string[] = [];
        const reports: any[] = [];

        if (pendingRegs && pendingRegs.length > 0) {
          const uniqueDates: string[] = Array.from(new Set(pendingRegs.map((r: any) => r.arena_date as string)));
          console.log(`[ARENA TRANSITION ENGINE] [${dbName}] 发现需要流转的日期批次:`, uniqueDates);

          for (const date of uniqueDates) {
            const { data, error } = await client.rpc('transition_arena_phase', {
              p_target_date: date
            });
            if (error) {
              console.error(`[ARENA TRANSITION ENGINE] [${dbName}] RPC failed for target date ${date}:`, error.message);
            } else {
              transitionedDates.push(date);
              reports.push(data);
            }
          }
        }
        return { success: true, transitionedDates, reports };
      } catch (err: any) {
        console.error(`[ARENA TRANSITION ENGINE] [${dbName}] Unhandled exception:`, err.message);
        return { success: false, error: err.message, transitionedDates: [], reports: [] };
      }
    }

    // 4. 并行执行主副库流转
    const tasks = [processDatabase(supabaseAdmin, 'SUPABASE')];
    if (memfireAdmin) {
      tasks.push(processDatabase(memfireAdmin, 'MEMFIRE'));
    }

    const [primaryRes, secondaryRes] = await Promise.all(tasks);

    console.log(`[ARENA TRANSITION ENGINE] 阶段流转完成. 主库:`, primaryRes, `副库:`, secondaryRes || '未启用');

    return NextResponse.json({
      success: true,
      message: `Arena transition completed on all active databases.`,
      primary: primaryRes,
      secondary: secondaryRes || null
    });

  } catch (error: any) {
    console.error('[ARENA TRANSITION ENGINE] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
