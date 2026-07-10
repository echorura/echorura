'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { useLanguageStore } from '@/store/languageStore';
import { createClient } from '@/utils/supabase/client';
import { activeConfig } from '@/utils/compliance';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits, parseAbi } from 'viem';
import { CONTRACT_ADDRESSES, EchoTokenABI } from '@/contracts/config';
import { BUILDER_CODE_SUFFIX } from '@/utils/erc8021';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  X,
  ChevronDown,
  Repeat,
  Shuffle,
  TrendingUp,
  Loader2,
  Heart,
  MessageCircle,
  Music,
  DownloadCloud,
  Bookmark,
  Share2,
  ListMusic,
  FolderPlus,
  Wallet2
} from 'lucide-react';
import AddToPlaylistModal from './AddToPlaylistModal';
import PlaylistDetailModal from './PlaylistDetailModal';


interface LyricLine {
  time: number; // in seconds
  text: string;
}

function parseLyrics(lyricsStr: string | undefined): LyricLine[] {
  if (!lyricsStr) return [];
  const lines = lyricsStr.split('\n');
  const result: LyricLine[] = [];

  // RegEx for standard LRC format: [00:12.30] or [00:12] or [01:02:03]
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/;
  // LRC metadata tags to skip: [ti:], [ar:], [al:], [by:], [offset:] etc.
  const metaRegex = /^\[(?:ti|ar|al|by|offset|length|re|ve):/i;

  let hasTimestamps = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (metaRegex.test(trimmed)) continue; // skip metadata tags

    const match = timeRegex.exec(trimmed);
    if (match) {
      hasTimestamps = true;
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3], 10) / (match[3].length === 2 ? 100 : 1000) : 0;
      const totalTime = mins * 60 + secs + ms;
      const text = trimmed.replace(timeRegex, '').trim();
      if (text) result.push({ time: totalTime, text });
    } else {
      result.push({ time: -1, text: trimmed });
    }
  }

  // Fallback for plaintext without timestamps
  if (!hasTimestamps) {
    return result
      .filter(item => item.text.trim().length > 0)
      .map((item) => ({
        time: -99, // Magic number indicating no timestamp
        text: item.text
      }));
  }

  return result.filter(item => item.time >= 0).sort((a, b) => a.time - b.time);
}

export default function GlobalAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ipoData, setIpoData] = useState<any>(null);
  const [isInvesting, setIsInvesting] = useState(false);
  const [investAmount, setInvestAmount] = useState(1);
  const [rewardPoint, setRewardPoint] = useState<number | null>(null); // 随机奖励点 (0.5 - 0.6)
  const [hasRewarded, setHasRewarded] = useState(false); // 本次播放是否已奖励


  // Interactive Social & Investment States
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseShares, setPurchaseShares] = useState(5);
  const [localCoCreated, setLocalCoCreated] = useState(false);
  const [hasCommented, setHasCommented] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(null);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [playerToast, setPlayerToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'success' });
  const [isConfirmDownload, setIsConfirmDownload] = useState(false);
  const [globalPlaylistId, setGlobalPlaylistId] = useState<string | null>(null);
  // On-chain payment for co-creation
  const [playerPaymentMode, setPlayerPaymentMode] = useState<'balance' | 'onchain'>('balance');
  const { address: connectedAddress, isConnected } = useAccount();
  const { writeContractAsync: writeTokenTransfer } = useWriteContract();

  // Dynamic Scrolling Lyric States & Ref
  const [parsedLyrics, setParsedLyrics] = useState<LyricLine[]>([]);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [isLyricsView, setIsLyricsView] = useState(false);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const {
    isPlaying,
    currentTrack,
    addEcho,
    spendEcho,
    echoBalance,
    pause,
    togglePlay,
    showPlayer,
    isFullScreen,
    togglePlayerPanel,
    toggleFullScreen,
    equities,
    addEquity,
    addDividends,
    playNext,
    playPrev,
    playSong,
    playlist,
    removeFromQueue,
    clearQueue
  } = usePlayerStore();
  const { t } = useLanguageStore();

  const supabase = createClient();

  // Register Service Worker for PWA
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleRegister = () => {
        navigator.serviceWorker.register('/sw.js').then(
          (reg) => console.log('ServiceWorker registered with scope: ', reg.scope),
          (err) => console.error('ServiceWorker registration failed: ', err)
        );
      };
      if (document.readyState === 'complete') {
        handleRegister();
      } else {
        window.addEventListener('load', handleRegister);
        return () => window.removeEventListener('load', handleRegister);
      }
    }
  }, []);

  // 自动化检测并自动播放分享的歌曲
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sharedSongId = params.get('songId');
      if (sharedSongId) {
        // Clear only the songId parameter from URL immediately to prevent loops
        params.delete('songId');
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
        window.history.replaceState({}, '', newUrl);

        supabase
          .from('songs')
          .select('*, creator:profiles(display_name, avatar_url)')
          .eq('id', sharedSongId)
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              const mappedSong = {
                ...data,
                artist: data.artist || data.creator?.display_name || 'Unknown Artist',
                cover_url: data.cover_url || data.cover
              };
              playSong(mappedSong);
            }
          });
      }
    }
  }, [playSong, supabase]);

  // 自动化检测并自动播放分享的歌单，并弹出歌单详情模态框
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sharedPlaylistId = params.get('playlistId');
      if (sharedPlaylistId) {
        // Clear playlistId parameter from URL immediately to prevent loops
        params.delete('playlistId');
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
        window.history.replaceState({}, '', newUrl);

        // 打开歌单详情模态框
        setGlobalPlaylistId(sharedPlaylistId);

        // 自动拉取歌单曲目并开始播放
        supabase
          .from('playlists')
          .select(`
            *,
            playlist_songs(
              *,
              song:songs(
                *,
                creator:profiles(display_name, avatar_url)
              )
            )
          `)
          .eq('id', sharedPlaylistId)
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              const songsList = data.playlist_songs
                ?.map((ps: any) => ps.song)
                .filter(Boolean) || [];
              if (songsList.length > 0) {
                playSong(songsList[0], songsList);
              }
            }
          });
      }
    }
  }, [playSong, supabase]);

  // 读取当前登录用户的手机号 (用于生成邀请分享专属链接)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserPhone(user.phone || null);
      }
    });
  }, [supabase]);

  // Fetch IPO Data for current track
  useEffect(() => {
    const fetchIpoData = async () => {
      if (!currentTrack) return;

      // 检查是否为合法的 UUID 格式 (防止演示歌曲 ID '1', '2' 导致 400 报错)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentTrack.id);
      if (!isUuid) {
        setIpoData(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('songs')
          .select('is_ipo_active, total_shares, remaining_shares, ipo_percentage, creator_id')
          .eq('id', currentTrack.id)
          .single();

        if (error) {
          setIpoData(null);
        } else {
          setIpoData(data);
        }
      } catch (err) {
        setIpoData(null);
      }
    };

    const fetchInteractions = async () => {
      if (!currentTrack) return;
      
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentTrack.id);
      const isNum = !isNaN(Number(currentTrack.id));
      if (!isUuid && !isNum) {
        setLikeCount(0);
        setComments([]);
        return;
      }

      try {
        const { data: songData } = await supabase.from('songs').select('likes').eq('id', currentTrack.id).single();
        if (songData) setLikeCount(songData.likes || 0);

        const { data: commentsData } = await supabase
          .from('song_comments')
          .select('*, creator:profiles(display_name, avatar_url)')
          .eq('song_id', currentTrack.id)
          .order('created_at', { ascending: false });
        
        if (commentsData) {
          const formattedComments = commentsData.map((c: any) => ({
            id: c.id,
            author: c.creator?.display_name || 'ECHORURA Citizen',
            avatar: c.creator?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.creator_id}`,
            content: c.content,
            time: new Date(c.created_at).toLocaleString()
          }));
          setComments(formattedComments);
        } else {
          setComments([]);
        }

        setIsLiked(false);
        setHasCommented(false);

        // Check favorite state
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: favData } = await supabase
            .from('user_favorites')
            .select('id')
            .eq('song_id', currentTrack.id)
            .eq('user_id', user.id)
            .single();
          setIsFavorited(!!favData);
        } else {
          setIsFavorited(false);
        }

      } catch (err) {
        console.error("[Interactions Fetch Error]", err);
      }
    };

    fetchIpoData();
    fetchInteractions();
  }, [currentTrack?.id, supabase]);



  const showPlayerToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setPlayerToast({ show: true, message, type });
    setTimeout(() => setPlayerToast(prev => ({ ...prev, show: false })), 3500);
  };

  const handleLikeToggle = () => {
    if (!currentTrack) return;
    
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount(c => nextLiked ? c + 1 : Math.max(0, c - 1));
    
    // Async update to db
    supabase.from('songs').select('likes').eq('id', currentTrack.id).single().then(({data}) => {
      if (data) {
        supabase.from('songs').update({ likes: Math.max(0, (data.likes || 0) + (nextLiked ? 1 : -1)) }).eq('id', currentTrack.id).then();
      }
    });
  };

  const handleFavoriteToggle = async () => {
    if (!currentTrack) return;
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      showPlayerToast(t('player.login_to_favorite'), 'info');
      return;
    }

    setIsFavorited(prev => {
      const nextFavorited = !prev;
      
      if (nextFavorited) {
        supabase.from('user_favorites').insert({
          song_id: currentTrack.id,
          user_id: user.id
        }).then();
      } else {
        supabase.from('user_favorites').delete()
          .eq('song_id', currentTrack.id)
          .eq('user_id', user.id)
          .then();
      }
      
      showPlayerToast(nextFavorited ? t('player.favorite_added') : t('player.favorite_removed'), nextFavorited ? 'success' : 'info');
      return nextFavorited;
    });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentTrack) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showPlayerToast(t('player.login_to_comment'), 'info');
      return;
    }

    const { error } = await supabase.from('song_comments').insert({
      song_id: currentTrack.id,
      creator_id: user.id,
      content: newComment.trim()
    });

    if (error) {
      alert(t('player.comment_failed') + error.message);
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).single();

    const newCommentItem = {
      id: Date.now(),
      author: profile?.display_name || t('common.me'),
      avatar: profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
      content: newComment.trim(),
      time: t('common.just_now')
    };
    setComments(prev => [newCommentItem, ...prev]);
    setNewComment('');
    setHasCommented(true);
  };

  const handleInvestShares = async (amount: number) => {
    if (!currentTrack || !ipoData || !isIpoActive) return;

    setIsInvesting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('common.login_required'));

      // === Branch: On-chain wallet payment ===
      if (playerPaymentMode === 'onchain') {
        if (!isConnected || !connectedAddress) throw new Error('请先连接您的智能钱包才能使用链上支付');
        showPlayerToast('正在发起链上支付，请在钱包中确认...', 'info');

        const txHash = await writeTokenTransfer({
          address: CONTRACT_ADDRESSES.EchoToken as `0x${string}`,
          abi: parseAbi(EchoTokenABI as any),
          functionName: 'transfer',
          args: [CONTRACT_ADDRESSES.AdminAddress as `0x${string}`, parseUnits(amount.toString(), 18)],
          dataSuffix: BUILDER_CODE_SUFFIX,
        });

        showPlayerToast('支付已提交，等待链上确认...', 'info');
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
        let receipt = null;
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 3000));
          try { receipt = await provider.getTransactionReceipt(txHash); if (receipt?.status === 1) break; } catch (_) {}
        }
        if (!receipt || receipt.status !== 1) throw new Error('链上交易超时或失败');

        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/market/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ txHash, songId: currentTrack.id, shareAmount: amount, userAddress: connectedAddress })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || '链上股权分发失败');

        addEquity({ id: currentTrack.id, songTitle: currentTrack.title, artist: currentTrack.artist, shares: amount, currentPrice: 1.0, cover: currentTrack.cover });
        showPlayerToast(`🔗 链上认购成功！${amount} 份版权代币已发送至您的钱包。`, 'success');
        setIsPurchaseModalOpen(false);
        setLocalCoCreated(true);
        const { data: nd } = await supabase.from('songs').select('remaining_shares').eq('id', currentTrack.id).single();
        setIpoData({ ...ipoData, remaining_shares: nd?.remaining_shares });
        return;
      }

      // === Branch: Platform balance payment ===
      if (echoBalance < amount) throw new Error(t('player.insufficient_balance_ipo'));
      if (ipoData.remaining_shares < amount) throw new Error(t('player.insufficient_shares_ipo').replace('{shares}', ipoData.remaining_shares.toString()));

      await new Promise(resolve => setTimeout(resolve, 1500));
      const { error: rpcError } = await supabase.rpc('purchase_equity', { p_song_id: currentTrack.id, p_share_amount: amount });
      if (rpcError) throw new Error(rpcError.message || t('player.ipo_tx_failed_err'));

      spendEcho(amount);
      addEquity({ id: currentTrack.id, songTitle: currentTrack.title, artist: currentTrack.artist, shares: amount, currentPrice: 1.0, cover: currentTrack.cover });
      showPlayerToast(t('player.ipo_success_toast').replace('{title}', currentTrack.title).replace('{amount}', amount.toString()).replace('{equityDisplayName}', t('compliance.equity_' + activeConfig.region.toLowerCase())), 'success');
      setIsPurchaseModalOpen(false);
      setLocalCoCreated(true);
      const { data: newData } = await supabase.from('songs').select('remaining_shares').eq('id', currentTrack.id).single();
      setIpoData({ ...ipoData, remaining_shares: newData?.remaining_shares });
    } catch (err: any) {
      showPlayerToast(t('player.ipo_failed_toast') + err.message, 'error');
    } finally {
      setIsInvesting(false);
    }
  };

  const handleDownload = async () => {
    if (!currentTrack || !currentTrack.src) return;
    
    if (echoBalance < 1) {
      showPlayerToast(t('player.insufficient_balance_download'), 'error');
      return;
    }

    // 显示内嵌确认面板，不使用 window.confirm（会阻断音频播放）
    setIsConfirmDownload(true);
  };

  const handleDownloadConfirmed = async () => {
    setIsConfirmDownload(false);
    if (!currentTrack || !currentTrack.src) return;

    setIsDownloading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('player.login_to_download'));

      // 原子化 RPC：扣除用户 1 ECHO，同时注入版权池 1 ECHO
      const { data, error } = await supabase.rpc('purchase_song_download', {
        p_user_id: user.id,
        p_song_id: currentTrack.id,
        p_amount: 1.0
      });

      if (error) throw new Error(error.message);
      if (data && data.success === false) throw new Error(data.error);

      // 本地状态同步减去 1 ECHO
      spendEcho(1);
      const response = await fetch(currentTrack.src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${currentTrack.title || 'ECHORURA_Audio'}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      showPlayerToast(t('player.download_started'), 'success');
    } catch (e) {
      showPlayerToast(t('player.download_failed'), 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const copyTextFallback = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  const handleShare = async () => {
    if (!currentTrack) return;
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.echora.cn';
    
    // 动态获取当前登录用户和个人资料，获取邀请码
    let user = null;
    let profile = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      user = userData?.user;
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', user.id).single();
        profile = prof;
      }
    } catch (e) {
      console.warn("Failed to fetch user context for sharing:", e);
    }

    // 生成带专属邀请码/推广信息的分享链接
    const inviteCode = profile?.display_name || user?.email?.split('@')[0] || user?.phone || 'ECHORURA';
    const phoneNum = user?.phone || '';
    const rawPhone = phoneNum.replace('+86', '');
    
    let shareUrl = `${origin}/?songId=${currentTrack.id}`;
    if (rawPhone || inviteCode) {
      shareUrl += `&ref=${rawPhone || inviteCode}`;
    }

    const shareTitle = t('player.share_title').replace('{title}', currentTrack.title).replace('{artist}', currentTrack.artist);
    const shareText = t('player.share_text').replace('{title}', currentTrack.title).replace('{artist}', currentTrack.artist);
    
    const plainText = `${shareTitle}\n${shareText}：${shareUrl}`;
    const htmlText = `<p>${shareTitle}<br>${shareText}<a href="${shareUrl}">${t('player.share_click_to_listen')}</a>。</p>`;

    try {
      if (navigator.share && isMobile) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } else {
        if (navigator.clipboard && window.ClipboardItem) {
          const blobText = new Blob([plainText], { type: 'text/plain' });
          const blobHtml = new Blob([htmlText], { type: 'text/html' });
          const clipboardData = [
            new ClipboardItem({
              'text/plain': blobText,
              'text/html': blobHtml
            })
          ];
          await navigator.clipboard.write(clipboardData);
          alert(t('player.share_prompt_copied_rt'));
        } else {
          copyTextFallback(plainText);
          alert(t('player.share_prompt_copied'));
        }
      }
    } catch (err) {
      console.warn("Share failed:", err);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(plainText);
        } else {
          copyTextFallback(plainText);
        }
        alert(t('player.share_prompt_copied_link'));
      } catch (e) {
        copyTextFallback(plainText);
        alert(t('player.share_prompt_copied_link_fallback'));
      }
    }
  };

  const handleInvest = async () => {
    await handleInvestShares(investAmount);
  };

  const isIpoActive = ipoData?.is_ipo_active && ipoData?.remaining_shares > 0;

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  // Handle Play/Pause
  // 注意：锁定仅影响奖励发放，不阻止用户正常播放
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.warn('Playback prevented:', e);
          pause();
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack, pause]);

  // 1. 每次切歌时，重新初始化状态，并从数据库拉取最新歌词（防止 playerStore 缓存旧数据）
  useEffect(() => {
    if (!currentTrack) return;

    setProgress(0);
    setDuration(0);
    const randomPoint = 0.5 + Math.random() * 0.1;
    setRewardPoint(randomPoint);
    setHasRewarded(false);
    setIsLiked(false);
    setLocalCoCreated(false);
    setHasCommented(false);
    setActiveLineIndex(0);
    setIsLyricsView(false);

    console.log(`[ECHORURA] 奖励触发点已设定: ${Math.round(randomPoint * 100)}%`);

    // 检查是否为真实 UUID 歌曲（非演示 ID）
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentTrack.id);

    if (isUuid) {
      // 从数据库拉取最新歌词（确保 LRC 时间轴已同步，不依赖 playerStore 旧缓存）
      supabase
        .from('songs')
        .select('lyrics')
        .eq('id', currentTrack.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            const lyricsToUse = data.lyrics || currentTrack.lyrics;
            const parsed = parseLyrics(lyricsToUse);
            setParsedLyrics(parsed);
            const hasLrc = parsed.length > 0 && parsed[0].time !== -99;
            console.log(`[ECHORURA] 歌词加载完成: ${parsed.length} 行，模式: ${hasLrc ? 'LRC 精准时间轴' : '降级比例同步'}`);
          } else {
            // DB 查询失败时 fallback 到 store 里的数据
            const parsed = parseLyrics(currentTrack.lyrics);
            setParsedLyrics(parsed);
          }
        });
    } else {
      // 演示歌曲直接用 store 数据
      const parsed = parseLyrics(currentTrack.lyrics);
      setParsedLyrics(parsed);
    }
  }, [currentTrack?.id, setProgress, setDuration]);

  // 确保歌词行始终随着进度变化处于视口中央
  useEffect(() => {
    if (lyricsContainerRef.current && isFullScreen && parsedLyrics.length > 0) {
      const activeEl = lyricsContainerRef.current.querySelector(`[data-lyric-index="${activeLineIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [activeLineIndex, isFullScreen, parsedLyrics.length]);

  // 缓存非时间戳（纯文本）歌词的比例，避免在时间更新时频繁做大数组的 map 和 reduce 导致 CPU 占用及 GC 停顿
  const plainTextLineRatios = useMemo(() => {
    if (parsedLyrics.length === 0 || parsedLyrics[0].time !== -99) return [];
    const charCounts = parsedLyrics.map(l => Math.max(l.text.length, 4));
    const totalChars = charCounts.reduce((a, b) => a + b, 0);
    let cumulative = 0;
    const ratios: number[] = [];
    for (const count of charCounts) {
      ratios.push(cumulative);
      cumulative += count / totalChars;
    }
    return ratios;
  }, [parsedLyrics]);

  // 动态同步匹配当前歌词行
  const handleTimeUpdate = (currentTime: number) => {
    setProgress(currentTime);
    if (parsedLyrics.length === 0) return;

    if (parsedLyrics[0].time === -99) {
      // 按字符数加权的比例分配降级模式
      if (duration > 0 && plainTextLineRatios.length > 0) {
        const ratio = currentTime / duration;
        // 找到当前比例对应的歌词行
        let idx = 0;
        for (let i = plainTextLineRatios.length - 1; i >= 0; i--) {
          if (ratio >= plainTextLineRatios[i]) {
            idx = i;
            break;
          }
        }
        setActiveLineIndex(Math.max(0, Math.min(idx, parsedLyrics.length - 1)));
      }
    } else {
      // 时间戳毫秒匹配模式
      let index = 0;
      for (let i = 0; i < parsedLyrics.length; i++) {
        if (currentTime >= parsedLyrics[i].time) {
          index = i;
        } else {
          break;
        }
      }
      setActiveLineIndex(index);
    }
  };

  // 确保认购份额始终在合法范围内
  useEffect(() => {
    const maxShares = ipoData?.remaining_shares ?? currentTrack?.remaining_shares ?? 100;
    setPurchaseShares(prev => Math.min(prev > 0 ? prev : 5, maxShares || 1));
  }, [currentTrack?.id, ipoData?.remaining_shares, isPurchaseModalOpen]);

  // 2. 核心收益逻辑：到达随机点时触发奖励
  useEffect(() => {
    if (isPlaying && currentTrack && rewardPoint && !hasRewarded && duration > 0) {
      const currentProgressRatio = progress / duration;
      if (currentProgressRatio >= rewardPoint) {
        setHasRewarded(true);

        // [防刷机制 2]：单日单曲连续循环超过5次后，24小时内不再发放奖励（播放不受影响）
        const consecutiveKey = `consecutive_plays_v2`;
        const lockoutKey = `lockout_until_${currentTrack.id}`;

        // 先检查该曲是否在24小时奖励冷却期内
        const lockoutTime = localStorage.getItem(lockoutKey);
        if (lockoutTime && Date.now() < Number(lockoutTime)) {
          console.log('[防刷] 该曲奖励冷却中，本次不发放收益（剩余冷却时间约', Math.ceil((Number(lockoutTime) - Date.now()) / 3600000), '小时）');
          return; // 静默跳过，不发放奖励，不影响播放
        }

        let consecutiveData = { songId: currentTrack.id, count: 0 };
        try {
           const stored = localStorage.getItem(consecutiveKey);
           if (stored) consecutiveData = JSON.parse(stored);
        } catch(e){}

        if (consecutiveData.songId !== currentTrack.id) {
           // 切歌了，重置连续次数
           consecutiveData = { songId: currentTrack.id, count: 1 };
        } else {
           consecutiveData.count += 1;
        }
        localStorage.setItem(consecutiveKey, JSON.stringify(consecutiveData));

        if (consecutiveData.count > 5) {
           // 连续循环已超过5次，触发24小时奖励冷却（不停播、不弹窗）
           localStorage.setItem(lockoutKey, (Date.now() + 24 * 60 * 60 * 1000).toString());
           console.log('[防刷] 单日连续循环已达5次上限，已开启24小时奖励冷却期，播放正常继续');
           return; // 静默跳过，不发放奖励
        }

        // 调用后端 T+0 混合清算接口 (支持游客与已登录用户)
        supabase.auth.getSession().then(({ data: { session } }) => {
          const headers: HeadersInit = {
            'Content-Type': 'application/json'
          };
          if (session) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
          fetch('/api/rewards/play', {
            method: 'POST',
            headers,
            body: JSON.stringify({ songId: currentTrack.id })
          }).then(async res => {
            if (res.ok) {
              if (session) {
                // UI 同步显示（仅为响应速度，实际账本在后端）
                addEcho(0.3);
                console.log('🎉 完成已登录用户有效收听！已分配挖矿收益及版权分红。');
                const userEquity = equities.find(e => e.id === currentTrack.id);
                if (userEquity && userEquity.shares > 0) {
                  const userShare = (userEquity.shares / 100) * 0.7;
                  addDividends(currentTrack.id, userShare);
                }
              } else {
                console.log('🎉 游客有效收听记录成功，已增加播放量。');
              }
            } else {
              const data = await res.json();
              console.error('Play reward failed:', data.error);
            }
          }).catch(err => console.error('Play reward error:', err));
        });
      }
    }
  }, [progress, duration, isPlaying, currentTrack, rewardPoint, hasRewarded, addEcho, equities, addDividends]);

  if (!currentTrack) return null;

  return (
    <>
      {/* Player In-app Toast — replaces all alert() calls */}
      {playerToast.show && (
        <div className={`fixed bottom-[90px] lg:bottom-6 left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl border backdrop-blur-xl transition-all animate-in fade-in slide-in-from-bottom-4 flex items-center gap-2 max-w-sm pointer-events-none ${
          playerToast.type === 'success' ? 'bg-emerald-950/95 border-emerald-500/30 text-emerald-300' :
          playerToast.type === 'error' ? 'bg-rose-950/95 border-rose-500/30 text-rose-300' :
          'bg-blue-950/95 border-blue-500/30 text-blue-300'
        }`}>
          {playerToast.message}
        </div>
      )}

      {/* Inline Download Confirmation — replaces window.confirm() */}
      {isConfirmDownload && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 pointer-events-auto">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsConfirmDownload(false)} />
          <div className="relative w-full max-w-xs bg-[#0d0e15] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="text-center">
              <p className="text-white font-black text-base">{t('player.confirm_download')}</p>
              <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">{t('player.download_cost_desc').replace('{title}', currentTrack.title)}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsConfirmDownload(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs font-bold hover:bg-white/10 transition-all">{t('common.cancel')}</button>
              <button onClick={handleDownloadConfirmed} className="flex-1 py-2.5 rounded-xl bg-echo-primary text-black text-xs font-black hover:opacity-90 transition-all">{t('common.confirm')}</button>
            </div>
          </div>
        </div>
      )}

      <audio
        ref={audioRef}
        src={currentTrack.src}
        onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => {
          if (playNext) {
            playNext();
          } else {
            pause();
          }
        }}
        preload="metadata"
      />

      {/* Mini Player Panel */}
      <div
        className={`fixed left-0 right-0 z-50 transition-all duration-500 ease-in-out ${showPlayer && !isFullScreen ? 'bottom-[80px] lg:bottom-0 opacity-100' : '-bottom-32 opacity-0 pointer-events-none'
          } px-4 md:px-0 cursor-pointer`}
        onClick={(e) => {
          // 仅在点击背景时展开全屏，防止点击按钮时误触
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.clickable-area')) {
            toggleFullScreen();
          }
        }}
      >
        <div className="clickable-area max-w-7xl mx-auto glass-panel rounded-2xl p-4 flex items-center justify-between border-t border-echo-primary/30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-4 flex-1 overflow-hidden">
            <div className={`w-12 h-12 rounded-full overflow-hidden border-2 border-echo-primary/50 ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}>
              <img src={currentTrack.cover} alt="Cover" className="w-full h-full object-cover pointer-events-none" />
            </div>
            <div className="truncate flex-1">
              <h4 className="font-bold text-white text-sm truncate pointer-events-none">{currentTrack.title}</h4>
              <p className="text-xs text-echo-primary font-medium pointer-events-none">{currentTrack.artist}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-gray-400 mr-4">
              <span className="text-echo-secondary animate-pulse">⛏ {t('player.mining')}</span>
              <span>({t('player.mining_rate_desc')})</span>
            </div>

            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); playNext(); }}
              className="w-10 h-10 rounded-full hover:bg-white/10 hidden sm:flex items-center justify-center transition-colors text-white"
            >
              <SkipForward className="w-5 h-5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); togglePlayerPanel(); }} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Full Screen Player Modal */}
      <div
        className={`fixed inset-0 z-[100] bg-[#030303] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${isFullScreen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
          } flex flex-col overflow-hidden`}
      >
        <div className="flex-1 flex flex-col px-6 py-8 overflow-y-auto scrollbar-hide">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={toggleFullScreen}
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <ChevronDown className="w-6 h-6 text-white" />
            </button>
            <div className="text-center">
              <h2 className="text-sm font-bold text-white truncate max-w-[200px]">{currentTrack.title}</h2>
              <p className="text-[10px] text-echo-primary font-medium tracking-widest truncate max-w-[200px]">{currentTrack.artist}</p>
            </div>
            <div className="w-10"></div>
          </div>

          {/* Lyrics / Visualizer Area */}
          <div className="flex-1 w-full max-w-5xl mx-auto flex flex-col items-center justify-center overflow-hidden py-4">
            {currentTrack.lyrics ? (
              /* Widescreen side-by-side or mobile flip-to-toggle */
              <div className="w-full h-full lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">

                {/* Left Panel: Album Cover (Visible on desktop; toggled on mobile) */}
                <div className={`flex flex-col items-center justify-center w-full ${!isLyricsView ? 'flex animate-in fade-in zoom-in-95 duration-300' : 'hidden lg:flex'}`}>
                  <div
                    onClick={() => setIsLyricsView(true)}
                    className="relative w-64 h-64 md:w-80 md:h-80 xl:w-96 xl:h-96 rounded-full overflow-hidden shadow-[0_0_50px_rgba(0,240,255,0.25)] group border-4 border-white/5 p-2 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                    title={t('player.view_lyrics')}
                  >
                    <div className={`w-full h-full rounded-full overflow-hidden animate-spin-slow ${isPlaying ? '' : 'pause-animation'}`}>
                      <img
                        src={currentTrack.cover}
                        alt="Cover"
                        className="w-full h-full object-cover pointer-events-none"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 border border-white/10">
                        <Music className="w-3.5 h-3.5 text-echo-primary" />
                        {t('player.view_lyrics')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Panel: Scrolling Lyrics (Visible on desktop; toggled on mobile) */}
                <div className={`w-full flex-col items-center ${isLyricsView ? 'flex animate-in fade-in zoom-in-95 duration-300' : 'hidden lg:flex'}`}>
                  {/* On Mobile: Header to toggle back to cover */}
                  <div className="w-full flex justify-between items-center px-6 lg:hidden mb-2">
                    <span className="text-[10px] text-echo-primary font-bold uppercase tracking-widest flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-echo-primary animate-ping"></span>
                      {t('player.lyrics_synced')}
                    </span>
                    <button
                      onClick={() => setIsLyricsView(false)}
                      className="text-[10px] text-white/70 hover:text-white bg-white/5 px-2.5 py-1 rounded-full border border-white/10 transition-all active:scale-95 cursor-pointer font-bold"
                    >
                      {t('player.back_to_cover')}
                    </button>
                  </div>

                  {/* 滚动歌词区域 */}
                  <div
                    ref={lyricsContainerRef}
                    className="w-full text-center space-y-3 overflow-y-auto max-h-[50vh] lg:max-h-[60vh] custom-scrollbar mask-fade-edges px-6 py-16 relative select-none touch-pan-y"
                    style={{
                      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, white 15%, white 85%, transparent 100%)',
                      maskImage: 'linear-gradient(to bottom, transparent 0%, white 15%, white 85%, transparent 100%)'
                    }}
                  >
                    {parsedLyrics.map((line, idx) => {
                      const isPlainText = parsedLyrics.length > 0 && parsedLyrics[0].time === -99;
                      const isActive = !isPlainText && idx === activeLineIndex;
                      
                      return (
                        <p
                          key={idx}
                          data-lyric-index={idx}
                          className={`text-lg md:text-2xl lg:text-3xl font-bold transition-all duration-300 transform leading-relaxed py-1 ${
                            isPlainText
                              ? 'text-white/80 hover:text-white scale-95 cursor-default'
                              : isActive
                                ? 'text-echo-primary font-black scale-105 filter drop-shadow-[0_0_15px_rgba(0,240,255,0.45)] cursor-default'
                                : 'text-white/20 hover:text-white/40 scale-95 cursor-default'
                          }`}
                        >
                          {line.text}
                        </p>
                      );
                    })}
                  </div>
                </div>

              </div>
            ) : (
              /* No lyrics visualizer fallback (Just large cover) */
              <div className="flex flex-col items-center gap-12">
                <div className="relative w-64 h-64 md:w-96 md:h-96 rounded-full overflow-hidden shadow-[0_0_50px_rgba(0,240,255,0.2)] group border-4 border-white/5 p-2">
                  <div className={`w-full h-full rounded-full overflow-hidden animate-spin-slow ${isPlaying ? '' : 'pause-animation'}`}>
                    <img
                      src={currentTrack.cover}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Fixed Controls Area (Bottom) */}
        <div className="bg-gradient-to-t from-[#030303] via-[#030303]/95 to-transparent px-6 pt-10 pb-10 mt-auto relative z-20">
          {/* Social Interaction Action Row (Compact & Anchored at Bottom) */}
          <div className="w-full max-w-sm mx-auto mt-4 mb-2 flex justify-around items-center border-b border-white/5 pb-2 relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* 1. Like Button */}
            <button
              onClick={handleLikeToggle}
              className={`flex flex-col items-center gap-1 transition-all active:scale-95 group cursor-pointer ${isLiked ? 'text-red-500' : 'text-gray-500 hover:text-white'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/5 group-hover:bg-white/10 group-hover:border-white/10 transition-all ${isLiked ? 'bg-red-500/10 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : ''}`}>
                <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
              </div>
              <span className="text-[8px] uppercase font-bold tracking-widest font-mono">{t('player.like')} {likeCount > 0 ? `(${likeCount})` : ''}</span>
            </button>

            {/* 2. Co-creation Button */}
            <button
              onClick={() => {
                if (ipoData?.is_ipo_active) {
                  setIsPurchaseModalOpen(true);
                } else {
                  window.location.href = '/market';
                }
              }}
              className={`flex flex-col items-center gap-1 transition-all active:scale-95 group cursor-pointer ${(localCoCreated || equities.some(e => e.id === currentTrack?.id && e.shares > 0))
                ? 'text-echo-primary'
                : ipoData?.is_ipo_active
                  ? 'text-gray-500 hover:text-white'
                  : 'text-gray-600 cursor-not-allowed'
                }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/5 group-hover:bg-white/10 group-hover:border-white/10 transition-all ${(localCoCreated || equities.some(e => e.id === currentTrack?.id && e.shares > 0))
                ? 'bg-echo-primary/10 border-echo-primary/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]'
                : ipoData?.is_ipo_active
                  ? 'animate-pulse'
                  : ''
                }`}>
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <span className="text-[8px] uppercase font-bold tracking-widest font-mono">{t('player.co_creation')}</span>
            </button>

            {/* 3. Comment Button */}
            <button
              onClick={() => setIsCommentsOpen(true)}
              className={`flex flex-col items-center gap-1 transition-all active:scale-95 group cursor-pointer ${hasCommented ? 'text-echo-secondary' : 'text-gray-500 hover:text-white'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/5 group-hover:bg-white/10 group-hover:border-white/10 transition-all ${hasCommented ? 'bg-echo-secondary/10 border-echo-secondary/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : ''}`}>
                <MessageCircle className="w-3.5 h-3.5" />
              </div>
              <span className="text-[8px] uppercase font-bold tracking-widest font-mono">{t('player.comments')} {comments.length > 0 ? `(${comments.length})` : ''}</span>
            </button>

            {/* 4. Download Button */}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className={`flex flex-col items-center gap-1 transition-all active:scale-95 group cursor-pointer ${isDownloading ? 'opacity-50 cursor-not-allowed' : 'text-gray-500 hover:text-white'}`}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/5 group-hover:bg-white/10 group-hover:border-white/10 transition-all">
                {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />}
              </div>
              <span className="text-[8px] uppercase font-bold tracking-widest font-mono">{t('player.download')}</span>
            </button>
            {/* 5. Share Button */}
            <button
              onClick={handleShare}
              className="flex flex-col items-center gap-1 transition-all active:scale-95 group cursor-pointer text-gray-500 hover:text-white"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/5 group-hover:bg-white/10 group-hover:border-white/10 transition-all">
                <Share2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-[8px] uppercase font-bold tracking-widest font-mono">{t('player.share')}</span>
            </button>
            {/* 6. Favorite Button */}
            <button
              onClick={handleFavoriteToggle}
              className={`flex flex-col items-center gap-1 transition-all active:scale-95 group cursor-pointer ${isFavorited ? 'text-yellow-500' : 'text-gray-500 hover:text-white'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/5 group-hover:bg-white/10 group-hover:border-white/10 transition-all ${isFavorited ? 'bg-yellow-500/10 border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : ''}`}>
                <Bookmark className={`w-3.5 h-3.5 ${isFavorited ? 'fill-current' : ''}`} />
              </div>
              <span className="text-[8px] uppercase font-bold tracking-widest font-mono">{t('player.favorite')}</span>
            </button>

            {/* 7. Add to Playlist Button */}
            <button
              onClick={() => setIsAddToPlaylistOpen(true)}
              className="flex flex-col items-center gap-1 transition-all active:scale-95 group cursor-pointer text-gray-500 hover:text-white"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/5 group-hover:bg-white/10 group-hover:border-white/10 transition-all hover:border-echo-primary/30">
                <FolderPlus className="w-3.5 h-3.5 text-echo-primary" />
              </div>
              <span className="text-[8px] uppercase font-bold tracking-widest font-mono">{t('player.add_to_playlist')}</span>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-md mx-auto mt-4 mb-4">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={progress}
              onChange={handleSeek}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-echo-primary transition-all"
              style={{
                backgroundImage: `linear-gradient(to right, var(--echo-primary) ${(progress / (duration || 1)) * 100}%, transparent 0)`
              }}
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-2 font-mono">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-between max-w-md mx-auto w-full px-6">
            <button className="text-gray-500 hover:text-white transition-colors"><Shuffle className="w-4 h-4" /></button>
            <div className="flex items-center justify-center gap-6">
              <button onClick={() => { console.log('SkipBack button clicked'); playPrev(); }} className="text-gray-300 hover:text-white transition-colors"><SkipBack className="w-6 h-6" /></button>
              <button
                onClick={togglePlay}
                className="w-14 h-14 rounded-full bg-gradient-to-tr from-echo-primary to-echo-secondary flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:scale-105 active:scale-95 transition-all text-black"
              >
                {isPlaying ? <Pause className="w-6 h-6 fill-black" /> : <Play className="w-6 h-6 fill-black ml-0.5" />}
              </button>
              <button onClick={() => { console.log('SkipForward button clicked'); playNext(); }} className="text-gray-300 hover:text-white transition-colors"><SkipForward className="w-6 h-6" /></button>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-gray-500 hover:text-white transition-colors"><Repeat className="w-4 h-4" /></button>
              <button 
                onClick={() => setIsQueueOpen(true)} 
                className={`transition-colors relative ${isQueueOpen ? 'text-echo-primary' : 'text-gray-500 hover:text-white'}`}
                title={t('player.play_queue')}
              >
                <ListMusic className="w-5 h-5" />
                {playlist.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-echo-primary text-black font-black text-[8px] w-4 h-4 rounded-full flex items-center justify-center border border-black animate-pulse">
                    {playlist.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Slide-Up Comments Drawer */}
        {isCommentsOpen && (
          <div className="absolute inset-x-0 bottom-0 z-50 bg-black/95 border-t border-white/10 rounded-t-[32px] p-6 max-h-[70vh] flex flex-col shadow-[0_-15px_40px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 cursor-pointer" onClick={() => setIsCommentsOpen(false)} />

            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4 shrink-0">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">{t('player.reviews_title')} ({comments.length})</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Listener & Co-creator Reviews</p>
              </div>
              <button
                onClick={() => setIsCommentsOpen(false)}
                className="py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                {t('player.collapse')}
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4 scrollbar-hide">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 bg-white/5 border border-white/5 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <img src={comment.avatar} alt={comment.author} className="w-9 h-9 rounded-full bg-white/10 border border-white/5 object-cover shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-xs font-bold">{comment.author}</span>
                        {comment.author.includes('共创') && (
                          <span className="text-[9px] bg-echo-primary/10 border border-echo-primary/20 text-echo-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider scale-90">
                            {t('player.co_creator')}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-gray-500 font-mono">{comment.time}</span>
                    </div>
                    <p className="text-gray-300 text-xs leading-relaxed font-mono">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Box */}
            <form onSubmit={handleAddComment} className="pt-4 border-t border-white/5 flex gap-3 shrink-0">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={t('player.comment_placeholder')}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-xs focus:border-echo-primary/50 focus:outline-none placeholder-gray-600"
              />
              <button
                type="submit"
                className="bg-echo-primary hover:bg-echo-primary/90 text-black font-black px-6 rounded-xl text-xs uppercase transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
              >
                {t('player.comment_submit')}
              </button>
            </form>
          </div>
        )}

        {/* Slide-Up Play Queue Drawer */}
        {isQueueOpen && (
          <div className="absolute inset-x-0 bottom-0 z-50 bg-[#09090c]/98 border-t border-white/10 rounded-t-[32px] p-6 max-h-[70vh] flex flex-col shadow-[0_-15px_40px_rgba(0,0,0,0.9)] animate-in slide-in-from-bottom duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 cursor-pointer" onClick={() => setIsQueueOpen(false)} />

            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4 shrink-0">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">{t('player.current_queue')} ({playlist.length})</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">ECHORURA Active Play Queue</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (window.confirm(t('player.clear_queue_confirm'))) {
                      clearQueue();
                      setIsQueueOpen(false);
                    }
                  }}
                  className="py-1.5 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-bold text-red-400 transition-colors cursor-pointer"
                >
                  {t('player.clear_queue')}
                </button>
                <button
                  onClick={() => setIsQueueOpen(false)}
                  className="py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  {t('player.collapse')}
                </button>
              </div>
            </div>

            {/* Play Queue List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-4 scrollbar-hide">
              {playlist.length === 0 ? (
                <div className="text-center py-20 text-gray-500 text-xs font-bold">
                  {t('player.queue_empty')}
                </div>
              ) : (
                playlist.map((track, idx) => {
                  const isActive = currentTrack?.id === track.id;
                  return (
                    <div 
                      key={track.id} 
                      onClick={() => playSong(track, playlist)}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-echo-primary/10 border-echo-primary/30 shadow-[0_0_15px_rgba(0,240,255,0.05)]' 
                          : 'bg-white/5 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden flex-1">
                        <span className={`text-[10px] font-mono w-4 text-center ${isActive ? 'text-echo-primary font-bold animate-pulse' : 'text-gray-600'}`}>
                          {isActive ? '▶' : idx + 1}
                        </span>
                        <img src={track.cover} alt={track.title} className="w-10 h-10 rounded-xl object-cover shrink-0 bg-white/10" />
                        <div className="truncate flex-1">
                          <p className={`text-xs font-bold truncate ${isActive ? 'text-echo-primary' : 'text-white'}`}>{track.title}</p>
                          <p className={`text-[10px] truncate ${isActive ? 'text-echo-primary/80' : 'text-gray-500'}`}>{track.artist}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => removeFromQueue(track.id)}
                          className="w-8 h-8 rounded-xl hover:bg-white/5 flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors"
                          title={t('player.remove_from_queue')}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Co-creation Slider Purchase Modal */}
        {isPurchaseModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="relative w-full max-w-md glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl bg-[#09090c]/95 overflow-hidden">
              {/* Ambient Glow */}
              <div className="absolute -top-20 -right-20 w-48 h-48 bg-echo-primary/10 rounded-full blur-[60px] pointer-events-none"></div>

              <div className="space-y-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-echo-primary/10 border border-echo-primary/30 flex items-center justify-center text-echo-primary shrink-0">
                    <TrendingUp className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                      {t('player.purchase_equity_title').replace('{equityName}', t('compliance.equity_' + activeConfig.region.toLowerCase()))}
                    </h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Co-creation Share Purchase</p>
                  </div>
                </div>

                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">{t('player.current_song')}</span>
                    <span className="text-white font-bold">{currentTrack.title}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">{t('player.ipo_percentage_label')}</span>
                    <span className="text-echo-secondary font-bold font-mono">
                      {ipoData?.ipo_percentage || currentTrack?.ipo_percentage || 50}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">{t('player.remaining_shares_label')}</span>
                    <span className="text-white font-bold font-mono">
                      {ipoData?.remaining_shares ?? currentTrack?.remaining_shares ?? 100} / {ipoData?.total_shares ?? currentTrack?.total_shares ?? 100} {t('player.shares_unit')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-2 border-t border-white/5">
                    <span className="text-gray-400">{t('player.price_per_share')} (Price per Share)</span>
                    <span className="text-echo-primary font-black font-mono">1.00 ECHO / {t('player.share_item')}</span>
                  </div>
                </div>

                {/* Slider */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-bold">{t('player.shares_to_buy')} (Shares to Buy)</span>
                    <span className="text-echo-primary text-xl font-black font-mono">{purchaseShares} {t('player.shares_unit')}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max={ipoData?.remaining_shares ?? currentTrack?.remaining_shares ?? 100}
                    value={purchaseShares}
                    onChange={(e) => setPurchaseShares(Number(e.target.value))}
                    className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-echo-primary transition-all cursor-pointer"
                    style={{
                      backgroundImage: `linear-gradient(to right, var(--echo-primary) ${((purchaseShares - 1) / ((ipoData?.remaining_shares ?? currentTrack?.remaining_shares ?? 100) - 1 || 1)) * 100}%, transparent 0)`
                    }}
                  />
                  <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                    <span>1 {t('player.shares_unit')}</span>
                    <span>{t('player.max_label')} {ipoData?.remaining_shares ?? currentTrack?.remaining_shares ?? 100} {t('player.shares_unit')}</span>
                  </div>
                </div>

                {/* Costs & Dynamic Rewards */}
                <div className="p-4 bg-echo-primary/5 border border-echo-primary/10 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-bold">{t('player.total_cost')} (Total Cost)</span>
                    <span className="text-echo-primary font-black font-mono">
                      {purchaseShares.toFixed(2)} {t('compliance.token_' + activeConfig.region.toLowerCase())}
                    </span>
                  </div>
                  <p 
                    className="text-[10px] text-gray-500 leading-relaxed pt-1.5 border-t border-white/5 font-mono"
                    dangerouslySetInnerHTML={{
                      __html: t('player.co_creation_cost_estimate').replace(
                        '{percentage}', 
                        ((purchaseShares / (ipoData?.total_shares ?? currentTrack?.total_shares ?? 100)) * (ipoData?.ipo_percentage || currentTrack?.ipo_percentage || 50)).toFixed(2)
                      )
                    }}
                  />
                </div>

                {/* Payment Mode Toggle */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPlayerPaymentMode('balance')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                      playerPaymentMode === 'balance'
                        ? 'bg-echo-primary/20 border-echo-primary/50 text-echo-primary'
                        : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'
                    }`}
                  >
                    平台余额
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayerPaymentMode('onchain')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1 ${
                      playerPaymentMode === 'onchain'
                        ? 'bg-blue-500/20 border-blue-400/50 text-blue-400'
                        : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'
                    }`}
                  >
                    <Wallet2 className="w-3 h-3" />
                    {isConnected ? `链上 (${connectedAddress?.slice(0,4)}...${connectedAddress?.slice(-3)})` : '链上钱包'}
                  </button>
                </div>

                {/* Buttons */}
                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPurchaseModalOpen(false)}
                    disabled={isInvesting}
                    className="flex-1 py-3.5 rounded-2xl bg-white/5 text-gray-400 hover:bg-white/10 text-xs font-bold transition-all cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={isInvesting}
                    onClick={() => handleInvestShares(purchaseShares)}
                    className={`flex-1 py-3.5 rounded-2xl text-xs font-black uppercase transition-all shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                      playerPaymentMode === 'onchain'
                        ? 'bg-blue-500 hover:bg-blue-400 text-white'
                        : 'bg-echo-primary hover:bg-echo-primary/95 text-black'
                    }`}
                  >
                    {isInvesting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />{t('player.transferring')}</>
                    ) : (
                      playerPaymentMode === 'onchain' ? '🔗 链上认购' : t('player.confirm_purchase')
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add to Playlist Modal */}
        {isAddToPlaylistOpen && (
          <AddToPlaylistModal
            songId={currentTrack.id}
            songTitle={currentTrack.title}
            onClose={() => setIsAddToPlaylistOpen(false)}
          />
        )}

        {/* Playlist Detail Modal */}
        {globalPlaylistId && (
          <PlaylistDetailModal
            playlistId={globalPlaylistId}
            onClose={() => setGlobalPlaylistId(null)}
          />
        )}
      </div>
    </>
  );
}
