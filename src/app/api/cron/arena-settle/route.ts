import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, memfireAdmin } from '@/utils/supabase/sync';

// 此接口每天凌晨自动触发，对已结束投票周期的批次进行结算（前10名退款上榜，余下淘汰扣款并分红给听审员）
export async function GET(request: NextRequest) {
  try {
    // 1. 安全校验：防止外部恶意触发结算
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized access to Arena Settlement Engine' }, { status: 401 });
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

    // 计算 yesterdayString (Asia/Shanghai)，用于只结算昨日或更早的投票记录（确保完整的 24 小时投票周期）
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayParts = formatter.formatToParts(yesterday);
    const yYear = yesterdayParts.find(p => p.type === 'year')?.value;
    const yMonth = yesterdayParts.find(p => p.type === 'month')?.value;
    const yDay = yesterdayParts.find(p => p.type === 'day')?.value;
    const yesterdayString = `${yYear}-${yMonth}-${yDay}`;

    console.log(`[ARENA SETTLEMENT ENGINE] 正在扫描早于昨日 (${yesterdayString}) 且处于 voting 的对决记录进行结算...`);

    // 3. 定义统一的结算引擎函数
    async function processDatabase(client: any, dbName: string) {
      try {
        const { data: votingRegs, error: fetchError } = await client
          .from('arena_registrations')
          .select('arena_date')
          .eq('status', 'voting')
          .lt('arena_date', yesterdayString);

        if (fetchError) {
          console.error(`[ARENA SETTLEMENT ENGINE] [${dbName}] Fetch outdated voting registrations failed:`, fetchError.message);
          return { success: false, error: fetchError.message, settledDates: [], reports: [] };
        }

        const settledDates: string[] = [];
        const reports: any[] = [];

        if (votingRegs && votingRegs.length > 0) {
          const uniqueDates: string[] = Array.from(new Set(votingRegs.map((r: any) => r.arena_date as string)));
          console.log(`[ARENA SETTLEMENT ENGINE] [${dbName}] 发现需要结算的日期批次:`, uniqueDates);

          for (const date of uniqueDates) {
            const { data, error } = await client.rpc('settle_arena', {
              p_target_date: date
            });
            if (error) {
              console.error(`[ARENA SETTLEMENT ENGINE] [${dbName}] RPC failed for target date ${date}:`, error.message);
            } else {
              settledDates.push(date);
              reports.push(data);
            }
          }
        }
        return { success: true, settledDates, reports };
      } catch (err: any) {
        console.error(`[ARENA SETTLEMENT ENGINE] [${dbName}] Unhandled exception:`, err.message);
        return { success: false, error: err.message, settledDates: [], reports: [] };
      }
    }

    // 4. 并行执行主副库结算
    const tasks = [processDatabase(supabaseAdmin, 'SUPABASE')];
    if (memfireAdmin) {
      tasks.push(processDatabase(memfireAdmin, 'MEMFIRE'));
    }

    const [primaryRes, secondaryRes] = await Promise.all(tasks);

    console.log(`[ARENA SETTLEMENT ENGINE] 结算完成. 主库:`, primaryRes, `副库:`, secondaryRes || '未启用');

    return NextResponse.json({
      success: true,
      message: `Arena settlement completed on all active databases.`,
      primary: primaryRes,
      secondary: secondaryRes || null
    });

  } catch (error: any) {
    console.error('[ARENA SETTLEMENT ENGINE] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
