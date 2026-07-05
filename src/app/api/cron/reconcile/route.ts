import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, MusicIPABI, EchoTokenABI } from '@/contracts/config';

// Reconcile pending blockchain orders (runs periodically or triggered manually)
export async function GET(request: NextRequest) {
  try {
    // 1. Authorization: Verify cron token if set (supports Authorization header or URL token param)
    const authHeader = request.headers.get('Authorization');
    const authParam = request.nextUrl.searchParams.get('token');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      const isAuthHeaderMatch = authHeader === `Bearer ${cronSecret}`;
      const isAuthParamMatch = authParam === cronSecret;

      if (!isAuthHeaderMatch && !isAuthParamMatch) {
        console.warn('[Reconciliation] Unauthorized access attempt (invalid or missing token).');
        return NextResponse.json({ error: 'Unauthorized access: Invalid cron token' }, { status: 401 });
      }
    } else {
      console.warn('[Reconciliation] CRON_SECRET is not configured. Endpoint is publicly accessible (development mode).');
    }
    
    // 2. Initialize Supabase Admin Client
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_MEMFIRE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MEMFIRE_SERVICE_ROLE_KEY!
    );

    // 3. Find pending purchases with tx_hash that are older than 2 minutes
    // (We use 2 minutes instead of 5 minutes so it's faster to test)
    const timeLimit = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data: pendingOrders, error: fetchError } = await adminClient
      .from('pending_purchases')
      .select('*')
      .eq('status', 'pending')
      .not('tx_hash', 'is', null)
      .lt('created_at', timeLimit);

    if (fetchError) {
      console.error('[Reconciliation] Failed to fetch pending purchases:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch pending purchases' }, { status: 500 });
    }

    console.log(`[Reconciliation] Found ${pendingOrders?.length || 0} pending orders to reconcile.`);
    
    if (!pendingOrders || pendingOrders.length === 0) {
      return NextResponse.json({ success: true, message: '没有发现需要对账的未决订单。' });
    }

    const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
    const distributorPrivateKey = process.env.MINING_POOL_DISTRIBUTOR_PRIVATE_KEY;
    
    if (!distributorPrivateKey) {
      return NextResponse.json({ error: 'Distributor private key is not configured' }, { status: 500 });
    }
    
    const signer = new ethers.Wallet(distributorPrivateKey, provider);
    const musicIPContract = new ethers.Contract(CONTRACT_ADDRESSES.MusicIP, MusicIPABI, signer);

    const reconciledOrders = [];
    const failedOrders = [];

    for (const order of pendingOrders) {
      console.log(`[Reconciliation] Processing Order ${order.id} | txHash: ${order.tx_hash}`);
      
      // A. State Machine Lock: Update status to 'processing' to prevent concurrent execution
      const { data: lockOk, error: lockError } = await adminClient
        .from('pending_purchases')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', order.id)
        .eq('status', 'pending')
        .select();

      if (lockError || !lockOk || lockOk.length === 0) {
        console.warn(`[Reconciliation] Order ${order.id} is already being processed or locked.`);
        continue;
      }

      try {
        // B. On-chain validation of the payment txHash
        const receipt = await provider.getTransactionReceipt(order.tx_hash);
        if (!receipt) {
          console.warn(`[Reconciliation] Tx receipt not found for ${order.tx_hash}. Keeping as pending.`);
          // Rollback status to pending
          await adminClient
            .from('pending_purchases')
            .update({ status: 'pending', updated_at: new Date().toISOString() })
            .eq('id', order.id);
          continue;
        }

        if (receipt.status !== 1) {
          console.error(`[Reconciliation] Tx ${order.tx_hash} failed on-chain. Marking order as failed.`);
          await adminClient
            .from('pending_purchases')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', order.id);
          failedOrders.push({ id: order.id, reason: 'Payment transaction failed on-chain' });
          continue;
        }

        // Parse transfer logs to verify the payment
        const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
        let paymentValid = false;

        for (const log of receipt.logs) {
          if (
            log.address.toLowerCase() === CONTRACT_ADDRESSES.EchoToken.toLowerCase() &&
            log.topics[0] === transferTopic
          ) {
            const logFromAddress = '0x' + log.topics[1].slice(26).toLowerCase();
            const logToAddress = '0x' + log.topics[2].slice(26).toLowerCase();
            
            const expectedFromAddress = order.buyer_address.toLowerCase();
            const expectedToAddress = CONTRACT_ADDRESSES.AdminAddress.toLowerCase();
            
            if (logFromAddress === expectedFromAddress && logToAddress === expectedToAddress) {
              const logValue = ethers.toBigInt(log.data);
              const expectedValue = ethers.parseUnits(order.share_amount.toString(), 18);
              
              if (logValue >= expectedValue) {
                paymentValid = true;
                break;
              }
            }
          }
        }

        if (!paymentValid) {
          console.error(`[Reconciliation] Tx ${order.tx_hash} does not match expected payment values. Marking order as failed.`);
          await adminClient
            .from('pending_purchases')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', order.id);
          failedOrders.push({ id: order.id, reason: 'Payment logs did not match order' });
          continue;
        }

        // C. Distribute MusicIP ERC-1155 tokens on-chain (if not already done)
        // First check if the IPO needs initialization
        const songInfoOnChain = await musicIPContract.songs(order.song_id);
        const onChainCreator = songInfoOnChain[0];
        
        if (onChainCreator === ethers.ZeroAddress) {
          console.log(`[Reconciliation] Initializing IPO on-chain for song ${order.song_id}...`);
          
          // Query song details from DB
          const { data: song } = await adminClient
            .from('songs')
            .select('total_shares')
            .eq('id', order.song_id)
            .single();

          const createIpoTx = await musicIPContract.createIPO(
            order.song_id,
            song?.total_shares || 100,
            CONTRACT_ADDRESSES.AdminAddress
          );
          await createIpoTx.wait();
        }

        // Distribute the shares on-chain
        console.log(`[Reconciliation] Executing safeTransferFrom of ${order.share_amount} shares of song ${order.song_id} to ${order.buyer_address}...`);
        const transferTx = await musicIPContract.safeTransferFrom(
          CONTRACT_ADDRESSES.AdminAddress,
          order.buyer_address,
          order.song_id,
          order.share_amount,
          "0x"
        );
        await transferTx.wait();
        const shareTransferTxHash = transferTx.hash;
        console.log(`[Reconciliation] Distributed shares. Tx Hash: ${shareTransferTxHash}`);

        // D. Call atomic RPC to execute database synchronization
        const { data: song } = await adminClient
          .from('songs')
          .select('title')
          .eq('id', order.song_id)
          .single();

        const description = `[对账补单] 链上代币认购作品《${song?.title || '未知'}》的版权股权: ${order.share_amount} 份 [Tx: ${order.tx_hash}]`;
        
        const { data: rpcResult, error: rpcError } = await adminClient.rpc(
          'purchase_equity_on_chain',
          {
            p_user_id: order.user_id,
            p_song_id: order.song_id,
            p_share_amount: order.share_amount,
            p_tx_hash: order.tx_hash,
            p_description: description
          }
        );

        if (rpcError || !rpcResult || !rpcResult.success) {
          console.error(`[Reconciliation] Database sync RPC failed for order ${order.id}:`, rpcError || rpcResult?.error);
          // Rollback lock status back to pending to retry in the next run
          await adminClient
            .from('pending_purchases')
            .update({ status: 'pending', updated_at: new Date().toISOString() })
            .eq('id', order.id);
          continue;
        }

        console.log(`[Reconciliation] Successfully reconciled order ${order.id}!`);
        reconciledOrders.push({ id: order.id, txHash: order.tx_hash });

      } catch (err: any) {
        console.error(`[Reconciliation] Unexpected error processing order ${order.id}:`, err.message);
        // Rollback lock status back to pending
        await adminClient
          .from('pending_purchases')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', order.id);
      }
    }

    return NextResponse.json({
      success: true,
      processed: pendingOrders.length,
      reconciledCount: reconciledOrders.length,
      reconciled: reconciledOrders,
      failed: failedOrders
    });

  } catch (error: any) {
    console.error('[Reconciliation System Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
