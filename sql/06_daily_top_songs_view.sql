-- ==========================================
-- ECHORURA MUSICCHAIN Daily Top Songs View
-- 请在 Memfire Cloud -> SQL Editor 中运行此脚本
-- ==========================================

-- 创建实时聚合视图：关联当日听歌流水、歌曲元数据与创作者信息
CREATE OR REPLACE VIEW public.daily_top_songs_with_details AS
SELECT 
    t.song_id as id, 
    COUNT(t.id) as today_plays,
    s.title,
    s.cover_url,
    s.audio_url,
    s.earn_rate,
    s.tags,
    s.lyrics,
    s.creator_id,
    p.display_name as creator_name,
    p.avatar_url as creator_avatar
FROM public.transactions t
JOIN public.songs s ON t.song_id = s.id
LEFT JOIN public.profiles p ON s.creator_id = p.id
WHERE t.type = 'listen_reward' AND t.created_at >= CURRENT_DATE
GROUP BY 
    t.song_id, 
    s.title, 
    s.cover_url, 
    s.audio_url, 
    s.earn_rate, 
    s.tags,
    s.lyrics,
    s.creator_id, 
    p.display_name, 
    p.avatar_url
ORDER BY today_plays DESC;

-- 允许匿名与认证用户读取此视图
GRANT SELECT ON public.daily_top_songs_with_details TO anon, authenticated, service_role;
