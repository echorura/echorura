import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, MusicIPABI } from '@/contracts/config';

export async function POST(request: NextRequest) {
  try {
    const { txHash, songId, shareAmount, userAddress } = await request.json();

    if (!txHash || !songId || !shareAmount || !userAddress) {
      return NextResponse.json({ error: '参数无效: 需提供 txHash, songId, shareAmount, userAddress' }, { status: 400 });
    }

    // 1. Bearer Token 鉴权，验证登录用户
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权访问: 缺少 Authorization Header' }, { status: 401 });
    }

    const accessToken = authHeader.slice(7);
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY!
    );
    
    const { data: { user }, error: authError } = await anonClient.auth.getUser(accessToken);
    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问: 登录会话无效' }, { status: 401 });
    }

    // 2. 检查交易哈希是否被重复使用，防止重放攻击 (Replay Attack)
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.MEMFIRE_SERVICE_ROLE_KEY!
    );

        const { data: existingTx, error: checkError } = await adminClient
      .from('processed_onchain_txs')
      .select('tx_hash')
      .eq('tx_hash', txHash);

    if (checkError) {
      console.error('Failed to verify transaction reuse:', checkError);
      return NextResponse.json({ error: '验证交易记录失败，请稍后重试' }, { status: 500 });
    }

    if (existingTx && existingTx.length > 0) {
      return NextResponse.json({ error: '重复支付: 该交易哈希已被处理过' }, { status: 400 });
    }

    // 1.1 写入 pending_purchases 跟踪订单，利用数据库唯一性索引充当分布式锁
    const { error: orderError } = await adminClient
      .from('pending_purchases')
      .insert({
        user_id: user.id,
        song_id: songId,
        share_amount: shareAmount,
        buyer_address: userAddress,
        tx_hash: txHash,
        status: 'pending'
      });

    if (orderError) {
      if (orderError.code === '23505') {
        const { data: existingOrder } = await adminClient
          .from('pending_purchases')
          .select('status')
          .eq('tx_hash', txHash)
          .single();
          
        if (existingOrder?.status === 'completed') {
          return NextResponse.json({ error: '重复支付: 该交易哈希已被处理过' }, { status: 400 });
        } else {
          return NextResponse.json({ error: '交易正在处理或对账中，请勿重复提交' }, { status: 429 });
        }
      }
      console.error('Failed to register pending purchase:', orderError);
      return NextResponse.json({ error: '初始化购买订单失败，请稍后重试' }, { status: 500 });
    }

    // 3. 链上验证用户的支付交易
    try {
      const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return NextResponse.json({ error: '支付交易在链上未找到，可能尚未确认，请稍候再试。' }, { status: 400 });
      }

      if (receipt.status !== 1) {
        return NextResponse.json({ error: '支付交易执行状态为失败' }, { status: 400 });
      }

      // 解析 ERC-20 Transfer 日志
      const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      let paymentFound = false;

      for (const log of receipt.logs) {
        if (
          log.address.toLowerCase() === CONTRACT_ADDRESSES.EchoToken.toLowerCase() &&
          log.topics[0] === transferTopic
        ) {
          const logFromAddress = '0x' + log.topics[1].slice(26).toLowerCase();
          const logToAddress = '0x' + log.topics[2].slice(26).toLowerCase();
          
          const expectedFromAddress = userAddress.toLowerCase();
          const expectedToAddress = CONTRACT_ADDRESSES.AdminAddress.toLowerCase();
          
          if (logFromAddress === expectedFromAddress && logToAddress === expectedToAddress) {
            const logValue = ethers.toBigInt(log.data);
            const expectedValue = ethers.parseUnits(shareAmount.toString(), 18);

            // 检查转账金额是否足够 (1 ECHO 每份)
            if (logValue >= expectedValue) {
              paymentFound = true;
              break;
            }
          }
        }
      }

      if (!paymentFound) {
        return NextResponse.json({ error: '交易无效: 未在交易日志中检测到相匹配的付款交易' }, { status: 400 });
      }

    } catch (web3Error: any) {
      console.error('Web3 verification error:', web3Error);
      return NextResponse.json({ error: '链上支付校验失败，可能是 RPC 网络延迟，请稍后重试' }, { status: 500 });
    }

    // 4. 获取歌曲信息并检查/分发链上 MusicIP 股权
    const { data: song, error: songError } = await adminClient
      .from('songs')
      .select('title, remaining_shares, total_shares, creator_id')
      .eq('id', songId)
      .single();

    if (songError || !song) {
      return NextResponse.json({ error: '未找到该音乐作品' }, { status: 404 });
    }

    if (song.remaining_shares < shareAmount) {
      return NextResponse.json({ error: '共创份额不足，认购失败' }, { status: 400 });
    }

    // 链上 MusicIP 分发
    const distributorPrivateKey = process.env.MINING_POOL_DISTRIBUTOR_PRIVATE_KEY;
    if (!distributorPrivateKey) {
      return NextResponse.json({ error: '系统配置错误: 未配置分发私钥，无法分发链上股权' }, { status: 500 });
    }

    let shareTransferTxHash = '';
    try {
      const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
      const signer = new ethers.Wallet(distributorPrivateKey, provider);
      const musicIPContract = new ethers.Contract(
        CONTRACT_ADDRESSES.MusicIP,
        MusicIPABI,
        signer
      );

      // A. 校验链上 IPO 是否已初始化，若未初始化，由平台私钥代为调用 createIPO
      const songInfoOnChain = await musicIPContract.songs(songId);
      const onChainCreator = songInfoOnChain[0];
      
      if (onChainCreator === ethers.ZeroAddress) {
        console.log(`[Web3 Backend] Initializing IPO on-chain for song ${songId}...`);
        const createIpoTx = await musicIPContract.createIPO(
          songId,
          song.total_shares || 100,
          CONTRACT_ADDRESSES.AdminAddress
        );
        await createIpoTx.wait();
        console.log(`[Web3 Backend] IPO initialized on-chain successfully!`);
      }

      // B. 调用 safeTransferFrom 将 ERC-1155 歌曲股权代币从 AdminAddress 发送至用户钱包
      console.log(`[Web3 Backend] Distributing ${shareAmount} shares of song ${songId} to ${userAddress}...`);
      const transferTx = await musicIPContract.safeTransferFrom(
        CONTRACT_ADDRESSES.AdminAddress,
        userAddress,
        songId,
        shareAmount,
        "0x"
      );
      const transferReceipt = await transferTx.wait();
      shareTransferTxHash = transferTx.hash;
      console.log(`[Web3 Backend] Distributed successfully! Tx Hash: ${shareTransferTxHash}`);

    } catch (contractError: any) {
      console.error('[Web3 Contract Error]', contractError);
      return NextResponse.json({ error: `链上股权分发失败: ${contractError.message || contractError}` }, { status: 500 });
    }

    // 5. 链上分发成功，执行数据库状态原子同步 (RPC)
    const description = `链上代币认购作品《${song.title}》的版权股权: ${shareAmount} 份 [Tx: ${txHash}]`;
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      'purchase_equity_on_chain',
      {
        p_user_id: user.id,
        p_song_id: songId,
        p_share_amount: shareAmount,
        p_tx_hash: txHash,
        p_description: description
      }
    );

    if (rpcError || !rpcResult) {
      console.error('RPC Error:', rpcError);
      return NextResponse.json({ error: '数据库同步失败，系统将自动对账，请稍后查看' }, { status: 500 });
    }

    if (!rpcResult.success) {
      console.error('RPC Business Error:', rpcResult.error);
      if (rpcResult.code === 'DUPLICATE_TX') {
        return NextResponse.json({ error: '重复支付: 该交易哈希已被处理过' }, { status: 400 });
      }
      return NextResponse.json({ error: `数据库同步失败: ${rpcResult.error}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `🎉 认购成功！已在 Base Sepolia 链上分发 ${shareAmount} 份版权代币至您的智能钱包。`,
      shareTransferTxHash
    });

  } catch (error: any) {
    console.error('Purchase api error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
