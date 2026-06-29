import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, EchoTokenABI, MusicIPABI } from '@/contracts/config';

// 此接口由 Vercel Cron 每天凌晨自动触发
export async function GET(request: NextRequest) {
  try {
    // 安全校验：防止外部恶意触发结算
    // 在 Vercel 的 Environment Variables 配置 CRON_SECRET
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized access to Settlement Engine' }, { status: 401 });
    }

    // 使用 adminClient 绕过 RLS 执行结算逻辑
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.MEMFIRE_SERVICE_ROLE_KEY!
    );

    // 1. 获取待结算的版权池收益 (按 song_id 汇总)，以便稍后进行链上分红注入
    const { data: pendingDividends, error: queryErr } = await adminClient
      .from('transactions')
      .select('song_id, amount')
      .eq('type', 'dividend_pool_reward')
      .eq('status', 'pending');

    const songDividends: Record<number, number> = {};
    if (!queryErr && pendingDividends) {
      pendingDividends.forEach((tx: any) => {
        if (tx.song_id) {
          const sId = Number(tx.song_id);
          songDividends[sId] = (songDividends[sId] || 0) + Number(tx.amount);
        }
      });
    }

    // 2. 调用我们在数据库创建的 T+1 结算预言机 RPC
    const { data: settleData, error } = await adminClient.rpc('run_daily_settlement');

    if (error) {
      console.error('Settlement RPC failed:', error);
      return NextResponse.json({ error: 'Settlement process failed', details: error.message }, { status: 500 });
    }

    console.log('[ECHORURA SETTLEMENT ENGINE] 数据库结算完成', settleData);

    // 3. 执行链上分红注入 (对有分红产生且在链上有 IPO 的歌曲进行分红注入)
    const onChainInjections: any[] = [];
    const distributorPrivateKey = process.env.MINING_POOL_DISTRIBUTOR_PRIVATE_KEY;

    if (distributorPrivateKey && Object.keys(songDividends).length > 0) {
      try {
        const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
        const signer = new ethers.Wallet(distributorPrivateKey, provider);
        
        const echoTokenContract = new ethers.Contract(
          CONTRACT_ADDRESSES.EchoToken,
          EchoTokenABI,
          signer
        );

        const musicIPContract = new ethers.Contract(
          CONTRACT_ADDRESSES.MusicIP,
          MusicIPABI,
          signer
        );

        for (const [songIdStr, amount] of Object.entries(songDividends)) {
          const songId = Number(songIdStr);
          if (amount <= 0) continue;

          // A. 校验链上 IPO 是否已初始化，若未初始化，说明此歌目前仅在 Web2 进行分红，无需向链上注入
          const songInfoOnChain = await musicIPContract.songs(songId);
          const onChainCreator = songInfoOnChain[0];

          if (onChainCreator !== ethers.ZeroAddress) {
            console.log(`[Cron Settle] Song ${songId} has active on-chain IPO. Injecting ${amount} ECHO as dividends...`);
            
            const parsedAmount = ethers.parseUnits(amount.toFixed(6), 18);

            // B. 校验并更新 allowance
            const currentAllowance = await echoTokenContract.allowance(signer.address, CONTRACT_ADDRESSES.MusicIP);
            if (currentAllowance < parsedAmount) {
              console.log(`[Cron Settle] Approving MusicIP to spend ECHO...`);
              const approveTx = await echoTokenContract.approve(CONTRACT_ADDRESSES.MusicIP, ethers.MaxUint256);
              await approveTx.wait();
            }

            // C. 校验并补充 admin 余额
            const adminBalance = await echoTokenContract.balanceOf(signer.address);
            if (adminBalance < parsedAmount) {
              const diff = parsedAmount - adminBalance;
              console.log(`[Cron Settle] Minting ${ethers.formatUnits(diff, 18)} ECHO to admin wallet...`);
              const mintTx = await echoTokenContract.mint(signer.address, diff);
              await mintTx.wait();
            }

            // D. 执行 injectDividends
            const injectTx = await musicIPContract.injectDividends(songId, parsedAmount);
            const receipt = await injectTx.wait();

            console.log(`[Cron Settle] Injected successfully! Tx Hash: ${injectTx.hash}`);
            onChainInjections.push({
              songId,
              amount,
              txHash: injectTx.hash
            });
          }
        }
      } catch (web3Error: any) {
        console.error('[Cron Settle] Web3 Dividend Injection failed:', web3Error);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'T+1 Settlement executed successfully',
      report: settleData,
      onChainInjections
    });

  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
