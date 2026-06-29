import { createClient } from '@/utils/supabase/server';
import { Metadata } from 'next';
import ArtistClientPage from './ArtistClientPage';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  
  try {
    const supabase = await createClient();
    const { data: artist } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (!artist) {
      return {
        title: '极声音乐 / 去中心化音乐分发平台',
        description: '极声音乐 · Web3 驱动的去中心化音乐分发与 ECHO 积分生态',
      };
    }

    const name = artist.display_name || artist.username || '创作者';
    const avatar = artist.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aria';
    const bio = `欢迎来到 ${name} 的极声音乐主页。`;

    return {
      title: `ECHORURA推荐 ${name}`,
      description: bio,
      openGraph: {
        title: `ECHORURA推荐 ${name}`,
        description: bio,
        images: [
          {
            url: avatar,
            width: 300,
            height: 300,
            alt: name,
          },
        ],
        type: 'profile',
      },
    };
  } catch (err) {
    console.error('Error generating artist metadata:', err);
    return {
      title: '极声音乐 / 去中心化音乐分发平台',
      description: '极声音乐 · Web3 驱动的去中心化音乐分发与 ECHO 积分生态',
    };
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArtistClientPage id={id} />;
}
