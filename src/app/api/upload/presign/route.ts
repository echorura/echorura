import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user via Supabase
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录，无法上传文件' }, { status: 401 });
    }
    const accessToken = authHeader.slice(7);

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json({ error: '身份验证失败，请重新登录' }, { status: 401 });
    }

    // 2. Parse request JSON
    const { filename, contentType, folder } = await request.json();
    if (!filename || !contentType) {
      return NextResponse.json({ error: '参数无效: 需提供 filename, contentType' }, { status: 400 });
    }

    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_BUCKET_NAME) {
      return NextResponse.json({ error: '服务端 R2 存储配置未完成，请联系管理员' }, { status: 500 });
    }

    // 3. Generate key and presigned URL
    const ext = filename.split('.').pop() || '';
    const safeFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const objectKey = `${folder || 'uploads'}/${user.id}/${safeFilename}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 600 });
    const publicUrlBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, '');
    const publicUrl = `${publicUrlBase}/${objectKey}`;

    console.log(`[Presign API] Generated PUT URL for ${objectKey}`);

    return NextResponse.json({
      success: true,
      uploadUrl,
      publicUrl,
      key: objectKey,
    });
  } catch (err: any) {
    console.error('[Presign API Error]', err);
    return NextResponse.json({ error: `无法生成预签名 URL: ${err.message}` }, { status: 500 });
  }
}
