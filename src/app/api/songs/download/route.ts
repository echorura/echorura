import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { songId, amount } = await request.json();

    if (!songId || !amount) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Authenticate user from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY!
    );
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 2. Use Service Role key to bypass RLS and execute the RPC securely
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.MEMFIRE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin.rpc('purchase_song_download', {
      p_user_id: user.id,
      p_song_id: songId,
      p_amount: amount
    });

    if (error) {
      console.error("[Download Purchase Error]", error);
      return NextResponse.json({ error: '支付失败，请重试' }, { status: 500 });
    }

    if (data && data.success === false) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[Download API Exception]", err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
