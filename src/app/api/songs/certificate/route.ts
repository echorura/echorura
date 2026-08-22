import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/utils/supabase/sync';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user session
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录，无法申请存证证书' }, { status: 401 });
    }
    const accessToken = authHeader.slice(7);

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(accessToken);

    if (authError || !user) {
      console.error('[Certificate API] Auth failed:', authError?.message);
      return NextResponse.json({ error: '身份验证失败，请重新登录' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { songId } = body;

    if (!songId) {
      return NextResponse.json({ error: '缺少必需参数: songId' }, { status: 400 });
    }

    // 3. Query song and verify ownership
    const { data: song, error: fetchError } = await supabaseAdmin
      .from('songs')
      .select('*')
      .eq('id', songId)
      .single();

    if (fetchError || !song) {
      return NextResponse.json({ error: '找不到指定的歌曲作品' }, { status: 404 });
    }

    if (song.creator_id !== user.id) {
      return NextResponse.json({ error: '无权为非本人作品申请存证证书' }, { status: 403 });
    }

    // 4. Return existing certificate if already generated
    if (song.certificate_id) {
      return NextResponse.json({
        success: true,
        message: '该作品已拥有版权存证证书',
        data: {
          certificate_id: song.certificate_id,
          audio_hash: song.audio_hash,
          signature_hash: song.signature_hash,
          certificate_created_at: song.certificate_created_at
        }
      });
    }

    // 5. Fetch audio file and compute SHA-256 fingerprint
    console.log(`[Certificate API] Fetching audio file for hashing: ${song.audio_url}`);
    let sha256 = '';
    try {
      const audioResponse = await fetch(song.audio_url);
      if (!audioResponse.ok) {
        throw new Error(`存储服务器返回状态 ${audioResponse.status}`);
      }
      const arrayBuffer = await audioResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    } catch (hashErr: any) {
      console.error('[Certificate API] Failed to compute hash:', hashErr);
      return NextResponse.json({ error: `音频文件哈希计算失败: ${hashErr.message}` }, { status: 500 });
    }

    // 6. Generate Certificate ID and Server Digital Signature
    const cleanId = String(song.id).padStart(6, '0');
    const certificateId = `EC-GLOBAL-2026-${cleanId}`;
    const now = new Date().toISOString();
    
    // HMAC-SHA256 signature payload
    const signPayload = `${certificateId}:${song.id}:${sha256}:${song.creator_id}:${now}`;
    const secret = process.env.CERTIFICATE_SIGNING_KEY || 'echorura-global-secrethandshake-2026';
    const signatureHash = crypto.createHmac('sha256', secret).update(signPayload).digest('hex');

    // 7. Write back to database
    console.log(`[Certificate API] Writing certificate info for song ${song.id} into database`);
    const { error: updateError } = await supabaseAdmin
      .from('songs')
      .update({
        certificate_id: certificateId,
        audio_hash: sha256,
        signature_hash: signatureHash,
        certificate_created_at: now
      })
      .eq('id', song.id);

    if (updateError) {
      console.error('[Certificate API] Database update error:', updateError);
      return NextResponse.json({ error: `证书写回失败: ${updateError.message}` }, { status: 500 });
    }

    console.log(`[Certificate API] ✅ Successfully generated certificate ${certificateId} for song "${song.title}"`);

    return NextResponse.json({
      success: true,
      message: '证书申请并生成成功！',
      data: {
        certificate_id: certificateId,
        audio_hash: sha256,
        signature_hash: signatureHash,
        certificate_created_at: now
      }
    });

  } catch (err: any) {
    console.error('[Certificate API] Unexpected error:', err);
    return NextResponse.json({ error: `系统内部错误: ${err.message}` }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const certId = request.nextUrl.searchParams.get('id') || request.nextUrl.searchParams.get('certificate_id');
    if (!certId) {
      return NextResponse.json({ error: '缺少证书ID参数 (id)' }, { status: 400 });
    }

    // 查询对应歌曲作品
    const { data: song, error: fetchError } = await supabaseAdmin
      .from('songs')
      .select('id, title, artist, certificate_id, audio_hash, signature_hash, certificate_created_at, creator_id')
      .eq('certificate_id', certId)
      .single();

    if (fetchError || !song) {
      return NextResponse.json({ error: '未找到匹配的数字版权存证凭证' }, { status: 404 });
    }

    // 校验数字防伪签章 (HMAC-SHA256 Verification)
    const signPayload = `${song.certificate_id}:${song.id}:${song.audio_hash}:${song.creator_id}:${song.certificate_created_at}`;
    const secret = process.env.CERTIFICATE_SIGNING_KEY || 'echorura-global-secrethandshake-2026';
    const computedSignature = crypto.createHmac('sha256', secret).update(signPayload).digest('hex');

    const isValid = computedSignature === song.signature_hash;
    if (!isValid) {
      return NextResponse.json({
        success: false,
        error: '证书防伪数字签章校验失败 (Cryptographic Verification Failed)',
        data: {
          song,
          verified: false
        }
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        song,
        verified: true
      }
    });

  } catch (err: any) {
    console.error('[Certificate GET API] Error:', err);
    return NextResponse.json({ error: `系统内部错误: ${err.message}` }, { status: 500 });
  }
}
