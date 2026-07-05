import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '@/contracts/config';

export async function POST(request: NextRequest) {
  try {
    // 1. Get JWT Token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '请登录后再申领创世勋章' }, { status: 401 });
    }
    const accessToken = authHeader.slice(7);

    // 2. Initialize Supabase client and authenticate user
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(accessToken);

    if (authError || !user) {
      console.error('[Genesis Claim API] Auth failed:', authError?.message);
      return NextResponse.json({ error: '身份验证失败，请重新登录' }, { status: 401 });
    }

    // 3. Parse request body for user wallet address
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return NextResponse.json({ error: '无效的钱包地址' }, { status: 400 });
    }

    // 4. Query database for user's member_number
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MEMFIRE_SERVICE_ROLE_KEY!
    );

    const { data: profile, error: dbError } = await adminClient
      .from('profiles')
      .select('member_number')
      .eq('id', user.id)
      .single();

    if (dbError || !profile) {
      console.error('[Genesis Claim API] DB query failed:', dbError?.message);
      return NextResponse.json({ error: '获取会员编号失败' }, { status: 500 });
    }

    const memberNumber = profile.member_number;
    if (memberNumber === null || memberNumber === undefined) {
      return NextResponse.json({ error: '会员编号尚未分配，请联系客服' }, { status: 400 });
    }

    // 5. Generate signature
    const privateKey = process.env.MINING_POOL_DISTRIBUTOR_PRIVATE_KEY;
    if (!privateKey) {
      console.error('[Genesis Claim API] Private key not configured');
      return NextResponse.json({ error: '服务器配置错误' }, { status: 500 });
    }

    // Contract details
    const contractAddress = CONTRACT_ADDRESSES.GenesisPassport;
    // We get the chainId based on which network we are on
    // For Base Sepolia: 84532. For Base Mainnet: 8453.
    // We can infer chainId from environment or default to 84532 (Base Sepolia) for testing.
    const isMainnet = process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_MEMFIRE_URL?.includes('sepolia');
    const chainId = isMainnet ? 8453 : 84532; 

    // Construct message hash: keccak256(abi.encodePacked(userAddress, memberNumber, contractAddress, chainId))
    const msgHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'address', 'uint256'],
      [walletAddress, memberNumber, contractAddress, chainId]
    );

    // Sign the hash
    const signerWallet = new ethers.Wallet(privateKey);
    const signature = await signerWallet.signMessage(ethers.getBytes(msgHash));

    console.log(`[Genesis Claim API] Signed claim for User ${user.id} | MemberNo ${memberNumber} | Wallet ${walletAddress}`);

    return NextResponse.json({
      success: true,
      memberNumber,
      signature,
      contractAddress,
      chainId
    });

  } catch (err: any) {
    console.error('[Genesis Claim API] Unhandled exception:', err);
    return NextResponse.json({ error: `服务器处理异常: ${err.message}` }, { status: 500 });
  }
}
