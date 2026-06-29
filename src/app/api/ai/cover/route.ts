import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prompt = searchParams.get('prompt') || '';
  
  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }
  
  console.log(`[AI Cover Backend] Received prompt request: "${prompt}"`);
  
  // 构造生图 URL
  const aiImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1000&height=1000&nologo=true&private=true`;
  
  try {
    // 后端发起网络请求，避免浏览器 CORS 跨域拦截
    const response = await fetch(aiImageUrl, {
      next: { revalidate: 0 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from Pollinations API: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`[AI Cover Backend] Successfully synthesized image from AI model. Size: ${buffer.length} bytes.`);
    
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('[AI Cover Backend] Error fetching image:', error);
    
    // 如果后台生图模型暂时不可用，后端自动优雅降级为高画质抽象设计纹理（作为备份）
    try {
      console.log('[AI Cover Backend] Attempting fallback to curated abstract visual assets...');
      const fallbackUrl = `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80`;
      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok) {
        const arrayBuffer = await fallbackRes.arrayBuffer();
        return new Response(Buffer.from(arrayBuffer), {
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }
    } catch (fallbackError) {
      console.error('[AI Cover Backend] Fallback also failed:', fallbackError);
    }
    
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
