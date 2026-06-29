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
        const title = playlist.name || 'ECHORURA Playlist';
        const creator = playlist.creator?.display_name || 'ECHORURA User';
        const cover = playlist.cover_url || 'https://www.echora.cn/logo.png';
        const desc = `Listen to this curated playlist! "${title}" - selected and created by @${creator}. Listen & earn together.`;

        return {
          title: `ECHORURA Recommended Playlist [${title}] - @${creator}`,
          description: desc,
          openGraph: {
            title: `ECHORURA Recommended Playlist [${title}] - @${creator}`,
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
      title: 'ECHORURA | Decentralized Music Ecosystem',
      description: 'ECHORURA - Web3-powered decentralized music distribution and attention economy.',
      openGraph: {
        title: 'ECHORURA | Decentralized Music Ecosystem',
        description: 'ECHORURA - Web3-powered decentralized music distribution and attention economy.',
        images: [
          {
            url: 'https://www.echora.cn/logo.png',
            width: 300,
            height: 300,
            alt: 'ECHORURA',
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
        title: 'ECHORURA | Decentralized Music Ecosystem',
        description: 'ECHORURA - Web3-powered decentralized music distribution and attention economy.',
      };
    }

    const title = song.title || 'ECHORURA Track';
    const artist = song.artist || song.creator?.display_name || 'ECHORURA Creator';
    const cover = song.cover_url || song.cover || 'https://www.echora.cn/logo.png';
    const desc = `Listen to this track: "${title}" by ${artist}. Listen to earn ECHO mining rewards! Co-own music equity & share royalty dividends. Click to listen.`;

    return {
      title: `ECHORURA Recommends [${title}] - ${artist}`,
      description: desc,
      openGraph: {
        title: `ECHORURA Recommends [${title}] - ${artist}`,
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
      title: 'ECHORURA | Decentralized Music Ecosystem',
      description: 'ECHORURA - Web3-powered decentralized music distribution and attention economy.',
    };
  }
}

export default async function Page() {
  return <HomeClientPage />;
}
