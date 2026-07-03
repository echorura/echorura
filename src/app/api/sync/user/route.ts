import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 初始化主/副数据库 Admin 客户端
const memfireAdmin = createClient(
  process.env.NEXT_PUBLIC_MEMFIRE_URL!,
  process.env.MEMFIRE_SERVICE_ROLE_KEY!
);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { type, table, record } = payload;

    // 仅处理 profiles 和 wallets 数据表
    if (table !== 'profiles' && table !== 'wallets') {
      return NextResponse.json({ ok: true, message: 'Ignored table' });
    }

    const url = new URL(req.url);
    const source = url.searchParams.get('source'); // 'memfire' 或 'supabase'

    if (!source || (source !== 'memfire' && source !== 'supabase')) {
      return NextResponse.json({ error: 'Missing or invalid source param' }, { status: 400 });
    }

    const sourceDb = source === 'memfire' ? memfireAdmin : supabaseAdmin;
    const targetDb = source === 'memfire' ? supabaseAdmin : memfireAdmin;
    const sourceDbName = source === 'memfire' ? 'Memfire' : 'Supabase';
    const targetDbName = source === 'memfire' ? 'Supabase' : 'Memfire';

    // A. 处理 wallets 表同步
    if (table === 'wallets') {
      console.log(`[Sync Engine] Received ${type} from ${sourceDbName} on wallets for User ID: ${record.user_id}`);
      
      // 检查目标库中的钱包记录，防止死循环
      const { data: targetWallet } = await targetDb
        .from('wallets')
        .select('balance, updated_at')
        .eq('user_id', record.user_id)
        .maybeSingle();

      if (targetWallet) {
        const isBalanceEqual = Number(targetWallet.balance) === Number(record.balance);
        const isTargetNewer = new Date(targetWallet.updated_at) >= new Date(record.updated_at);
        if (isBalanceEqual || isTargetNewer) {
          console.log(`[Sync Engine] Wallet for user ${record.user_id} is already up to date on ${targetDbName}. Skipping.`);
          return NextResponse.json({ success: true, message: 'Already up to date' });
        }
      }

      const { error: walletSyncErr } = await targetDb
        .from('wallets')
        .upsert({
          user_id: record.user_id,
          balance: record.balance,
          updated_at: record.updated_at,
          created_at: record.created_at,
        }, { onConflict: 'user_id' });

      if (walletSyncErr) {
        console.error(`[Sync Engine] Sync wallet to ${targetDbName} failed:`, walletSyncErr.message);
        return NextResponse.json({ error: walletSyncErr.message }, { status: 500 });
      }
      
      console.log(`[Sync Engine] Wallet sync complete for User ID: ${record.user_id} to ${targetDbName}`);
      return NextResponse.json({ success: true });
    }

    // B. 处理 profiles 表同步
    console.log(`[Sync Engine] Received ${type} from ${sourceDbName} on profiles for ID: ${record.id}`);

    // 1. 检查目标数据库中是否已有该用户账号
    const { data: targetUser, error: checkErr } = await targetDb.rpc('get_auth_user_by_id', {
      p_user_id: record.id,
    });

    if (checkErr) {
      console.error(`[Sync Engine] Check user in ${targetDbName} failed:`, checkErr.message);
      return NextResponse.json({ error: checkErr.message }, { status: 500 });
    }

    // 2. 如果不存在，说明是新注册用户，开始跨库复制 Auth 账号
    if (!targetUser) {
      console.log(`[Sync Engine] User ${record.id} not found in ${targetDbName}. Fetching from ${sourceDbName}...`);
      
      const { data: sourceUser, error: fetchErr } = await sourceDb.rpc('get_auth_user_by_id', {
        p_user_id: record.id,
      });

      if (fetchErr || !sourceUser) {
        console.error(`[Sync Engine] Fetch user from ${sourceDbName} failed:`, fetchErr?.message);
        return NextResponse.json({ error: fetchErr?.message || 'User not found in source' }, { status: 500 });
      }

      console.log(`[Sync Engine] Syncing Auth user ${record.id} to ${targetDbName}...`);
      const { error: syncErr } = await targetDb.rpc('sync_auth_user', {
        user_data: sourceUser,
      });

      if (syncErr) {
        console.error(`[Sync Engine] Sync Auth user to ${targetDbName} failed:`, syncErr.message);
        return NextResponse.json({ error: syncErr.message }, { status: 500 });
      }
      console.log(`[Sync Engine] Successfully synced Auth user ${record.id} to ${targetDbName}`);
    }

    // 3. 同步 profiles 表对应的资料，加防死循环校验
    const { data: targetProfile } = await targetDb
      .from('profiles')
      .select('updated_at')
      .eq('id', record.id)
      .maybeSingle();

    if (targetProfile && new Date(targetProfile.updated_at) >= new Date(record.updated_at)) {
      console.log(`[Sync Engine] Profile for user ${record.id} is already up to date on ${targetDbName}. Skipping.`);
      return NextResponse.json({ success: true, message: 'Already up to date' });
    }

    const { error: profileErr } = await targetDb
      .from('profiles')
      .upsert({
        id: record.id,
        display_name: record.display_name,
        avatar_url: record.avatar_url,
        bio: record.bio,
        updated_at: record.updated_at,
        member_number: record.member_number,
        created_at: record.created_at,
      });

    if (profileErr) {
      console.error(`[Sync Engine] Sync profile to ${targetDbName} failed:`, profileErr.message);
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    // 4. 确保目标库存在对应的钱包记录 (防止钱包数据缺失)
    const { data: walletData, error: walletCheckErr } = await targetDb
      .from('wallets')
      .select('user_id')
      .eq('user_id', record.id)
      .maybeSingle();

    if (!walletCheckErr && !walletData) {
      console.log(`[Sync Engine] Creating wallet for user ${record.id} in ${targetDbName}...`);
      const { error: walletCreateErr } = await targetDb
        .from('wallets')
        .insert({
          user_id: record.id,
          balance: 0,
        });
      
      if (walletCreateErr) {
        console.warn(`[Sync Engine] Create wallet in ${targetDbName} failed:`, walletCreateErr.message);
      }
    }

    console.log(`[Sync Engine] Sync complete for user ${record.id} from ${sourceDbName} to ${targetDbName}`);
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[Sync Engine] Critical error in webhook handler:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
