'use client';

declare global {
  interface Window {
    ethereum?: any;
  }
}

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { usePlayerStore } from '@/store/playerStore';
import { useLanguageStore } from '@/store/languageStore';
import { activeConfig } from '@/utils/compliance';
import Link from 'next/link';
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits, isAddress, parseAbi } from 'viem';
import { CONTRACT_ADDRESSES, EchoTokenABI, MusicIPABI } from '@/contracts/config';
import GenesisPassportCard from '@/components/GenesisPassportCard';

import { 
  ArrowUpRight, 
  Wallet, 
  History, 
  TrendingUp, 
  Timer, 
  Lock, 
  CreditCard,
  ShieldCheck,
  Disc3,
  ChevronRight,
  Sparkles,
  Play,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Info,
  DollarSign,
  Loader2,
  Send,
  ArrowDownLeft
} from 'lucide-react';

export default function AssetHubPage() {
  const { 
    echoBalance, 
    setBalance,
    spendEcho,
    equities, 
    maxCreditLimit, 
    usedCredit,
    setTrack,
    earnedThisSession,
    setEquities,
    setUsedCredit
  } = usePlayerStore();
  const { t } = useLanguageStore();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  // Web3 Real-Chain States
  const { address: connectedAddress, isConnected } = useAccount();
  const aaWalletAddress = isConnected && connectedAddress ? connectedAddress : null;
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const handleConnectWallet = () => {
    const connector = connectors.find((c) => c.id === 'coinbaseWallet' || c.id === 'coinbaseWalletSDK');
    if (connector) {
      connect({ connector });
    } else if (connectors.length > 0) {
      connect({ connector: connectors[0] });
    } else {
      alert('No web3 connectors found. Please reload or check your connection.');
    }
  };
  
  
  
  
  const [txHash, setTxHash] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Web3 read contract hook to fetch real-time on-chain balance
  const { data: onChainBalanceRaw, refetch: refetchOnChainBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.EchoToken as `0x${string}`,
    abi: parseAbi(EchoTokenABI as any),
    functionName: 'balanceOf',
    args: aaWalletAddress ? [aaWalletAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!aaWalletAddress,
    }
  });

  const onChainBalance = onChainBalanceRaw 
    ? Number(formatUnits(onChainBalanceRaw as bigint, 18)) 
    : 0;

  // --- On-chain Dividend Claim States ---
  // Track pending dividends for each equity (songId -> claimable ECHO in wei)
  const [pendingDividends, setPendingDividends] = useState<Record<string, bigint>>({});
  const [claimingSongId, setClaimingSongId] = useState<string | null>(null);
  const { writeContractAsync: writeMusicIP } = useWriteContract();

  // Fetch pending dividends from MusicIP for all held equities
  const refetchPendingDividends = async () => {
    if (!aaWalletAddress || equities.length === 0) return;
    const results: Record<string, bigint> = {};
    // We use a single ethers call via JSON-RPC for read-only queries (no wallet needed)
    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
      const musicIPContract = new ethers.Contract(CONTRACT_ADDRESSES.MusicIP, MusicIPABI, provider);
      for (const eq of equities) {
        try {
          const pending: bigint = await musicIPContract.getPendingDividends(aaWalletAddress, BigInt(eq.id));
          results[eq.id] = pending;
        } catch (_) {
          results[eq.id] = BigInt(0);
        }
      }
    } catch (_) {}
    setPendingDividends(results);
  };

  // Trigger pending dividends fetch whenever equities list or wallet address changes
  useEffect(() => {
    refetchPendingDividends();
  }, [equities.length, aaWalletAddress]);

  // Claim on-chain dividends for a specific song
  const handleClaimDividends = async (songId: string) => {
    if (!aaWalletAddress) {
      alert('请先连接您的智能钱包');
      return;
    }
    setClaimingSongId(songId);
    try {
      const txHash = await writeMusicIP({
        address: CONTRACT_ADDRESSES.MusicIP as `0x${string}`,
        abi: parseAbi(MusicIPABI as any),
        functionName: 'claimDividends',
        args: [BigInt(songId)],
      });
      // Wait a few seconds then refresh
      await new Promise(r => setTimeout(r, 6000));
      await refetchOnChainBalance();
      await refetchPendingDividends();
      alert(`🎉 链上分红领取成功！ECHO 已转入您的智能钱包。`);
    } catch (err: any) {
      alert('领取失败: ' + (err.message || err));
    } finally {
      setClaimingSongId(null);
    }
  };

  // Web3 Transfer Modal States
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');

  // Web3 write contract hook to execute transfer
  const { data: transferTxHash, writeContract, isPending: isTransferSending, error: transferError } = useWriteContract();

  // Wait for block confirmation
  const { isLoading: isTransferConfirming, isSuccess: isTransferSuccess } = useWaitForTransactionReceipt({
    hash: transferTxHash,
  });

  // Watch for transfer success
  useEffect(() => {
    if (isTransferSuccess) {
      alert(t('wallet.transfer_success'));
      setRecipientAddress('');
      setTransferAmount('');
      setShowTransferModal(false);
      refetchOnChainBalance();
    }
  }, [isTransferSuccess]);

  // Handle transfer submit
  const handleTransferECHO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientAddress || !isAddress(recipientAddress)) {
      alert(t('wallet.invalid_recipient'));
      return;
    }
    const amountVal = Number(transferAmount);
    if (isNaN(amountVal) || amountVal <= 0 || amountVal > onChainBalance) {
      alert(t('wallet.invalid_amount'));
      return;
    }

    try {
      writeContract({
        address: CONTRACT_ADDRESSES.EchoToken as `0x${string}`,
        abi: parseAbi(EchoTokenABI as any),
        functionName: 'transfer',
        args: [recipientAddress as `0x${string}`, parseUnits(transferAmount, 18)],
      });
    } catch (err: any) {
      console.error('[Transfer Error]', err);
      alert(t('wallet.transfer_failed') + err.message);
    }
  };

  // Web3 Deposit Modal States
  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [isDepositVerifying, setIsDepositVerifying] = useState<boolean>(false);

  // Web3 write contract hook to execute deposit
  const { data: depositTxHash, writeContract: writeDeposit, isPending: isDepositSending, error: depositError } = useWriteContract();

  // Wait for block confirmation
  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({
    hash: depositTxHash,
  });

  // Watch for deposit success
  useEffect(() => {
    const verifyAndCreditDeposit = async () => {
      if (isDepositSuccess && depositTxHash) {
        setIsDepositVerifying(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            alert(t('wallet.session_expired_sync'));
            return;
          }

          const response = await fetch('/api/wallet/deposit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              txHash: depositTxHash,
              amount: Number(depositAmount)
            })
          });

          const data = await response.json();
          if (data.success) {
            alert(data.message || t('wallet.deposit_success'));
            setBalance(data.newBalance);
            setDepositAmount('');
            setShowDepositModal(false);
            refetchOnChainBalance();
          } else {
            alert(t('wallet.deposit_failed') + (data.error || ''));
          }
        } catch (err: any) {
          console.error('[Deposit Verification Error]', err);
          alert(t('wallet.deposit_failed') + err.message);
        } finally {
          setIsDepositVerifying(false);
        }
      }
    };
    verifyAndCreditDeposit();
  }, [isDepositSuccess, depositTxHash]);

  // Handle deposit submit
  const handleDepositECHO = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = Number(depositAmount);
    if (isNaN(amountVal) || amountVal <= 0 || amountVal > onChainBalance) {
      alert(t('wallet.invalid_amount'));
      return;
    }

    try {
      writeDeposit({
        address: CONTRACT_ADDRESSES.EchoToken as `0x${string}`,
        abi: parseAbi(EchoTokenABI as any),
        functionName: 'transfer',
        args: [CONTRACT_ADDRESSES.AdminAddress as `0x${string}`, parseUnits(depositAmount, 18)],
      });
    } catch (err: any) {
      console.error('[Deposit Transfer Error]', err);
      alert(t('wallet.deposit_failed') + err.message);
    }
  };
  
  
  

  // Stripe Fiat Top-up States
  const [showTopUpModal, setShowTopUpModal] = useState<boolean>(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(100);
  const [payMethod, setPayMethod] = useState<'card' | 'apple'>('card');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardExpiry, setCardExpiry] = useState<string>('');
  const [cardCvc, setCardCvc] = useState<string>('');
  const [isTopUpProcessing, setIsTopUpProcessing] = useState<boolean>(false);
  const [topUpSuccess, setTopUpSuccess] = useState<boolean>(false);
  const [acceptTerms, setAcceptTerms] = useState<boolean>(true);

  // Transaction History Modal
  const [showTxModal, setShowTxModal] = useState<boolean>(false);

  // 信用额度计算
  const availableCredit = maxCreditLimit - usedCredit;

  // 资产计算
  const pendingMining = earnedThisSession || 0; // 真实待审计收益 (基于当前 session 挖矿)
  const equityValuation = equities.reduce((acc, eq) => acc + eq.shares * eq.currentPrice, 0);
  const totalAssets = echoBalance + pendingMining + equityValuation;



  // 铸造并将本地 Mock 余额同步到 Base Sepolia 真实链上 (通过后端 API 安全铸造)
  const syncBalanceToL2 = async () => {
    const targetAddress = aaWalletAddress;
    if (!targetAddress) {
      alert(t('wallet.no_valid_address'));
      return;
    }
    
    const amountToSync = 50.0; // 每次同步 50 个 ECHO，作为真实上链资产演示
    if (echoBalance < amountToSync) {
      alert(t('wallet.insufficient_balance_sync'));
      return;
    }

    setIsSyncing(true);
    setTxHash('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert(t('wallet.session_expired_sync'));
        setIsSyncing(false);
        return;
      }

      console.log(`[Web3] 正在发起后端清算接口以同步 50.0 ECHO 到地址 ${targetAddress}...`);
      const response = await fetch('/api/wallet/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          address: targetAddress,
          amount: amountToSync
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '后端清算同步失败');
      }

      setTxHash(result.txHash);
      alert(result.message || t('wallet.sync_success'));
      
      // 扣减本地 mock 余额
      spendEcho(amountToSync);
      // 延迟触发链上余额查询刷新，确保交易打包上链
      setTimeout(() => refetchOnChainBalance(), 3000);
      setTimeout(() => refetchOnChainBalance(), 6000);
    } catch (err: any) {
      console.error('[Sync Error]', err);
      alert(t('wallet.sync_failed') + err.message);
    } finally {
      setIsSyncing(false);
    }
  };



  const handleStripePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    alert(t('wallet.topup_not_available') || 'Top-up is not available during beta test');
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        
        // 1. 获取最近交易流水
        const { data: txData } = await supabase
          .from('transactions')
          .select('*, song:songs(title)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);
        if (txData) setTransactions(txData);

        // 1.1 从数据库拉取信用代付记录并同步已用额度 (完全独立，优先执行)
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
          console.log('🔄 [Wallet Page] 从数据库同步已用信用额度:', totalUsedCredit);
          setUsedCredit(totalUsedCredit);
        } catch (creditErr) {
          console.error('[Wallet Page] 信用额度同步失败:', creditErr);
        }

        // 2. 从数据库拉取真实的版权股份 (equities 表)
        try {
          const { data: rawEquities, error: equitiesError } = await supabase
            .from('equities')
            .select('song_id, shares')
            .eq('user_id', user.id)
            .gt('shares', 0);

          if (!equitiesError && rawEquities) {
            // 分步拉取歌曲详情，避免在没有显式外键的环境下触发 PGRST200
            const songIds = rawEquities.map((eq: any) => eq.song_id).filter(Boolean);
            let songMap = new Map();
            if (songIds.length > 0) {
              const { data: songsData, error: songsError } = await supabase
                .from('songs')
                .select('id, title, artist, cover_url')
                .in('id', songIds);
              if (!songsError && songsData) {
                songMap = new Map(songsData.map((s: any) => [s.id, s]));
              } else if (songsError) {
                console.error('[Asset Hub Sync] Failed to fetch song details for equities:', songsError);
              }
            }

            const dbEquities = rawEquities.map((eq: any) => ({
              song_id: eq.song_id,
              shares: eq.shares,
              song: songMap.get(eq.song_id) || null
            }));

            // 3. 拉取用户的版权分红记录计算各歌曲的累计收益
            const { data: dividendData } = await supabase
              .from('transactions')
              .select('song_id, amount')
              .eq('user_id', user.id)
              .eq('type', 'dividend_payout');

            const dividendMap: Record<string, number> = {};
            if (dividendData) {
              dividendData.forEach((tx: any) => {
                if (tx.song_id) {
                  dividendMap[tx.song_id] = (dividendMap[tx.song_id] || 0) + Number(tx.amount);
                }
              });
            }

            // 获取本地缓存的数据以进行比对同步（防止本地使用信用购买的记录由于未存数据库被覆盖抹消）
            const localEquities = usePlayerStore.getState().equities || [];
            let needReFetch = false;

            console.log('🔄 [Sync Engine] 本地缓存资产数:', localEquities.length, '云端数据库资产数:', dbEquities.length);

            // 如果本地有资产但云端没有，且用户不是创作者（即属于用信用购买的股权），则自动在后台进行数据库同步！
            for (const localEq of localEquities) {
              const existsInDb = dbEquities.some((dbEq: any) => dbEq.song_id.toString() === localEq.id.toString());
              if (!existsInDb) {
                // 双重校验：查一下该歌的 creator_id 是否为当前用户。如果是创作者，我们已经在后台修复了；
                // 如果不是创作者，说明是认购所得，应当触发云端认购记账！
                const { data: songInfo } = await supabase
                  .from('songs')
                  .select('creator_id, title')
                  .eq('id', Number(localEq.id))
                  .single();

                if (songInfo && songInfo.creator_id !== user.id) {
                  console.log(`🚀 [Sync Engine] 发现本地认购资产 "${songInfo.title}" (ID: ${localEq.id}, Shares: ${localEq.shares}) 尚未存盘，正在自动将其同步至云端数据库...`);
                  const { error: syncErr } = await supabase.rpc('purchase_equity', {
                    p_song_id: Number(localEq.id),
                    p_share_amount: Number(localEq.shares),
                    p_use_credit: true
                  });
                  if (syncErr) {
                    console.error(`❌ [Sync Engine] 自动同步资产失败:`, syncErr.message);
                  } else {
                    console.log(`✅ [Sync Engine] 自动同步资产 "${songInfo.title}" 成功！`);
                    needReFetch = true;
                  }
                }
              }
            }

            // 如果有同步写入，我们需要重新拉取最新的数据库统计数据以保持完全精确
            if (needReFetch) {
              console.log('🔄 [Sync Engine] 正在拉取最新的云端同步数据...');
              const { data: newRawEquities } = await supabase
                .from('equities')
                .select('song_id, shares')
                .eq('user_id', user.id)
                .gt('shares', 0);
              
              if (newRawEquities) {
                const newSongIds = newRawEquities.map((eq: any) => eq.song_id).filter(Boolean);
                let newSongMap = new Map();
                if (newSongIds.length > 0) {
                  const { data: newSongsData } = await supabase
                    .from('songs')
                    .select('id, title, artist, cover_url')
                    .in('id', newSongIds);
                  if (newSongsData) {
                    newSongMap = new Map(newSongsData.map((s: any) => [s.id, s]));
                  }
                }
                const newDbEquities = newRawEquities.map((eq: any) => ({
                  song_id: eq.song_id,
                  shares: eq.shares,
                  song: newSongMap.get(eq.song_id) || null
                }));

                dbEquities.length = 0;
                dbEquities.push(...newDbEquities);
              }

              const { data: newCreditData } = await supabase
                .from('transactions')
                .select('amount')
                .eq('user_id', user.id)
                .eq('type', 'equity_purchase_credit');

              let latestUsedCredit = 0;
              if (newCreditData) {
                newCreditData.forEach((tx: any) => {
                  latestUsedCredit += Math.abs(Number(tx.amount));
                });
              }
              console.log('🔄 [Asset Hub Sync] 重新同步最新已用信用额度:', latestUsedCredit);
              setUsedCredit(latestUsedCredit);
            }

            // 4. 将数据库实体转换为前端 Equity 格式并同步至 Zustand
            const mappedEquities = dbEquities.map((eq: any) => {
              const song = eq.song;
              return {
                id: eq.song_id.toString(),
                songTitle: song?.title || 'Unknown Song',
                artist: song?.artist || 'Unknown Artist',
                shares: eq.shares,
                currentPrice: 1.0, // 统一 1.00 ECHO 单价
                totalDividends: dividendMap[eq.song_id] || 0,
                cover: song?.cover_url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=300&q=70&fm=webp'
              };
            });

            console.log('🔄 [Asset Hub Sync] 成功从数据库同步股权与分红资产记录，数量:', mappedEquities.length);
            setEquities(mappedEquities);
          } else if (equitiesError) {
            console.error('[Asset Hub Sync] 股权读取失败，降级使用本地存储:', equitiesError);
          }
        } catch (syncErr) {
          console.error('[Asset Hub Sync] 状态同步异常:', syncErr);
        }
      }
      setLoading(false);
    };

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 点击播放持股歌曲：实时从数据库查询真实音频地址
  const playEquitySong = async (equity: typeof equities[0]) => {
    // 先用封面图和已知信息先启动播放器，给用户即时反馈
    setTrack({
      id: equity.id,
      title: equity.songTitle,
      artist: equity.artist,
      cover: equity.cover,
      src: '', // 临时空置，待查询后填充
      earnRate: 0.01
    });

    // 异步查询真实音频地址
    const { data: song, error } = await supabase
      .from('songs')
      .select('audio_url, earn_rate')
      .eq('id', equity.id)
      .single();

    if (error || !song?.audio_url) {
      console.error('[Equity Play] 无法获取音频地址:', error);
      return;
    }

    // 用真实音频更新播放器
    setTrack({
      id: equity.id,
      title: equity.songTitle,
      artist: equity.artist,
      cover: equity.cover,
      src: song.audio_url,
      earnRate: song.earn_rate || 0.01
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24">

      {/* 模块 1 & 2: 极声余额 & 信用额度 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Module 1: ECHO Balance */}
        <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-echo-primary/20 via-black to-echo-secondary/10 border border-white/10 p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-echo-primary/10 blur-[80px] rounded-full -mr-32 -mt-32"></div>
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-1">
                  {t('compliance.token_' + activeConfig.region.toLowerCase())} {t('wallet.token_balance')}
                </h2>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-black text-white italic tracking-tighter">
                    {echoBalance.toFixed(2)}
                  </span>
                  <span className="text-echo-primary font-black mb-1 italic">ECHO</span>
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-500 uppercase tracking-widest flex items-center gap-1">
                <Lock className="w-3 h-3" />
                {t('wallet.locked_available')}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 bg-white/5 border border-white/5 p-4 rounded-2xl">
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">{t('wallet.today_listen_earn')}</p>
                <p className="text-lg font-black text-white">+{earnedThisSession.toFixed(2)} <span className="text-xs text-echo-primary">ECHO</span></p>
                <p className="text-[9px] text-gray-600 mt-0.5">{t('wallet.reset_midnight')}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">{t('wallet.curation_total')}</p>
                <p className="text-lg font-black text-white">{equityValuation.toFixed(2)} <span className="text-xs text-echo-secondary">ECHO</span></p>
                <p className="text-[9px] text-gray-600 mt-0.5">{t('wallet.equity_ref_value')}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setShowTopUpModal(true)}
                className="flex-1 bg-echo-primary text-black py-3.5 rounded-xl font-black text-sm hover:scale-[1.03] active:scale-[0.97] transition-all shadow-[0_0_25px_rgba(0,240,255,0.3)] flex items-center justify-center gap-2"
              >
                <DollarSign className="w-4 h-4 text-black" />
                {t('wallet.quick_topup')}
              </button>
              <button 
                onClick={() => setShowTxModal(true)}
                className="flex-1 bg-white/5 text-white py-3.5 rounded-xl font-bold text-sm border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
              >
                {t('wallet.tx_stream')}
              </button>
            </div>
          </div>
        </section>

        {/* Module 2: Credit Limit (信用额度) */}
        <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-echo-secondary/20 via-black to-purple-900/10 border border-white/10 p-8">
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-echo-secondary/10 blur-[80px] rounded-full -mr-32 -mb-32"></div>
          
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-1">
                    <CreditCard className="w-4 h-4 text-echo-secondary" />
                    {t('wallet.credit_limit')}
                  </h2>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-black text-white italic tracking-tighter">
                      {availableCredit.toFixed(2)}
                    </span>
                    <span className="text-echo-secondary font-black mb-1 italic">ECHO</span>
                  </div>
                </div>
                <div className="text-right flex gap-4">
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase">{t('wallet.used_limit')}</div>
                    <div className="text-sm font-bold text-gray-300">{usedCredit.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase">{t('wallet.total_limit')}</div>
                    <div className="text-sm font-bold text-white">{maxCreditLimit.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden border border-white/5 mb-4">
                <div 
                  className="h-full bg-gradient-to-r from-echo-secondary to-purple-500"
                  style={{ width: `${(availableCredit / maxCreditLimit) * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-400 font-medium mb-6 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-echo-secondary" />
                {t('wallet.listener_weight')}
              </p>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-echo-secondary/30 bg-echo-secondary/5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-white uppercase">{t('wallet.credit_privilege')}</h3>
                <span className="text-[9px] bg-echo-secondary text-black px-2 py-0.5 rounded-full font-bold">{t('wallet.interest_free')}</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-4 leading-relaxed">
                {t('wallet.credit_desc')}
              </p>
              <Link 
                href="/market"
                className="w-full bg-echo-secondary/20 hover:bg-echo-secondary/40 text-echo-secondary border border-echo-secondary/50 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 group"
              >
                {t('wallet.go_to_market')}
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Genesis Member Passport */}
      <GenesisPassportCard />

      {/* Web3 智能资产中枢 (Hybrid AA & Self-Custody Portal) */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-purple-900/15 via-black to-echo-primary/10 border border-white/10 p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-echo-primary/5 blur-[100px] rounded-full -mr-40 -mt-40"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/5 blur-[100px] rounded-full -ml-40 -mb-40"></div>
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-white/10 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-echo-primary/15 border border-echo-primary/30 text-[10px] font-black text-echo-primary uppercase tracking-wider">
                  Base Sepolia Testnet
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-[10px] font-black text-purple-400 uppercase tracking-wider">
                  Account Abstraction
                </span>
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                <Wallet className="w-7 h-7 text-echo-primary" />
                Web3 {t('wallet.asset_name')} (Web3 Asset Hub)
              </h2>
              <p className="text-xs text-gray-400 mt-1">{t('wallet.asset_hub_subtitle')}</p>
            </div>
            
            {/* 全局链上同步按钮 */}
            <div>
              <button 
                onClick={syncBalanceToL2}
                disabled={isSyncing || echoBalance < 50}
                className={`px-6 py-3.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${
                  isSyncing 
                    ? 'bg-white/10 text-gray-500 border border-white/15 cursor-not-allowed' 
                    : echoBalance < 50
                      ? 'bg-white/5 text-gray-650 border border-white/5 cursor-not-allowed'
                      : 'bg-gradient-to-r from-echo-primary to-echo-secondary text-black hover:scale-[1.03] active:scale-[0.97] shadow-[0_0_20px_rgba(0,240,255,0.2)] font-black'
                }`}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('wallet.syncing_rewards')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin-hover" />
                    {t('wallet.sync_amount_rewards').replace('{amount}', '50.00')}
                  </>
                )}
              </button>
              {echoBalance < 50 && (
                <p className="text-[10px] text-gray-600 text-right mt-1.5 font-medium">{t('wallet.min_sync_threshold')}</p>
              )}
            </div>
          </div>

          
          <div className="w-full">
            {/* Custodial AA Wallet Card */}
            <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-white/5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    {t('wallet.aa_sca')}
                  </span>
                  <span className={`text-[9px] px-2 py-0.5 rounded border font-bold ${
                    aaWalletAddress 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {aaWalletAddress ? t('wallet.wallet_status_connected') : t('wallet.wallet_status_disconnected')}
                  </span>
                </div>

                {aaWalletAddress ? (
                  <>
                    <div className="bg-black/30 p-3.5 rounded-xl border border-white/5 mb-4 font-mono text-xs text-gray-300 break-all select-all flex justify-between items-center group">
                      <span>{aaWalletAddress}</span>
                      <span 
                        onClick={() => {
                          if (aaWalletAddress) {
                            navigator.clipboard.writeText(aaWalletAddress);
                            alert(t('wallet.address_copied'));
                          }
                        }}
                        className="text-[10px] text-echo-primary cursor-pointer hover:underline opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0"
                      >
                        {t('wallet.copy')}
                      </span>
                    </div>

                    {/* Real Chain Balance & Send Button */}
                    <div className="flex flex-col gap-2.5 bg-white/5 border border-white/10 p-4 rounded-xl mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400 font-medium">{t('wallet.onchain_balance')}</span>
                        <span className="text-sm font-black text-echo-primary">{onChainBalance.toFixed(2)} ECHO</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setShowTransferModal(true)}
                          disabled={onChainBalance <= 0}
                          className={`w-full py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            onChainBalance <= 0
                              ? 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                              : 'bg-echo-primary/10 hover:bg-echo-primary/20 text-echo-primary border border-echo-primary/20 hover:scale-[1.02] active:scale-[0.98]'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          {t('wallet.transfer_out')}
                        </button>
                        <button
                          onClick={() => setShowDepositModal(true)}
                          disabled={onChainBalance <= 0}
                          className={`w-full py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            onChainBalance <= 0
                              ? 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                              : 'bg-echo-primary/10 hover:bg-echo-primary/20 text-echo-primary border border-echo-primary/20 hover:scale-[1.02] active:scale-[0.98]'
                          }`}
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                          {t('wallet.deposit_to_platform')}
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      {t('wallet.smart_wallet_desc')}
                    </p>
                    <button
                      onClick={() => disconnect()}
                      className="mt-4 w-full bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer"
                    >
                      {t('wallet.disconnect_wallet')}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="bg-black/30 p-5 rounded-xl border border-dashed border-white/10 mb-4 text-center">
                      <p className="text-xs text-gray-400 mb-3">{t('wallet.connect_first')}</p>
                      <button
                        onClick={handleConnectWallet}
                        className="mx-auto bg-echo-primary hover:scale-[1.03] active:scale-[0.97] text-black px-4 py-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,240,255,0.2)] cursor-pointer"
                      >
                        <Wallet className="w-3.5 h-3.5 text-black" />
                        {t('wallet.connect_smart_wallet')}
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      {t('wallet.smart_wallet_desc')}
                    </p>
                  </>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-xs">
                <span className="text-gray-500">{t('wallet.custody_status')}</span>
                <span className="text-gray-300 font-bold flex items-center gap-1">
                  {t('wallet.silent_custody')}
                </span>
              </div>
            </div>
          </div>
    

          {/* Sync Transactions Pending Details */}
          {txHash && (
            <div className="mt-6 p-4 bg-echo-primary/5 border border-echo-primary/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-2.5">
                <Info className="w-5 h-5 text-echo-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">{t('wallet.sync_tx_sent')}</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">{t('wallet.sync_tx_sent_desc')}</p>
                </div>
              </div>
              <a 
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-echo-primary hover:underline flex items-center gap-1 shrink-0"
              >
                {t('wallet.view_on_basescan')}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Module 3: Music Equity (音乐股权) */}
      <section className="glass-panel rounded-[2.5rem] p-8 border border-white/10 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-echo-primary to-transparent opacity-30"></div>
        
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3 mb-2">
              <Disc3 className="w-7 h-7 text-echo-primary" />
              {t('compliance.equity_' + activeConfig.region.toLowerCase())}{t('wallet.asset_portfolios')}
            </h2>
            <p className="text-sm text-gray-400">{t('wallet.portfolio_desc')}</p>
          </div>
          <div className="flex gap-6">
            <div className="text-right">
              <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">{t('wallet.real_time_valuation')}</p>
              <p className="text-xl font-black text-white">{equityValuation.toFixed(2)} <span className="text-xs text-gray-400">ECHO</span></p>
            </div>
            <div className="w-px h-10 bg-white/10"></div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">{t('wallet.accumulated_dividends_earned')}</p>
              <p className="text-xl font-black text-green-400">+{equities.reduce((acc, eq) => acc + eq.totalDividends, 0).toFixed(2)} <span className="text-xs text-gray-500">ECHO</span></p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {equities.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                  <th className="pb-4 pl-2">{t('wallet.asset_name')} (Asset)</th>
                  <th className="pb-4">{t('wallet.shares_held')} (Shares)</th>
                  <th className="pb-4">{t('wallet.current_price')} (Price)</th>
                  <th className="pb-4">{t('wallet.est_market_value')} (Value)</th>
                  <th className="pb-4">{t('wallet.history_dividends')} (Dividends)</th>
                  <th className="pb-4 text-right pr-2">链上分红 (On-chain)</th>
                </tr>
              </thead>
              <tbody>
                {equities.map((equity) => {
                  const pendingWei = pendingDividends[equity.id] ?? BigInt(0);
                  const pendingEcho = pendingWei > BigInt(0)
                    ? Number(formatUnits(pendingWei, 18))
                    : 0;
                  const isClaimable = pendingEcho > 0.000001;
                  const isClaiming = claimingSongId === equity.id;
                  return (
                    <tr 
                      key={equity.id} 
                      className="border-b border-white/5 hover:bg-white/5 transition-colors group/row"
                    >
                      <td className="py-4 pl-2 cursor-pointer" onClick={() => playEquitySong(equity)}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 relative group/play">
                            <img src={equity.cover} alt="Cover" className="w-full h-full object-cover group-hover/row:scale-110 transition-transform" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-center">
                              <Play className="w-4 h-4 text-echo-primary fill-echo-primary" />
                            </div>
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm group-hover/row:text-echo-primary transition-colors">{equity.songTitle}</div>
                            <div className="text-[10px] text-gray-500 font-mono">{equity.artist}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="font-bold text-white bg-white/5 px-2 py-1 rounded-md text-xs border border-white/10 inline-block w-fit">
                          {equity.shares}{t('wallet.system_shares')}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className="text-sm font-mono text-gray-400">1.00 ECHO</span>
                      </td>
                      <td className="py-4">
                        <span className="text-sm font-bold text-white">{(equity.shares * equity.currentPrice).toFixed(2)} <span className="text-[10px] text-gray-500">ECHO</span></span>
                      </td>
                      <td className="py-4">
                        <span className="text-sm text-green-400 font-bold">+{equity.totalDividends.toFixed(4)}</span>
                      </td>
                      <td className="py-4 text-right pr-2">
                        {aaWalletAddress ? (
                          isClaimable ? (
                            <button
                              onClick={() => handleClaimDividends(equity.id)}
                              disabled={isClaiming}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/20 border border-green-500/40 text-green-400 text-[10px] font-black uppercase tracking-wider hover:bg-green-500/30 hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(34,197,94,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isClaiming ? (
                                <><Loader2 className="w-3 h-3 animate-spin" />领取中...</>
                              ) : (
                                <><ArrowDownLeft className="w-3 h-3" />{pendingEcho.toFixed(4)} ECHO</>
                              )}
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-600 font-mono">暂无可领</span>
                          )
                        ) : (
                          <span className="text-[10px] text-gray-600 font-mono">未连接钱包</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-3xl">
              <p className="text-gray-500 text-sm">{t('wallet.no_equity_held')}</p>
            </div>
          )}
        </div>
      </section>

      {/* Stripe / Apple Pay Fiat Top-up Modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !isTopUpProcessing && setShowTopUpModal(false)} />
          
          <div className="relative w-full max-w-md glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-tighter flex items-center gap-2.5">
              <DollarSign className="w-7 h-7 text-echo-primary" />
              {t('wallet.top_up_fiat')} (Top Up)
            </h2>

            {topUpSuccess ? (
              <div className="py-12 flex flex-col items-center justify-center gap-4 text-center animate-in fade-in zoom-in-95">
                <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white">🎉 {t('wallet.top_up_success')}</h3>
                <p className="text-xs text-gray-400">
                  {t('wallet.top_up_success_desc').replace('{amount}', topUpAmount.toFixed(2)).replace('{token}', t('compliance.token_' + activeConfig.region.toLowerCase()))}
                </p>
              </div>
            ) : (
              <form onSubmit={handleStripePayment} className="space-y-5">
                {/* Internal Testing Warning Banner */}
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-xs text-amber-400">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>{t('wallet.top_up_warning')}</span>
                </div>

                {/* Exchange Rate Info */}
                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex justify-between items-center text-xs">
                  <span className="text-gray-500">{t('wallet.fiat_exchange_rate')}</span>
                  <span className="text-echo-primary font-black">t('compliance.fiat_exchange_rate_' + activeConfig.region.toLowerCase())</span>
                </div>

                {/* Preset Packages */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">{t('wallet.select_preset')}</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[50, 100, 500].map((amt) => (
                      <div 
                        key={amt}
                        onClick={() => {
                          alert(t('wallet.beta_alert'));
                        }}
                        className={`py-3 rounded-xl border border-white/5 text-center cursor-pointer transition-all bg-black/20 text-gray-400 hover:opacity-100 opacity-60`}
                      >
                        <div className="text-xs">{activeConfig.fiatCurrencySymbol} {amt}</div>
                        <div className="text-[9px] mt-0.5 text-echo-primary">+{amt} ECHO</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Amount */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">{t('wallet.custom_amount')} ({activeConfig.fiatCurrencySymbol})</label>
                  <input 
                    type="number" 
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:border-echo-primary/50 outline-none"
                    placeholder={t('wallet.input_amount')}
                    required
                  />
                </div>

                {/* Payment Methods */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">{t('wallet.payment_gateway')} (Payment Gateway)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div 
                      onClick={() => {
                        alert(t('wallet.beta_alert'));
                      }}
                      className={`py-3 rounded-xl border text-center cursor-pointer transition-all flex items-center justify-center gap-2 bg-black/20 border-transparent text-gray-500 opacity-60`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span className="text-xs">{t('wallet.credit_card')} (Stripe)</span>
                    </div>
                    <div 
                      onClick={() => {
                        alert(t('wallet.beta_alert'));
                      }}
                      className={`py-3 rounded-xl border text-center cursor-pointer transition-all flex items-center justify-center gap-2 bg-black/20 border-transparent text-gray-500 opacity-60`}
                    >
                      <span className="text-xs">🍏 Apple Pay</span>
                    </div>
                  </div>
                </div>

                {/* Credit Card Detail Inputs */}
                {payMethod === 'card' && (
                  <div className="space-y-3 bg-black/40 border border-white/5 p-4 rounded-2xl animate-in fade-in slide-in-from-top-2">
                    <div>
                      <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">{t('wallet.card_number')} (Card Number)</label>
                      <input 
                        type="text" 
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                        maxLength={19}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-xs font-mono outline-none focus:border-echo-primary/50"
                        placeholder="4242 4242 4242 4242"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">{t('wallet.expiry')} (Expiry)</label>
                        <input 
                          type="text" 
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          maxLength={5}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-xs font-mono outline-none focus:border-echo-primary/50"
                          placeholder="MM/YY"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">{t('wallet.cvc')} (CVC)</label>
                        <input 
                          type="password" 
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          maxLength={3}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-xs font-mono outline-none focus:border-echo-primary/50"
                          placeholder="•••"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* HK Compliance Checkbox */}
                <div className="flex gap-2 items-start bg-rose-500/5 border border-rose-500/15 p-3.5 rounded-2xl">
                  <input 
                    type="checkbox" 
                    checked={acceptTerms} 
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="w-4 h-4 accent-rose-500 rounded border-white/10 bg-black/40 mt-0.5 cursor-pointer"
                  />
                  <span className="text-[10px] text-gray-400 leading-normal">
                    {t('wallet.fiat_disclaimer').replace('{appName}', t('compliance.app_name_' + activeConfig.region.toLowerCase()))}
                  </span>
                </div>

                {/* Submits */}
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowTopUpModal(false)}
                    disabled={isTopUpProcessing}
                    className="flex-1 py-3.5 rounded-xl bg-white/5 text-gray-400 font-bold hover:bg-white/10 text-xs transition-all"
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    type="submit" 
                    disabled={isTopUpProcessing}
                    className="flex-[2] bg-gradient-to-r from-echo-primary to-echo-secondary hover:scale-[1.02] text-black font-black py-3.5 rounded-xl text-xs shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    {isTopUpProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        {t('wallet.stripe_processing')}
                      </>
                    ) : `${t('wallet.pay_now')} ${activeConfig.fiatCurrencySymbol} ${topUpAmount.toFixed(2)}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Web3 Transfer ECHO Token Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !isTransferSending && !isTransferConfirming && setShowTransferModal(false)} />
          
          <div className="relative w-full max-w-md glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-tighter flex items-center gap-2.5">
              <Send className="w-7 h-7 text-echo-primary" />
              {t('wallet.transfer_out')}
            </h2>

            <form onSubmit={handleTransferECHO} className="space-y-5">
              {/* On-chain balance info */}
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex justify-between items-center text-xs">
                <span className="text-gray-500">{t('wallet.onchain_balance')}</span>
                <span className="text-echo-primary font-black">{onChainBalance.toFixed(2)} ECHO</span>
              </div>

              {/* Recipient Address */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">{t('wallet.recipient_address')}</label>
                <input 
                  type="text" 
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value.trim())}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-xs font-mono focus:border-echo-primary/50 outline-none placeholder:text-gray-600"
                  placeholder="0x..."
                  required
                  disabled={isTransferSending || isTransferConfirming}
                />
              </div>

              {/* Amount */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                  {t('wallet.transfer_amount_input')}
                </label>
                <input 
                  type="number" 
                  step="any"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:border-echo-primary/50 outline-none"
                  placeholder="0.00"
                  required
                  disabled={isTransferSending || isTransferConfirming}
                />
              </div>

              {/* Submits */}
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowTransferModal(false)}
                  disabled={isTransferSending || isTransferConfirming}
                  className="flex-1 py-3.5 rounded-xl bg-white/5 text-gray-400 font-bold hover:bg-white/10 text-xs transition-all cursor-pointer"
                >
                  {t('wallet.close')}
                </button>
                <button 
                  type="submit" 
                  disabled={isTransferSending || isTransferConfirming}
                  className="flex-[2] bg-gradient-to-r from-echo-primary to-echo-secondary hover:scale-[1.02] text-black font-black py-3.5 rounded-xl text-xs shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isTransferSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      {t('wallet.transfer_sending')}
                    </>
                  ) : isTransferConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      {t('wallet.transfer_confirming')}
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-black" />
                      {t('wallet.send')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Web3 Deposit ECHO Token to App Balance Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !isDepositSending && !isDepositConfirming && !isDepositVerifying && setShowDepositModal(false)} />
          
          <div className="relative w-full max-w-md glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-tighter flex items-center gap-2.5">
              <ArrowDownLeft className="w-7 h-7 text-echo-primary" />
              {t('wallet.deposit_to_platform')}
            </h2>

            <form onSubmit={handleDepositECHO} className="space-y-5">
              {/* On-chain balance info */}
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex justify-between items-center text-xs">
                <span className="text-gray-500">{t('wallet.onchain_balance')}</span>
                <span className="text-echo-primary font-black">{onChainBalance.toFixed(2)} ECHO</span>
              </div>

              {/* Amount */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                  {t('wallet.deposit_amount_input')}
                </label>
                <input 
                  type="number" 
                  step="any"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:border-echo-primary/50 outline-none"
                  placeholder="0.00"
                  required
                  disabled={isDepositSending || isDepositConfirming || isDepositVerifying}
                />
              </div>

              {/* Submits */}
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowDepositModal(false)}
                  disabled={isDepositSending || isDepositConfirming || isDepositVerifying}
                  className="flex-1 py-3.5 rounded-xl bg-white/5 text-gray-400 font-bold hover:bg-white/10 text-xs transition-all cursor-pointer"
                >
                  {t('wallet.close')}
                </button>
                <button 
                  type="submit" 
                  disabled={isDepositSending || isDepositConfirming || isDepositVerifying}
                  className="flex-[2] bg-gradient-to-r from-echo-primary to-echo-secondary hover:scale-[1.02] text-black font-black py-3.5 rounded-xl text-xs shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isDepositSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      {t('wallet.deposit_sending')}
                    </>
                  ) : isDepositConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      {t('wallet.transfer_confirming')}
                    </>
                  ) : isDepositVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      {t('wallet.deposit_verifying')}
                    </>
                  ) : (
                    <>
                      <ArrowDownLeft className="w-3.5 h-3.5 text-black" />
                      {t('wallet.send')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 交易流水 (Transactions) Modal */}
      {showTxModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl bg-[#09090c]/95 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6 shrink-0 relative">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowTxModal(false)} 
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                  title={t('wallet.back')}
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
                <h3 className="text-lg font-black text-white uppercase flex items-center gap-2">
                  <History className="w-5 h-5 text-echo-primary" />
                  {t('wallet.transactions_log')} (Txs)
                </h3>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {transactions.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">{t('wallet.no_records')}</div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex justify-between items-center hover:bg-white/10 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        tx.type === 'listen_reward' || tx.type === 'upload_reward' || tx.type === 'system_gift' ? 'bg-echo-primary/20 text-echo-primary' : 
                        tx.type === 'dividend_pool_reward' || tx.type === 'dividend_payout' ? 'bg-green-500/20 text-green-400' :
                        tx.type === 'download_fee' ? 'bg-rose-500/20 text-rose-400' : 'bg-gray-800 text-gray-400'
                      }`}>
                        {tx.amount > 0 ? <TrendingUp className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {tx.type === 'listen_reward' ? t('wallet.tx_type_listen') : 
                           tx.type === 'upload_reward' ? t('wallet.tx_type_upload') :
                           tx.type === 'system_gift' ? (tx.description?.includes('邀请') ? t('wallet.tx_type_invite') : t('wallet.tx_type_gift')) :
                           tx.type === 'dividend_pool_reward' ? t('wallet.tx_type_dividend_pool') : 
                           tx.type === 'dividend_payout' ? t('wallet.tx_type_dividend_payout') : 
                           tx.type === 'download_fee' ? t('wallet.tx_type_download') : tx.description || t('wallet.tx_unknown')}
                        </h4>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {new Date(tx.created_at).toLocaleString()} {tx.song?.title ? `· ${t('wallet.tx_song')}${tx.song.title}` : ''}
                        </p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${tx.status === 'settled' || tx.type === 'system_gift' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-500'}`}>
                          {tx.status === 'settled' || tx.type === 'system_gift' ? t('wallet.settled') : t('wallet.auditing')}
                        </span>
                      </div>
                    </div>
                    <div className={`text-lg font-black font-mono ${tx.amount > 0 ? 'text-echo-primary' : 'text-white'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 补充说明区域 */}
      <section className="text-center">
        <p className="text-[10px] text-gray-600 font-mono">
          © 2026 ECHORURA MUSICCHAIN. Cryptographically secured closed-loop utility points system.
        </p>
      </section>
    </div>
  );
}
