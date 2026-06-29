-- ==========================================================
-- ECHORURA MUSICCHAIN Homepage Ranking Views (Trending Discoveries & Emerging Artists)
-- 请在 Memfire Cloud -> SQL Editor 中运行此脚本
-- ==========================================================

-- 先清理已存在的同名旧视图以避免字段数据类型变更冲突 (cannot change data type of view column)
DROP VIEW IF EXISTS public.trending_discoveries_score CASCADE;
DROP VIEW IF EXISTS public.emerging_artists_score CASCADE;

-- 1. 热门发现 (Trending Discoveries) 视图
-- 方案 A (综合指数排序法)：播放量 (1x) + 点赞数 (10x) + 收藏数 (15x) = hot_score
CREATE OR REPLACE VIEW public.trending_discoveries_score AS
WITH 
  song_plays AS (
    SELECT song_id, COUNT(*) as plays
    FROM public.transactions
    WHERE type = 'listen_reward'
    GROUP BY song_id
  ),
  song_favorites AS (
    SELECT song_id, COUNT(*) as favorites
    FROM public.user_favorites
    GROUP BY song_id
  )
SELECT 
  s.id,
  s.title,
  s.artist,
  s.cover_url,
  s.audio_url,
  s.earn_rate,
  s.tags,
  s.lyrics,
  s.creator_id,
  s.likes,
  s.created_at,
  p.display_name as creator_name,
  p.avatar_url as creator_avatar,
  COALESCE(sp.plays, 0) as play_count,
  COALESCE(sf.favorites, 0) as favorites_count,
  (COALESCE(sp.plays, 0) * 1 + COALESCE(s.likes, 0) * 10 + COALESCE(sf.favorites, 0) * 15) as hot_score
FROM public.songs s
LEFT JOIN song_plays sp ON s.id = sp.song_id
LEFT JOIN song_favorites sf ON s.id = sf.song_id
LEFT JOIN public.profiles p ON s.creator_id = p.id
WHERE s.id < 900
ORDER BY hot_score DESC, s.created_at DESC;

GRANT SELECT ON public.trending_discoveries_score TO anon, authenticated, service_role;


-- 2. 新锐艺人 (Emerging Artists) 视图
-- 时间区间：过去 30 天的增长量
-- 评分规则：最近30天播放量 (1x) + 歌曲总点赞数 (2x) + 最近30天收藏量 (3x) + 最近30天新增关注 (20x) = artist_score
CREATE OR REPLACE VIEW public.emerging_artists_score AS
WITH 
  plays_30d AS (
    SELECT s.creator_id, COUNT(t.id) as recent_plays
    FROM public.transactions t
    JOIN public.songs s ON t.song_id = s.id
    WHERE t.type = 'listen_reward' AND t.created_at >= (now() - interval '30 days')
    GROUP BY s.creator_id
  ),
  favorites_30d AS (
    SELECT s.creator_id, COUNT(f.id) as recent_favorites
    FROM public.user_favorites f
    JOIN public.songs s ON f.song_id = s.id
    WHERE f.created_at >= (now() - interval '30 days')
    GROUP BY s.creator_id
  ),
  follows_30d AS (
    SELECT following_id as creator_id, COUNT(*) as recent_follows
    FROM public.follows
    WHERE created_at >= (now() - interval '30 days')
    GROUP BY following_id
  ),
  likes_sum AS (
    SELECT creator_id, SUM(COALESCE(likes, 0)) as total_likes
    FROM public.songs
    GROUP BY creator_id
  )
SELECT 
  p.id as creator_id,
  p.display_name as creator_name,
  p.avatar_url as creator_avatar,
  COALESCE(pl.recent_plays, 0) as total_plays,
  COALESCE(lk.total_likes, 0) as total_likes,
  COALESCE(fa.recent_favorites, 0) as total_favorites,
  COALESCE(fl.recent_follows, 0) as total_follows,
  (
    COALESCE(pl.recent_plays, 0) * 1 + 
    COALESCE(lk.total_likes, 0) * 2 + 
    COALESCE(fa.recent_favorites, 0) * 3 + 
    COALESCE(fl.recent_follows, 0) * 20
  ) as artist_score
FROM public.profiles p
LEFT JOIN plays_30d pl ON p.id = pl.creator_id
LEFT JOIN likes_sum lk ON p.id = lk.creator_id
LEFT JOIN favorites_30d fa ON p.id = fa.creator_id
LEFT JOIN follows_30d fl ON p.id = fl.creator_id
WHERE (
  COALESCE(pl.recent_plays, 0) > 0 OR 
  COALESCE(lk.total_likes, 0) > 0 OR 
  COALESCE(fa.recent_favorites, 0) > 0 OR 
  COALESCE(fl.recent_follows, 0) > 0
)
ORDER BY artist_score DESC;

GRANT SELECT ON public.emerging_artists_score TO anon, authenticated, service_role;
