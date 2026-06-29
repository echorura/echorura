import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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
      process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json({ error: '身份验证失败，请重新登录' }, { status: 401 });
    }

    // 2. Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'uploads';

    if (!file) {
      return NextResponse.json({ error: '未找到上传的文件' }, { status: 400 });
    }

    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_BUCKET_NAME) {
      return NextResponse.json({ error: '服务端 R2 存储配置未完成，请联系管理员' }, { status: 500 });
    }

    // 3. Prepare File for S3
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Generate secure filename: timestamp + random string + extension
    const ext = file.name.split('.').pop() || '';
    const safeFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const objectKey = `${folder}/${user.id}/${safeFilename}`;

    console.log(`[R2 Upload API] Uploading ${file.name} to ${objectKey}...`);

    // 4. Upload to Cloudflare R2
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
      Body: buffer,
      ContentType: file.type,
    });

    await r2Client.send(uploadCommand);

    // 5. Construct Public URL
    const publicUrlBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, '');
    const publicUrl = `${publicUrlBase}/${objectKey}`;

    console.log(`[R2 Upload API] ✅ Successfully uploaded to: ${publicUrl}`);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: objectKey,
    });

  } catch (err: any) {
    console.error('[R2 Upload API] Unexpected error:', err);
    return NextResponse.json({ error: `服务器上传失败: ${err.message}` }, { status: 500 });
  }
}
