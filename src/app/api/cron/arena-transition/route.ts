import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 此接口每天凌晨自动触发，将昨日报名的歌曲状态从 pending 转为 voting
export async function GET(request: NextRequest) {
  try {
    // 1. 安全校验：防止外部恶意触发阶段流转
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized access to Arena Transition Engine' }, { status: 401 });
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

    console.log(`[ARENA TRANSITION ENGINE] 正在扫描早于今日 (${todayString}) 且处于 pending 的报名记录...`);

    // 3. 获取所有早于今天的待流转报名记录的日期
    const { data: pendingRegs, error: fetchError } = await adminClient
      .from('arena_registrations')
      .select('arena_date')
      .eq('status', 'pending')
      .lt('arena_date', todayString);

    if (fetchError) {
      console.error('[ARENA TRANSITION ENGINE] Fetch outdated pending registrations failed:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch pending registrations' }, { status: 500 });
    }

    const transitionedDates: string[] = [];
    const reports: any[] = [];

    if (pendingRegs && pendingRegs.length > 0) {
      const uniqueDates = Array.from(new Set(pendingRegs.map((r: any) => r.arena_date)));
      console.log(`[ARENA TRANSITION ENGINE] 发现需要流转的日期批次:`, uniqueDates);

      for (const date of uniqueDates) {
        const { data, error } = await adminClient.rpc('transition_arena_phase', {
          p_target_date: date
        });
        if (error) {
          console.error(`[ARENA TRANSITION ENGINE] RPC failed for target date ${date}:`, error);
        } else {
          transitionedDates.push(date);
          reports.push(data);
        }
      }
    }

    console.log(`[ARENA TRANSITION ENGINE] 阶段流转成功完成，已流转日期:`, transitionedDates);

    return NextResponse.json({
      success: true,
      message: transitionedDates.length > 0
        ? `Arena registrations for ${transitionedDates.join(', ')} are now open for voting!`
        : `No outdated pending arena registrations found to transition.`,
      transitioned_dates: transitionedDates,
      reports
    });

  } catch (error: any) {
    console.error('[ARENA TRANSITION ENGINE] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
