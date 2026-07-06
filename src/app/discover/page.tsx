import { Metadata } from 'next';
import { createClient } from '@/utils/supabase/server';
import DiscoverClientPage from './DiscoverClientPage';
import { fetchPlaylistResilient } from '@/utils/supabase/queries';

interface Props {
  searchParams: Promise<{ playlistId?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { playlistId } = await searchParams;

  if (!playlistId) {
    return {
      title: '发现极声精选 / 去中心化音乐分发平台',
      description: '极声音乐 · 探索高品质精选歌单与 Web3 去中心化音乐共创生态',
      openGraph: {
        title: '发现极声精选 / 去中心化音乐分发平台',
        description: '极声音乐 · 探索高品质精选歌单与 Web3 去中心化音乐共创生态',
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
    const { data: playlist } = await fetchPlaylistResilient(supabase, playlistId);

    if (!playlist) {
      return {
        title: '发现极声精选 / 去中心化音乐分发平台',
        description: '极声音乐 · 探索高品质精选歌单与 Web3 去中心化音乐共创生态',
      };
    }

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
  } catch (err) {
    console.error('Error generating playlist metadata:', err);
    return {
      title: '发现极声精选 / 去中心化音乐分发平台',
      description: '极声音乐 · 探索高品质精选歌单与 Web3 去中心化音乐共创生态',
    };
  }
}

export default async function Page() {
  return <DiscoverClientPage />;
}
