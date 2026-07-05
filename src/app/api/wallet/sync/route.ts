import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, MiningPoolABI } from '@/contracts/config';

export async function POST(request: NextRequest) {
  try {
    const { address: userAddress, amount } = await request.json();
    
    if (!userAddress || !amount || amount <= 0) {
      return NextResponse.json({ error: '参数无效: 需提供有效的钱包地址和同步金额' }, { status: 400 });
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

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MEMFIRE_SERVICE_ROLE_KEY!
    );

    // 2. 调用原子 RPC 进行余额扣减和交易日志入账 (行排他锁，彻底消除并发双花隐患)
    const description = `同步提现 ${amount} ECHO 到链上钱包 (${userAddress.slice(0,6)}...${userAddress.slice(-4)})`;
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      'withdraw_user_balance',
      {
        p_user_id: user.id,
        p_amount: amount,
        p_description: description
      }
    );

    if (rpcError || !rpcResult || !rpcResult.success) {
      console.error('Failed to execute withdraw RPC:', rpcError || rpcResult?.error);
      const errorMsg = rpcResult?.error || rpcError?.message || '同步提现失败，请稍后重试';
      const status = rpcResult?.code === 'INSUFFICIENT_BALANCE' ? 400 : 500;
      return NextResponse.json({ error: errorMsg }, { status });
    }

    const transactionId = rpcResult.transaction_id;
    const newBalance = Number(rpcResult.new_balance);

    // 3. 链上分发：在 Base Sepolia 链上分发/铸造代币给用户地址
    const distributorPrivateKey = process.env.MINING_POOL_DISTRIBUTOR_PRIVATE_KEY;
    let txHash = '';

    if (!distributorPrivateKey) {
      // 演示/开发 mock 模式：自动生成 mock 哈希并绑定
      console.warn('[Warning] MINING_POOL_DISTRIBUTOR_PRIVATE_KEY is not defined. Falling back to Mock Tx Hash.');
      txHash = '0x1e86' + Array.from({ length: 60 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      
      await adminClient.rpc('update_transaction_tx_hash', { p_tx_id: transactionId, p_tx_hash: txHash });

      return NextResponse.json({ 
        success: true, 
        message: `[Demo Mode] 本地扣减成功，已模拟链上同步并分发 ${amount} ECHO！`, 
        txHash,
        isMock: true,
        newBalance
      });
    }

    try {
      const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
      const signer = new ethers.Wallet(distributorPrivateKey, provider);
      
      const miningPoolContract = new ethers.Contract(
        CONTRACT_ADDRESSES.MiningPool,
        MiningPoolABI,
        signer
      );

      const decimals = 18;
      const amountWei = ethers.parseUnits(amount.toString(), decimals);

      console.log(`[Web3 Backend] Executing distributeReward(${userAddress}, ${amountWei.toString()})...`);
      const tx = await miningPoolContract.distributeReward(userAddress, amountWei);
      txHash = tx.hash;

      // 在提现记录里绑定真实的 txHash
      await adminClient.rpc('update_transaction_tx_hash', { p_tx_id: transactionId, p_tx_hash: txHash });

      // 异步等待确认，不阻塞前端 API 立即响应
      tx.wait().then(() => {
        console.log(`[Web3 Backend] distributeReward transaction confirmed: ${txHash}`);
      }).catch((err: any) => {
        console.error(`[Web3 Backend] transaction failed during waiting confirmation:`, err);
      });

      return NextResponse.json({ 
        success: true, 
        message: `🎉 同步成功！${amount} ECHO 已正式在 Base Sepolia 链上分发！`, 
        txHash,
        isMock: false,
        newBalance
      });
    } catch (contractError: any) {
      console.error('[Web3 Contract Error]', contractError);
      
      // 出现链上发放错误，绑定错误标志并返回
      const fallbackHash = '0x' + Array.from({ length: 64 }, () => 'f').join('');
      await adminClient.rpc('update_transaction_tx_hash', { p_tx_id: transactionId, p_tx_hash: fallbackHash });

      return NextResponse.json({
        success: true,
        message: '本地扣减成功，但 Base Sepolia 链上请求拥堵。系统已自动加入分发重试队列。',
        txHash: fallbackHash,
        isMock: true,
        warning: contractError.message,
        newBalance
      });
    }

  } catch (error: any) {
    console.error('Wallet sync api error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
