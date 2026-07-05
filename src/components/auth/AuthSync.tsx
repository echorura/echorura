'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { usePlayerStore } from '@/store/playerStore';

export default function AuthSync() {
  const supabase = createClient();
  const { setBalance, setUsedCredit, setEquities } = usePlayerStore();

  useEffect(() => {
    const fetchBalanceAndCredit = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError && (authError.message.includes('Refresh Token') || authError.message.includes('refresh_token'))) {
          console.warn('[AuthSync] Invalid refresh token detected, signing out to reset session.');
          await supabase.auth.signOut();
          window.location.reload();
          return;
        }

        if (user) {
          // 1. 同步钱包余额
          const { data: finalBalance, error: rpcError } = await supabase
            .rpc('claim_welcome_gift');

          if (!rpcError && finalBalance !== null && finalBalance !== undefined) {
            console.log('🎉 钱包资产初始化与余额同步成功，当前余额:', finalBalance);
            setBalance(Number(finalBalance));
          } else {
            console.error('钱包资产同步 RPC 失败，尝试直接查询 wallets 表:', rpcError);
            try {
              const { data: walletData } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', user.id)
                .single();
              if (walletData) {
                setBalance(Number(walletData.balance));
              }
            } catch (fallbackErr) {
              console.error('钱包余额只读回退查询失败:', fallbackErr);
            }
          }

          // 2. 同步信用授信额度的已使用度 (usedCredit)
          try {
            const { data: creditData } = await supabase
              .from('transactions')
              .select('amount')
              .eq('user_id', user.id)
              .eq('type', 'equity_purchase_credit');

            let totalUsedCredit = 0;
            if (creditData) {
              creditData.forEach((tx: any) => {
                totalUsedCredit += Math.abs(Number(tx.amount));
              });
            }
            console.log('🔄 [AuthSync] 从数据库同步已用信用额度:', totalUsedCredit);
            setUsedCredit(totalUsedCredit);
          } catch (creditErr) {
            console.error('信用额度同步失败:', creditErr);
          }
        }
      } catch (err) {
        console.error('[AuthSync] Exception in fetchBalanceAndCredit:', err);
      }
    };

    fetchBalanceAndCredit();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        fetchBalanceAndCredit();
      }
      if (event === 'SIGNED_OUT') {
        console.log('🚪 [AuthSync] 用户已退出登录，清理客户端资产和额度状态');
        setBalance(0);
        setUsedCredit(0);
        setEquities([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, setBalance, setUsedCredit, setEquities]);

  return null; // 此组件仅处理逻辑，不渲染 UI
}
