'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/utils/supabase/client';
import { compressAudioFile } from '@/utils/audioCompressor';
import TapSyncStudio from '@/components/studio/TapSyncStudio';
import PlaylistDetailModal from '@/components/player/PlaylistDetailModal';
import { usePlayerStore } from '@/store/playerStore';
import { activeConfig } from '@/utils/compliance';
import { useLanguageStore } from '@/store/languageStore';
import { useSearchParams } from 'next/navigation';
import { 
  Upload, 
  Music, 
  Image as ImageIcon, 
  DollarSign, 
  CheckCircle2, 
  Loader2, 
  Plus,
  Play,
  Heart,
  Settings,
  TrendingUp,
  Award,
  Sparkles,
  Info,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  Lock,
  ShieldAlert,
  Pencil,
  X,
  Palette,
  ChevronRight,
  Share2,
  Copy,
  Check,
  FolderPlus,
  Folder,
  Volume2
} from 'lucide-react';


// 客户端图片智能压缩优化：限制封面 500x500 像素，画质 0.8，转为小体积 JPG
const compressImage = (file: File, maxWidth = 500, maxHeight = 500, quality = 0.8): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};


function ProfileContent() {
  const { t } = useLanguageStore();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const tSafe = (key: string, fallback: string) => {
    if (!isMounted) return fallback;
    return t(key);
  };

  const renderHelpText = (key: string, fallback: string) => {
    let text = tSafe(key, fallback);
    text = text.replace(/{token}/g, tSafe('compliance.token_' + activeConfig.region.toLowerCase(), '积分'));
    text = text.replace(/{equity}/g, tSafe('compliance.equity_' + activeConfig.region.toLowerCase(), '版权股权'));
    text = text.replace(/{fiatRate}/g, activeConfig.fiatExchangeRateText);
    text = text.replace(/\n/g, '<br />');
    return text;
  };

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [mySongs, setMySongs] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const [arenaPhase, setArenaPhase] = useState<'day1' | 'day2' | 'day3'>('day2');
  
  // Tabs State
  const [activeTab, setActiveTab] = useState<'works' | 'favorites' | 'follows' | 'playlists'>('works');
  const [myFavorites, setMyFavorites] = useState<any[]>([]);
  const [myFollows, setMyFollows] = useState<any[]>([]);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  // Profile Edit State
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editBio, setEditBio] = useState('');

  // Account Deletion State
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deletionStep, setDeletionStep] = useState(0); // 0 = Asset warning, 1 = Agreements, 2 = Anim & complete
  const [deletionConfirmText, setDeletionConfirmText] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isEraseRunning, setIsEraseRunning] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState(0);

  // Help & About Modals State
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedArtistLink, setCopiedArtistLink] = useState(false);

  // Feedback Modal State
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);

  const handleCopyInviteCode = () => {
    const inviteCode = profile?.display_name || user?.email?.split('@')[0] || user?.phone || 'ECHORURA';
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackContent.trim()) {
      alert('请输入您的宝贵意见或问题反馈！');
      return;
    }

    setFeedbackSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('未获取到您的登录凭证，请重新登录后再试');
      }

      const displayName = profile?.display_name || user?.email?.split('@')[0] || user?.phone || 'ECHORURA_User';

      const response = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          username: displayName,
          content: feedbackContent.trim()
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `提交失败 (${response.status})`);
      }

      alert(`🎉 ${result.message || '反馈工单已成功递交！'}\n非常感谢您的支持，我们会尽快处理并与您取得联系。`);
      setFeedbackContent('');
      setIsFeedbackModalOpen(false);
    } catch (err: any) {
      alert(`❌ 提交反馈失败: ${err.message}`);
    } finally {
      setFeedbackSending(false);
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

  const handleShareMyArtistPage = async () => {
    if (!user) return;
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.echora.cn';
    const inviteCode = profile?.display_name || user?.email?.split('@')[0] || user?.phone || 'ECHORURA';
    const phoneNum = user?.phone || '';
    const rawPhone = phoneNum.replace('+86', '');
    
    // 创作者个人空间链接，带推荐参数
    let shareUrl = `${origin}/artist/${user.id}`;
    if (rawPhone || inviteCode) {
      shareUrl += `?ref=${rawPhone || inviteCode}`;
    }

    const shareTitle = `ECHORURA推荐 ${profile?.display_name || user?.email?.split('@')[0] || user?.phone || '创作者'}`;
    const shareText = `欢迎来到我的极声音乐主页！在这里可以聆听我的所有原创音乐作品，认购我发行的作品股权参与版税共创分红，听歌还能直接挖矿！快点击我的`;
    
    const plainText = `${shareTitle}\n${shareText}创作者公开空间：${shareUrl}`;
    const htmlText = `<p>${shareTitle}<br>${shareText}<a href="${shareUrl}">创作者公开空间</a>。</p>`;

    try {
      if (navigator.share && isMobile) {
        await navigator.share({
          title: shareTitle,
          text: `${shareText}创作者公开空间。`,
          url: shareUrl
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
          setCopiedArtistLink(true);
          setTimeout(() => setCopiedArtistLink(false), 2000);
          alert('📋 创作者空间推广卡片已成功复制！当您将内容粘贴到微信、微博或支持富文本的平台时，链接已完美隐藏在“创作者公开空间”字样中！');
        } else {
          copyTextFallback(plainText);
          setCopiedArtistLink(true);
          setTimeout(() => setCopiedArtistLink(false), 2000);
          alert('📋 创作者空间推广链接与文案已成功复制到剪贴板！');
        }
      }
    } catch (e) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(plainText);
        } else {
          copyTextFallback(plainText);
        }
        setCopiedArtistLink(true);
        setTimeout(() => setCopiedArtistLink(false), 2000);
        alert('📋 专属推广链接与文案已复制到剪贴板！');
      } catch (err) {
        copyTextFallback(plainText);
        setCopiedArtistLink(true);
        setTimeout(() => setCopiedArtistLink(false), 2000);
        alert('📋 专属推广链接已复制到剪贴板！');
      }
    }
  };

  const [activeFaqTab, setActiveFaqTab] = useState<'guide' | 'credits' | 'equity' | 'arena'>('guide');

  // Change Password State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [isIpoActive, setIsIpoActive] = useState(false);
  const [totalShares, setTotalShares] = useState(100);
  const [ipoPercentage, setIpoPercentage] = useState(50);
  const [pushToFollowers, setPushToFollowers] = useState(true);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  
  // Audio Compression State
  const [compressionState, setCompressionState] = useState<{
    progress: number;
    status: 'idle' | 'decoding' | 'converting' | 'encoding' | 'done' | 'error';
    message: string;
    originalSize?: number;
    compressedSize?: number;
  }>({
    progress: 0,
    status: 'idle',
    message: ''
  });
  const [isCompressing, setIsCompressing] = useState(false);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverSource, setCoverSource] = useState<'upload' | 'ai'>('upload');
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [aiStyle, setAiStyle] = useState<'cyber' | 'zen' | 'vaporwave' | 'ambient'>('cyber');
  const [aiPrompt, setAiPrompt] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  
  // Curation & Staking States
  const [uploadMode, setUploadMode] = useState<'regular' | 'stake'>('regular');
  const [uploadStep, setUploadStep] = useState(0);
  const [agreedToCreatorAgreement, setAgreedToCreatorAgreement] = useState(false);
  const [isCreatorAgreementOpen, setIsCreatorAgreementOpen] = useState(false);

  // ==================== SONG EDIT STATES ====================
  const [isEditingSong, setIsEditingSong] = useState(false);
  const [editingSong, setEditingSong] = useState<any>(null);
  const [editingSongArenaStatus, setEditingSongArenaStatus] = useState<'none' | 'pending' | 'voting' | 'winner' | 'loser'>('none');
  const [wantsToRegisterArenaInEdit, setWantsToRegisterArenaInEdit] = useState(false);
  const [isLoadingArenaStatus, setIsLoadingArenaStatus] = useState(false);
  const [editSongLyrics, setEditSongLyrics] = useState('');
  const [uploadLyricsMode, setUploadLyricsMode] = useState<'plain' | 'lrc'>('plain');
  const [editLyricsMode, setEditLyricsMode] = useState<'plain' | 'lrc'>('plain');
  
  // Tap-to-Sync Studio States
  const [isSyncStudioOpen, setIsSyncStudioOpen] = useState(false);
  const [syncAudioUrl, setSyncAudioUrl] = useState('');
  const [syncInitialText, setSyncInitialText] = useState('');
  const [syncMode, setSyncMode] = useState<'upload' | 'edit'>('upload');
  
  const [editSelectedGenres, setEditSelectedGenres] = useState<string[]>([]);
  const [editSelectedMoods, setEditSelectedMoods] = useState<string[]>([]);
  
  // Cover Editing
  const [editCoverSource, setEditCoverSource] = useState<'keep' | 'upload' | 'ai'>('keep');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreviewUrl, setEditCoverPreviewUrl] = useState('');
  
  // AI Cover Generation inside Edit Mode
  const [editAiPrompt, setEditAiPrompt] = useState('');
  const [editAiStyle, setEditAiStyle] = useState<'cyber' | 'zen' | 'vaporwave' | 'ambient'>('cyber');
  const [isGeneratingEditCover, setIsGeneratingEditCover] = useState(false);
  // Playlist creation state
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [newPlaylistCoverUrl, setNewPlaylistCoverUrl] = useState('');
  const [newPlaylistCoverFile, setNewPlaylistCoverFile] = useState<File | null>(null);
  const [newPlaylistCoverSource, setNewPlaylistCoverSource] = useState<'default' | 'upload' | 'ai'>('default');
  const [newPlaylistAiPrompt, setNewPlaylistAiPrompt] = useState('');
  const [newPlaylistAiStyle, setNewPlaylistAiStyle] = useState<'cyber' | 'zen' | 'vaporwave' | 'ambient'>('cyber');
  const [isGeneratingPlaylistCover, setIsGeneratingPlaylistCover] = useState(false);
  const [playlistLoading, setPlaylistLoading] = useState(false);


  const GENRES = ['流行', '嘻哈', 'R&B', '电子舞曲', '摇滚', 'K-Pop', '古典', '爵士', '民谣', '氛围放松', '影视原声', '国风', '二次元', '另类独立', '灵魂乐'];
  const MOODS = ['午夜', '孤独', '伤感', '治愈', '放松', '专注', '冥想', '助眠', '热血', '运动', '派对', '喜悦', '赛博'];

  const supabase = createClient();
  const { echoBalance, addEcho, spendEcho, setBalance, playSong } = usePlayerStore();

  const PRESET_AVATARS = [
    '/avatars/ghibli1.png',
    '/avatars/ghibli2.png',
    '/avatars/ghibli3.png',
    '/avatars/ghibli4.png',
    '/avatars/ghibli5.png',
    '/avatars/ghibli6.png',
    '/avatars/ghibli7.png',
  ];

  useEffect(() => {
    let activeUserId: string | null = null;
    const init = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError && (authError.message.includes('Refresh Token') || authError.message.includes('refresh_token'))) {
          console.warn('[Profile Page] Invalid refresh token detected, signing out to reset session.');
          await supabase.auth.signOut();
          window.location.reload();
          return;
        }

        if (user) {
          activeUserId = user.id;
          setUser(user);
          fetchProfile(user.id);
          fetchMySongs(user.id);
          fetchMyFavorites(user.id);
          fetchMyFollows(user.id);
          fetchMyPlaylists(user.id);
        }
      } catch (err) {
        console.error('[Profile Page] Exception in init:', err);
      }
    };
    init();

    if (typeof window !== 'undefined') {
      const savedPhase = localStorage.getItem('arena_phase');
      if (savedPhase) {
        setArenaPhase(savedPhase as any);
      }
    }

    const handlePlayCountUpdate = () => {
      if (activeUserId) {
        fetchMySongs(activeUserId);
        fetchMyFavorites(activeUserId);
        fetchMyPlaylists(activeUserId);
      }
    };

    window.addEventListener('play-count-updated', handlePlayCountUpdate);
    return () => {
      window.removeEventListener('play-count-updated', handlePlayCountUpdate);
    };
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'upload') {
      setIsUploading(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === 'playlists' && user?.id) {
      fetchMyPlaylists(user.id);
    }
  }, [activeTab, user]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) {
      setProfile(data);
      setEditName(data.display_name || '');
      setEditAvatar(data.avatar_url || '');
      setEditBio(data.bio || '');
    } else {
      const initialName = user?.email?.split('@')[0] || user?.phone || 'ECHORURA_User';
      const initialAvatar = PRESET_AVATARS[0];
      const { data: newProfile } = await supabase.from('profiles').insert({
        id: userId,
        display_name: initialName,
        avatar_url: initialAvatar
      }).select().single();
      if (newProfile) setProfile(newProfile);
    }
  };

  const fetchMySongs = async (userId: string) => {
    const { data: songsData } = await supabase
      .from('songs')
      .select('*')
      .eq('creator_id', userId)
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
      setMySongs(songsWithCounts);
    } else if (songsData) {
      setMySongs([]);
    }
  };

  const fetchEditingSongArenaStatus = async (songId: any) => {
    setIsLoadingArenaStatus(true);
    setEditingSongArenaStatus('none');
    setWantsToRegisterArenaInEdit(false);
    try {
      const { data, error } = await supabase
        .from('arena_registrations')
        .select('status')
        .eq('song_id', songId)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (!error && data && data.length > 0) {
        setEditingSongArenaStatus(data[0].status as any);
      }
    } catch (e) {
      console.error('[Arena status check failed]', e);
    } finally {
      setIsLoadingArenaStatus(false);
    }
  };

  const fetchMyFavorites = async (userId: string) => {
    const { data } = await supabase
      .from('user_favorites')
      .select('*, song:song_id(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (data) {
      const songsData = data.map(f => f.song).filter(Boolean);
      if (songsData.length > 0) {
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
        setMyFavorites(songsWithCounts);
      } else {
        setMyFavorites([]);
      }
    }
  };

  const fetchMyFollows = async (userId: string) => {
    const { data: followsData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false });

    if (followsData && followsData.length > 0) {
      const followingIds = followsData.map(f => f.following_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, bio')
        .in('id', followingIds);

      if (profilesData) {
        const orderedProfiles = followsData
          .map(f => profilesData.find(p => p.id === f.following_id))
          .filter(Boolean);
        setMyFollows(orderedProfiles);
      } else {
        setMyFollows([]);
      }
    } else {
      setMyFollows([]);
    }
  };

  const fetchMyPlaylists = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/playlists/list?type=mine`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        const result = await res.json();
        setMyPlaylists(result.data || []);
      }
    } catch (e) {
      console.error('[fetchMyPlaylists error]', e);
    }
  };

  const generateAICoverForPlaylist = () => {
    if (!newPlaylistName.trim()) {
      alert('请先填写歌单名称，以便 AI 提取视觉灵感！');
      return;
    }
    
    setIsGeneratingPlaylistCover(true);
    
    const baseStylePrompt = newPlaylistAiPrompt.trim() || `Ethereal music playlist cover matching "${newPlaylistName}"`;
    let styleKeywords = 'cyberpunk, neon glow, sci-fi aesthetic, detailed digital art, 8k resolution, futuristic concept';
    if (newPlaylistAiStyle === 'zen') {
      styleKeywords = 'traditional chinese ink painting, minimalist zen art, warm gold and charcoal color palette, high resolution, soft brush strokes';
    } else if (newPlaylistAiStyle === 'vaporwave') {
      styleKeywords = 'retro 80s synthwave grid, vaporwave aesthetic, pastel neon pink and cyan, 3d wireframe globe, digital illustration';
    } else if (newPlaylistAiStyle === 'ambient') {
      styleKeywords = 'abstract aurora nebula, soft light rays, cosmic glowing particles, cinematic lighting, ethereal dreamy, 8k resolution';
    }
    
    const finalAIPrompt = `${baseStylePrompt}, ${styleKeywords}`;
    const aiImageUrl = `/api/ai/cover?prompt=${encodeURIComponent(finalAIPrompt)}`;

    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      setIsGeneratingPlaylistCover(false);
      return;
    }

    const renderPlaylistDesign = (baseImage?: HTMLImageElement) => {
      let primaryColor = '#00F0FF';
      let secondaryColor = '#EB00FF';
      let bgColor = '#06060c';
      
      if (newPlaylistAiStyle === 'zen') {
        primaryColor = '#D9A05B';
        secondaryColor = '#8C2D19';
        bgColor = '#0e1115';
      } else if (newPlaylistAiStyle === 'vaporwave') {
        primaryColor = '#01CDFE';
        secondaryColor = '#FF71CE';
        bgColor = '#150628';
      } else if (newPlaylistAiStyle === 'ambient') {
        primaryColor = '#8EC5FC';
        secondaryColor = '#E0C3FC';
        bgColor = '#0a0d16';
      }

      if (baseImage) {
        ctx.drawImage(baseImage, 0, 0, 1000, 1000);
        
        const coverGrad = ctx.createLinearGradient(0, 0, 0, 1000);
        coverGrad.addColorStop(0, 'rgba(6, 6, 12, 0.45)');
        coverGrad.addColorStop(1, 'rgba(6, 6, 12, 0.65)');
        ctx.fillStyle = coverGrad;
        ctx.fillRect(0, 0, 1000, 1000);
      } else {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 1000, 1000);
        
        ctx.globalCompositeOperation = 'screen';
        const blob1 = ctx.createRadialGradient(300, 300, 50, 300, 300, 450);
        blob1.addColorStop(0, primaryColor + '7f');
        blob1.addColorStop(1, 'transparent');
        ctx.fillStyle = blob1;
        ctx.fillRect(0, 0, 1000, 1000);
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1.0;
      for (let r = 100; r < 440; r += 12) {
        ctx.beginPath();
        ctx.arc(500, 500, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(80, 80, 240, 118);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(80, 80, 240, 118);

      ctx.fillStyle = primaryColor;
      ctx.font = '900 11px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('ECHORURA PLAYLIST', 92, 103);
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 9px "Courier New", monospace';
      ctx.fillText(`COLLECTION: #${Math.floor(Math.random() * 90000 + 10000)}`, 92, 122);
      ctx.fillText(`STYLE: ${newPlaylistAiStyle.toUpperCase()}`, 92, 139);
      ctx.fillText(`CREATOR: @ECHORURA`, 92, 156);
      ctx.fillText(`TYPE: LOSS-LESS HIFI`, 92, 173);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsGeneratingPlaylistCover(false);
          return;
        }
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error('Unauthenticated');
          
          const fileToUpload = new File([blob], 'playlist_ai_cover.png', { type: 'image/png' });
          const formData = new FormData();
          formData.append('file', fileToUpload);
          formData.append('folder', 'covers');
          
          const res = await fetch('/api/upload/r2', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            },
            body: formData
          });
          
          if (!res.ok) throw new Error('R2 upload failed');
          const uploadResult = await res.json();
          setNewPlaylistCoverUrl(uploadResult.url);
        } catch (e: any) {
          console.error(e);
          alert('智能封面生成成功，但同步到云存储失败: ' + e.message);
        } finally {
          setIsGeneratingPlaylistCover(false);
        }
      }, 'image/png');
    };

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      renderPlaylistDesign(img);
    };
    img.onerror = () => {
      renderPlaylistDesign();
    };
    img.src = aiImageUrl;
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) {
      alert('请填写歌单名称！');
      return;
    }
    
    setPlaylistLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('登录凭证已失效，请重新登录！');
        return;
      }
      
      let coverUrl = newPlaylistCoverUrl;
      
      if (newPlaylistCoverSource === 'upload' && newPlaylistCoverFile) {
        const formData = new FormData();
        console.log('正在进行智能图像无损优化压缩中...');
        const compressedCover = await compressImage(newPlaylistCoverFile);
        formData.append('file', compressedCover);
        formData.append('folder', 'covers');
        
        const uploadRes = await fetch('/api/upload/r2', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          body: formData
        });
        
        if (!uploadRes.ok) throw new Error('上传封面失败');
        const uploadResult = await uploadRes.json();
        coverUrl = uploadResult.url;
      }
      
      const createRes = await fetch('/api/playlists/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: newPlaylistName,
          description: newPlaylistDesc,
          cover_url: coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80',
          is_public: true
        })
      });
      
      const createResult = await createRes.json();
      if (createRes.ok) {
        alert('🎉 歌单创建成功！');
        setIsCreatePlaylistOpen(false);
        setNewPlaylistName('');
        setNewPlaylistDesc('');
        setNewPlaylistCoverUrl('');
        setNewPlaylistCoverFile(null);
        setNewPlaylistCoverSource('default');
        fetchMyPlaylists(user.id);
      } else {
        alert(`❌ 创建失败: ${createResult.error}`);
      }
    } catch (e: any) {
      alert(`❌ 创建失败: ${e.message}`);
    } finally {
      setPlaylistLoading(false);
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!confirm('确定要永久删除这张歌单吗？此操作无法撤销。')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('登录凭证已失效，请重新登录！');
        return;
      }
      const res = await fetch(`/api/playlists/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ playlistId })
      });
      const data = await res.json();
      if (res.ok) {
        alert('🎉 歌单已成功删除！');
        fetchMyPlaylists(user.id);
      } else {
        alert(`❌ 删除失败: ${data.error || '未知错误'}`);
      }
    } catch (e: any) {
      alert(`❌ 删除失败: ${e.message}`);
    }
  };

  const handleAudioSelection = async (file: File | null) => {
    if (!file) {
      setAudioFile(null);
      setCompressionState({
        progress: 0,
        status: 'idle',
        message: ''
      });
      return;
    }

    // 限制原始音频大小，避免浏览器解码导致内存崩溃
    if (file.size > 150 * 1024 * 1024) {
      alert('❌ 原始音频文件过大，请选择 150MB 以内的音频文件进行优化。');
      return;
    }

    setIsCompressing(true);
    setCompressionState({
      progress: 0,
      status: 'decoding',
      message: '⚡ 正在解码源音频文件...',
      originalSize: file.size
    });

    try {
      const compressed = await compressAudioFile(file, (state) => {
        setCompressionState(state);
      });
      setAudioFile(compressed);
    } catch (err: any) {
      console.error('[Audio Compression Error]', err);
      alert(`❌ 音频智能优化失败: ${err.message}`);
      setAudioFile(null);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCompressing) {
      alert('⏳ 音频声学引擎优化压缩中，请稍候再提交发布...');
      return;
    }

    if (!audioFile || !coverFile || !user) {
      alert('请检查文件是否选择完整，以及登录状态');
      return;
    }

    if (audioFile.size > 50 * 1024 * 1024) {
      alert('❌ 音频文件过大，当前限制上传 50MB 以内的 MP3/WAV 文件。');
      return;
    }
    
    const audioExt = audioFile.name.split('.').pop()?.toLowerCase();
    if (audioExt !== 'mp3' && audioExt !== 'wav') {
      alert('❌ 格式不支持，当前仅支持上传 MP3 或 WAV 格式音频。');
      return;
    }

    if (coverFile.size > 5 * 1024 * 1024) {
      alert('❌ 封面图片过大，请保持在 5MB 以内。');
      return;
    }

    const stakeCost = 10.0;
    if (uploadMode === 'stake') {
      if (echoBalance < stakeCost) {
        alert('🔒 您的平台账户余额不足，无法支付 10.00 ECHO 的打榜质押保证金！请日常挖矿积累或先充值。');
        return;
      }

      // 检测今日报名是否达到 20 首上限
      let registeredSongs = [];
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('arena_registered_songs');
          if (stored) registeredSongs = JSON.parse(stored);
        } catch (e) {
          console.error(e);
        }
      }

      if (registeredSongs.length >= 20) {
        alert('⚠️ 本日打榜报名额度已满（20/20首封顶），请明天再来报名！');
        return;
      }
    }

    setLoading(true);
    console.log('开始上传流程...', { title, artist, uploadMode, ipoPercentage });

    try {
      // 获取当前登录 session 的 JWT token，传给服务端验证身份
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('无法获取登录凭证，请重新登录后再试');
      }

      console.log('正在上传音频到全球分发节点...');
      const audioFormData = new FormData();
      audioFormData.append('file', audioFile);
      audioFormData.append('folder', 'songs');
      
      const audioUploadRes = await fetch('/api/upload/r2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: audioFormData
      });
      
      const audioUploadResult = await audioUploadRes.json();
      if (!audioUploadRes.ok || !audioUploadResult.url) {
        throw new Error(audioUploadResult.error || `音频上传失败`);
      }
      const audioUrl = audioUploadResult.url;

      console.log('正在对封面进行智能图形学算法优化...');
      const coverFormData = new FormData();
      const compressedCover = await compressImage(coverFile);
      coverFormData.append('file', compressedCover);
      coverFormData.append('folder', 'covers');
      
      const coverUploadRes = await fetch('/api/upload/r2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: coverFormData
      });
      
      const coverUploadResult = await coverUploadRes.json();
      if (!coverUploadRes.ok || !coverUploadResult.url) {
        throw new Error(coverUploadResult.error || `封面上传失败`);
      }
      const coverUrl = coverUploadResult.url;

      // 通过服务端 API Route 并发双写库，将元数据同步写入 Supabase 和 Memfire
      const createRes = await fetch('/api/songs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title,
          artist: artist || profile?.display_name || user.email?.split('@')[0],
          lyrics: lyrics,
          tags: selectedGenres,
          moods: selectedMoods,
          audio_url: audioUrl,
          cover_url: coverUrl,
          is_ipo_active: isIpoActive,
          total_shares: totalShares,
          ipo_percentage: ipoPercentage,
          push_to_followers: pushToFollowers
        }),
      });

      const createResult = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createResult.error || `服务器返回 ${createRes.status}`);
      }

      const dbData = [createResult.data];


      // 🎁 执行代币转移或奖励
      if (uploadMode === 'stake') {
        // 调用真实的数据库打榜质押注册接口
        try {
          const regRes = await fetch('/api/arena/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ songId: dbData[0].id })
          });
          const regResult = await regRes.json();
          if (!regRes.ok) {
            console.error('打榜质押失败:', regResult.error);
            alert(`⚠️ 作品已成功发布，但自动质押打榜失败: ${regResult.error || '余额不足或已满额'}。您仍可稍后在“听审打榜”页面手动发起报名打榜。`);
          } else {
            console.log('自动打榜质押成功！', regResult);
            // 同步最新的数据库余额给 store
            if (regResult.remaining_balance !== undefined) {
              setBalance(regResult.remaining_balance);
            }
            alert(`🎉 发布并质押成功！作品已成功通过 AI 指纹和音质自动首检，并正式送入「听审竞技场」！已成功扣减并锁定 10.00 ECHO 保证金。`);
          }
        } catch (regErr: any) {
          console.error('打榜质押网络错误:', regErr);
          alert(`⚠️ 作品已成功发布，但自动发起打榜时网络异常，您仍可在“听审打榜”页面手动为其发起打榜。`);
        }
      } else {
        // 后端 record_mining_reward RPC 已记录 1.0 ECHO，此处不重复累加
        alert('🎉 普通作品发布成功！已获得 1.00 ECHO 创作者激励 (待审计入账)。');
      }
      
      setIsUploading(false);
      setUploadStep(0);
      fetchMySongs(user.id);
      
      // 重置表单
      setTitle('');
      setAudioFile(null);
      setCompressionState({
        progress: 0,
        status: 'idle',
        message: ''
      });
      setCoverFile(null);
      setCoverSource('upload');
      setIsIpoActive(false);
      setUploadMode('regular');
    } catch (err: any) {
      alert('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateAICover = () => {
    if (!title.trim()) {
      alert('请先填写作品标题，以便 AI 提取视觉灵感！');
      return;
    }
    
    setIsGeneratingCover(true);
    
    // 1. 构建高精度 AI 大模型 Prompt 提示词
    const baseStylePrompt = aiPrompt.trim() || `Abstract art matching title "${title}"`;
    let styleKeywords = 'cyberpunk, neon glow, sci-fi aesthetic, detailed digital art, 8k resolution, futuristic concept';
    if (aiStyle === 'zen') {
      styleKeywords = 'traditional chinese ink painting, minimalist zen art, warm gold and charcoal color palette, high resolution, soft brush strokes';
    } else if (aiStyle === 'vaporwave') {
      styleKeywords = 'retro 80s synthwave grid, vaporwave aesthetic, pastel neon pink and cyan, 3d wireframe globe, digital illustration';
    } else if (aiStyle === 'ambient') {
      styleKeywords = 'abstract aurora nebula, soft light rays, cosmic glowing particles, cinematic lighting, ethereal dreamy, 8k resolution';
    }
    
    const finalAIPrompt = `${baseStylePrompt}, ${styleKeywords}`;
    // 使用我们刚刚写好的本地后端 Next.js API 路由，由后端服务器拉取，彻底绕过跨域 (CORS) 与浏览器网络限制！
    const aiImageUrl = `/api/ai/cover?prompt=${encodeURIComponent(finalAIPrompt)}`;

    // 2. 创建高分辨率 Canvas (1000x1000)
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      setIsGeneratingCover(false);
      return;
    }

    // 渲染主画面的内部闭包函数 (包括物理唱片压纹、水印规格贴纸与排版)
    const renderDesignOverlays = (baseImage?: HTMLImageElement) => {
      // 风格基调配置
      let primaryColor = '#00F0FF';
      let secondaryColor = '#EB00FF';
      let bgColor = '#06060c';
      let auxColor = '#39FF14'; // 赛博亮绿
      
      if (aiStyle === 'zen') {
        primaryColor = '#D9A05B'; // 暖金黄
        secondaryColor = '#8C2D19'; // 赤砂红
        bgColor = '#0e1115'; // 玄铁黑
        auxColor = '#5e656d'; // 苍暮灰
      } else if (aiStyle === 'vaporwave') {
        primaryColor = '#01CDFE'; // 霓虹天蓝
        secondaryColor = '#FF71CE'; // 霓虹粉红
        bgColor = '#150628'; // 深紫红
        auxColor = '#B57CFF'; // 紫罗兰
      } else if (aiStyle === 'ambient') {
        primaryColor = '#8EC5FC'; // 极光水蓝
        secondaryColor = '#E0C3FC'; // 薰衣草紫
        bgColor = '#0a0d16'; // 深邃星云黑
        auxColor = '#C2FFD8'; // 柔和极光绿
      }

      // 智能情绪描述词色彩与星云微粒偏移自适应
      const lowerPrompt = aiPrompt.toLowerCase();
      if (lowerPrompt.includes('红') || lowerPrompt.includes('red') || lowerPrompt.includes('火') || lowerPrompt.includes('fire')) {
        primaryColor = '#FF0D50'; // 绯红
      }
      if (lowerPrompt.includes('金') || lowerPrompt.includes('gold') || lowerPrompt.includes('黄') || lowerPrompt.includes('yellow')) {
        primaryColor = '#FFD700'; // 皇家金
      }
      if (lowerPrompt.includes('绿') || lowerPrompt.includes('green') || lowerPrompt.includes('翠') || lowerPrompt.includes('forest')) {
        secondaryColor = '#00FF66'; // 极光翠绿
      }
      if (lowerPrompt.includes('紫') || lowerPrompt.includes('purple') || lowerPrompt.includes('暗') || lowerPrompt.includes('dark')) {
        secondaryColor = '#9A4BFF'; // 霓虹重紫
      }
      if (lowerPrompt.includes('蓝') || lowerPrompt.includes('blue') || lowerPrompt.includes('水') || lowerPrompt.includes('water')) {
        primaryColor = '#00A8FF'; // 蔚蓝
      }

      // A. 画底图：如果大模型生成图成功加载，则画上去；否则降级渲染五重流体发光网格
      if (baseImage) {
        ctx.drawImage(baseImage, 0, 0, 1000, 1000);
        
        // 覆盖一层 45% 的暗色渐变底，确保前景文字和规格贴纸绝对清晰
        const coverGrad = ctx.createLinearGradient(0, 0, 0, 1000);
        coverGrad.addColorStop(0, 'rgba(6, 6, 12, 0.45)');
        coverGrad.addColorStop(0.5, 'rgba(6, 6, 12, 0.15)');
        coverGrad.addColorStop(1, 'rgba(6, 6, 12, 0.65)');
        ctx.fillStyle = coverGrad;
        ctx.fillRect(0, 0, 1000, 1000);
      } else {
        // 降级：绘制未来深邃背景
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 1000, 1000);
        
        // 绘制 3D 悬浮液态流体渐变 Blobs (五重融合)
        ctx.globalCompositeOperation = 'screen';
        
        // Blob 1: 左上发光团
        const blob1 = ctx.createRadialGradient(250, 250, 20, 300, 300, 450);
        blob1.addColorStop(0, primaryColor + '7f'); // 50% opacity
        blob1.addColorStop(0.6, secondaryColor + '26'); // 15% opacity
        blob1.addColorStop(1, 'transparent');
        ctx.fillStyle = blob1;
        ctx.fillRect(0, 0, 1000, 1000);

        // Blob 2: 右下发光团
        const blob2 = ctx.createRadialGradient(750, 750, 30, 700, 700, 500);
        blob2.addColorStop(0, secondaryColor + '8a');
        blob2.addColorStop(0.5, primaryColor + '33');
        blob2.addColorStop(1, 'transparent');
        ctx.fillStyle = blob2;
        ctx.fillRect(0, 0, 1000, 1000);

        // Blob 3: 中心氛围软光晕
        const blob3 = ctx.createRadialGradient(500, 500, 50, 500, 500, 350);
        blob3.addColorStop(0, auxColor + '2d');
        blob3.addColorStop(0.7, 'transparent');
        ctx.fillStyle = blob3;
        ctx.fillRect(0, 0, 1000, 1000);

        ctx.globalCompositeOperation = 'source-over';
      }

      // B. 物理唱片同心黑胶纹理 (Fine Vinyl Grooves Overlay)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1.0;
      for (let r = 80; r < 460; r += 8) {
        ctx.beginPath();
        ctx.arc(500, 500, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // C. 绘制去中心化“音频节点星空微粒子”系统
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      for (let i = 0; i < 180; i++) {
        const angle = (i * Math.PI) / 90;
        const noiseRadius = 260 + Math.sin(angle * 12) * 25 + Math.cos(angle * 3) * 15 + (Math.random() - 0.5) * 8;
        const x = 500 + Math.cos(angle) * noiseRadius;
        const y = 500 + Math.sin(angle) * noiseRadius;
        const dotSize = Math.random() > 0.85 ? 2.5 : 1.2;
        
        ctx.fillStyle = i % 2 === 0 ? primaryColor + 'cc' : secondaryColor + 'cc';
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // D. 各风格专属高级矢量几何/声学律动图景
      if (aiStyle === 'cyber') {
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(500, 500, 290, 0, Math.PI * 2); ctx.stroke();

        ctx.strokeStyle = 'rgba(235, 0, 255, 0.25)';
        ctx.beginPath();
        ctx.moveTo(500, 150); ctx.lineTo(500, 210);
        ctx.moveTo(500, 790); ctx.lineTo(500, 850);
        ctx.moveTo(150, 500); ctx.lineTo(210, 500);
        ctx.moveTo(790, 500); ctx.lineTo(850, 500);
        ctx.stroke();

        // 电子声波
        ctx.strokeStyle = primaryColor + 'cc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = 180; x <= 820; x += 4) {
          const tVal = (x - 180) / 640;
          const envelope = Math.sin(tVal * Math.PI);
          const wave = Math.sin(tVal * Math.PI * 18) * 40 * envelope + Math.cos(tVal * Math.PI * 42) * 10 * envelope;
          const y = 500 + wave;
          if (x === 180) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (aiStyle === 'zen') {
        const gradEnso = ctx.createLinearGradient(300, 300, 700, 700);
        gradEnso.addColorStop(0, primaryColor + 'cc');
        gradEnso.addColorStop(1, secondaryColor + '22');
        ctx.strokeStyle = gradEnso;
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(500, 500, 290, -Math.PI * 0.45, Math.PI * 1.35);
        ctx.stroke();
        ctx.lineCap = 'butt';

        // 山水重峦音波
        for (let pass = 0; pass < 3; pass++) {
          ctx.fillStyle = pass === 0 ? 'rgba(26, 30, 36, 0.65)' : pass === 1 ? 'rgba(40, 35, 34, 0.45)' : 'rgba(217, 160, 91, 0.18)';
          ctx.beginPath();
          ctx.moveTo(150, 650 + pass * 40);
          for (let x = 150; x <= 850; x += 10) {
            const tVal = (x - 150) / 700;
            const envelope = Math.sin(tVal * Math.PI);
            const height = Math.sin(tVal * Math.PI * (3.5 + pass * 2)) * (75 - pass * 18) * envelope;
            ctx.lineTo(x, 520 + pass * 35 - height);
          }
          ctx.lineTo(850, 750); ctx.lineTo(150, 750);
          ctx.closePath();
          ctx.fill();
        }
      } else if (aiStyle === 'vaporwave') {
        ctx.strokeStyle = secondaryColor + '44';
        ctx.lineWidth = 1.5;
        const gridY = 620;
        for (let x = 100; x <= 900; x += 80) {
          ctx.beginPath(); ctx.moveTo(x, gridY); ctx.lineTo(500 + (x - 500) * 2.8, 850); ctx.stroke();
        }
        for (let y = gridY; y <= 850; y += 32) {
          const alpha = ((y - gridY) / 230) * 0.4;
          ctx.strokeStyle = `rgba(255, 113, 206, ${alpha})`;
          ctx.beginPath(); ctx.moveTo(100 - (y - gridY) * 0.8, y); ctx.lineTo(900 + (y - gridY) * 0.8, y); ctx.stroke();
        }

        ctx.strokeStyle = primaryColor + '66';
        ctx.lineWidth = 1.2;
        const cx = 500, cy = 420, r = 160;
        for (let i = 1; i < 6; i++) {
          ctx.beginPath(); ctx.ellipse(cx, cy, r * (i / 6), r, 0, 0, Math.PI * 2); ctx.stroke();
        }
        for (let i = -4; i <= 4; i++) {
          const wY = cy + (i * r) / 5;
          const wR = Math.sqrt(r * r - (i * r / 5) * (i * r / 5));
          ctx.beginPath(); ctx.moveTo(cx - wR, wY); ctx.lineTo(cx + wR, wY); ctx.stroke();
        }
      } else if (aiStyle === 'ambient') {
        ctx.strokeStyle = primaryColor + '3f';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        let spiralR = 10; ctx.moveTo(500, 500);
        for (let theta = 0; theta < Math.PI * 10; theta += 0.08) {
          spiralR = 6 + theta * 10.5;
          const x = 500 + Math.cos(theta) * spiralR;
          const y = 500 + Math.sin(theta) * spiralR;
          if (spiralR < 380) ctx.lineTo(x, y);
        }
        ctx.stroke();

        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass === 0 ? 'rgba(142, 197, 252, 0.7)' : 'rgba(224, 195, 252, 0.5)';
          ctx.lineWidth = pass === 0 ? 3 : 1.5;
          ctx.beginPath();
          for (let x = 200; x <= 800; x += 5) {
            const tVal = (x - 200) / 600;
            const envelope = Math.sin(tVal * Math.PI);
            const y = 500 + Math.sin(tVal * Math.PI * (4 + pass * 2) + (pass * Math.PI / 2)) * 35 * envelope;
            if (x === 200) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      // E. 高奢 Web3 数字发布贴纸水贴 (Watermarked Spec Label Sticker)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'; // 半透明黑色底色，便于盖在复杂图像上
      ctx.fillRect(80, 80, 240, 118);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(80, 80, 240, 118);

      ctx.fillStyle = primaryColor;
      ctx.font = '900 10px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('ECHORURA DECENTRALIZED', 92, 103);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 9px "Courier New", monospace';
      ctx.fillText(`BLOCK: #${Math.floor(Math.random() * 800000 + 1200000)}`, 92, 121);
      ctx.fillText(`GENRE: ${selectedGenres[0] || 'CLASSIC'}`, 92, 137);
      
      const promptTag = aiPrompt ? aiPrompt.slice(0, 18) : (aiStyle === 'cyber' ? 'CYBER GLOW' : aiStyle === 'zen' ? 'PURE ZEN' : aiStyle === 'vaporwave' ? 'RETRO FUTURE' : 'AURORA SKY');
      ctx.fillText(`SPEC: ${promptTag.toUpperCase()}`, 92, 153);
      ctx.fillText(`FMT: HI-RES FLAC`, 92, 169);

      // 条形码
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      const barX = 230;
      const barWidths = [2, 5, 2, 7, 3, 2, 8, 2, 4, 2];
      let curBarOffset = 0;
      for (let w of barWidths) {
        ctx.fillRect(barX + curBarOffset, 120, w, 40);
        curBarOffset += w + 2;
      }

      // 右上角共创印章
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.beginPath(); ctx.arc(890, 100, 24, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = secondaryColor + 'bb';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(890, 100, 20, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = secondaryColor + 'bb';
      ctx.beginPath(); ctx.arc(890, 100, 6, 0, Math.PI * 2); ctx.fill();
      ctx.font = '900 8px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CO-CREATIVE', 890, 134);

      // F. 精致排版：主标题与副标题
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 15;
      
      const maxTitleLen = 16;
      const cleanTitle = title.length > maxTitleLen ? title.slice(0, maxTitleLen) + '...' : title;
      
      const titleGrad = ctx.createLinearGradient(300, 0, 700, 0);
      titleGrad.addColorStop(0, '#FFFFFF');
      titleGrad.addColorStop(0.5, '#FFFFFF');
      titleGrad.addColorStop(1, primaryColor);

      ctx.fillStyle = titleGrad;
      ctx.font = '900 68px "Inter", "Outfit", system-ui, sans-serif';
      ctx.fillText(cleanTitle.toUpperCase(), 500, 420);
      
      const displayArtist = artist || profile?.display_name || user.email?.split('@')[0] || 'ECHORURA';
      const cleanArtist = displayArtist.length > 20 ? displayArtist.slice(0, 20) + '...' : displayArtist;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = 'bold 22px "Inter", "Outfit", sans-serif';
      ctx.shadowBlur = 6;
      
      const spacedArtist = cleanArtist.toUpperCase().split('').join('  ');
      ctx.fillText(`BY  ${spacedArtist}`, 500, 550);
      
      ctx.shadowBlur = 0; // 关闭阴影
      
      // 底部水印
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '900 14px "Inter", sans-serif';
      ctx.fillText('⚡ ECHORURA SMART NFT CREATION', 500, 890);
      
      // 边缘裁边线
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(40, 40, 920, 920);
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2.0;
      const d = 40, l = 30;
      ctx.beginPath(); ctx.moveTo(d, d + l); ctx.lineTo(d, d); ctx.lineTo(d + l, d); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1000 - d, d + l); ctx.lineTo(1000 - d, d); ctx.lineTo(1000 - d - l, d); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(d, 1000 - d - l); ctx.lineTo(d, 1000 - d); ctx.lineTo(d + l, 1000 - d); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1000 - d, 1000 - d - l); ctx.lineTo(1000 - d, 1000 - d); ctx.lineTo(1000 - d - l, 1000 - d); ctx.stroke();

      // G. 注入胶片噪点与微小划痕
      const imgData = ctx.getImageData(0, 0, 1000, 1000);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 20;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
      }
      ctx.putImageData(imgData, 0, 0);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 0.5;
      for (let s = 0; s < 3; s++) {
        const startX = Math.random() * 800 + 100;
        const startY = Math.random() * 800 + 100;
        ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(startX + (Math.random() - 0.5) * 80, startY + (Math.random() - 0.5) * 80); ctx.stroke();
      }
      
      // H. 导出为 blob 文件流并保存
      canvas.toBlob((blob) => {
        if (blob) {
          const generatedFile = new File([blob], `ai-cover-${Date.now()}.png`, { type: 'image/png' });
          setCoverFile(generatedFile);
        }
        setIsGeneratingCover(false);
      }, 'image/png');
    };

    // 3. 开始异步加载神经网络大模型生成的底图
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // 成功加载大模型生成的图，执行混合排版叠加！
      renderDesignOverlays(img);
    };
    img.onerror = () => {
      console.warn("AI Image model API failed or timed out. Falling back to high-fidelity mesh fluid engine gracefully.");
      // 降级：使用流体引擎排版叠加
      renderDesignOverlays();
    };

    // 触发加载图片
    img.src = aiImageUrl;
  };

  const generateAICoverForEdit = () => {
    if (!editingSong) return;
    
    setIsGeneratingEditCover(true);
    
    // 1. 构建高精度 AI 大模型 Prompt 提示词
    const baseStylePrompt = editAiPrompt.trim() || `Abstract art matching title "${editingSong.title}"`;
    let styleKeywords = 'cyberpunk, neon glow, sci-fi aesthetic, detailed digital art, 8k resolution, futuristic concept';
    if (editAiStyle === 'zen') {
      styleKeywords = 'traditional chinese ink painting, minimalist zen art, warm gold and charcoal color palette, high resolution, soft brush strokes';
    } else if (editAiStyle === 'vaporwave') {
      styleKeywords = 'retro 80s synthwave grid, vaporwave aesthetic, pastel neon pink and cyan, 3d wireframe globe, digital illustration';
    } else if (editAiStyle === 'ambient') {
      styleKeywords = 'abstract aurora nebula, soft light rays, cosmic glowing particles, cinematic lighting, ethereal dreamy, 8k resolution';
    }
    
    const finalAIPrompt = `${baseStylePrompt}, ${styleKeywords}`;
    const aiImageUrl = `/api/ai/cover?prompt=${encodeURIComponent(finalAIPrompt)}`;

    // 2. 创建高分辨率 Canvas (1000x1000)
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      setIsGeneratingEditCover(false);
      return;
    }

    // 渲染主画面的内部闭包函数 (包括物理唱片压纹、水印规格贴纸与排版)
    const renderDesignOverlays = (baseImage?: HTMLImageElement) => {
      // 风格基调配置
      let primaryColor = '#00F0FF';
      let secondaryColor = '#EB00FF';
      let bgColor = '#06060c';
      let auxColor = '#39FF14'; // 赛博亮绿
      
      if (editAiStyle === 'zen') {
        primaryColor = '#D9A05B'; // 暖金黄
        secondaryColor = '#8C2D19'; // 赤砂红
        bgColor = '#0e1115'; // 玄铁黑
        auxColor = '#5e656d'; // 苍暮灰
      } else if (editAiStyle === 'vaporwave') {
        primaryColor = '#01CDFE'; // 霓虹天蓝
        secondaryColor = '#FF71CE'; // 霓虹粉红
        bgColor = '#150628'; // 深紫红
        auxColor = '#B57CFF'; // 紫罗兰
      } else if (editAiStyle === 'ambient') {
        primaryColor = '#8EC5FC'; // 极光水蓝
        secondaryColor = '#E0C3FC'; // 薰衣草紫
        bgColor = '#0a0d16'; // 深邃星云黑
        auxColor = '#C2FFD8'; // 柔和极光绿
      }

      // 智能情绪描述词色彩自适应
      const lowerPrompt = editAiPrompt.toLowerCase();
      if (lowerPrompt.includes('红') || lowerPrompt.includes('red') || lowerPrompt.includes('火') || lowerPrompt.includes('fire')) {
        primaryColor = '#FF0D50';
      }
      if (lowerPrompt.includes('金') || lowerPrompt.includes('gold') || lowerPrompt.includes('黄') || lowerPrompt.includes('yellow')) {
        primaryColor = '#FFD700';
      }
      if (lowerPrompt.includes('绿') || lowerPrompt.includes('green') || lowerPrompt.includes('翠') || lowerPrompt.includes('forest')) {
        secondaryColor = '#00FF66';
      }
      if (lowerPrompt.includes('紫') || lowerPrompt.includes('purple') || lowerPrompt.includes('暗') || lowerPrompt.includes('dark')) {
        secondaryColor = '#9A4BFF';
      }
      if (lowerPrompt.includes('蓝') || lowerPrompt.includes('blue') || lowerPrompt.includes('水') || lowerPrompt.includes('water')) {
        primaryColor = '#00A8FF';
      }

      // A. 画底图
      if (baseImage) {
        ctx.drawImage(baseImage, 0, 0, 1000, 1000);
        const coverGrad = ctx.createLinearGradient(0, 0, 0, 1000);
        coverGrad.addColorStop(0, 'rgba(6, 6, 12, 0.45)');
        coverGrad.addColorStop(0.5, 'rgba(6, 6, 12, 0.15)');
        coverGrad.addColorStop(1, 'rgba(6, 6, 12, 0.65)');
        ctx.fillStyle = coverGrad;
        ctx.fillRect(0, 0, 1000, 1000);
      } else {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 1000, 1000);
        ctx.globalCompositeOperation = 'screen';
        const blob1 = ctx.createRadialGradient(250, 250, 20, 300, 300, 450);
        blob1.addColorStop(0, primaryColor + '7f');
        blob1.addColorStop(0.6, secondaryColor + '26');
        blob1.addColorStop(1, 'transparent');
        ctx.fillStyle = blob1;
        ctx.fillRect(0, 0, 1000, 1000);

        const blob2 = ctx.createRadialGradient(750, 750, 30, 700, 700, 500);
        blob2.addColorStop(0, secondaryColor + '8a');
        blob2.addColorStop(0.5, primaryColor + '33');
        blob2.addColorStop(1, 'transparent');
        ctx.fillStyle = blob2;
        ctx.fillRect(0, 0, 1000, 1000);

        ctx.globalCompositeOperation = 'source-over';
      }

      // B. 物理唱片同心黑胶纹理
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1.0;
      for (let r = 80; r < 460; r += 8) {
        ctx.beginPath();
        ctx.arc(500, 500, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // C. 星空微粒子
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      for (let i = 0; i < 180; i++) {
        const angle = (i * Math.PI) / 90;
        const noiseRadius = 260 + Math.sin(angle * 12) * 25 + Math.cos(angle * 3) * 15 + (Math.random() - 0.5) * 8;
        const x = 500 + Math.cos(angle) * noiseRadius;
        const y = 500 + Math.sin(angle) * noiseRadius;
        const dotSize = Math.random() > 0.85 ? 2.5 : 1.2;
        ctx.fillStyle = i % 2 === 0 ? primaryColor + 'cc' : secondaryColor + 'cc';
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // D. 艺术贴纸
      ctx.fillStyle = 'rgba(6, 6, 12, 0.85)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(80, 80, 240, 240, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = primaryColor;
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.fillText('ECHORURA DECENTRALIZED', 100, 115);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = '900 15px "Courier New", monospace';
      ctx.fillText('BLOCK: #88492-CO', 100, 140);
      
      const cleanPrompt = editAiPrompt ? (editAiPrompt.length > 15 ? editAiPrompt.slice(0, 15) + '...' : editAiPrompt) : 'GENERATIVE_SD';
      ctx.fillText(`SPEC: ${cleanPrompt.toUpperCase()}`, 100, 165);
      ctx.fillText(`FMT: HI-RES FLAC`, 100, 190);

      // 绘制条形码
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      const barcodeX = 100;
      const barcodeY = 215;
      const barcodeHeight = 25;
      const barcodePattern = [2, 4, 1, 3, 1, 4, 2, 2, 1, 3, 2, 4, 1, 1, 3, 2, 4, 1, 2, 2];
      let currentX = barcodeX;
      barcodePattern.forEach((width, index) => {
        if (index % 2 === 0) {
          ctx.fillRect(currentX, barcodeY, width, barcodeHeight);
        }
        currentX += width;
      });

      // E. 排版文字 (使用 editingSong.title 和 editingSong.artist)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 15;
      ctx.textAlign = 'center';
      
      const maxTitleLen = 16;
      const songTitle = editingSong.title || 'ECHORURA';
      const cleanTitle = songTitle.length > maxTitleLen ? songTitle.slice(0, maxTitleLen) + '...' : songTitle;
      const titleGrad = ctx.createLinearGradient(300, 0, 700, 0);
      titleGrad.addColorStop(0, '#FFFFFF');
      titleGrad.addColorStop(0.5, '#FFFFFF');
      titleGrad.addColorStop(1, primaryColor);

      ctx.fillStyle = titleGrad;
      ctx.font = '900 68px "Inter", "Outfit", system-ui, sans-serif';
      ctx.fillText(cleanTitle.toUpperCase(), 500, 420);
      
      const displayArtist = editingSong.artist || profile?.display_name || user.email?.split('@')[0] || 'ECHORURA';
      const cleanArtist = displayArtist.length > 20 ? displayArtist.slice(0, 20) + '...' : displayArtist;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = 'bold 22px "Inter", "Outfit", sans-serif';
      ctx.shadowBlur = 6;
      ctx.fillText(`BY  ${cleanArtist.toUpperCase().split('').join('  ')}`, 500, 550);
      ctx.shadowBlur = 0;

      // 胶片颗粒
      const imgData = ctx.getImageData(0, 0, 1000, 1000);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 20;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
      }
      ctx.putImageData(imgData, 0, 0);

      // F. 导出 Blob 与 DataURL
      canvas.toBlob((blob) => {
        if (blob) {
          const generatedFile = new File([blob], `edit-cover-${Date.now()}.png`, { type: 'image/png' });
          setEditCoverFile(generatedFile);
          setEditCoverPreviewUrl(canvas.toDataURL('image/png'));
        }
        setIsGeneratingEditCover(false);
      }, 'image/png');
    };

    // 3. 开始加载
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => renderDesignOverlays(img);
    img.onerror = () => {
      console.warn("AI Image model API failed or timed out during edit. Falling back to mesh fluid engine.");
      renderDesignOverlays();
    };
    img.src = aiImageUrl;
  };


  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSong || !user) return;
    
    setLoading(true);
    try {
      const supabase = createClient();
      let finalCoverUrl = editingSong.cover_url;
      
      // A. 如果用户选择上传新封面，或者使用 AI 生成，且有新文件流
      if (editCoverSource !== 'keep' && editCoverFile) {
        const { data: { session: editSession } } = await supabase.auth.getSession();
        if (!editSession) throw new Error('无法获取登录凭证，请重新登录');
        
        const coverFormData = new FormData();
        console.log('正在对修改的封面进行智能图形学算法优化...');
        const compressedCover = await compressImage(editCoverFile);
        coverFormData.append('file', compressedCover);
        coverFormData.append('folder', 'covers');
        
        const coverUploadRes = await fetch('/api/upload/r2', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${editSession.access_token}` },
          body: coverFormData,
        });
        const coverUploadData = await coverUploadRes.json();
        if (!coverUploadRes.ok) throw new Error(coverUploadData.error || '封面上传失败');
        
        finalCoverUrl = coverUploadData.url;
      }
      
      // B. 获取当前登录 session 的 JWT token，传给服务端验证身份
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('无法获取登录凭证，请重新登录后再试');
      }

      // C. 通过服务端 API Route 写库（携带 Bearer Token 鉴权，绕过 RLS 静默拦截）
      console.log('[Edit Song] Calling /api/songs/update for ID:', editingSong.id);
      const res = await fetch('/api/songs/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          songId: editingSong.id,
          lyrics: editSongLyrics,
          tags: editSelectedGenres,
          moods: editSelectedMoods,
          cover_url: finalCoverUrl,
        }),
      });

      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || `服务器返回 ${res.status}`);
      }
      
      // D. 若用户勾选了参加听审竞技场，发起链上质押报名
      let arenaMessage = '';
      if (wantsToRegisterArenaInEdit) {
        const { data: arenaRes, error: arenaErr } = await supabase.rpc('register_for_arena', {
          p_user_id: user.id,
          p_song_id: editingSong.id
        });
        
        if (arenaErr) {
          throw new Error('听审竞技场报名失败: ' + arenaErr.message);
        }
        if (arenaRes && arenaRes.success === false) {
          throw new Error('听审竞技场报名失败: ' + arenaRes.error);
        }
        
        arenaMessage = '\n💎 听审竞技场质押 10.00 ECHO 报名成功！已成功排队竞演！';
      }
      
      // E. 成功完成
      alert('🎉 作品展示元数据已成功优化并同步！' + arenaMessage);
      setIsEditingSong(false);
      setEditingSong(null);
      fetchMySongs(user.id);
    } catch (err: any) {
      alert('❌ 保存修改失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openUploadSyncStudio = () => {
    if (!audioFile) {
      alert('请先选择音频文件，再进行打轴！');
      return;
    }
    setSyncMode('upload');
    setSyncAudioUrl(URL.createObjectURL(audioFile));
    setSyncInitialText(lyrics);
    setIsSyncStudioOpen(true);
  };

  const openEditSyncStudio = () => {
    if (!editingSong?.audio_url) {
      alert('该作品没有关联音频文件！');
      return;
    }
    setSyncMode('edit');
    setSyncAudioUrl(editingSong.audio_url);
    setSyncInitialText(editSongLyrics);
    setIsSyncStudioOpen(true);
  };


  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        display_name: editName,
        avatar_url: editAvatar,
        bio: editBio,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      setProfile({ ...profile, display_name: editName, avatar_url: editAvatar, bio: editBio });
      setIsEditingProfile(false);
      alert('资料更新成功！');
    } catch (err: any) {
      alert('更新失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const startDeletionProgress = () => {
    setDeletionProgress(0);
    const interval = setInterval(() => {
      setDeletionProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 28);
    return interval;
  };

  const handleAccountDeletion = async () => {
    if (!user) return;
    setIsEraseRunning(true);
    try {
      console.log('Starting account anonymization flow...');
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          display_name: '匿名创作者',
          avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=anonymous',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      setDeletionStep(2);
      const interval = startDeletionProgress();

      await new Promise(resolve => setTimeout(resolve, 3200));
      clearInterval(interval);

      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setIsDeletingAccount(false);
      window.location.href = '/';
    } catch (err: any) {
      alert('❌ 账户注销失败，请稍后重试: ' + err.message);
      setIsEraseRunning(false);
    }
  };

  const handleSignOut = async () => {
    if (confirm('确定要退出当前登录吗？')) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      window.location.href = '/';
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      alert('密码长度不能少于 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('两次输入的密码不一致');
      return;
    }
    setChangePasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      alert('🎉 密码修改成功！');
      setIsChangingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      alert('❌ 密码修改失败: ' + err.message);
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleAvatarFileUpload = async (file: File) => {
    if (!user) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('❌ 只支持 JPG, PNG 或 WebP 格式的图片');
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('❌ 图片大小不能超过 2MB');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Unauthenticated');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'avatars');

      console.log('正在上传头像到 Cloudflare R2...');
      const uploadRes = await fetch('/api/upload/r2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Failed to upload avatar to R2');
      }

      const { url } = await uploadRes.json();
      setEditAvatar(url);
    } catch (err: any) {
      alert('上传失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
          <Settings className="w-10 h-10 text-gray-600 animate-spin-slow" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('profile.login_required')}</h2>
        <p className="text-gray-400">{t('profile.login_required_desc')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-24">
      {/* Profile Header */}
      <header className="relative mb-12">
        <div className="h-48 w-full rounded-3xl bg-gradient-to-r from-echo-primary/20 via-echo-secondary/20 to-black border border-white/5 overflow-hidden">
          <div className="absolute inset-0 backdrop-blur-3xl"></div>
        </div>
        <div className="absolute -bottom-6 left-8 flex items-end gap-6">
          <div 
            onClick={() => setIsEditingProfile(true)}
            className="group relative w-24 h-24 rounded-3xl bg-gray-900 border-4 border-[#030303] overflow-hidden shadow-2xl cursor-pointer"
          >
            <img src={profile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.email || user.phone || 'echo'}`} alt="Avatar" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Settings className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-1">
              <h1 
                className="text-3xl font-black text-white uppercase tracking-tighter"
              >
                {profile?.display_name || user.email?.split('@')[0] || user.phone || 'ECHORURA_User'}
              </h1>
              <button 
                onClick={() => setIsEditingProfile(true)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-echo-primary/20 text-gray-400 hover:text-echo-primary transition-colors border border-white/10 hover:border-echo-primary/50"
                title="编辑个人资料"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button 
                onClick={handleShareMyArtistPage}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-echo-secondary/20 text-gray-400 hover:text-echo-secondary transition-colors border border-white/10 hover:border-echo-secondary/50 flex items-center gap-1.5 px-3 py-1 font-bold text-xs"
                title="分享我的创作者主页"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{copiedArtistLink ? '已复制！' : '分享主页'}</span>
              </button>
            </div>
            <p className="text-echo-primary font-mono text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Verified Creator {user.phone && <span className="text-gray-500 text-xs ml-2">(Phone)</span>}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-16">
        {/* Left Column: Stats & Creator Mode */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-white/10">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-6">{t('profile.creator_overview')}</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">{t('profile.published_works')}</span>
                <span className="text-white font-bold">{mySongs.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">{t('profile.total_plays')}</span>
                <span className="text-white font-bold">
                  {mySongs.reduce((acc, song) => acc + (song.play_count || 0), 0)}
                </span>
              </div>
              <div className="pt-4 border-t border-white/5 mt-4">
                <p className="text-xs text-gray-500 mb-2">{t('profile.current_balance')}</p>
                <div className="text-2xl font-black text-echo-primary">{echoBalance.toFixed(2)} ECHO</div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setIsUploading(true)}
            className="w-full group bg-gradient-to-br from-echo-primary to-echo-secondary p-1 rounded-3xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="bg-[#030303] rounded-[22px] py-6 flex flex-col items-center justify-center gap-3 group-hover:bg-transparent transition-colors">
              <Plus className="w-8 h-8 text-echo-primary group-hover:text-black" />
              <span className="text-white font-bold group-hover:text-black uppercase tracking-tighter">{t('profile.publish_new_work')}</span>
            </div>
          </button>

          {/* 专属社交邀请码 Card */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-echo-primary to-transparent opacity-30"></div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Share2 className="w-4 h-4 text-echo-primary" /> {tSafe('profile.social_rewards_title', '专属社交裂变奖励')}
            </h3>
            
            <div className="space-y-3">
              <p className="text-xs text-gray-400 leading-relaxed">
                {tSafe('profile.social_rewards_desc', '分享您的专属邀请码给好友，好友在注册时填写此码。注册成功后，新成员可得 10 ECHO 新人礼包，您将获得 5.00 ECHO 邀请人分润奖励，秒级发放到账！')}
              </p>
              
              <div className="flex gap-2">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm font-mono font-bold flex items-center justify-between overflow-hidden">
                  <span className="truncate">{profile?.display_name || user?.email?.split('@')[0] || user?.phone || 'ECHORURA_User'}</span>
                  <span className="text-[10px] bg-echo-primary/10 text-echo-primary px-2 py-0.5 rounded uppercase font-sans shrink-0 ml-2">{tSafe('profile.my_invite_code', '我的邀请码')}</span>
                </div>
                
                <button
                  onClick={handleCopyInviteCode}
                  className={`px-4 rounded-2xl flex items-center justify-center transition-all ${
                    copied 
                      ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' 
                      : 'bg-echo-primary hover:bg-echo-primary/80 text-black shadow-lg shadow-echo-primary/20 hover:scale-[1.02]'
                  }`}
                  title={tSafe('profile.copy_invite_code', '复制邀请码')}
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              <button
                onClick={handleShareMyArtistPage}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-echo-secondary via-echo-primary to-echo-secondary text-black font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.25)] mt-2"
              >
                <Share2 className="w-4 h-4 text-black" />
                <span>{copiedArtistLink ? tSafe('profile.artist_link_copied', '已复制创作者主页链接！') : tSafe('profile.share_artist_page', '推广分享我的创作者主页')}</span>
              </button>
              
              <p className="text-[10px] text-gray-500 leading-normal bg-white/5 p-3 rounded-xl border border-white/5 flex gap-1.5 items-start mt-2">
                <span className="text-echo-primary mt-0.5">💡</span>
                <span>{tSafe('profile.social_rewards_rule', '规则说明：邀请好友注册属于社区共创增长计划。每次成功邀请，奖励将以 🟢已结算 形式实时入账，可用于市集认购歌曲版权或在擂台质押！')}</span>
              </p>
            </div>
          </div>

          {/* 账户安全管理 Card */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Lock className="w-4 h-4 text-echo-primary" /> {tSafe('profile.security_mgmt', '账户安全管理')}
            </h3>
            <div className="space-y-3">
              <button 
                onClick={() => setIsChangingPassword(true)}
                className="w-full py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 hover:text-echo-primary transition-all text-sm font-bold text-gray-300 flex items-center justify-between group border border-white/5"
              >
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-400 group-hover:text-echo-primary transition-colors" /> {tSafe('profile.change_pwd', '修改账户密码')}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-echo-primary transition-colors" />
              </button>

              <button 
                onClick={() => setIsFeedbackModalOpen(true)}
                className="w-full py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 hover:text-echo-primary transition-all text-sm font-bold text-gray-300 flex items-center justify-between group border border-white/5"
              >
                <span className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-gray-400 group-hover:text-echo-primary transition-colors" /> {tSafe('profile.feedback_support', '意见与问题反馈')}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-echo-primary transition-colors" />
              </button>

              <button 
                onClick={handleSignOut}
                className="w-full py-3 px-4 rounded-2xl bg-red-500/10 hover:bg-red-500 hover:text-white transition-all text-sm font-bold text-red-400 flex items-center justify-between group border border-red-500/20"
              >
                <span>{tSafe('profile.logout', '退出当前登录')}</span>
                <ChevronRight className="w-4 h-4 text-red-400 group-hover:text-white transition-colors" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Songs List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs Navigation */}
          <div className="grid grid-cols-4 gap-1 sm:flex sm:items-center sm:gap-3 md:gap-4 border-b border-white/10 pb-4">
            <button 
              onClick={() => setActiveTab('works')}
              className={`text-[10px] xs:text-xs sm:text-sm md:text-lg font-black uppercase tracking-tighter flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap px-1 py-2.5 sm:px-4 sm:py-2 rounded-xl transition-all ${activeTab === 'works' ? 'bg-echo-primary/10 text-echo-primary' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
              <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 shrink-0" />
              <span>{t('profile.my_works')}</span>
            </button>
            <button 
              onClick={() => setActiveTab('favorites')}
              className={`text-[10px] xs:text-xs sm:text-sm md:text-lg font-black uppercase tracking-tighter flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap px-1 py-2.5 sm:px-4 sm:py-2 rounded-xl transition-all ${activeTab === 'favorites' ? 'bg-echo-primary/10 text-echo-primary' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
              <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 shrink-0" />
              <span>{t('profile.my_favorites')}</span>
            </button>
            <button 
              onClick={() => setActiveTab('follows')}
              className={`text-[10px] xs:text-xs sm:text-sm md:text-lg font-black uppercase tracking-tighter flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap px-1 py-2.5 sm:px-4 sm:py-2 rounded-xl transition-all ${activeTab === 'follows' ? 'bg-echo-primary/10 text-echo-primary' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 shrink-0" />
              <span>{t('profile.my_follows')}</span>
            </button>
            <button 
              onClick={() => setActiveTab('playlists')}
              className={`text-[10px] xs:text-xs sm:text-sm md:text-lg font-black uppercase tracking-tighter flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap px-1 py-2.5 sm:px-4 sm:py-2 rounded-xl transition-all ${activeTab === 'playlists' ? 'bg-echo-primary/10 text-echo-primary' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
              <FolderPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 shrink-0" />
              <span>{t('profile.my_playlists')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {activeTab === 'works' && (
              mySongs.length > 0 ? mySongs.map((song) => (
                <div key={song.id} className="glass-panel p-4 rounded-2xl border border-white/5 flex items-center gap-4 hover:border-echo-primary/30 transition-all group">
                  <div className="w-16 h-16 rounded-xl overflow-hidden relative">
                    <img src={song.cover_url} alt="Cover" className="w-full h-full object-cover" />
                    <div 
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                      onClick={() => playSong(song, mySongs)}
                    >
                      <Play className="w-6 h-6 text-white fill-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-bold truncate">{song.title}</h4>
                    <p className="text-[10px] text-gray-500 font-mono mt-1 flex items-center gap-2">
                      {t('profile.earning_model')}<span className="text-echo-secondary">{t('profile.audience_holder')}</span>
                      {song.is_staked && (
                        <span className="bg-echo-secondary/20 text-echo-secondary px-1.5 py-0.5 rounded text-[8px] font-bold uppercase animate-pulse">
                          {t('profile.staked_today')}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-500 uppercase">{t('profile.plays_count')}</p>
                      <p className="text-white font-bold">{song.play_count ?? 0}</p>
                    </div>
                    {/* 📝 编辑展示元数据按钮 */}
                    <button 
                      onClick={() => {
                        setEditingSong(song);
                        setEditSongLyrics(song.lyrics || '');
                        setEditSelectedGenres(song.tags || []);
                        setEditSelectedMoods(song.moods || []);
                        setEditCoverPreviewUrl(song.cover_url || '');
                        setEditCoverSource('keep');
                        setEditCoverFile(null);
                        setEditAiPrompt('');
                        setEditAiStyle('cyber');
                        fetchEditingSongArenaStatus(song.id);
                        setIsEditingSong(true);
                      }}
                      className="p-2 rounded-full hover:bg-white/10 text-echo-primary/80 hover:text-echo-primary transition-all flex items-center justify-center relative group-hover:scale-105"
                      title="编辑作品展示信息"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    
                    <button className="p-2 rounded-full hover:bg-white/5 text-gray-400">
                      <Heart className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
                  <p className="text-gray-500">{t('profile.no_works')}</p>
                </div>
              )
            )}

            {activeTab === 'favorites' && (
              myFavorites.length > 0 ? myFavorites.map((song) => (
                <div key={song.id} className="glass-panel p-4 rounded-2xl border border-white/5 flex items-center gap-4 hover:border-echo-primary/30 transition-all group">
                  <div 
                    className="w-16 h-16 rounded-xl overflow-hidden relative shrink-0 cursor-pointer"
                    onClick={() => playSong(song, myFavorites)}
                  >
                    <img src={song.cover_url} alt="Cover" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                      <Play className="w-6 h-6 text-white fill-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-bold truncate">{song.title}</h4>
                    <p className="text-xs text-gray-500 truncate mt-1">{song.artist}</p>
                  </div>
                  <button 
                    onClick={() => playSong(song, myFavorites)}
                    className="w-10 h-10 rounded-full bg-echo-primary/20 text-echo-primary flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
                  >
                    <Play className="w-5 h-5 ml-1 fill-current" />
                  </button>
                </div>
              )) : (
                <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                  <p className="text-gray-500">{t('profile.no_favorites')}</p>
                </div>
              )
            )}

            {activeTab === 'follows' && (
              myFollows.length > 0 ? myFollows.map((artist) => (
                <div key={artist.id} className="glass-panel p-4 rounded-2xl border border-white/5 flex items-center gap-4 hover:border-echo-primary/30 transition-all group cursor-pointer" onClick={() => window.location.href=`/artist/${artist.id}`}>
                  <div className="w-16 h-16 rounded-full overflow-hidden relative shrink-0 border border-white/10">
                    <img src={artist.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aria'} alt={artist.display_name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-bold truncate text-lg">{artist.display_name}</h4>
                    <p className="text-xs text-gray-500 truncate mt-1">{artist.bio || t('profile.no_bio')}</p>
                  </div>
                  <div className="text-echo-primary text-xs font-bold uppercase shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {t('profile.visit_homepage')} <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                  <p className="text-gray-500">{t('profile.no_follows')}</p>
                </div>
              )
            )}

            {activeTab === 'playlists' && (
              <div className="space-y-6">
                {/* Header Action Row */}
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-white text-lg font-black uppercase tracking-tighter">我的歌单</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mt-0.5">My Custom Playlists ({myPlaylists.length})</p>
                  </div>
                  
                  <button
                    onClick={() => setIsCreatePlaylistOpen(true)}
                    className="py-2.5 px-5 rounded-2xl bg-gradient-to-r from-echo-primary to-echo-secondary text-black font-black text-xs hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-[0_0_20px_rgba(0,240,255,0.2)] cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4" />
                    {t('playlist.create_new')}
                  </button>
                </div>

                {/* Playlist Grid */}
                {myPlaylists.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {myPlaylists.map((playlist) => {
                      const playlistSongs = playlist.playlist_songs?.map((ps: any) => ps.song).filter(Boolean) || [];
                      const songCount = playlistSongs.length;
                      
                      return (
                        <div 
                          key={playlist.id} 
                          onClick={() => setSelectedPlaylistId(playlist.id)}
                          className="glass-panel p-4 rounded-3xl border border-white/5 flex items-center gap-5 hover:border-echo-primary/30 transition-all group relative cursor-pointer"
                        >
                          {/* Cover with hover play button */}
                          <div className="w-24 h-24 rounded-2xl overflow-hidden relative bg-black/40 border border-white/10 shrink-0">
                            <img src={playlist.cover_url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400&h=400'} alt={playlist.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            {songCount > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playSong(playlistSongs[0], playlistSongs);
                                }}
                                className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-echo-primary text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-echo-primary/30 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-pointer"
                                title="播放整张歌单"
                              >
                                <Play className="w-4 h-4 fill-black ml-0.5" />
                              </button>
                            )}
                            {songCount === 0 && (
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-[10px] text-gray-400 font-bold px-2 py-1 bg-black/80 rounded border border-white/10">{t('playlist.no_songs_short')}</span>
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white text-base font-black truncate tracking-tight">{playlist.name}</h4>
                            <p className="text-[11px] text-gray-400 line-clamp-2 mt-1 leading-relaxed">{playlist.description || t('playlist.no_desc')}</p>
                            
                            <div className="flex items-center gap-3 mt-3">
                              <span className="text-[10px] bg-white/5 text-gray-400 font-bold px-2.5 py-1 rounded-full border border-white/5 flex items-center gap-1">
                                <Music className="w-3 h-3 text-echo-primary" />
                                {t('playlist.songs_count').replace('{count}', songCount.toString())}
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono">{new Date(playlist.created_at).toLocaleDateString()} 创建</span>
                            </div>
                          </div>

                          {/* Delete Action */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlaylist(playlist.id);
                            }}
                            className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-500 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all border border-transparent hover:border-red-500/20 cursor-pointer"
                            title="删除歌单"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center glass-panel rounded-3xl border border-white/5 bg-white/2 space-y-4">
                    <Folder className="w-12 h-12 text-gray-600 mx-auto animate-pulse" />
                    <div className="space-y-1">
                      <h4 className="text-white font-bold">{t('playlist.empty_list')}</h4>
                      <p className="text-xs text-gray-500">{t('playlist.no_custom_playlists')}</p>
                    </div>
                    <button
                      onClick={() => setIsCreatePlaylistOpen(true)}
                      className="py-2 px-5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition-all cursor-pointer"
                    >
                      创建首张专属歌单
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Help & Support Navigation Card (Moved below My Creations) */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">{tSafe('profile.system_support', '系统与支持 (Support)')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={() => {
                  setIsHelpModalOpen(true);
                  setActiveFaqTab('guide');
                }}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-echo-primary/30 hover:bg-white/10 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-echo-primary/10 flex items-center justify-center text-echo-primary group-hover:scale-110 transition-transform">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold">{tSafe('profile.guide_help_center', '使用指南 & 帮助中心')}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{tSafe('profile.how_to_play', '如何玩转极声音乐')}</p>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-echo-primary shrink-0"></div>
              </button>

              <button 
                onClick={() => setIsAboutModalOpen(true)}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-echo-secondary/30 hover:bg-white/10 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-echo-secondary/10 flex items-center justify-center text-echo-secondary group-hover:scale-110 transition-transform">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold">{tSafe('profile.about_compliance', '关于我们 & 合规说明')}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{tSafe('profile.mission_architecture', '使命愿景与架构公示')}</p>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-echo-secondary shrink-0"></div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Song Modal */}
      {isEditingSong && editingSong && (
        <div className="fixed top-[132px] bottom-0 left-0 right-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => !loading && setIsEditingSong(false)} />
          <div className="relative w-full max-w-4xl glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl max-h-full overflow-y-auto z-10 animate-scale-up">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                <Pencil className="w-8 h-8 text-echo-primary animate-pulse" />
                编辑作品展示信息
              </h2>
              <button 
                type="button"
                onClick={() => !loading && setIsEditingSong(false)}
                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleEditSave} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Left Column: 🔒 Immutable Web3 Registry (Locked Details) */}
              <div className="space-y-6 bg-white/[0.02] border border-white/5 p-6 rounded-2xl relative overflow-hidden">
                {/* Visual Lock Badge */}
                <div className="absolute top-4 right-4 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                  <Lock className="w-3 h-3 animate-bounce" />
                  已在去中心化链确权
                </div>

                <h3 className="text-sm font-black text-red-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  共识核心数据 (只读锁死)
                </h3>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">作品标题 (Title)</label>
                  <div className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3 px-4 text-gray-500 font-bold mt-2 flex items-center justify-between cursor-not-allowed">
                    <span>{editingSong.title}</span>
                    <Lock className="w-4 h-4 text-gray-600" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">发布艺术家 (Artist)</label>
                  <div className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3 px-4 text-gray-500 font-bold mt-2 flex items-center justify-between cursor-not-allowed">
                    <span>{editingSong.artist}</span>
                    <Lock className="w-4 h-4 text-gray-600" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">音频源文件完整性 (Audio URL / IPFS Hash)</label>
                  <div className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3 px-4 text-gray-600 font-mono text-[10px] truncate mt-2 flex items-center justify-between cursor-not-allowed">
                    <span className="truncate flex-1 pr-2">{editingSong.audio_url}</span>
                    <Lock className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  </div>
                </div>

                {/* IPO & Shares Data block */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                  <div className="bg-white/[0.01] p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] text-gray-500 uppercase font-bold">共创发行比例</p>
                    <p className="text-lg font-black text-gray-400 mt-1">{editingSong.ipo_percentage || 50}%</p>
                  </div>
                  <div className="bg-white/[0.01] p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] text-gray-500 uppercase font-bold">共创总份额</p>
                    <p className="text-lg font-black text-gray-400 mt-1">{editingSong.total_shares || 100} 份</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/10 text-[11px] text-red-300 leading-relaxed">
                  ⚠️ <strong>去中心化确权声明：</strong> 本作品的发行总比例、总份额与音频原始 Hash 均已成功上链确权。任何针对分红权益的二次篡改或物理下架申请都将被去中心化共识机制拒绝，这是为了保护所有认购听众的既得版税分红权。
                </div>

                {/* 💎 听审竞技场 (Curation Arena) 参赛状态与重赛管理 */}
                <div className="pt-6 border-t border-white/5 space-y-4">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-echo-primary" />
                    听审竞技场状态 (Curation Arena)
                  </h4>
                  
                  {isLoadingArenaStatus ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-echo-primary" />
                      正在检索作品竞演史...
                    </div>
                  ) : (
                    <>
                      {/* 1. 成功晋级 (winner) */}
                      {editingSongArenaStatus === 'winner' && (
                        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-3 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                          <span className="text-xl">🎉</span>
                          <div>
                            <p className="font-bold">恭喜！该原创作品已成功晋级！</p>
                            <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                              作品在历史听审中投票表现优异，已永久解锁平台推荐和 Sound Equity 版税分红权益。不可重复参赛。
                            </p>
                          </div>
                        </div>
                      )}

                      {/* 2. 竞演中 (pending 或 voting) */}
                      {(editingSongArenaStatus === 'pending' || editingSongArenaStatus === 'voting') && (
                        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-3 animate-pulse">
                          <span className="text-xl">⏳</span>
                          <div>
                            <p className="font-bold">竞演进行中</p>
                            <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                              该歌曲当前正处于听审竞技场 {editingSongArenaStatus === 'pending' ? '“待竞演”' : '“投票中”'} 状态。请耐心等待本轮投票结算。
                            </p>
                          </div>
                        </div>
                      )}

                      {/* 3. 未参加 (none) 或 挑战失败 (loser) */}
                      {(editingSongArenaStatus === 'none' || editingSongArenaStatus === 'loser') && (
                        <div className="space-y-3">
                          {editingSongArenaStatus === 'loser' && (
                            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-gray-400 text-xs leading-relaxed flex items-start gap-2.5">
                              <span className="text-gray-500">💡</span>
                              <div>
                                <span className="font-bold text-gray-300">历史挑战未晋级：</span>
                                没关系！音乐在打磨重制后允许再次挑战。您可以勾选下方选项重新报名。
                              </div>
                            </div>
                          )}
                          
                          <label className="block">
                            <div className={`p-4 rounded-2xl border transition-all duration-300 flex items-start gap-3 ${
                              wantsToRegisterArenaInEdit 
                                ? 'bg-echo-primary/10 border-echo-primary/40 shadow-[0_0_25px_rgba(0,240,255,0.08)] cursor-pointer' 
                                : 'bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer'
                            }`}>
                              <input 
                                type="checkbox"
                                checked={wantsToRegisterArenaInEdit}
                                onChange={(e) => {
                                  setWantsToRegisterArenaInEdit(e.target.checked);
                                }}
                                className="w-4 h-4 rounded mt-0.5 border-gray-600 text-echo-primary focus:ring-echo-primary focus:ring-offset-black bg-black cursor-pointer"
                              />
                              <div>
                                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <span>💎 报名参加听审竞技场</span>
                                  <span className="text-[9px] bg-echo-primary/20 text-echo-primary px-1.5 py-0.5 rounded font-mono">质押 10.00 ECHO</span>
                                </p>
                                <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">
                                  质押 10.00 ECHO。当作品在听众投票中票数排在前 10 名，即为挑战成功，退还全部质押金并开启全站流量推荐！若失败质押金将分发给参与投票的听众。
                                </p>
                              </div>
                            </div>
                          </label>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Right Column: ✏️ Editable Visuals & Lyric Details */}
              <div className="space-y-6">
                <h3 className="text-sm font-black text-echo-primary uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-echo-primary" />
                  创作者优化区 (允许美化)
                </h3>

                {/* Tab select Cover Source */}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-2">作品封面美化 (Cover Art)</label>
                  <div className="grid grid-cols-3 gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setEditCoverSource('keep')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${editCoverSource === 'keep' ? 'bg-echo-primary text-black shadow-lg shadow-echo-primary/20' : 'text-gray-400 hover:text-white'}`}
                    >
                      保持当前封面
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCoverSource('upload')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${editCoverSource === 'upload' ? 'bg-echo-primary text-black shadow-lg shadow-echo-primary/20' : 'text-gray-400 hover:text-white'}`}
                    >
                      上传全新封面
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCoverSource('ai')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${editCoverSource === 'ai' ? 'bg-echo-primary text-black shadow-lg shadow-echo-primary/20' : 'text-gray-400 hover:text-white'}`}
                    >
                      AI 大模型重构
                    </button>
                  </div>
                </div>

                {/* Source details */}
                {editCoverSource === 'keep' && (
                  <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl">
                    <img src={editingSong.cover_url} alt="Current Cover" className="w-20 h-20 rounded-xl object-cover border border-white/10 shadow-lg" />
                    <div>
                      <p className="text-xs font-bold text-white">当前使用的版权黑胶封面</p>
                      <p className="text-[10px] text-gray-500 mt-1">作品正在以此视觉渲染在大厅与播放页。如无更换需求，建议保持原样。</p>
                    </div>
                  </div>
                )}

                {editCoverSource === 'upload' && (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-white/10 hover:border-echo-primary/40 rounded-2xl p-6 text-center transition-all cursor-pointer relative group">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setEditCoverFile(file);
                            setEditCoverPreviewUrl(URL.createObjectURL(file));
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <ImageIcon className="w-10 h-10 text-gray-500 group-hover:text-echo-primary mx-auto mb-2 transition-colors" />
                      <p className="text-xs text-gray-400 group-hover:text-white font-bold transition-colors">
                        {editCoverFile ? editCoverFile.name : '点击或拖拽上传全新封面艺术图片'}
                      </p>
                      <p className="text-[9px] text-gray-600 mt-1">支持 PNG, JPG, JPEG格式 (推荐 1000x1000 正方形)</p>
                    </div>
                    {editCoverPreviewUrl && (
                      <div className="flex justify-center">
                        <img src={editCoverPreviewUrl} alt="New Upload Preview" className="w-32 h-32 rounded-xl object-cover border border-white/20 shadow-md" />
                      </div>
                    )}
                  </div>
                )}

                {editCoverSource === 'ai' && (
                  <div className="space-y-4 bg-white/5 border border-white/10 p-4 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-echo-primary uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                        <Palette className="w-3.5 h-3.5 text-echo-primary" />
                        AI 智能设计设置
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const promptSuggestions = [
                            "超写实浮雕，未来主义霓虹都市，发光雨夜街道，漂浮全息黑胶，高画质，电影级质感",
                            "水墨意境，金线泼墨，仙鹤飞越苍山，极简金沙，古典留白，大理石纹理",
                            "蒸汽波粉红与天蓝交织网格，流体渐变发光晶体，3D复古石膏像，粉紫晚霞",
                            "极光极简星云，深邃宇宙光线，极光绿发光微粒，迷幻梦境，温暖极光线条，8K分辨率"
                          ];
                          setEditAiPrompt(promptSuggestions[Math.floor(Math.random() * promptSuggestions.length)]);
                        }}
                        className="text-[10px] text-echo-primary hover:text-echo-primary-hover font-bold flex items-center gap-1 bg-echo-primary/10 px-2 py-1 rounded"
                      >
                        💡 随机生成灵感描述词
                      </button>
                    </div>

                    {/* Style selector */}
                    <div className="grid grid-cols-4 gap-2">
                      {['cyber', 'zen', 'vaporwave', 'ambient'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setEditAiStyle(s as any)}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-bold capitalize transition-all ${editAiStyle === s ? 'bg-white/15 text-white border border-white/20' : 'bg-transparent text-gray-500 hover:text-white border border-transparent'}`}
                        >
                          {s === 'cyber' ? '赛博霓虹' : s === 'zen' ? '水墨禅意' : s === 'vaporwave' ? '蒸汽波' : '极光治愈'}
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase">画面描述 (做图要求 / AI Prompt)</label>
                      <textarea
                        value={editAiPrompt}
                        onChange={(e) => setEditAiPrompt(e.target.value)}
                        rows={2}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white text-xs focus:border-echo-primary/50 focus:outline-none mt-2"
                        placeholder="描述您想要的画面细节（如：深海发光水母，金色浪花，梦幻星空...）"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isGeneratingEditCover}
                      onClick={generateAICoverForEdit}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-echo-primary to-echo-secondary text-black font-black text-xs hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {isGeneratingEditCover ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          正在调用 Stable Diffusion / FLUX 大模型合成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 animate-bounce" />
                          一键重构智能封面
                        </>
                      )}
                    </button>

                    {editCoverPreviewUrl && (
                      <div className="flex flex-col items-center gap-2 pt-2 border-t border-white/5">
                        <span className="text-[10px] text-gray-500 font-bold">✨ 大模型合成物理黑胶封面预览</span>
                        <img src={editCoverPreviewUrl} alt="AI Generated Preview" className="w-40 h-40 rounded-xl object-cover border border-white/20 shadow-xl" />
                      </div>
                    )}
                  </div>
                )}

                {/* Lyrics Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-1">作品歌词 (Lyrics)</label>
                    <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/5">
                      <button type="button" onClick={() => setEditLyricsMode('plain')}
                        className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-all ${editLyricsMode === 'plain' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>
                        纯文本
                      </button>
                      <button type="button" onClick={() => setEditLyricsMode('lrc')}
                        className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-all flex items-center gap-1 ${editLyricsMode === 'lrc' ? 'bg-echo-primary text-black' : 'text-gray-500 hover:text-white'}`}>
                        ⏱ LRC 时间轴
                      </button>
                    </div>
                  </div>

                  {editLyricsMode === 'lrc' && (
                    <div className="bg-echo-primary/5 border border-echo-primary/20 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] text-echo-primary font-bold uppercase tracking-widest">📌 LRC 时间轴格式说明</p>
                      <p className="text-[10px] text-gray-400 leading-relaxed font-mono">
                        每行格式：<span className="text-white">[分:秒.毫秒] 歌词文字</span><br />
                        例如：<span className="text-echo-primary">[00:12.34] 那是多年以前</span><br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-echo-primary">[00:15.80] 秋天的一个傍晚</span>
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <button type="button"
                          onClick={() => setEditSongLyrics('[00:00.00] 第一句歌词\n[00:04.00] 第二句歌词\n[00:08.00] 第三句歌词\n[00:12.00] 请替换为实际歌词与对应时间戳')}
                          className="text-[9px] text-echo-primary font-bold bg-echo-primary/10 border border-echo-primary/20 px-2.5 py-1 rounded-lg hover:bg-echo-primary/20 transition-all cursor-pointer">
                          📋 插入模板
                        </button>
                        <button type="button"
                          onClick={openEditSyncStudio}
                          className="text-[9px] text-black font-black bg-echo-primary border border-echo-primary/50 px-2.5 py-1 rounded-lg hover:bg-echo-primary/90 transition-all cursor-pointer flex items-center gap-1 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                          🎧 开启录音棚打轴模式
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea
                    value={editSongLyrics}
                    onChange={(e) => setEditSongLyrics(e.target.value)}
                    rows={5}
                    className={`w-full bg-white/5 border rounded-2xl py-3 px-4 text-white focus:outline-none mt-1 resize-none text-xs font-mono ${
                      editLyricsMode === 'lrc'
                        ? editSongLyrics && /\[\d{2}:\d{2}/.test(editSongLyrics)
                          ? 'border-echo-primary/40 focus:border-echo-primary'
                          : 'border-yellow-500/30 focus:border-yellow-500/50'
                        : 'border-white/10 focus:border-echo-primary/50'
                    }`}
                    placeholder={editLyricsMode === 'lrc'
                      ? '[00:00.00] 第一句歌词\n[00:04.50] 第二句歌词\n[00:09.00] 第三句歌词...'
                      : '输入或粘贴歌词（纯文本，将按比例滚动显示）...'}
                  />
                  {editLyricsMode === 'lrc' && editSongLyrics && (
                    <p className={`text-[9px] font-mono ${/\[\d{2}:\d{2}/.test(editSongLyrics) ? 'text-echo-primary' : 'text-yellow-400'}`}>
                      {/\[\d{2}:\d{2}/.test(editSongLyrics)
                        ? `✅ 已检测到 LRC 时间戳，共 ${(editSongLyrics.match(/\[\d{2}:\d{2}/g) || []).length} 行将精准同步`
                        : '⚠️ 未检测到时间戳，请使用 [00:00.00] 格式，否则将退回比例滚动模式'}
                    </p>
                  )}
                  {editSongLyrics && !editLyricsMode && /\[\d{2}:\d{2}/.test(editSongLyrics) && (
                    <p className="text-[9px] text-echo-primary font-mono">
                      ✅ 已检测到 LRC 时间戳格式
                    </p>
                  )}
                </div>

                {/* Genre Tags Selection */}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1 block mb-2">音乐风格标签 (Genres - 可多选)</label>
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map((g) => {
                      const isSelected = editSelectedGenres.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            setEditSelectedGenres(prev => 
                              prev.includes(g) ? prev.filter(item => item !== g) : [...prev, g]
                            );
                          }}
                          className={`py-1.5 px-3 rounded-full text-xs font-bold transition-all ${isSelected ? 'bg-echo-primary/20 text-echo-primary border border-echo-primary/50' : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'}`}
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mood Tags Selection */}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1 block mb-2">灵魂状态标签 (Moods - 可多选)</label>
                  <div className="flex flex-wrap gap-2">
                    {MOODS.map((m) => {
                      const isSelected = editSelectedMoods.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setEditSelectedMoods(prev => 
                              prev.includes(m) ? prev.filter(item => item !== m) : [...prev, m]
                            );
                          }}
                          className={`py-1.5 px-3 rounded-full text-xs font-bold transition-all ${isSelected ? 'bg-echo-secondary/20 text-echo-secondary border border-echo-secondary/50' : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'}`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setIsEditingSong(false)}
                    className="flex-1 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition-colors disabled:opacity-50"
                  >
                    取消修改
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-echo-primary to-echo-secondary text-black font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        正在加密同步中...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        保存修改并同步
                      </>
                    )}
                  </button>
                </div>

              </div>

            </form>
            
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {isUploading && (
        <div className="fixed top-[132px] bottom-0 left-0 right-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !loading && setIsUploading(false)} />
          <div className="relative w-full max-w-2xl glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl max-h-full overflow-y-auto z-10">
            <h2 className="text-3xl font-black text-white mb-8 uppercase tracking-tighter flex items-center gap-3">
              <Upload className="w-8 h-8 text-echo-primary" />
              发布作品 (Studio)
            </h2>

            <form onSubmit={handleUpload} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase ml-1">作品标题</label>
                    <input 
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-echo-primary/50 focus:outline-none mt-2"
                      placeholder="例如: Neon Dreamscape"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase ml-1">艺术家名称</label>
                    <input 
                      type="text" 
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-echo-primary/50 focus:outline-none mt-2"
                      placeholder="默认使用用户名"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-400 uppercase ml-1">作品歌词 (Lyrics)</label>
                      <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/5">
                        <button type="button" onClick={() => setUploadLyricsMode('plain')}
                          className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-all ${uploadLyricsMode === 'plain' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>
                          纯文本
                        </button>
                        <button type="button" onClick={() => setUploadLyricsMode('lrc')}
                          className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-all flex items-center gap-1 ${uploadLyricsMode === 'lrc' ? 'bg-echo-primary text-black' : 'text-gray-500 hover:text-white'}`}>
                          ⏱ LRC 时间轴
                        </button>
                      </div>
                    </div>

                    {uploadLyricsMode === 'lrc' && (
                      <div className="bg-echo-primary/5 border border-echo-primary/20 rounded-xl p-3 space-y-2">
                        <p className="text-[10px] text-echo-primary font-bold uppercase tracking-widest">📌 LRC 时间轴格式说明</p>
                        <p className="text-[10px] text-gray-400 leading-relaxed font-mono">
                          每行格式：<span className="text-white">[分:秒.毫秒] 歌词文字</span><br />
                          例如：<span className="text-echo-primary">[00:12.34] 那是多年以前</span><br />
                          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-echo-primary">[00:15.80] 秋天的一个傍晚</span>
                        </p>
                        <div className="flex gap-2 flex-wrap mt-2">
                          <button type="button"
                            onClick={openUploadSyncStudio}
                            disabled={!audioFile}
                            className="text-[10px] text-black font-black bg-echo-primary border border-echo-primary/50 px-3 py-1.5 rounded-lg hover:bg-echo-primary/90 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                            {!audioFile ? '请先选择音频' : '🎧 开启录音棚打轴模式'}
                          </button>
                          <button type="button"
                            onClick={() => setLyrics('[00:00.00] 第一句歌词\n[00:04.00] 第二句歌词\n[00:08.00] 第三句歌词\n[00:12.00] 请替换为实际歌词与对应时间戳')}
                            className="text-[9px] text-echo-primary font-bold bg-echo-primary/10 border border-echo-primary/20 px-2.5 py-1 rounded-lg hover:bg-echo-primary/20 transition-all cursor-pointer">
                            📋 LRC 模板
                          </button>
                        </div>
                      </div>
                    )}

                    <textarea
                      value={lyrics}
                      onChange={(e) => setLyrics(e.target.value)}
                      rows={5}
                      className={`w-full bg-white/5 border rounded-2xl py-3 px-4 text-white focus:outline-none mt-1 resize-none text-xs font-mono ${
                        uploadLyricsMode === 'lrc'
                          ? lyrics && /\[\d{2}:\d{2}/.test(lyrics)
                            ? 'border-echo-primary/40 focus:border-echo-primary'
                            : 'border-yellow-500/30 focus:border-yellow-500/50'
                          : 'border-white/10 focus:border-echo-primary/50'
                      }`}
                      placeholder={uploadLyricsMode === 'lrc'
                        ? '[00:00.00] 第一句歌词\n[00:04.50] 第二句歌词\n[00:09.00] 第三句歌词...'
                        : '粘贴作品歌词（纯文本，将按比例滚动显示）...'}
                    />
                    {uploadLyricsMode === 'lrc' && lyrics && (
                      <p className={`text-[9px] font-mono ${/\[\d{2}:\d{2}/.test(lyrics) ? 'text-echo-primary' : 'text-yellow-400'}`}>
                        {/\[\d{2}:\d{2}/.test(lyrics)
                          ? `✅ 已检测到 LRC 时间戳，共 ${(lyrics.match(/\[\d{2}:\d{2}/g) || []).length} 行将精准同步`
                          : '⚠️ 未检测到时间戳，请使用 [00:00.00] 格式，否则将退回比例滚动模式'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase ml-1">音乐风格 (Genres)</label>
                    <div className="flex flex-wrap gap-2 mt-2 mb-4">
                      {GENRES.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            if (selectedGenres.includes(tag)) {
                              setSelectedGenres(selectedGenres.filter(t => t !== tag));
                            } else {
                              setSelectedGenres([...selectedGenres, tag]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                            selectedGenres.includes(tag) 
                            ? 'bg-echo-primary text-black' 
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:border-echo-primary/50'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>

                    <label className="text-xs font-bold text-gray-400 uppercase ml-1">灵魂状态 (Soul States)</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {MOODS.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            if (selectedMoods.includes(tag)) {
                              setSelectedMoods(selectedMoods.filter(t => t !== tag));
                            } else {
                              setSelectedMoods([...selectedMoods, tag]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                            selectedMoods.includes(tag) 
                            ? 'bg-echo-secondary text-black' 
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:border-echo-secondary/50'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="relative group">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-1 block mb-2">上传音频文件 (MP3/WAV)</label>
                    
                    {compressionState.status === 'idle' ? (
                      <div className="mt-2 border-2 border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 group-hover:border-echo-primary/30 transition-colors relative">
                        <Music className="w-8 h-8 text-gray-500" />
                        <span className="text-xs text-gray-400">选择或拖入音频文件</span>
                        <input 
                          type="file" 
                          accept="audio/*" 
                          onChange={(e) => handleAudioSelection(e.target.files?.[0] || null)}
                          required
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                    ) : (compressionState.status === 'decoding' || compressionState.status === 'converting' || compressionState.status === 'encoding') ? (
                      <div className="mt-2 border border-echo-primary/20 bg-echo-primary/5 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 relative h-32 overflow-hidden">
                        {/* pulsing background glow */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-echo-primary/10 to-echo-secondary/10 animate-pulse" />
                        
                        {/* equalizing micro-animation */}
                        <div className="relative flex items-end gap-1.5 mb-2 h-8">
                          <span className="w-1.5 h-4 bg-echo-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <span className="w-1.5 h-7 bg-echo-secondary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                          <span className="w-1.5 h-5 bg-echo-primary rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                          <span className="w-1.5 h-6 bg-echo-secondary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                        </div>

                        {/* Text Status */}
                        <span className="text-xs font-black text-white tracking-widest text-center uppercase animate-pulse z-10">
                          {compressionState.message}
                        </span>
                        
                        {/* Progress Bar */}
                        <div className="w-4/5 h-1.5 bg-white/5 border border-white/10 rounded-full mt-2 overflow-hidden relative z-10">
                          <div 
                            className="h-full bg-gradient-to-r from-echo-primary to-echo-secondary rounded-full shadow-[0_0_8px_rgba(0,240,255,0.8)] transition-all duration-300"
                            style={{ width: `${compressionState.progress}%` }}
                          />
                        </div>
                        
                        <span className="text-[9px] text-echo-primary font-mono mt-1 tracking-wider z-10">
                          {compressionState.progress}% OPTIMIZING
                        </span>
                      </div>
                    ) : compressionState.status === 'done' ? (
                      <div className="mt-2 border border-echo-primary/30 bg-echo-primary/5 rounded-2xl p-6 flex flex-col items-center justify-center gap-1.5 relative h-32 group hover:border-echo-primary/50 transition-colors">
                        <CheckCircle2 className="w-8 h-8 text-echo-primary" />
                        <span className="text-xs text-echo-primary font-black tracking-wider uppercase">✓ 极声声码优化完成</span>
                        <p className="text-[10px] font-mono text-gray-400 max-w-full truncate px-4">
                          {audioFile?.name}
                        </p>
                        
                        <div className="flex items-center gap-2 mt-0.5 text-[9px] font-mono text-gray-500 bg-black/40 px-2 py-0.5 rounded-lg border border-white/5">
                          <span className="line-through">{(compressionState.originalSize! / (1024 * 1024)).toFixed(2)} MB</span>
                          <span className="text-echo-primary">➔ {(compressionState.compressedSize! / (1024 * 1024)).toFixed(2)} MB</span>
                          <span className="text-echo-secondary font-bold">
                            (-{((1 - compressionState.compressedSize! / compressionState.originalSize!) * 100).toFixed(1)}%)
                          </span>
                        </div>

                        {/* Allow re-selecting a different file by overlaying an invisible input */}
                        <input 
                          type="file" 
                          accept="audio/*" 
                          onChange={(e) => handleAudioSelection(e.target.files?.[0] || null)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                    ) : (
                      <div className="mt-2 border border-red-500/20 bg-red-500/5 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 relative h-32">
                        <div className="text-red-500 font-bold text-xs uppercase tracking-widest text-center">
                          {compressionState.message || '❌ 优化发生错误'}
                        </div>
                        <span className="text-[10px] text-gray-400">点击重新选择并上传</span>
                        <input 
                          type="file" 
                          accept="audio/*" 
                          onChange={(e) => handleAudioSelection(e.target.files?.[0] || null)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-400 uppercase ml-1">作品封面</label>
                      <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/5">
                        <button
                          type="button"
                          onClick={() => setCoverSource('upload')}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${coverSource === 'upload' ? 'bg-echo-primary text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                          自主上传
                        </button>
                        <button
                          type="button"
                          onClick={() => setCoverSource('ai')}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${coverSource === 'ai' ? 'bg-gradient-to-r from-echo-primary to-echo-secondary text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          AI 智能创作
                        </button>
                      </div>
                    </div>

                    {coverSource === 'upload' ? (
                      <div className="relative group">
                        <div className="mt-1 border-2 border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 group-hover:border-echo-primary/30 transition-colors relative h-32 overflow-hidden bg-black/20">
                          {coverFile ? (
                            <img src={URL.createObjectURL(coverFile)} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                          ) : <ImageIcon className="w-8 h-8 text-gray-500" />}
                          <span className="text-xs text-gray-400 relative z-10">{coverFile ? '已选择封面' : '选择或拖入封面'}</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="border border-white/10 rounded-2xl p-4 bg-white/5 space-y-4">
                        <div className="flex gap-2">
                          {(['cyber', 'zen', 'vaporwave', 'ambient'] as const).map((style) => (
                            <button
                              key={style}
                              type="button"
                              onClick={() => setAiStyle(style)}
                              className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold border uppercase transition-all ${
                                aiStyle === style 
                                  ? 'border-echo-primary bg-echo-primary/10 text-white' 
                                  : 'border-white/5 bg-black/20 text-gray-400 hover:border-white/20'
                              }`}
                            >
                              {style === 'cyber' ? '赛博霓虹' : style === 'zen' ? '水墨禅意' : style === 'vaporwave' ? '蒸汽波' : '极光治愈'}
                            </button>
                          ))}
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">画面描述 (做图要求 / AI Prompt)</label>
                            <button
                              type="button"
                              onClick={() => {
                                if (!title) {
                                  alert('请先填写作品标题，以便 AI 捕获核心意境！');
                                  return;
                                }
                                const inspirations = [
                                  `超写实浮雕，未来主义 ${aiStyle === 'cyber' ? '霓虹都市，发光雨街，漂浮全息黑胶' : aiStyle === 'zen' ? '墨水山峦叠嶂，金色朝阳，微风泛舟' : aiStyle === 'vaporwave' ? '粉红霓虹雕塑，数码落日，波形网格' : '空灵极光星云，微尘极光雾霭，发光晶体'}，高画质，电影级质感`,
                                  `极简抽象主义，${title} 情绪写照，${selectedGenres.join(' ') || '迷幻'} 音频震动，三维空间，${aiStyle === 'cyber' ? '赛博蓝绿' : aiStyle === 'zen' ? '暖金古砂' : aiStyle === 'vaporwave' ? '粉红天蓝' : '薰衣草紫'} 色调，8k渲染`,
                                  `未来写实主义，去中心化音乐节点守护者，漂浮发光声波流体，${selectedMoods.join(' ') || '孤独'} 的灵魂共鸣，数字粒子星座，唯美浪漫`
                                ];
                                const randomInspiration = inspirations[Math.floor(Math.random() * inspirations.length)];
                                setAiPrompt(randomInspiration);
                              }}
                              className="text-[9px] font-black text-echo-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              💡 随机生成灵感描述词
                            </button>
                          </div>
                          <textarea
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            rows={2}
                            maxLength={100}
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white placeholder-gray-600 focus:border-echo-primary/50 focus:outline-none resize-none"
                            placeholder="输入做图要求，例如: 赛博朋克霓虹城市、浮空飞船、发光雨街、超现实主义..."
                          />
                        </div>

                        <div className="relative h-32 rounded-xl overflow-hidden bg-black/30 border border-white/5 flex items-center justify-center">
                          {coverFile ? (
                            <>
                              <img src={URL.createObjectURL(coverFile)} className="absolute inset-0 w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-[10px] text-white font-mono bg-black/70 px-2.5 py-1 rounded-md border border-white/10">已智能排版生成</span>
                              </div>
                            </>
                          ) : (
                            <div className="text-center space-y-1">
                              <Sparkles className="w-6 h-6 text-echo-secondary mx-auto animate-pulse" />
                              <p className="text-[9px] text-gray-500">根据歌曲信息智能渲染高级艺术封面</p>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={isGeneratingCover || !title.trim()}
                          onClick={generateAICover}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-echo-primary to-echo-secondary text-black font-black text-xs hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isGeneratingCover ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              正在解析旋律与情绪...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              {coverFile ? '重新生成 AI 封面' : '一键生成智能封面'}
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Recommendation & Promotion Mode Selector */}
                  <div className="glass-panel p-4 rounded-2xl border border-white/10 bg-white/5 space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">推荐推广模式 (Promotion Selector)</label>
                    
                    <div className="grid grid-cols-1 gap-2.5">
                      {/* Option A: Regular Self-Publish */}
                      <div 
                        onClick={() => setUploadMode('regular')}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                          uploadMode === 'regular' 
                            ? 'bg-echo-primary/10 border-echo-primary/30 shadow-[0_0_15px_rgba(0,240,255,0.05)]' 
                            : 'bg-black/20 border-white/5 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-echo-primary"></span>
                            普通自主上架 (Regular Upload)
                          </div>
                          <p className="text-[9px] text-gray-500 leading-relaxed">
                            • AI 指纹质检后普通入库上架 <br />
                            • 🎁 创作者奖励：<span className="text-echo-primary font-bold">+1.00 ECHO</span>
                          </p>
                        </div>
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${uploadMode === 'regular' ? 'border-echo-primary' : 'border-white/20'}`}>
                          {uploadMode === 'regular' && <div className="w-1.5 h-1.5 bg-echo-primary rounded-full" />}
                        </div>
                      </div>

                      {/* Option B: Stake & Compete for "Today's Feature" */}
                      <div 
                        onClick={() => {
                          setUploadMode('stake');
                        }}
                        className={`p-3 rounded-xl border transition-all flex items-start justify-between bg-black/20 border-white/5 opacity-60 hover:opacity-100 cursor-pointer ${
                          uploadMode === 'stake' 
                            ? 'bg-echo-secondary/15 border-echo-secondary/30 shadow-[0_0_15px_rgba(235,0,255,0.05)] cursor-pointer opacity-100' 
                            : ''
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-echo-secondary animate-pulse"></span>
                            质押冲刺「本日推荐榜」 (Stake Curation)
                          </div>
                          <p className="text-[9px] text-gray-500 leading-relaxed">
                            • 进入「听审竞技场」竞逐 30 票 Upvote 挑战 <br />
                            • 🏆 挑战成功：<span className="text-echo-secondary font-bold">登上首页「本日推荐榜」</span>，并<span className="text-white font-bold">退回质押积分</span>！ <br />
                            • 🔽 挑战失败：质押不退并作为伯乐分红，作品保留为普通 <br />
                            • 🔒 质押数量：<span className="text-rose-400 font-bold">10.00 ECHO</span>
                          </p>
                        </div>
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${uploadMode === 'stake' ? 'border-echo-secondary' : 'border-white/20'}`}>
                          {uploadMode === 'stake' && <div className="w-1.5 h-1.5 bg-echo-secondary rounded-full" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* IPO Settings */}
                  <div className="glass-panel p-4 rounded-2xl border border-echo-primary/20 bg-echo-primary/5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-echo-primary" />
                        <span className="text-sm font-bold text-white uppercase tracking-tighter">开启歌曲共创</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={isIpoActive} 
                          onChange={(e) => setIsIpoActive(e.target.checked)}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-echo-primary"></div>
                      </label>
                    </div>

                    {isIpoActive && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase">发行总份额 (1 ECHO = 1 份)</label>
                          <input 
                            type="number" 
                            value={totalShares}
                            onChange={(e) => setTotalShares(Number(e.target.value))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white text-sm mt-1 focus:border-echo-primary/50 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase">权益出售比例: {ipoPercentage}%</label>
                          <input 
                            type="range" 
                            min="5" 
                            max="100" 
                            value={ipoPercentage}
                            onChange={(e) => setIpoPercentage(Number(e.target.value))}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-echo-secondary mt-2"
                          />
                          <div className="mt-3 p-2 bg-black/40 rounded-xl border border-white/5 space-y-1">
                            <div className="flex justify-between text-[9px]">
                              <span className="text-gray-500">听众固定收益</span>
                              <span className="text-echo-primary font-bold">30%</span>
                            </div>
                            <div className="flex justify-between text-[9px]">
                              <span className="text-gray-500">权益池分配</span>
                              <span className="text-echo-secondary font-bold">70%</span>
                            </div>
                            <div className="pt-1 border-t border-white/5 flex justify-between text-[9px]">
                              <span className="text-gray-400">你保留的权益</span>
                              <span className="text-white font-bold">{100 - ipoPercentage}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Fan Push Switch */}
                    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer" onClick={() => setPushToFollowers(!pushToFollowers)}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${pushToFollowers ? 'bg-echo-primary/20 text-echo-primary' : 'bg-gray-800 text-gray-500'}`}>
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">推送给粉丝 (Fan Push)</h4>
                          <p className="text-[10px] text-gray-400 mt-1">
                            向关注你的粉丝发送上新通知
                          </p>
                        </div>
                      </div>
                      <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${pushToFollowers ? 'bg-echo-primary' : 'bg-white/10'}`}>
                        <div className={`w-4 h-4 rounded-full bg-black transition-transform ${pushToFollowers ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Creator Agreement Checkbox */}
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 select-none animate-in fade-in slide-in-from-top-2 duration-300">
                <input 
                  type="checkbox" 
                  id="creator-agreement-check"
                  checked={agreedToCreatorAgreement}
                  onChange={(e) => setAgreedToCreatorAgreement(e.target.checked)}
                  className="w-4 h-4 rounded accent-echo-primary cursor-pointer shrink-0 mt-0.5"
                />
                <label htmlFor="creator-agreement-check" className="text-xs text-gray-400 leading-normal cursor-pointer">
                  我已认真阅读并自愿同意签署 <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsCreatorAgreementOpen(true); }} className="text-echo-primary hover:text-echo-primary-hover hover:underline font-bold cursor-pointer transition-colors">《极声音乐创作者原创作品上传与收益分配协议》</span>。我明确知悉并同意本协议第三条：<strong>作品一经发布，即自动进入听众分账及权益共创流通，因涉及多方既得财产安全，作品将永久存续在平台中，创作者不可单方面进行物理删除或物理下架。</strong>
                </label>
              </div>

              <div className="flex gap-4 pt-6">
                <button 
                  type="button"
                  onClick={() => setIsUploading(false)}
                  disabled={loading}
                  className="flex-1 py-4 rounded-2xl bg-white/5 text-gray-400 font-bold hover:bg-white/10 transition-all"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  disabled={loading || isCompressing || !agreedToCreatorAgreement}
                  className="flex-[2] bg-gradient-to-r from-echo-primary to-echo-secondary text-black font-black py-4 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      正在加密发布中...
                    </>
                  ) : isCompressing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      声码优化压缩中...
                    </>
                  ) : !agreedToCreatorAgreement ? (
                    <>
                      <Lock className="w-4 h-4 mr-1 text-black/50" />
                      请先同意签署创作者协议
                    </>
                  ) : (
                    '正式发布作品'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Creator Agreement Modal */}
      {isCreatorAgreementOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl animate-fade-in" onClick={() => setIsCreatorAgreementOpen(false)} />
          <div className="relative w-full max-w-2xl glass-panel rounded-3xl p-8 border border-white/10 shadow-[0_0_50px_rgba(0,240,255,0.15)] max-h-[85vh] overflow-y-auto z-10 animate-scale-up flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6 shrink-0">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-echo-primary" />
                极声音乐创作者原创作品上传与收益分配协议
              </h2>
              <button 
                type="button"
                onClick={() => setIsCreatorAgreementOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Terms Content */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-5 text-xs text-gray-300 leading-relaxed custom-scrollbar">
              <div className="p-3 bg-echo-primary/10 border border-echo-primary/20 rounded-xl mb-4">
                <p className="text-echo-primary font-bold">重要提示：</p>
                <p className="mt-1 text-[11px] leading-normal text-gray-300">
                  本协议是极声音乐（ECHORURA）平台与创作者之间关于原创作品上传、流通及收益分配的法律协议。<strong>在您勾选同意或上传作品前，请务必仔细阅读本协议，特别是第三条中关于作品“不可下架”与“不可删除”的重要声明。</strong>
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1.5 text-sm">第一条：引言与共识基础</h4>
                <p>
                  极声音乐是一个基于 Web3 共享经济与去中心化理念构建的音乐分发与价值共创平台。创作者在此上传、发布歌曲，即代表自愿将作品接入极声音乐的“听审竞技场（Curation Arena）”及“版权共创 Sound Equity 机制”，与听众、伯乐分享数字红利，共同打造公平、透明、自治的音乐创作新生态。
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1.5 text-sm">第二条：版权归属与非独占授权</h4>
                <p>
                  创作者对其在平台上传的作品拥有 100% 原始著作权。创作者仅非独占性、全球性、无偿地授予极声音乐在平台内传播、播放、缓存、生成动态推荐分享卡片及通过听歌挖矿分发给听众进行流媒体播放的权利。
                </p>
              </div>

              <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-xl space-y-2">
                <h4 className="font-bold text-red-400 text-sm flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  第三条：🚫 作品不可下架与不可删除声明 (Immutability Clause)
                </h4>
                <p className="text-[11px] leading-normal text-red-300">
                  极声音乐采用链上数据锚定与注意力挖矿机制。创作者一旦上传作品并成功发布：
                </p>
                <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-gray-300">
                  <li>
                    作品将立即与听众的“听歌挖矿收益”产生绑定。听众因播放、投票或发掘作品所产生的收益，在数据库中具有强一致性与金融资产属性。
                  </li>
                  <li>
                    如作品开启 Sound Equity 权益共创，投资者（听众）基于对作品的认购已持有作品的“版权份额”。该份额代表真实的未来收益分红权，属于投资者的合规资产。
                  </li>
                  <li>
                    <strong className="text-white">【非物理下架规定】</strong> <strong>为保障全体共创听众及投资人的既得资产安全，极声音乐不提供单方面物理下架或物理删除作品的功能。</strong> 作品一经成功上传，其音频指纹、源文件 Hash 及版权池数据将永久存续在极声音乐体系中，创作者终身放弃针对已关联资产的作品执行物理下架或物理删除的权利。
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1.5 text-sm">第四条：Curation Arena 质押与打榜规则</h4>
                <p>
                  创作者如选择“质押冲刺本日推荐榜”模式，需自愿质押 10.00 ECHO 作为听审保证金。平台遵循民主化听审规则。当作品在听众投票中获得的票数在前 10 名，即为挑战成功，作品将登上首页「本日推荐榜」并全额退回 10.00 ECHO 保证金。若挑战未进入前 10 名，保证金将被没收并全部作为伯乐红利自动分发给参与投票的听众。
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1.5 text-sm">第五条：收益分割与版税分润</h4>
                <p>
                  当作品开启共创 IPO 认购后，听歌挖矿产生的全部 ECHO 收益将以“30% 听众流媒体挖矿”和“70% 权益池认购分红”进行透明分配。创作者通过认购与保留份额，按比例在数据库事务中获得秒级实时分润，双方严格遵守平台的智能计算共识。
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1.5 text-sm">第六条：原创性保证与侵权处罚</h4>
                <p>
                  创作者声明并担保所上传作品完全为原创或已依法获得完整的商业授权。如发生任何涉及侵犯第三方权益的纠纷，创作者须独立承担全部法律责任，平台免责。如平台收到合理的侵权指控，为保护平台安全，有权在不通知的前提下对该作品执行“听歌屏蔽”或“暂停收益分配”等保全措施。
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1.5 text-sm">第七条：反作弊审计</h4>
                <p>
                  极声音乐严格禁止利用机器人、多开账号、模拟器等任何作弊或刷量方式恶意侵占流媒体挖矿池。系统内置 AI 流量审计引擎。一经监测到虚假播放流量，平台有权冻结相关账户的所有收益，没收质押保证金，并执行作弊地址的永久限制访问。
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreatorAgreementOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 font-bold text-xs transition-all"
              >
                关闭阅读
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgreedToCreatorAgreement(true);
                  setIsCreatorAgreementOpen(false);
                }}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-echo-primary to-echo-secondary text-black font-black text-xs hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-[0_0_20px_rgba(0,240,255,0.25)] animate-pulse"
              >
                <ShieldCheck className="w-4 h-4" />
                我自愿并同意签署此协议
              </button>
            </div>

          </div>
        </div>
      )}
      {/* Profile Edit Modal */}
      {isEditingProfile && (
        <div className="fixed top-[132px] bottom-0 left-0 right-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => !loading && setIsEditingProfile(false)} />
          <div className="relative w-full max-w-md glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl max-h-full overflow-y-auto z-10">
            <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-tighter">编辑个人资料</h2>
            
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              {/* Avatar Selection */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-3 block">选择头像 (艺名形象)</label>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {PRESET_AVATARS.map((url) => (
                    <div 
                      key={url}
                      onClick={() => setEditAvatar(url)}
                      className={`aspect-square rounded-2xl overflow-hidden cursor-pointer border-2 transition-all ${editAvatar === url ? 'border-echo-primary scale-105 shadow-[0_0_15px_rgba(0,240,255,0.3)]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    >
                      <img src={url} alt="Preset" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  <div className="relative aspect-square rounded-2xl bg-white/5 border-2 border-dashed border-white/10 flex items-center justify-center hover:border-echo-primary/50 transition-colors cursor-pointer overflow-hidden">
                    <Plus className="w-6 h-6 text-gray-500" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => e.target.files?.[0] && handleAvatarFileUpload(e.target.files[0])}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    {editAvatar && !PRESET_AVATARS.includes(editAvatar) && (
                      <img src={editAvatar} className="absolute inset-0 w-full h-full object-cover" />
                    )}
                  </div>
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">艺名 (Stage Name)</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white focus:border-echo-primary/50 focus:outline-none"
                  placeholder="输入你的舞台昵称..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">个人简介 (Bio)</label>
                <textarea 
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white focus:border-echo-primary/50 focus:outline-none custom-scrollbar min-h-[100px]"
                  placeholder="用一段话向粉丝介绍一下你自己..."
                  maxLength={500}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="flex-1 py-4 rounded-2xl bg-white/5 text-gray-400 font-bold hover:bg-white/10 transition-all"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1 bg-echo-primary text-black font-black py-4 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '保存更改'}
                </button>
              </div>
            </form>

            {/* Danger Zone */}
            <div className="mt-8 pt-6 border-t border-red-500/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h3 className="text-red-500 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                危险区域 (Danger Zone)
              </h3>
              <p className="text-[10px] text-gray-500 mb-4 leading-relaxed">
                注销账户是不可逆的操作。所有的个人隐私数据将按照香港《个人资料（私隐）条例》被彻底抹除。根据平台共享经济协定，您的已发行共创歌曲将被脱敏匿名保留以保障粉丝的权益。
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsEditingProfile(false);
                  setIsDeletingAccount(true);
                  setDeletionStep(0);
                  setDeletionConfirmText('');
                  setAgreedToTerms(false);
                }}
                className="w-full py-3 rounded-xl bg-red-950/30 border border-red-500/30 hover:bg-red-950/60 text-red-400 font-bold text-xs transition-all flex items-center justify-center gap-2 hover:border-red-500/50 cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.05)]"
              >
                <Trash2 className="w-4 h-4" />
                注销极声音乐账户
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Deletion Modal */}
      {isDeletingAccount && (
        <div className="fixed top-[132px] bottom-0 left-0 right-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => !isEraseRunning && setIsDeletingAccount(false)} />
          <div className="relative w-full max-w-xl glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl overflow-y-auto max-h-full z-10 overflow-hidden bg-black/40">
            {/* Ambient Background Glow */}
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-red-600/10 rounded-full blur-[100px] pointer-events-none"></div>
            
            {deletionStep === 0 && (
              <div className="space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                    <ShieldAlert className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                      安全注销核查 <span className="text-red-500">(Step 1/2)</span>
                    </h2>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">Asset Audit & Rights Warning</p>
                  </div>
                </div>

                <div className="p-5 bg-red-950/15 border border-red-500/20 rounded-2xl space-y-4">
                  <h4 className="text-red-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 animate-pulse shrink-0" />
                    注销资产扣留及放弃警告 (Important Notice)
                  </h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    根据极声音乐全球去中心化版权与积分共享模型，在注销您的账户之前，系统对您的名下资产进行了自动核查：
                  </p>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 py-2">
                    <div className="bg-black/30 border border-white/5 rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 uppercase">当前账户余额</p>
                      <p className="text-lg font-black text-echo-primary mt-1">
                        {echoBalance.toFixed(2)} {t('compliance.token_' + activeConfig.region.toLowerCase())}
                      </p>
                    </div>
                    <div className="bg-black/30 border border-white/5 rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 uppercase">已上架共创作品</p>
                      <p className="text-lg font-black text-echo-secondary mt-1">
                        {mySongs.length} 首 作品
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-[10px] text-gray-500 leading-relaxed pt-2 border-t border-white/5">
                    <p className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1 shrink-0"></span>
                      <span>
                        <strong className="text-red-400">账户余额放弃：</strong> 您的账户中仍存有 <span className="text-echo-primary font-bold">{echoBalance.toFixed(2)} {t('compliance.token_' + activeConfig.region.toLowerCase())}</span>。一旦完成注销，由于身份被解绑，这笔资产将永久作废且无法找回。建议您在注销前将其提现至外部钱包或进行平台消费。
                      </span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1 shrink-0"></span>
                      <span>
                        <strong className="text-red-400">版权作品存续：</strong> 您已发布的 <span className="text-white font-bold">{mySongs.length} 首</span> 作品不会被物理下架。这是因为其他社区用户可能已经认购了这些作品的 <span className="text-echo-secondary font-bold">{t('compliance.equity_' + activeConfig.region.toLowerCase())}</span>。如果下架，将侵害他们的既得收益权。
                      </span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1 shrink-0"></span>
                      <span>
                        <strong className="text-red-400">创作者匿名化：</strong> 您的 stage name 和头像数据将被清空，取而代之的是“匿名创作者 (Anonymous Creator)”标识，歌曲后续产生的任何收益均与您的个人隐私账户彻底解绑。
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDeletingAccount(false)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 text-gray-400 font-bold hover:bg-white/10 transition-all text-sm cursor-pointer"
                  >
                    取消，保留账户
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletionStep(1)}
                    className="flex-1 py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all text-sm flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(220,38,38,0.15)] cursor-pointer"
                  >
                    我已知晓，进入下一步
                  </button>
                </div>
              </div>
            )}

            {deletionStep === 1 && (
              <div className="space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                    <ShieldCheck className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                      签署存续协议与确认 <span className="text-red-500">(Step 2/2)</span>
                    </h2>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">Agreement & Verification</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Agreement Box */}
                  <div className="p-4 bg-black/40 border border-white/5 rounded-2xl max-h-48 overflow-y-auto text-[10px] text-gray-500 space-y-2 leading-relaxed font-mono">
                    <h5 className="font-bold text-gray-300 text-[11px] mb-2 uppercase">极声音乐共享资产存续与注销协议</h5>
                    <p>1. 本注销协议一经签署，即代表您与极声音乐 (ECHORURA) 之间解除全部的服务合同关系。</p>
                    <p>2. 根据智能合约的去中心化属性，用户知悉并同意其名下已发行的 MusicIP (ERC-1155) 的总供应量、被他人持有的“共创共享权益/版权股权”将永久存在于 Base Sepolia 区块链上。平台无权且无法对此进行物理销毁或冻结。</p>
                    <p>3. 用户在此不可撤销地同意：授权极声音乐将原账户下所有歌曲作品的所有人名称更改为“匿名创作者 (Anonymous Creator)”，并将其关联的头像更换为系统预设头像，以完全履行《个人资料（私隐）条例》对注销账户的个人隐私清除义务。</p>
                    <p>4. 用户知悉并同意自愿放弃注销账户内存储的所有“ECHO 积分/Token”及其他平台专属权益，平台对于未来因歌曲产生的版权分红在此账户注销后不承担任何保管、兑付、重开账户划转的法律责任。</p>
                  </div>

                  {/* Agreement Checkbox */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-1 w-4 h-4 accent-red-600 rounded border-white/10 bg-white/5 cursor-pointer shrink-0"
                    />
                    <span className="text-[11px] text-gray-400 select-none group-hover:text-white transition-colors leading-relaxed">
                      我已仔细阅读并完全同意上述《极声音乐共享资产存续与注销协议》，我在此不可撤销地确认放弃我名下的全部积分余额。
                    </span>
                  </label>

                  {/* Verification Input */}
                  <div className="pt-2">
                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
                      请输入您的艺名 <span className="text-red-500">"{profile?.display_name || user.email?.split('@')[0]}"</span> 进行最终注销确认：
                    </label>
                    <input
                      type="text"
                      value={deletionConfirmText}
                      onChange={(e) => setDeletionConfirmText(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white text-sm focus:border-red-500/50 focus:outline-none placeholder-gray-600"
                      placeholder="在此输入您的艺名以确认"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeletionStep(0)}
                    disabled={isEraseRunning}
                    className="flex-1 py-4 rounded-2xl bg-white/5 text-gray-400 font-bold hover:bg-white/10 transition-all text-sm disabled:opacity-40 cursor-pointer"
                  >
                    上一步
                  </button>
                  <button
                    type="button"
                    disabled={
                      !agreedToTerms || 
                      deletionConfirmText.trim() !== (profile?.display_name || user.email?.split('@')[0]) || 
                      isEraseRunning
                    }
                    onClick={handleAccountDeletion}
                    className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 text-white font-black transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_25px_rgba(220,38,38,0.2)] hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  >
                    {isEraseRunning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        数字足迹抹除中...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 shrink-0" />
                        我确认注销并抹除隐私
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {deletionStep === 2 && (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-6 relative z-10 animate-in zoom-in-95 duration-1000">
                <div className="relative">
                  {/* Pulsing ring animation */}
                  <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping duration-1000"></div>
                  <div className="w-20 h-20 rounded-full bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-400 relative z-10 shadow-[0_0_30px_rgba(220,38,38,0.2)] animate-pulse">
                    <Sparkles className="w-10 h-10" />
                  </div>
                </div>
                
                <div className="space-y-2 max-w-sm">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">数字痕迹抹除完毕</h3>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Digital consciousness faded successfully</p>
                  <p className="text-xs text-gray-400 leading-relaxed pt-2">
                    正在解除您与极声音乐 (ECHORURA) 的所有数字链结... <br />
                    感谢您曾经与我们共享这段美妙的音乐共创旅程！
                  </p>
                </div>
                
                <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden relative">
                  <div 
                    className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-red-500 to-rose-600 transition-all duration-30 rounded-full"
                    style={{ width: `${deletionProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FAQ / Help Center Modal */}
      {isHelpModalOpen && (
        <div className="fixed top-[132px] bottom-0 left-0 right-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsHelpModalOpen(false)} />
          <div className="relative w-full max-w-3xl glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl overflow-y-auto z-10 overflow-hidden bg-[#0a0a0c]/80 max-h-full flex flex-col">
            {/* Ambient Background Glow */}
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-echo-primary/10 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Header */}
            <div className="flex items-center justify-between pb-6 border-b border-white/5 relative z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-echo-primary/10 border border-echo-primary/30 flex items-center justify-center text-echo-primary">
                  <Info className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{tSafe('profile.help_center_title', '极声帮助中心 (Help Center)')}</h2>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">{tSafe('profile.help_center_subtitle', 'Platform FAQ & Creator Guide')}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsHelpModalOpen(false)}
                className="py-2 px-4 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 text-xs transition-colors cursor-pointer"
              >
                {tSafe('profile.close_faq', '关闭')}
              </button>
            </div>

            {/* Main Section */}
            <div className="flex flex-col md:flex-row gap-6 mt-6 overflow-hidden flex-1 relative z-10">
              {/* Tab Navigation */}
              <div className="md:w-48 shrink-0 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
                <button
                  onClick={() => setActiveFaqTab('guide')}
                  className={`py-3 px-4 rounded-xl text-xs font-bold text-left whitespace-nowrap cursor-pointer transition-all ${activeFaqTab === 'guide' ? 'bg-echo-primary text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                >
                  {tSafe('profile.tab_guide', '🚀 平台使用指南')}
                </button>
                <button
                  onClick={() => setActiveFaqTab('credits')}
                  className={`py-3 px-4 rounded-xl text-xs font-bold text-left whitespace-nowrap cursor-pointer transition-all ${activeFaqTab === 'credits' ? 'bg-echo-primary text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                >
                  {tSafe('profile.tab_credits', '🪙 {token}获取').replace('{token}', tSafe('compliance.token_' + activeConfig.region.toLowerCase(), '积分'))}
                </button>
                <button
                  onClick={() => setActiveFaqTab('equity')}
                  className={`py-3 px-4 rounded-xl text-xs font-bold text-left whitespace-nowrap cursor-pointer transition-all ${activeFaqTab === 'equity' ? 'bg-echo-primary text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                >
                  {tSafe('profile.tab_equity', '🎼 {equity}').replace('{equity}', tSafe('compliance.equity_' + activeConfig.region.toLowerCase(), '版权股权'))}
                </button>
                <button
                  onClick={() => setActiveFaqTab('arena')}
                  className={`py-3 px-4 rounded-xl text-xs font-bold text-left whitespace-nowrap cursor-pointer transition-all ${activeFaqTab === 'arena' ? 'bg-echo-primary text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                >
                  {tSafe('profile.tab_arena', '🏆 听审竞技场机制')}
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 text-gray-400 text-xs leading-relaxed max-h-[50vh] md:max-h-none">
                {activeFaqTab === 'guide' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                      <span className="w-1.5 h-3 bg-echo-primary rounded-full"></span>
                      {renderHelpText('profile.guide_title', '极声音乐快速上手指南 (ECHORURA Platform Guide)')}
                    </h3>
                    <p className="text-gray-400" dangerouslySetInnerHTML={{ __html: renderHelpText('profile.guide_desc', '欢迎来到极声音乐！本平台采用去中心化的共享共创模型，为乐迷和创作者构建起无中介的价值链接。以下是核心使用方法：') }} />

                    <div className="space-y-3">
                      <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5">
                        <h4 className="font-bold text-white mb-1">{renderHelpText('profile.guide_step1_title', '第一步：加入平台与获取初始积分')}</h4>
                        <p className="text-[11px] text-gray-500" dangerouslySetInnerHTML={{ __html: renderHelpText('profile.guide_step1_desc', '注册并登录极声账户后，系统会自动为你建立去中心化标识。你可通过完成日常活动（如收听、打榜、签到等）轻松积累创作者初始的 <strong>{t(\'compliance.token_\' + activeConfig.region.toLowerCase())}</strong>，或通过充值入口划转所需积分。') }} />
                      </div>

                      <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5">
                        <h4 className="font-bold text-white mb-1">{renderHelpText('profile.guide_step2_title', '第二步：参与优秀歌曲的“共创共享”')}</h4>
                        <p className="text-[11px] text-gray-500" dangerouslySetInnerHTML={{ __html: renderHelpText('profile.guide_step2_desc', '在“共创市场 (Studio/Market)”中，优秀创作者在发布新歌时通常会拿出一部分（如 50%）的 <strong>{t(\'compliance.equity_\' + activeConfig.region.toLowerCase())}</strong> 进行社区发行。你可以使用 <strong>{t(\'compliance.token_\' + activeConfig.region.toLowerCase())}</strong> 认购这些份额，成为这首歌曲的社区“共创合伙人”。') }} />
                      </div>

                      <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5">
                        <h4 className="font-bold text-white mb-1">{renderHelpText('profile.guide_step3_title', '第三步：歌曲播放，全自动分红共享')}</h4>
                        <p className="text-[11px] text-gray-500" dangerouslySetInnerHTML={{ __html: renderHelpText('profile.guide_step3_desc', '一旦该歌曲在平台被乐迷播放，其产生的播放收益将触发<strong>去中心化分配协议</strong>，按秒自动分红。其中 30% 分配给当前收听的乐迷，另外 70% 分配给持有这首歌的全体“权益持有人”（包括你和创作者本身）。') }} />
                      </div>

                      <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5">
                        <h4 className="font-bold text-white mb-1">{renderHelpText('profile.guide_step4_title', '第四步：创作者发布作品与竞技打榜')}</h4>
                        <p className="text-[11px] text-gray-500" dangerouslySetInnerHTML={{ __html: renderHelpText('profile.guide_step4_desc', '如果你是创作者，可以直接上传作品。为了能让歌曲直接登上首页“本日推荐榜”获得曝光，建议使用 10 ECHO 积分参与“去中心化听审竞技场”，通过大众投票赢取返还和超级推广资源。') }} />
                      </div>
                    </div>
                  </div>
                )}

                {activeFaqTab === 'credits' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                      <span className="w-1.5 h-3 bg-echo-primary rounded-full"></span>
                      {renderHelpText('profile.credits_title', '如何获取与使用 {token}？')}
                    </h3>
                    
                    <div className="space-y-4 font-mono">
                      <div>
                        <h4 className="font-bold text-gray-300">{renderHelpText('profile.credits_q1', 'Q: 什么是 {token}？')}</h4>
                        <p className="mt-1 text-gray-400" dangerouslySetInnerHTML={{ __html: renderHelpText('profile.credits_a1', '这是极声去中心化社区中唯一流转的系统积分凭证。可用于认购歌曲的<strong>{t(\'compliance.equity_\' + activeConfig.region.toLowerCase())}</strong>、给喜欢的作品打榜投票、打赏创作者，或者充值和划转。') }} />
                      </div>

                      <div>
                        <h4 className="font-bold text-gray-300">{renderHelpText('profile.credits_q2', 'Q: 如何免费“听歌挖矿”获取积分？')}</h4>
                        <p className="mt-1 text-gray-400" dangerouslySetInnerHTML={{ __html: renderHelpText('profile.credits_a2', '当你在极声音乐收听任何歌曲时，每一次播放产生的收益，都会分出 30% 作为<strong>聆听激励</strong>当即返还到你的平台账户。也就是说，听歌即可持续产生积分！') }} />
                      </div>

                      <div>
                        <h4 className="font-bold text-gray-300">{renderHelpText('profile.credits_q3', 'Q: 创作者有什么免费获取途径？')}</h4>
                        <p className="mt-1 text-gray-400" dangerouslySetInnerHTML={{ __html: renderHelpText('profile.credits_a3', '每当创作者成功发布一首原创歌曲，平台会自动派发 <strong>1.00 ECHO 积分</strong> 的普通发布补贴，鼓励持续创作。') }} />
                      </div>

                      <div>
                        <h4 className="font-bold text-gray-300">{renderHelpText('profile.credits_q4', 'Q: 支持法币充值吗？')}</h4>
                        <p className="mt-1 text-gray-400" dangerouslySetInnerHTML={{ __html: renderHelpText('profile.credits_a4', '支持。极声对接了安全的法币（如港币 HKD / 美元 USD）积分充值接口，可在个人账户余额处点击充值，按照约 {activeConfig.fiatExchangeRateText} 的固定兑换比例一键购入。') }} />
                      </div>
                    </div>
                  </div>
                )}

                {activeFaqTab === 'equity' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                      <span className="w-1.5 h-3 bg-echo-primary rounded-full"></span>
                      {renderHelpText('profile.equity_title', '理解“{equity}”分成机制')}
                    </h3>

                    <div className="space-y-4">
                      <p dangerouslySetInnerHTML={{ __html: renderHelpText('profile.equity_desc', '极声倡导的是“共创共享”的音乐共享经济理念。每一首发布的优秀歌曲都不再专属于创作者一人，而是属于所有支持过它的社区粉丝。') }} />

                      <div className="bg-black/20 p-3.5 rounded-xl border border-white/5 space-y-2">
                        <h4 className="font-bold text-white text-[11px] uppercase">{renderHelpText('profile.equity_section1_title', '1. 什么是共创认购 (Music IPO)？')}</h4>
                        <p className="text-gray-500" dangerouslySetInnerHTML={{ __html: renderHelpText('profile.equity_section1_desc', '创作者在上架歌曲时，可开启“歌曲共创”并设定发行总份额。例如：设定总权益 1000 份，出售 50%。乐迷们可以使用积分进行认购，这些购买积分将划转给创作者，用于补贴前期的音乐制作成本。') }} />
                      </div>

                      <div className="bg-black/20 p-3.5 rounded-xl border border-white/5 space-y-2">
                        <h4 className="font-bold text-white text-[11px] uppercase">{renderHelpText('profile.equity_section2_title', '2. 分红是如何自动分配的？')}</h4>
                        <p className="text-gray-500" dangerouslySetInnerHTML={{ __html: renderHelpText('profile.equity_section2_desc', '当用户在线播放这首歌时，单次收听产生的平台总收益池中：\n• <strong>30%</strong> 直接作为“收听奖励”到账给收听的这位乐迷；\n• <strong>70%</strong> 作为“共创分红收益”注入这首歌的歌曲公共收益池，并按照全体权益人的持股比例，全自动发放到账！即使原作者离线或注销，这笔收益依然会永久有效。') }} />
                      </div>
                    </div>
                  </div>
                )}

                {activeFaqTab === 'arena' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                      <span className="w-1.5 h-3 bg-echo-primary rounded-full"></span>
                      {renderHelpText('profile.arena_title', '什么是“三日循环竞技赛制”？')}
                    </h3>

                    <div className="space-y-4 font-mono text-[11px]">
                      <div>
                        <h4 className="font-bold text-gray-300">{renderHelpText('profile.arena_q1', 'Q: 什么是“听审竞技场”的三日运转周期？')}</h4>
                        <p className="mt-1 text-gray-400" dangerouslySetInnerHTML={{ __html: renderHelpText('profile.arena_a1', '为提升打榜含金量，极声设计了滚动式的**“三日周期竞争淘汰制”**：\n• <strong>第一天：报名期 (Registration Day)</strong> — 开放打榜报名，创作者可通过质押 10.00 ECHO 发起打榜申请。<strong>每日名额仅限 20 首</strong>，满额即关闭报名通道。\n• <strong>第二天：听审期 (Voting Day)</strong> — 报名曲目锁定，进入盲听分发池。社区用户（听审员）在此阶段进行试听并投下 Upvote（支持）或 Down（下沉）选票，系统实时排序计算排名。\n• <strong>第三天：公示榜单期 (Showcase Day)</strong> — 投票截止。胜出的优秀作品将正式登上极声主页黄金曝光位 <strong>“今日推荐榜”</strong>！') }} />
                      </div>

                      <div>
                        <h4 className="font-bold text-gray-300">{renderHelpText('profile.arena_q2', 'Q: 淘汰规则与保证金分红如何结算？')}</h4>
                        <p className="mt-1 text-gray-400" dangerouslySetInnerHTML={{ __html: renderHelpText('profile.arena_a2', '根据每轮批次报名的歌曲总数，结算规则如下：\n<strong>1. 单期报名歌曲达 10 首 or 以上（最高 20 首）：</strong>\n• <strong>第 1 至 10 名（胜出）</strong>：歌曲成功晋级首页<strong>“今日推荐榜”</strong>，并<strong>全额退回 10.00 ECHO 保证金</strong>！\n• <strong>第 11 名及以后（淘汰）</strong>：歌曲转为普通作品；创作者质押的 <strong>10.00 ECHO 保证金被没收，实时平分给所有参与本次打分投票的听审员</strong>，作为对社区伯乐的劳动报酬。\n<strong>2. 单期报名歌曲不足 10 首时（少人兜底保护）：</strong>\n• <strong>全员免遭淘汰</strong>：所有报名歌曲无视竞争直接成功晋级首页<strong>“今日推荐榜”</strong>！\n• <strong>质押伯乐分红</strong>：在此情况下，创作者的 <strong>10.00 ECHO 保证金不予退还，而是全部充作社区伯乐激励，均匀平分给本期参与投票的所有听审员</strong>。') }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* About Us / Compliance Modal */}
      {isAboutModalOpen && (
        <div className="fixed top-[132px] bottom-0 left-0 right-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsAboutModalOpen(false)} />
          <div className="relative w-full max-w-xl glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl overflow-y-auto max-h-full z-10 overflow-hidden bg-[#0d0d11]/90">
            {/* Ambient Background Glow */}
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-echo-secondary/10 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="space-y-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-echo-secondary/10 border border-echo-secondary/30 flex items-center justify-center text-echo-secondary">
                  <ShieldCheck className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{t('profile.about_compliance_title')}</h2>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">{t('profile.about_compliance_subtitle')}</p>
                </div>
              </div>

              <div className="space-y-4 text-xs text-gray-400 leading-relaxed font-mono">
                {/* === 关于我们 === */}
                <div className="pb-4 border-b border-white/5">
                  <h4 className="font-black text-white text-sm mb-2 uppercase tracking-widest">{t('profile.about_us_section_title')}</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed" dangerouslySetInnerHTML={{
                    __html: t('profile.about_us_desc')
                  }} />
                  <div className="mt-3 flex flex-col gap-1">
                    <p className="text-[10px] text-gray-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-echo-primary inline-block"></span>
                      {t('profile.about_us_contact')}<a href="mailto:echorura@piscesoul.cn" className="text-echo-primary font-bold hover:underline">echorura@piscesoul.cn</a>
                    </p>
                    <p className="text-[10px] text-gray-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-echo-secondary inline-block"></span>
                      V1.5.0 &nbsp;© {new Date().getFullYear()} {t('profile.about_us_rights')}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-white mb-1">{t('profile.mission_vision_title')}</h4>
                  <p className="text-[11px] text-gray-500" dangerouslySetInnerHTML={{
                    __html: t('profile.mission_vision_desc')
                  }} />
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                  <h4 className="font-bold text-white text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {t('profile.compliance_status_title')}
                  </h4>
                  
                  <div className="space-y-1.5 text-[10px] text-gray-500">
                    <p className="flex justify-between">
                      <span>{t('profile.compliance_entity_version')}</span>
                      <span className="text-white font-bold">
                        {(activeConfig.region as string) === 'HK' ? t('profile.compliance_entity_hk') : (activeConfig.region as string) === 'SG' ? t('profile.compliance_entity_sg') : t('profile.compliance_entity_global')}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span>{t('profile.compliance_core_tech')}</span>
                      <span className="text-echo-primary font-bold">{t('profile.compliance_core_tech_val')}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>{t('profile.compliance_exemption')}</span>
                      <span className="text-echo-secondary font-bold">{t('profile.compliance_exemption_val')}</span>
                    </p>
                  </div>
                </div>

                {/* Web3 specific address rendering - strictly hidden on HK version */}
                {(activeConfig.region as string) !== 'HK' ? (
                  <div className="p-4 border border-echo-primary/20 bg-echo-primary/5 rounded-2xl space-y-3">
                    <h4 className="font-bold text-white text-[11px] flex items-center gap-1.5 uppercase tracking-tighter">
                      ⛓️ Web3 Smart Contracts Addresses
                    </h4>
                    <p className="text-[9px] text-gray-500 leading-relaxed">
                      Below are the official smart contract addresses deployed on the Base Sepolia Testnet, 100% verified on Sourcify:
                    </p>
                    <div className="space-y-1.5 text-[9px] font-mono text-gray-400">
                      <div className="flex justify-between">
                        <span>EchoToken ERC-20:</span>
                        <a href="https://sepolia.basescan.org/address/0x462a9C1FC3f69C8b663B9d365bb30e690D7f3094" target="_blank" rel="noopener noreferrer" className="text-echo-primary hover:underline">0x462a...3094 ↗</a>
                      </div>
                      <div className="flex justify-between">
                        <span>MiningPool Contract:</span>
                        <a href="https://sepolia.basescan.org/address/0x6bB3b6D3f580Fe5cd680e96c78c1214B05B1E744" target="_blank" rel="noopener noreferrer" className="text-echo-primary hover:underline">0x6bB3...E744 ↗</a>
                      </div>
                      <div className="flex justify-between">
                        <span>MusicIP ERC-1155:</span>
                        <a href="https://sepolia.basescan.org/address/0xEDe38Ab93a9fD25E594a85819A50583b47F0a11e" target="_blank" rel="noopener noreferrer" className="text-echo-primary hover:underline">0xEDe3...a11e ↗</a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border border-emerald-500/10 bg-emerald-500/5 rounded-2xl">
                    <p className="text-[10px] text-gray-500 leading-relaxed" dangerouslySetInnerHTML={{
                      __html: t('profile.compliance_transparency_disclosure')
                    }} />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsAboutModalOpen(false)}
                className="w-full py-4 rounded-2xl bg-white/5 text-gray-400 font-bold hover:bg-white/10 hover:text-white transition-all text-sm cursor-pointer"
              >
                {t('profile.compliance_button')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAP SYNC STUDIO MODAL */}
      {isSyncStudioOpen && (
        <TapSyncStudio
          audioUrl={syncAudioUrl}
          initialLyrics={syncInitialText}
          onComplete={(resultLrc) => {
            if (syncMode === 'upload') {
              setLyrics(resultLrc);
              setUploadLyricsMode('lrc');
            } else {
              setEditSongLyrics(resultLrc);
              setEditLyricsMode('lrc');
            }
            setIsSyncStudioOpen(false);
          }}
          onCancel={() => setIsSyncStudioOpen(false)}
        />
      )}

      {/* CHANGE PASSWORD MODAL */}
      {isChangingPassword && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsChangingPassword(false)} />
          <div className="relative w-full max-w-md glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl bg-[#0d0d11]/90 z-10 overflow-hidden">
            <button 
              onClick={() => setIsChangingPassword(false)} 
              className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="mb-6">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                <Lock className="w-6 h-6 text-echo-primary" /> {t('profile.change_password_title')}
              </h2>
              <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">{t('profile.change_password_subtitle')}</p>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t('profile.change_password_new_label')}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-echo-primary/50 focus:outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t('profile.change_password_confirm_label')}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-echo-primary/50 focus:outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={changePasswordLoading}
                className="w-full mt-2 bg-gradient-to-r from-echo-primary to-echo-secondary text-black font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {changePasswordLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('profile.change_password_loading')}
                  </>
                ) : t('profile.change_password_submit')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FEEDBACK WORK ORDER MODAL */}
      {isFeedbackModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => !feedbackSending && setIsFeedbackModalOpen(false)} />
          <div className="relative w-full max-w-lg glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl bg-[#0d0d11]/95 z-10 overflow-hidden animate-scale-up">
            <button 
              onClick={() => !feedbackSending && setIsFeedbackModalOpen(false)} 
              className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="mb-6">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                <Info className="w-6 h-6 text-echo-primary" /> {t('profile.feedback_title')}
              </h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">{t('profile.feedback_subtitle')}</p>
            </div>

            <form onSubmit={handleSendFeedback} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t('profile.feedback_username_label')}</label>
                <div className="relative">
                  <div className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-gray-400 font-bold select-none cursor-not-allowed">
                    {profile?.display_name || user?.email?.split('@')[0] || user?.phone || 'ECHORURA_User'}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t('profile.feedback_content_label')}</label>
                <textarea 
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  required
                  rows={6}
                  disabled={feedbackSending}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-white focus:border-echo-primary/50 focus:outline-none transition-all resize-none text-sm placeholder:text-gray-600"
                  placeholder={t('profile.feedback_placeholder')}
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button 
                  type="button"
                  disabled={feedbackSending}
                  onClick={() => {
                    setFeedbackContent('');
                    setIsFeedbackModalOpen(false);
                  }}
                  className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-gray-300 font-bold hover:bg-white/10 transition-all text-sm active:scale-98 cursor-pointer"
                >
                  {t('profile.feedback_cancel')}
                </button>
                <button 
                  type="submit" 
                  disabled={feedbackSending}
                  className="flex-1 bg-gradient-to-r from-echo-primary to-echo-secondary text-black font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {feedbackSending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-black shrink-0" />
                      {t('profile.feedback_sending')}
                    </>
                  ) : t('profile.feedback_send')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE PLAYLIST MODAL */}
      {isCreatePlaylistOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => !playlistLoading && setIsCreatePlaylistOpen(false)} />
          <div className="relative w-full max-w-lg glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl bg-[#0d0d11]/95 z-10 overflow-y-auto max-h-[90vh] custom-scrollbar animate-scale-up">
            <button 
              type="button"
              onClick={() => !playlistLoading && setIsCreatePlaylistOpen(false)} 
              className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="mb-6">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                <FolderPlus className="w-6 h-6 text-echo-primary" /> 创建我的专属歌单
              </h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Create Your Custom Playlist Collection</p>
            </div>

            <form onSubmit={handleCreatePlaylist} className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">歌单名称 (Name) *</label>
                <input 
                  type="text" 
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  required
                  maxLength={50}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-echo-primary/50 focus:outline-none transition-all placeholder:text-gray-600 text-sm font-bold"
                  placeholder="我的私人治愈电台..."
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">描述内容 (Description)</label>
                <textarea 
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  rows={3}
                  maxLength={200}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-echo-primary/50 focus:outline-none transition-all resize-none text-sm placeholder:text-gray-600"
                  placeholder="用这张歌单记录我深夜漫步的心情，以及那些闪烁的赛博音波..."
                />
              </div>

              {/* Cover Source Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">歌单封面 (Cover Image)</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPlaylistCoverSource('default')}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${newPlaylistCoverSource === 'default' ? 'bg-echo-primary/10 text-echo-primary border-echo-primary/30' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}
                  >
                    默认艺术封面
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPlaylistCoverSource('upload')}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${newPlaylistCoverSource === 'upload' ? 'bg-echo-primary/10 text-echo-primary border-echo-primary/30' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}
                  >
                    本地上传
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPlaylistCoverSource('ai')}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${newPlaylistCoverSource === 'ai' ? 'bg-echo-primary/10 text-echo-primary border-echo-primary/30' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}
                  >
                    ✨ AI 封面生成
                  </button>
                </div>
              </div>

              {/* Dynamic Cover Inputs */}
              {newPlaylistCoverSource === 'default' && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-black/40 border border-white/10 overflow-hidden relative">
                    <img src={newPlaylistCoverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80'} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h5 className="text-white text-xs font-bold">默认精致封面</h5>
                    <p className="text-[10px] text-gray-500 mt-0.5">将自动分配一张极富声学张力的摄影或数码平面艺术大图作为歌单标志。</p>
                  </div>
                </div>
              )}

              {newPlaylistCoverSource === 'upload' && (
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 hover:border-echo-primary/30 rounded-2xl cursor-pointer hover:bg-white/5 transition-all relative overflow-hidden group">
                    {newPlaylistCoverFile ? (
                      <div className="absolute inset-0">
                        <img src={URL.createObjectURL(newPlaylistCoverFile)} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">重新选择</div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon className="w-8 h-8 text-gray-500 mb-2 group-hover:text-echo-primary transition-colors" />
                        <p className="text-xs text-gray-400 font-bold">点击上传本地封面图片</p>
                        <p className="text-[10px] text-gray-600 mt-1 font-mono">PNG, JPG (5MB以内)</p>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files?.[0]) setNewPlaylistCoverFile(e.target.files[0]);
                      }}
                    />
                  </label>
                </div>
              )}

              {newPlaylistCoverSource === 'ai' && (
                <div className="space-y-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex gap-4">
                    {/* AI Preview */}
                    <div className="w-24 h-24 rounded-2xl border border-white/10 overflow-hidden bg-black relative shrink-0 flex items-center justify-center">
                      {newPlaylistCoverUrl ? (
                        <img src={newPlaylistCoverUrl} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-2 text-center">
                          <Sparkles className="w-6 h-6 text-echo-primary animate-pulse" />
                          <span className="text-[8px] text-gray-600 font-mono mt-1">AWAITING AI GENERATOR</span>
                        </div>
                      )}
                      {isGeneratingPlaylistCover && (
                        <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-center p-1">
                          <Loader2 className="w-6 h-6 animate-spin text-echo-primary" />
                          <span className="text-[8px] text-echo-primary font-bold uppercase mt-1 animate-pulse">绘制中...</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-3">
                      {/* AI Style */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">艺术视觉风格 (Style)</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { key: 'cyber', name: '⚡ 赛博朋克' },
                            { key: 'zen', name: '🍂 写意东方' },
                            { key: 'vaporwave', name: '🌐 蒸汽波' },
                            { key: 'ambient', name: '✨ 极光氛围' }
                          ].map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => setNewPlaylistAiStyle(item.key as any)}
                              className={`py-1.5 rounded-lg border text-[10px] font-black transition-all ${newPlaylistAiStyle === item.key ? 'bg-echo-primary/10 text-echo-primary border-echo-primary/30' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Prompt */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">画面提示词 / 意境描绘 (AI Prompt Hint)</span>
                    <textarea
                      value={newPlaylistAiPrompt}
                      onChange={(e) => setNewPlaylistAiPrompt(e.target.value)}
                      rows={2}
                      maxLength={100}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-echo-primary/50 focus:outline-none transition-all placeholder:text-gray-600"
                      placeholder="例如: 深海中的发光巨鲸，极简线条，未来主义科技底色..."
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isGeneratingPlaylistCover}
                    onClick={generateAICoverForPlaylist}
                    className="w-full py-2.5 rounded-xl bg-echo-primary/10 border border-echo-primary/20 text-echo-primary font-bold text-xs hover:bg-echo-primary/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isGeneratingPlaylistCover ? '正在进行高级声学视觉渲染...' : '✨ 生成专属 AI 智能艺术封面'}
                  </button>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-4 pt-2">
                <button 
                  type="button"
                  disabled={playlistLoading}
                  onClick={() => setIsCreatePlaylistOpen(false)}
                  className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-gray-300 font-bold hover:bg-white/10 transition-all text-sm active:scale-98 cursor-pointer"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  disabled={playlistLoading}
                  className="flex-1 bg-gradient-to-r from-echo-primary to-echo-secondary text-black font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {playlistLoading ? <Loader2 className="w-5 h-5 animate-spin text-black" /> : '立即创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Playlist Detail Modal */}
      {selectedPlaylistId && (
        <PlaylistDetailModal
          playlistId={selectedPlaylistId}
          onClose={() => setSelectedPlaylistId(null)}
        />
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20 bg-black min-h-screen">
        <div className="w-8 h-8 border-4 border-echo-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
