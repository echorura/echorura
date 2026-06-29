import { createClient } from '@/utils/supabase/server';
import { Metadata } from 'next';
import HomeClientPage from './HomeClientPage';

interface Props {
  searchParams: Promise<{ songId?: string; playlistId?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { songId, playlistId } = await searchParams;
  
  if (playlistId) {
    try {
      const supabase = await createClient();
      const { data: playlist } = await supabase
        .from('playlists')
        .select('*, creator:profiles(display_name, avatar_url)')
        .eq('id', playlistId)
        .single();

      if (playlist) {
        const title = playlist.name || '极声歌单';
        const creator = playlist.creator?.display_name || '极声用户';
        const cover = playlist.cover_url || 'https://www.echora.cn/logo.png';
        const desc = `快来听听这个精选歌单！《${title}》- 由 @${creator} 精选创建，听歌共享收益。`;

        return {
          title: `ECHORURA推荐歌单【${title}】 - @${creator}`,
          description: desc,
          openGraph: {
            title: `ECHORURA推荐歌单【${title}】 - @${creator}`,
            description: desc,
            images: [
              {
                url: cover,
                width: 300,
                height: 300,
                alt: title,
              },
            ],
            type: 'music.playlist',
          },
        };
      }
    } catch (err) {
      console.error('Error generating playlist metadata in Home:', err);
    }
  }

  if (!songId) {
    return {
      title: '极声音乐 / 去中心化音乐分发平台',
      description: '极声音乐 · Web3 驱动 of 去中心化音乐分发与 ECHO 积分生态',
      openGraph: {
        title: '极声音乐 / 去中心化音乐分发平台',
        description: '极声音乐 · Web3 驱动 of 去中心化音乐分发与 ECHO 积分生态',
        images: [
          {
            url: 'https://www.echora.cn/logo.png',
            width: 300,
            height: 300,
            alt: '极声音乐 ECHORURA',
          },
        ],
      },
    };
  }

  try {
    const supabase = await createClient();
    const { data: song } = await supabase
      .from('songs')
      .select('*, creator:profiles(display_name, avatar_url)')
      .eq('id', songId)
      .single();

    if (!song) {
      return {
        title: '极声音乐 / 去中心化音乐分发平台',
        description: '极声音乐 · Web3 驱动的去中心化音乐分发与 ECHO 积分生态',
      };
    }

    const title = song.title || '极声音轨';
    const artist = song.artist || song.creator?.display_name || '极声创作者';
    const cover = song.cover_url || song.cover || 'https://www.echora.cn/logo.png';
    const desc = `快来听听这首歌！《${title}》- ${artist}，听歌还能获取 ECHO 挖矿奖励！认购音乐共创股权获取分成收益，点击立刻收听。`;

    return {
      title: `ECHORURA推荐【${title}】-${artist}`,
      description: desc,
      openGraph: {
        title: `ECHORURA推荐【${title}】-${artist}`,
        description: desc,
        images: [
          {
            url: cover,
            width: 300,
            height: 300,
            alt: title,
          },
        ],
        type: 'music.song',
      },
    };
  } catch (err) {
    console.error('Error generating song metadata:', err);
    return {
      title: '极声音乐 / 去中心化音乐分发平台',
      description: '极声音乐 · Web3 驱动的去中心化音乐分发与 ECHO 积分生态',
    };
  }
}

export default async function Page() {
  return <HomeClientPage />;
}
