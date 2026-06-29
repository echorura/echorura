import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 此接口每天凌晨自动触发，对已结束投票周期的批次进行结算（前10名退款上榜，余下淘汰扣款并分红给听审员）
export async function GET(request: NextRequest) {
  try {
    // 1. 安全校验：防止外部恶意触发结算
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized access to Arena Settlement Engine' }, { status: 401 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.MEMFIRE_SERVICE_ROLE_KEY!
    );

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

    // 3. 获取所有早于昨日的待结算对决记录的日期
    const { data: votingRegs, error: fetchError } = await adminClient
      .from('arena_registrations')
      .select('arena_date')
      .eq('status', 'voting')
      .lt('arena_date', yesterdayString);

    if (fetchError) {
      console.error('[ARENA SETTLEMENT ENGINE] Fetch outdated voting registrations failed:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch voting registrations' }, { status: 500 });
    }

    const settledDates: string[] = [];
    const reports: any[] = [];

    if (votingRegs && votingRegs.length > 0) {
      const uniqueDates = Array.from(new Set(votingRegs.map((r: any) => r.arena_date)));
      console.log(`[ARENA SETTLEMENT ENGINE] 发现需要结算的日期批次:`, uniqueDates);

      for (const date of uniqueDates) {
        const { data, error } = await adminClient.rpc('settle_arena', {
          p_target_date: date
        });
        if (error) {
          console.error(`[ARENA SETTLEMENT ENGINE] RPC failed for target date ${date}:`, error);
        } else {
          settledDates.push(date);
          reports.push(data);
        }
      }
    }

    console.log(`[ARENA SETTLEMENT ENGINE] 结算圆满完成，已结算日期:`, settledDates);

    return NextResponse.json({
      success: true,
      message: settledDates.length > 0
        ? `Arena settlements for ${settledDates.join(', ')} executed successfully!`
        : `No outdated voting arena registrations found to settle.`,
      settled_dates: settledDates,
      reports
    });

  } catch (error: any) {
    console.error('[ARENA SETTLEMENT ENGINE] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
