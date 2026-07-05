import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncSongsUpdate } from '@/utils/supabase/sync';

export async function POST(request: NextRequest) {
  try {
    // 1. 从请求头取客户端 JWT token（用于身份验证）
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录，无法修改作品信息' }, { status: 401 });
    }
    const accessToken = authHeader.slice(7);

    // 2. 用 anon key + bearer token 验证用户身份（不绕过 RLS，只为鉴权）
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(accessToken);

    if (authError || !user) {
      console.error('[Song Update API] Auth failed:', authError?.message);
      return NextResponse.json({ error: '身份验证失败，请重新登录' }, { status: 401 });
    }

    console.log(`[Song Update API] Authenticated user: ${user.id}`);

    // 3. 解析请求体
    const body = await request.json();
    const { songId, lyrics, tags, moods, cover_url } = body;

    if (!songId) {
      return NextResponse.json({ error: '缺少作品 ID' }, { status: 400 });
    }

    // 4. 用 service_role key 创建管理员客户端（完全绕过 RLS）
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MEMFIRE_SERVICE_ROLE_KEY!
    );

    // 5. 确认作品归属（防越权，用管理员客户端查询）
    const { data: songCheck, error: checkError } = await adminClient
      .from('songs')
      .select('id, creator_id')
      .eq('id', songId)
      .single();

    if (checkError || !songCheck) {
      return NextResponse.json({ error: '作品不存在' }, { status: 404 });
    }

    if (songCheck.creator_id !== user.id) {
      console.warn(`[Song Update API] Unauthorized: user ${user.id} tried to edit song owned by ${songCheck.creator_id}`);
      return NextResponse.json({ error: '无权修改他人的作品' }, { status: 403 });
    }

    // 6. 字段白名单（财务字段绝对不在此列）
    const updatePayload: Record<string, any> = {};
    if (typeof lyrics === 'string') updatePayload.lyrics = lyrics;
    if (Array.isArray(tags)) updatePayload.tags = tags;
    if (Array.isArray(moods)) updatePayload.moods = moods;
    if (typeof cover_url === 'string' && cover_url) updatePayload.cover_url = cover_url;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 });
    }

    console.log(`[Song Update API] Updating song ${songId} with fields:`, Object.keys(updatePayload));

    // 7. 使用双引擎并发同步模块执行更新，确保 Supabase 与 Memfire 同步更新
    await syncSongsUpdate(songId, updatePayload, user.id);

    console.log(`[Song Update API] ✅ Song ${songId} updated and synced successfully.`);
    return NextResponse.json({ success: true, message: '作品信息已成功保存' });


  } catch (err: any) {
    console.error('[Song Update API] Unexpected error:', err);
    return NextResponse.json({ error: `服务器错误: ${err.message}` }, { status: 500 });
  }
}
