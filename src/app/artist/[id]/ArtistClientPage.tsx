'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { usePlayerStore } from '@/store/playerStore';
import { Play, Sparkles, Music, UserPlus, UserMinus, ChevronLeft, Share2 } from 'lucide-react';
import Link from 'next/link';

interface ArtistClientPageProps {
  id: string;
}

export default function ArtistClientPage({ id }: ArtistClientPageProps) {
  const supabase = createClient();
  const { playSong } = usePlayerStore();
  
  const [artist, setArtist] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user) {
        setCurrentUserPhone(user.phone || null);
      }
      
      if (id) {
        await Promise.all([
          fetchArtistData(id),
          fetchArtistSongs(id),
          fetchFollowersData(id, user?.id)
        ]);
      }
      setLoading(false);
    };
    init();
  }, [id]);

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

  const handleShareArtist = async () => {
    if (!artist) return;
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.echora.cn';
    let shareUrl = `${origin}/artist/${id}`;
    if (currentUserPhone) {
      shareUrl += `?ref=${currentUserPhone}`;
    }

    const shareTitle = `【极声音乐 ECHORURA】`;
    const shareText = `欢迎来到我的极声音乐主页！在这里可以聆听我的所有原创音乐作品，认购我发行的作品股权参与版税共创分红，听歌还能直接挖矿！快点击我的`;
    
    const plainText = `${shareTitle}\n${shareText}创作者公开空间：${shareUrl}`;
    const htmlText = `<p>${shareTitle}<br>${shareText}<a href="${shareUrl}">创作者公开空间</a>。</p>`;

    try {
      if (navigator.share && isMobile) {
        await navigator.share({
          title: shareTitle,
          text: `${shareText}创作者公开空间。`,
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
          alert('📋 创作者空间推广卡片已成功复制！当您将内容粘贴 to 微信、微博或支持富文本的平台时，链接已完美隐藏在“创作者公开空间”字样中！');
        } else {
          copyTextFallback(plainText);
          alert('📋 创作者空间推广卡片与链接已成功复制到剪贴板！');
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
        alert('📋 创作者分享链接已成功复制到剪贴板！');
      } catch (e) {
        copyTextFallback(plainText);
        alert('📋 创作者分享链接已复制到剪贴板！');
      }
    }
  };

  const fetchArtistData = async (artistId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', artistId)
      .single();
    if (data) setArtist(data);
  };

  const fetchArtistSongs = async (artistId: string) => {
    const { data: songsData } = await supabase
      .from('songs')
      .select('*')
      .eq('creator_id', artistId)
      .order('created_at', { ascending: false });
      
    if (songsData && songsData.length > 0) {
      const songIds = songsData.map(s => s.id);
      const { data: txsData } = await supabase
        .from('transactions')
        .select('song_id')
        .eq('type', 'listen_reward')
        .in('song_id', songIds);
        
      const playCounts: { [key: number]: number } = {};
      txsData?.forEach(tx => {
        if (tx.song_id) {
          playCounts[tx.song_id] = (playCounts[tx.song_id] || 0) + 1;
        }
      });
      
      const songsWithCounts = songsData.map(song => ({
        ...song,
        play_count: playCounts[song.id] || 0
      }));
      setSongs(songsWithCounts);
    } else if (songsData) {
      setSongs([]);
    }
  };

  const fetchFollowersData = async (artistId: string, currentUserId?: string) => {
    // 获取总粉丝数
    const { count } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', artistId);
    
    setFollowersCount(count || 0);

    // 检查当前用户是否已关注
    if (currentUserId) {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', artistId)
        .single();
      
      setIsFollowing(!!data);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser) {
      alert('请先登录即可关注创作者');
      return;
    }
    if (currentUser.id === id) {
      alert('无法关注自己哦');
      return;
    }

    setActionLoading(true);
    try {
      if (isFollowing) {
        // 取消关注
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', id);
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
      } else {
        // 关注
        await supabase
          .from('follows')
          .insert({
            follower_id: currentUser.id,
            following_id: id
          });
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    } catch (err: any) {
      alert('操作失败: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-echo-primary/30 border-t-echo-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl text-white font-bold">未找到该创作者</h2>
        <Link href="/discover" className="text-echo-primary mt-4 inline-block">返回发现页</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Link href="/community" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-bold">
        <ChevronLeft className="w-4 h-4" /> 返回社区
      </Link>

      {/* 艺人信息大看板 */}
      <div className="relative rounded-[2rem] overflow-hidden glass-panel border border-white/10 p-8 md:p-12 mt-4">
        <div className="absolute inset-0 bg-gradient-to-br from-echo-primary/10 to-transparent pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row items-center md:items-start gap-8">
          <div className="w-32 h-32 md:w-40 md:h-40 shrink-0 rounded-full overflow-hidden border-4 border-black/50 shadow-[0_0_30px_rgba(0,240,255,0.2)]">
            <img src={artist.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aria'} alt="Artist Avatar" className="w-full h-full object-cover" />
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-2">
              {artist.display_name}
            </h1>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-4">
              <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                <Sparkles className="w-4 h-4 text-echo-primary" />
                <span className="text-xs font-bold text-gray-300">
                  <span className="text-white">{followersCount}</span> 关注者
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                <Music className="w-4 h-4 text-echo-primary" />
                <span className="text-xs font-bold text-gray-300">
                  <span className="text-white">{songs.length}</span> 作品
                </span>
              </div>
            </div>
            
            <p className="text-sm text-gray-400 max-w-2xl leading-relaxed">
              {artist.bio || '这个创作者很酷，但什么也没留下。'}
            </p>
          </div>
          
          <div className="shrink-0 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button 
              onClick={handleFollowToggle}
              disabled={actionLoading || currentUser?.id === id}
              className={`px-8 py-3 rounded-full font-black text-sm transition-all flex items-center justify-center gap-2 w-full sm:w-auto ${
                isFollowing 
                  ? 'bg-white/10 text-white hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/50 border border-transparent' 
                  : 'bg-echo-primary text-black hover:scale-105 shadow-[0_0_20px_rgba(0,240,255,0.4)]'
              } disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed`}
            >
              {isFollowing ? (
                <>
                  <UserMinus className="w-4 h-4" />
                  <span>已关注</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>关注 (Follow)</span>
                </>
              )}
            </button>
            <button
              onClick={handleShareArtist}
              className="px-8 py-3 rounded-full font-black text-sm transition-all flex items-center justify-center gap-2 w-full sm:w-auto bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 active:scale-95 shadow-md"
            >
              <Share2 className="w-4 h-4 text-echo-primary" />
              <span>分享创作者</span>
            </button>
          </div>
        </div>
      </div>

      {/* 作品列表 */}
      <div>
        <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2 mb-6">
          <Music className="w-5 h-5 text-echo-primary" />
          音乐作品 (Releases)
        </h2>
        
        <div className="grid grid-cols-1 gap-4">
          {songs.length > 0 ? songs.map((song) => (
            <div key={song.id} className="glass-panel p-4 rounded-2xl border border-white/5 flex items-center gap-4 hover:border-echo-primary/30 transition-all group">
              <div 
                className="w-16 h-16 rounded-xl overflow-hidden relative shrink-0 cursor-pointer"
                onClick={() => playSong(song)}
              >
                <img src={song.cover_url} alt="Cover" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Play className="w-6 h-6 text-white fill-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-bold truncate text-lg">{song.title}</h4>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                  <span>{new Date(song.created_at).toLocaleDateString()}</span>
                  {song.is_staked && (
                    <span className="bg-echo-secondary/20 text-echo-secondary px-1.5 py-0.5 rounded text-[8px] font-bold uppercase">
                      IPO 活跃
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right hidden sm:block shrink-0 px-4">
                <p className="text-xs text-gray-500 uppercase">收听</p>
                <p className="text-white font-bold font-mono">{song.play_count || 0}</p>
              </div>
            </div>
          )) : (
            <div className="text-center py-20 border border-dashed border-white/10 rounded-3xl">
              <p className="text-gray-500">暂无发布的音乐作品</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
