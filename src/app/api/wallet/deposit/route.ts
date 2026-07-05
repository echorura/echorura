import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '@/contracts/config';

export async function POST(request: NextRequest) {
  try {
    const { txHash, amount } = await request.json();
    
    if (!txHash || !amount || amount <= 0) {
      return NextResponse.json({ error: '参数无效: 需提供交易哈希和充值数量' }, { status: 400 });
    }

    // 1. Bearer Token 鉴权，验证登录用户
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权访问: 缺少 Authorization Header' }, { status: 401 });
    }

    const accessToken = authHeader.slice(7);
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY!
    );
    
    const { data: { user }, error: authError } = await anonClient.auth.getUser(accessToken);
    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问: 登录会话无效' }, { status: 401 });
    }

    // 2. 链上验证交易合法性 (在入账前执行验证，确保真实支付)
    try {
      const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return NextResponse.json({ error: '交易在链上未找到，可能尚未打包，请稍候再试。' }, { status: 400 });
      }

      if (receipt.status !== 1) {
        return NextResponse.json({ error: '该链上交易执行状态为失败' }, { status: 400 });
      }

      // 解析 Transfer 日志并比对接收者与金额
      const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      let transferFound = false;

      for (const log of receipt.logs) {
        if (
          log.address.toLowerCase() === CONTRACT_ADDRESSES.EchoToken.toLowerCase() &&
          log.topics[0] === transferTopic
        ) {
          const logToAddress = '0x' + log.topics[2].slice(26).toLowerCase();
          const expectedToAddress = CONTRACT_ADDRESSES.AdminAddress.toLowerCase();

          if (logToAddress === expectedToAddress) {
            const logValue = ethers.toBigInt(log.data);
            const expectedValue = ethers.parseUnits(amount.toString(), 18);

            if (logValue >= expectedValue) {
              transferFound = true;
              break;
            }
          }
        }
      }

      if (!transferFound) {
        return NextResponse.json({ error: '交易无效: 未在交易日志中检测到向平台管理员地址的转账，或数量不匹配' }, { status: 400 });
      }

    } catch (web3Error: any) {
      console.error('Web3 verification error:', web3Error);
      return NextResponse.json({ error: '链上交易验证失败，可能是 RPC 网络延迟，请稍后重试' }, { status: 500 });
    }

    // 3. 调用原子 RPC 进行余额增加、交易日志入账以及幂等哈希锁定
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MEMFIRE_SERVICE_ROLE_KEY!
    );

    const description = `链上代币充值入账: ${amount} ECHO [Tx: ${txHash}]`;
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      'deposit_user_balance',
      {
        p_user_id: user.id,
        p_amount: amount,
        p_tx_hash: txHash,
        p_description: description
      }
    );

    if (rpcError || !rpcResult || !rpcResult.success) {
      console.error('Failed to execute deposit RPC:', rpcError || rpcResult?.error);
      const errorMsg = rpcResult?.error || rpcError?.message || '充值入账失败，请稍后重试';
      const status = rpcResult?.code === 'DUPLICATE_TX' ? 400 : 500;
      return NextResponse.json({ error: errorMsg }, { status });
    }

    return NextResponse.json({
      success: true,
      message: `🎉 充值成功！${amount} ECHO 已安全转换入账为您的平台余额。`,
      newBalance: Number(rpcResult.new_balance)
    });

  } catch (error: any) {
    console.error('Wallet deposit api error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
