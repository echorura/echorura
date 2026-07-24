'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { MessageSquare, Users, TrendingUp, Send, ThumbsUp, Timer, CheckCircle2, Lock } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { useTranslation } from '@/store/languageStore';

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<'assembly' | 'square' | 'market'>('assembly');
  const [posts, setPosts] = useState<any[]>([]);
  const [ipoSongs, setIpoSongs] = useState<any[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [isReplying, setIsReplying] = useState<Record<string, boolean>>({});
  const { t } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('id', user.id)
          .single();
        if (profile) setUserProfile(profile);
      }
      fetchPosts();
      fetchIpoSongs();
    };
    init();
  }, []);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('community_posts')
      .select('*, creator:profiles(display_name, avatar_url), comments:community_comments(*, creator:profiles(display_name, avatar_url))')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[Community] fetchPosts error:', error.message);
    }
    if (data) {
      // 保证评论按时间先后顺序排列
      const sortedData = data.map(post => ({
        ...post,
        comments: (post.comments || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      }));
      setPosts(sortedData);
    }
    setLoading(false);
  };

  const fetchIpoSongs = async () => {
    const { data } = await supabase
      .from('songs')
      .select('*, creator:profiles(display_name, avatar_url)')
      .filter('ipo_percentage', 'gt', 0)
      .order('created_at', { ascending: false });
    if (data) setIpoSongs(data);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePostSubmit = async () => {
    if (!user) {
      router.push('/register');
      return;
    }
    if (!newPost.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    const { error } = await supabase.from('community_posts').insert({
      creator_id: user.id,
      content: newPost,
      type: activeTab === 'assembly' ? 'proposal' : 'social',
      likes: 0,
    });

    if (!error) {
      setNewPost('');
      await fetchPosts();
    } else {
      console.error('[Community Post Error]', error);
      alert(`❌ 发帖失败: ${error.message}\n\n请确认数据库中已创建 community_posts 表（运行 sql/02_community_posts.sql）`);
    }
    setIsSubmitting(false);
  };

  const handleLike = async (post: any) => {
    const postId = String(post.id);
    const isLiked = likedPosts.has(postId);
    const delta = isLiked ? -1 : 1;
    const newLikes = Math.max(0, (post.likes || 0) + delta);

    // 先更新本地状态，给用户即时反馈
    setLikedPosts(prev => {
      const next = new Set(prev);
      if (isLiked) { next.delete(postId); } else { next.add(postId); }
      return next;
    });
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: newLikes } : p));

    // 异步将点赞数写入数据库
    const { error } = await supabase
      .from('community_posts')
      .update({ likes: newLikes })
      .eq('id', post.id);

    if (error) {
      // 回滚本地状态
      console.error('[Like Error]', error.message);
      setLikedPosts(prev => {
        const next = new Set(prev);
        if (isLiked) { next.add(postId); } else { next.delete(postId); }
        return next;
      });
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: post.likes } : p));
    }
  };

  const toggleComments = (postId: string) => {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) { next.delete(postId); } else { next.add(postId); }
      return next;
    });
  };

  const handleReplySubmit = async (postId: string) => {
    if (!user) {
      router.push('/register');
      return;
    }
    const content = replyInputs[postId];
    if (!content?.trim() || isReplying[postId]) return;
    
    setIsReplying(prev => ({ ...prev, [postId]: true }));
    const { error } = await supabase.from('community_comments').insert({
      post_id: parseInt(postId),
      creator_id: user.id,
      content: content.trim(),
    });

    if (!error) {
      setReplyInputs(prev => ({ ...prev, [postId]: '' }));
      await fetchPosts();
    } else {
      console.error('[Reply Error]', error);
      alert(`❌ 回复失败: ${error.message}\n请确保已运行 sql/03_community_comments.sql`);
    }
    setIsReplying(prev => ({ ...prev, [postId]: false }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 px-4">
      {/* Header & Tabs */}
      <section className="text-center space-y-4 pt-8">
        <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic flex items-center justify-center gap-3">
          <Users className="w-10 h-10 text-echo-primary" />
          {t('community.title')}
        </h1>
        <p className="text-gray-500 text-sm max-w-md mx-auto">{t('community.desc')}</p>
        
        <div className="flex justify-center mt-8">
          <div className="bg-white/5 p-1.5 rounded-2xl border border-white/5 flex gap-2 backdrop-blur-xl">
            {[
              { id: 'assembly', label: t('community.assembly'), icon: MessageSquare },
              { id: 'square', label: t('community.square'), icon: Send },
              { id: 'market', label: t('community.market'), icon: TrendingUp },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'market') {
                    router.push('/market');
                  } else {
                    setActiveTab(tab.id as any);
                  }
                }}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id 
                  ? 'bg-echo-primary text-black shadow-[0_0_20px_rgba(0,240,255,0.3)]' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Input Area (Only for Assembly & Square) */}
      {activeTab !== 'market' && (
        <section className="glass-panel p-6 rounded-3xl border border-echo-primary/20 bg-gradient-to-br from-echo-primary/5 to-transparent">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-gray-800 border border-white/10 shrink-0 overflow-hidden">
              {userProfile?.avatar_url
                ? <img src={userProfile.avatar_url} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs font-bold">{userProfile?.display_name?.[0] || '?'}</div>
              }
            </div>
            <div className="flex-1 space-y-4 min-w-0">
              <textarea 
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder={user ? (activeTab === 'assembly' ? t('community.placeholder_assembly') : t('community.placeholder_square')) : t('community.login_placeholder')}
                className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-gray-600 resize-none py-2 min-w-0"
                rows={3}
                readOnly={!user}
              />
              <div className="flex justify-between items-center pt-4 border-t border-white/5">
                <span className="text-[10px] text-gray-500 font-mono uppercase">
                  {user ? 'Markdown Supported' : t('community.login_only')}
                </span>
                <button 
                  type="button"
                  onClick={handlePostSubmit}
                  disabled={isSubmitting || !newPost.trim()}
                  className={`bg-echo-primary text-black px-6 py-2 rounded-full text-xs font-black transition-all ${
                    (isSubmitting || !newPost.trim()) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
                  }`}
                >
                  {isSubmitting ? t('community.publishing') : user ? t('community.publish') : t('community.login_btn')}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Content Feed */}
      <div className="space-y-6">
        {activeTab === 'market' ? (
          /* IPO Market View */
          <div className="grid grid-cols-1 gap-4">
            {ipoSongs.map((song) => {
              const progress = ((song.total_shares - song.remaining_shares) / song.total_shares) * 100;
              const isSoldOut = song.remaining_shares === 0;
              return (
                <div key={song.id} className="glass-panel p-6 rounded-3xl border border-white/10 hover:border-echo-primary/30 transition-all flex flex-col md:flex-row items-center gap-6">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-2xl relative shrink-0">
                    <img src={song.cover_url} className="w-full h-full object-cover" />
                    {isSoldOut && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <CheckCircle2 className="text-echo-secondary w-10 h-10" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-3 text-center md:text-left">
                    <div>
                      <h3 className="text-lg font-black text-white uppercase">{song.title}</h3>
                      <p className="text-echo-primary text-xs font-mono">By {song.creator?.display_name || song.artist}</p>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ${isSoldOut ? 'bg-echo-secondary' : 'bg-echo-primary'}`} style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                      <span>{t('community.ipo_progress')} {progress.toFixed(1)}%</span>
                      <span>{isSoldOut ? t('market.sold_out') : `${t('community.shares_left_c')} ${song.remaining_shares}`}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-center gap-2">
                    <div className="text-xs font-black text-white">{song.ipo_percentage}{t('community.equity_sold')}</div>
                    {isSoldOut ? (
                      <div className="px-4 py-2 rounded-xl bg-echo-secondary/10 border border-echo-secondary/30 text-echo-secondary text-[10px] font-bold uppercase">{t('community.equity_distributed')}</div>
                    ) : (
                      <div className="px-4 py-2 rounded-xl bg-echo-primary/10 border border-echo-primary/30 text-echo-primary text-[10px] font-bold uppercase">{t('community.raising')}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Assembly & Square Feed */
          posts.filter(p => activeTab === 'assembly' ? p.type === 'proposal' : p.type === 'social').map((post) => (
            <div key={post.id} className="glass-panel p-6 rounded-3xl border border-white/5 hover:border-white/10 transition-all animate-in fade-in slide-in-from-bottom-4">
              <div className="flex gap-4">
                <img src={post.creator?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.creator_id}`} className="w-12 h-12 rounded-2xl object-cover border border-white/10" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-bold text-sm">{post.creator?.display_name || 'ECHORURA Citizen'}</h4>
                    <span className="text-[10px] text-gray-500 font-mono">{new Date(post.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  <div className="flex items-center gap-6 mt-6 pt-4 border-t border-white/5">
                    <button
                      onClick={() => handleLike(post)}
                      className={`flex items-center gap-2 transition-colors ${
                        likedPosts.has(String(post.id)) ? 'text-echo-primary' : 'text-gray-500 hover:text-echo-primary'
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span className="text-xs font-bold">{post.likes || 0}</span>
                    </button>
                    <button 
                      onClick={() => toggleComments(String(post.id))}
                      className="text-xs font-bold text-gray-600 hover:text-white transition-colors"
                    >
                      {t('community.reply')} {(post.comments?.length > 0) ? `(${post.comments.length})` : ''}
                    </button>
                  </div>

                  {/* 展开的评论区 */}
                  {expandedPosts.has(String(post.id)) && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-4 animate-in fade-in slide-in-from-top-2">
                      {/* 评论列表 */}
                      <div className="space-y-3">
                        {post.comments?.length > 0 ? post.comments.map((comment: any) => (
                          <div key={comment.id} className="flex gap-3 bg-black/20 p-3 rounded-2xl border border-white/5">
                            <img src={comment.creator?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.creator_id}`} className="w-8 h-8 rounded-xl object-cover border border-white/10 shrink-0" />
                            <div>
                              <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-white font-bold text-xs">{comment.creator?.display_name || 'ECHORURA Citizen'}</span>
                                <span className="text-[9px] text-gray-500 font-mono">{new Date(comment.created_at).toLocaleString()}</span>
                              </div>
                              <p className="text-gray-400 text-xs leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                            </div>
                          </div>
                        )) : (
                          <p className="text-center text-gray-500 text-xs py-3 italic">{t('community.no_comments')}</p>
                        )}
                      </div>
                      
                      {/* 回复输入框 */}
                      <div className="flex gap-3 items-end">
                        <div className="flex-1 bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:border-echo-primary/50 transition-colors">
                          <textarea 
                            value={replyInputs[post.id] || ''}
                            onChange={(e) => setReplyInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                            placeholder={user ? t('community.reply_placeholder') : t('community.reply_login')}
                            className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-gray-600 resize-none py-2.5 px-3 text-xs"
                            rows={1}
                            readOnly={!user}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleReplySubmit(String(post.id));
                              }
                            }}
                          />
                        </div>
                        <button
                          onClick={() => handleReplySubmit(String(post.id))}
                          disabled={isReplying[post.id] || !replyInputs[post.id]?.trim() || !user}
                          className="bg-echo-primary text-black px-4 py-2.5 rounded-xl text-xs font-black shrink-0 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all"
                        >
                          {isReplying[post.id] ? t('community.sending') : t('community.send')}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          ))
        )}

        {!loading && posts.length === 0 && activeTab !== 'market' && (
          <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
            <p className="text-gray-500 font-medium italic">{t('community.empty')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
