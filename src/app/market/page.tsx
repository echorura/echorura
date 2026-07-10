'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { activeConfig } from '@/utils/compliance';
import { fetchSongsResilient } from '@/utils/supabase/queries';
import { 
  TrendingUp, 
  Info, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  X, 
  CreditCard,
  Lock,
  ArrowUpRight,
  Disc3,
  Sparkles,
  AlertTriangle,
  HelpCircle,
  Users,
  Wallet2
} from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { useLanguageStore } from '@/store/languageStore';
import { motion, AnimatePresence } from 'framer-motion';
import { FALLBACK_SONGS } from '@/utils/mockData';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, parseAbi } from 'viem';
import { CONTRACT_ADDRESSES, EchoTokenABI } from '@/contracts/config';
import { BUILDER_CODE_SUFFIX } from '@/utils/erc8021';


export default function MarketPage() {
  const [ipoSongs, setIpoSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [shareAmount, setShareAmount] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useCredit, setUseCredit] = useState(false);
  // paymentMode: 'balance' | 'credit' | 'onchain'
  const [paymentMode, setPaymentMode] = useState<'balance' | 'credit' | 'onchain'>('balance');
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  const { 
    echoBalance, 
    setTrack, 
    spendEcho, 
    addEquity, 
    useCredit: applyCredit, 
    maxCreditLimit, 
    usedCredit 
  } = usePlayerStore();
  
  const { t } = useLanguageStore();
  const supabase = createClient();

  // On-chain payment hooks
  const { address: connectedAddress, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [onChainPayTxHash, setOnChainPayTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { isLoading: isWaitingForChain, isSuccess: chainTxSuccess } = useWaitForTransactionReceipt({
    hash: onChainPayTxHash,
  });

  // 信用额度计算
  const availableCredit = maxCreditLimit - usedCredit;



  useEffect(() => {
    const fetchIpoSongs = async () => {
      try {
        const { data, error } = await fetchSongsResilient(supabase, {
          gtField: 'ipo_percentage',
          gtValue: 0,
          orderField: 'created_at',
          ascending: false
        });
        
        if (data && data.length > 0) {
          setIpoSongs(data);
        } else {
          setIpoSongs([]);
        }
      } catch (e) {
        setIpoSongs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchIpoSongs();
  }, [supabase]);

  const showPremiumToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4500);
  };

  const handleOpenSubscribe = (song: any) => {
    if (song.remaining_shares <= 0) return;
    setSelectedSong(song);
    setShareAmount(1);
    setUseCredit(false);
    setPaymentMode('balance');
    setOnChainPayTxHash(undefined);
  };

  const handleSubscribe = async () => {
    if (!selectedSong) return;
    
    const unitPrice = 1.0; // 统一单价为 1 ECHO 每份
    const cost = shareAmount * unitPrice;
    
    setIsSubmitting(true);

    // === 链上代币支付流程 ===
    if (paymentMode === 'onchain') {
      if (!isConnected || !connectedAddress) {
        showPremiumToast('请先连接您的智能钱包才能使用链上支付', 'error');
        setIsSubmitting(false);
        return;
      }
      try {
        // A. 调用 EchoToken.transfer 将 ECHO 发送给平台 AdminAddress
        showPremiumToast('正在发起链上支付，请在钱包中确认...', 'success');
        const txHash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.EchoToken as `0x${string}`,
          abi: parseAbi(EchoTokenABI as any),
          functionName: 'transfer',
          args: [CONTRACT_ADDRESSES.AdminAddress as `0x${string}`, parseUnits(cost.toString(), 18)],
          dataSuffix: BUILDER_CODE_SUFFIX,
        });
        setOnChainPayTxHash(txHash);
        showPremiumToast('支付交易已提交，正在等待链上确认...', 'success');

        // B. 等待交易打包成功后，请求后端 API 验证交易并分发链上 ERC-1155 股权
        // 轮询等待链上确认 (最多 60 秒)
        const provider = await import('viem').then(({ createPublicClient, http }) =>
          createPublicClient({ chain: { id: 84532, name: 'Base Sepolia', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://sepolia.base.org'] } } } as any, transport: http() })
        );

        let receipt = null;
        for (let attempt = 0; attempt < 20; attempt++) {
          await new Promise(r => setTimeout(r, 3000));
          try {
            receipt = await provider.getTransactionReceipt({ hash: txHash });
            if (receipt?.status === 'success') break;
          } catch (_) {}
        }

        if (!receipt || receipt.status !== 'success') {
          showPremiumToast('链上交易超时或失败，请稍后在资产中心检查。', 'error');
          setIsSubmitting(false);
          return;
        }

        // C. 通知后端处理 MusicIP 股权分发
        const { data: { session } } = await supabase.auth.getSession();
        const purchaseRes = await fetch('/api/market/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            txHash,
            songId: selectedSong.id,
            shareAmount,
            userAddress: connectedAddress
          })
        });
        const purchaseResult = await purchaseRes.json();
        if (!purchaseRes.ok) {
          throw new Error(purchaseResult.error || '链上股权分发失败');
        }

        // D. 更新本地 UI 状态
        addEquity({ id: selectedSong.id, songTitle: selectedSong.title, artist: selectedSong.creator?.display_name || selectedSong.artist, shares: shareAmount, currentPrice: unitPrice, cover: selectedSong.cover_url });
        setIpoSongs(prev => prev.map(s => s.id === selectedSong.id ? { ...s, remaining_shares: Math.max(0, s.remaining_shares - shareAmount) } : s));
        showPremiumToast(`🔗 链上认购成功！${shareAmount} 份《${selectedSong.title}》版权代币已发送至您的智能钱包。`, 'success');
        setIsSubmitting(false);
        setSelectedSong(null);
        return;
      } catch (err: any) {
        showPremiumToast('链上支付失败: ' + (err.message || err), 'error');
        setIsSubmitting(false);
        return;
      }
    }

    // === 平台余额 / 信用代付流程 ===
    const usingCredit = paymentMode === 'credit';
    if (!usingCredit && echoBalance < cost) {
      showPremiumToast(t('market.toast_insufficient_balance'), 'error');
      setIsSubmitting(false);
      return;
    }
    if (usingCredit && availableCredit < cost) {
      showPremiumToast(t('market.toast_insufficient_credit'), 'error');
      setIsSubmitting(false);
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: rpcError } = await supabase.rpc('purchase_equity', {
          p_song_id: selectedSong.id,
          p_share_amount: shareAmount,
          p_use_credit: usingCredit
        });
        if (rpcError) {
          showPremiumToast(t('market.toast_tx_failed') + rpcError.message, 'error');
          setIsSubmitting(false);
          return;
        }
      } else {
        showPremiumToast(t('market.toast_not_logged_in'), 'error');
        setIsSubmitting(false);
        return;
      }
    } catch (err: any) {
      showPremiumToast(t('market.toast_network_error'), 'error');
      setIsSubmitting(false);
      return;
    }

    if (usingCredit) {
      applyCredit(cost);
    } else {
      spendEcho(cost);
    }

    addEquity({ id: selectedSong.id, songTitle: selectedSong.title, artist: selectedSong.creator?.display_name || selectedSong.artist, shares: shareAmount, currentPrice: unitPrice, cover: selectedSong.cover_url });
    setIpoSongs(prev => prev.map(s => s.id === selectedSong.id ? { ...s, remaining_shares: Math.max(0, s.remaining_shares - shareAmount) } : s));
    showPremiumToast(t('market.toast_curation_success_1') + shareAmount + t('market.toast_curation_success_2') + selectedSong.title + t('market.toast_curation_success_3'), 'success');
    setIsSubmitting(false);
    setSelectedSong(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-24 px-4">
      {/* Premium Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 20, scale: 0.9, filter: "blur(10px)" }}
            className={`fixed bottom-8 right-8 z-[250] flex items-center gap-3 px-6 py-4 rounded-2xl border backdrop-blur-md shadow-2xl max-w-md ${
              toast.type === 'success' 
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-400' 
                : 'bg-rose-950/90 border-rose-500/30 text-rose-400'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            )}
            <span className="text-xs font-black uppercase tracking-wider leading-relaxed">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explanation Header Card */}
      <section className="relative rounded-[3rem] bg-gradient-to-br from-echo-secondary/20 via-black to-echo-primary/10 border border-white/10 p-8 md:p-16 mt-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none overflow-hidden rounded-[3rem]">
          <TrendingUp size={400} className="text-echo-primary translate-x-20 -translate-y-20" />
        </div>
        
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-echo-secondary uppercase tracking-widest mb-6">
            <Info className="w-3 h-3" />
            {t('compliance.app_name_' + activeConfig.region.toLowerCase())} Launchpad
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-white mb-8 leading-tight italic uppercase tracking-tighter break-words">
            {t('market.header_title')} <br />
            <span className="text-gradient inline-block py-2 pr-6 pl-1">{t('market.header_subtitle')}</span>
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-400 text-sm leading-relaxed mb-10">
            <div className="flex gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md">
              <Zap className="w-8 h-8 text-echo-primary shrink-0" />
              <p>{t('market.desc_equity_detail_1')}{t('compliance.equity_' + activeConfig.region.toLowerCase())}{t('market.desc_equity_detail_2')}</p>
            </div>
            <div className="flex gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md">
              <ShieldCheck className="w-8 h-8 text-echo-secondary shrink-0" />
              <p>{t('market.desc_trust_contract')}</p>
            </div>
          </div>
        </div>
      </section>
 
 
      {/* Market Listing */}
      <section className="relative">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-echo-primary rounded-full"></div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">{t('market.co_creation_market')}</h2>
          </div>
        </div>
 
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-white/5 rounded-3xl animate-pulse border border-white/5"></div>
            ))}
          </div>
        ) : ipoSongs.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {ipoSongs.map((song) => {
              const progress = ((song.total_shares - song.remaining_shares) / song.total_shares) * 100;
              const isSoldOut = song.remaining_shares === 0;
              return (
                <div 
                  key={song.id} 
                  className="glass-panel p-6 rounded-[2.5rem] border border-white/10 hover:border-echo-primary/40 transition-all flex flex-col sm:flex-row items-center gap-6 group"
                >
                  <div className="w-32 h-32 rounded-2xl overflow-hidden shadow-2xl relative shrink-0">
                    <img src={song.cover_url} loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    {isSoldOut && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-sm">
                        <CheckCircle2 className="text-echo-secondary w-10 h-10" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 w-full space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-black text-white uppercase truncate">{song.title}</h3>
                        <p className="text-echo-primary text-xs font-mono">By {song.creator?.display_name || song.artist}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-gray-500 uppercase font-bold">{t('market.cost_per_share')}</div>
                        <div className="text-sm font-black text-white italic">1.00 ECHO</div>
                      </div>
                    </div>
 
                    <div className="space-y-2">
                      <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ${isSoldOut ? 'bg-echo-secondary' : 'bg-echo-primary shadow-[0_0_10px_rgba(0,240,255,0.4)]'}`} 
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 uppercase font-black tracking-widest">
                        <span>{t('market.support_progress')} {progress.toFixed(0)}%</span>
                        <span>{isSoldOut ? t('market.curation_success') : t('market.shares_left_format').replace('{shares}', song.remaining_shares.toString())}</span>
                      </div>
                    </div>
 
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleOpenSubscribe(song)}
                        disabled={isSoldOut}
                        className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${
                          isSoldOut 
                            ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed' 
                            : 'bg-echo-primary text-black hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                        }`}
                      >
                        {isSoldOut ? t('market.curation_success') : t('market.support_now')}
                      </button>
                      <button 
                        onClick={() => setTrack({
                          id: song.id, 
                          title: song.title, 
                          artist: song.artist, 
                          cover: song.cover_url, 
                          src: song.audio_url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 
                          earnRate: Number(song.earn_rate) || 0.005
                        })}
                        className="px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-bold text-xs"
                      >
                        {t('market.preview')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-panel p-16 rounded-[2.5rem] border border-white/10 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-echo-primary/10 flex items-center justify-center text-echo-primary border border-echo-primary/20">
              <Disc3 className="w-8 h-8 animate-[spin_4s_linear_infinite]" />
            </div>
            <h3 className="text-xl font-bold text-white uppercase italic tracking-wider">{t('market.waiting_join')}</h3>
            <p className="text-xs text-gray-500 max-w-sm">
              {t('market.no_active_songs')}
            </p>
          </div>
        )}
      </section>

      {/* Subscription Modal */}
      <AnimatePresence>
        {selectedSong && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-md" 
              onClick={() => !isSubmitting && setSelectedSong(null)} 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass-panel rounded-[2.5rem] p-8 border border-white/10 shadow-2xl overflow-hidden"
            >
              {/* Modal Glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-echo-primary/10 blur-[50px] -mr-16 -mt-16 pointer-events-none"></div>

              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">{t('market.confirm_support')}</h2>
                  <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mt-1">AA Curation Support</p>
                </div>
                <button 
                  onClick={() => setSelectedSong(null)}
                  disabled={isSubmitting}
                  className="p-2 rounded-full hover:bg-white/5 text-gray-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 mb-8">
                <img src={selectedSong.cover_url} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                <div className="overflow-hidden">
                  <h4 className="text-white font-bold truncate">{selectedSong.title}</h4>
                  <p className="text-xs text-echo-primary font-mono truncate">By {selectedSong.creator?.display_name || selectedSong.artist}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-2 block">
                    {t('market.curation_shares')} (Max: {selectedSong.remaining_shares})
                  </label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="number" 
                      min="1" 
                      max={selectedSong.remaining_shares}
                      value={shareAmount}
                      onChange={(e) => setShareAmount(Math.min(selectedSong.remaining_shares, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl py-4 px-4 text-white font-black text-xl focus:border-echo-primary/50 outline-none transition-all"
                    />
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-gray-500 font-bold uppercase">{t('market.curation_payment')}</div>
                      <div className="text-xl font-black text-echo-primary">{(shareAmount * 1.0).toFixed(2)} <span className="text-xs">ECHO</span></div>
                    </div>
                  </div>
                </div>

                {/* Payment Mode Selector */}
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">支付方式</div>

                  {/* Option 1: Platform Balance */}
                  <div
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      paymentMode === 'balance'
                        ? 'bg-echo-primary/10 border-echo-primary/50 shadow-[0_0_20px_rgba(0,240,255,0.08)]'
                        : 'bg-white/5 border-white/10 opacity-70 hover:opacity-100'
                    }`}
                    onClick={() => !isSubmitting && setPaymentMode('balance')}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${paymentMode === 'balance' ? 'bg-echo-primary/20 text-echo-primary' : 'bg-white/10 text-gray-500'}`}>
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white leading-tight">平台余额支付</div>
                        <div className="text-[10px] text-gray-400 mt-1">可用: <span className={echoBalance < shareAmount ? 'text-rose-400' : 'text-echo-primary'}>{echoBalance.toFixed(2)} ECHO</span></div>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${paymentMode === 'balance' ? 'border-echo-primary bg-echo-primary' : 'border-white/20'}`}>
                      {paymentMode === 'balance' && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                    </div>
                  </div>

                  {/* Option 2: Credit Limit */}
                  <div
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      paymentMode === 'credit'
                        ? 'bg-echo-secondary/15 border-echo-secondary/50 shadow-[0_0_20px_rgba(235,0,255,0.1)]'
                        : 'bg-white/5 border-white/10 opacity-70 hover:opacity-100'
                    }`}
                    onClick={() => !isSubmitting && setPaymentMode('credit')}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${paymentMode === 'credit' ? 'bg-echo-secondary/20 text-echo-secondary' : 'bg-white/10 text-gray-500'}`}>
                        <CreditCard size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white leading-tight">{t('market.use_credit_limit')} (信用代付)</div>
                        <div className="text-[10px] text-gray-400 mt-1">可用额度: {availableCredit.toFixed(2)} ECHO</div>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${paymentMode === 'credit' ? 'border-echo-secondary bg-echo-secondary' : 'border-white/20'}`}>
                      {paymentMode === 'credit' && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                    </div>
                  </div>

                  {/* Option 3: On-chain Wallet Payment */}
                  <div
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      paymentMode === 'onchain'
                        ? 'bg-blue-900/30 border-blue-400/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                        : 'bg-white/5 border-white/10 opacity-70 hover:opacity-100'
                    }`}
                    onClick={() => !isSubmitting && setPaymentMode('onchain')}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${paymentMode === 'onchain' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-gray-500'}`}>
                        <Wallet2 size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white leading-tight">链上钱包代币支付 <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold">Web3</span></div>
                        <div className="text-[10px] text-gray-400 mt-1">
                          {isConnected ? (
                            <span className="text-blue-400">{connectedAddress?.slice(0, 6)}...{connectedAddress?.slice(-4)} 已连接</span>
                          ) : (
                            <span className="text-gray-500">需连接智能钱包</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${paymentMode === 'onchain' ? 'border-blue-400 bg-blue-400' : 'border-white/20'}`}>
                      {paymentMode === 'onchain' && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={handleSubscribe}
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-echo-primary to-echo-secondary text-black font-black py-5 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-wider"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin shrink-0" />
                        {t('market.wallet_signing')}
                      </>
                    ) : (
                      <>
                        {t('market.confirm_curation_support')}
                        <ArrowUpRight size={18} />
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-2 justify-center text-[9px] text-gray-600 font-black uppercase tracking-widest">
                <Lock size={10} />
                Secured by ECHORURA L2 Smart Wallet
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
