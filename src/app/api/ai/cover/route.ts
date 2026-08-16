import { NextResponse } from 'next/server';

// 预设艺术风格提示词强化词库 (Prompt Enhancement Library)
const STYLE_PROMPTS: Record<string, string> = {
  cyberpunk: 'cyberpunk style, neon cyan and magenta glow, futuristic city, holographic elements, 8k resolution, octane render, detailed digital art, square album cover',
  zen: 'oriental zen aesthetic, traditional chinese ink wash painting, warm gold accents, minimalist composition, soft ethereal lighting, high resolution',
  vaporwave: 'retro 80s synthwave grid, vaporwave aesthetic, pastel neon pink and purple, 3d wireframe, palm trees, digital illustration, nostalgic vibe',
  ambient: 'abstract aurora nebula, cosmic glowing particles, soft volumetric lighting, deep space, ethereal ambient atmosphere, 8k resolution, album art',
  surrealism: 'dreamlike surrealism, Salvador Dali style, floating crystal geometries, distorted reality, rich vivid color palette, hyper-detailed',
  minimalist: 'minimalist graphic design, bold geometric shapes, Swiss style typography layout, high contrast color block, clean aesthetic',
};

// AI 智能提示词强化 Agent
function enhancePrompt(rawPrompt: string, style?: string): string {
  let enhanced = rawPrompt.trim();
  
  // 匹配选定的艺术风格
  const styleKeywords = (style && STYLE_PROMPTS[style]) || STYLE_PROMPTS.cyberpunk;
  
  // 增加高质感唱片封面专业关键词
  const qualitySuffix = 'masterpiece, high-end album cover design, 8k resolution, professional lighting, centered composition, trending on ArtStation, no watermark, no text';
  
  return `${enhanced}, ${styleKeywords}, ${qualitySuffix}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPrompt = searchParams.get('prompt') || '';
  const style = searchParams.get('style') || 'cyberpunk';
  const modelType = searchParams.get('model') || 'flux'; // 'flux' | 'turbo' | 'sdxl'
  
  if (!rawPrompt) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }

  const enhancedPrompt = enhancePrompt(rawPrompt, style);
  const seed = Math.floor(Math.random() * 1000000);
  
  console.log(`[AI Cover Agent] Model: ${modelType} | Raw Prompt: "${rawPrompt}"`);
  console.log(`[AI Cover Agent] Enhanced Prompt: "${enhancedPrompt}"`);

  // 候选开源大模型生成接口链
  const modelEndpoints = [
    // 优先 1: FLUX.1 开源最新顶级绘图模型
    `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`,
    // 备用 2: SDXL / Turbo 快速渲染大模型
    `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&seed=${seed}&model=turbo&nologo=true`,
  ];

  for (const endpoint of modelEndpoints) {
    try {
      console.log(`[AI Cover Agent] Attempting synthesis via: ${endpoint.substring(0, 80)}...`);
      const response = await fetch(endpoint, {
        next: { revalidate: 0 },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length > 5000) { // 确认不是空图或错误小网页
          console.log(`[AI Cover Agent] ✅ Successfully synthesized ${buffer.length} bytes using open-source AI model.`);
          return new Response(buffer, {
            headers: {
              'Content-Type': 'image/png',
              'Cache-Control': 'no-store, max-age=0',
            },
          });
        }
      }
    } catch (err: any) {
      console.warn(`[AI Cover Agent] Endpoint failed, trying next fallback...`, err.message);
    }
  }

  // 终极备用：高画质声学艺术视效兜底
  try {
    console.log('[AI Cover Agent] Attempting fallback to curated abstract visual assets...');
    const fallbackUrl = `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80`;
    const fallbackRes = await fetch(fallbackUrl);
    if (fallbackRes.ok) {
      const arrayBuffer = await fallbackRes.arrayBuffer();
      return new Response(Buffer.from(arrayBuffer), {
        headers: { 'Content-Type': 'image/jpeg' },
      });
    }
  } catch (fallbackError) {
    console.error('[AI Cover Agent] Fallback also failed:', fallbackError);
  }

  return NextResponse.json({ error: 'AI image synthesis failed' }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, style, model } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const enhancedPrompt = enhancePrompt(prompt, style);
    const seed = Math.floor(Math.random() * 1000000);

    const endpoint = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&seed=${seed}&model=${model || 'flux'}&nologo=true`;

    const response = await fetch(endpoint, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Synthesis failed with status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
