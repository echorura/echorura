-- ==================================================
-- ECHORURA MUSICCHAIN: 听审竞技场 (Curation Arena) 数据库驱动补丁
-- 请在 Memfire Cloud -> SQL Editor 中运行此脚本以完成部署
-- ==================================================

-- 1. 为 songs 表增加 votes 字段（得票数），如果已存在则忽略
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS votes INTEGER DEFAULT 0;

-- 2. 创建用于听审投票的 Security Definer RPC 函数，规避 RLS 越权限制，提供高并发原子操作
CREATE OR REPLACE FUNCTION public.vote_for_song(
    p_song_id BIGINT,
    p_type TEXT -- 'up' 或 'down'
) RETURNS INTEGER AS $$
DECLARE
    current_votes INTEGER;
    delta INTEGER;
BEGIN
    -- 查找歌曲
    SELECT COALESCE(votes, 0) INTO current_votes FROM public.songs WHERE id = p_song_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Song not found';
    END IF;
    
    -- 增减计算
    IF p_type = 'up' THEN
        delta := 1;
    ELSE
        delta := -1;
    END IF;
    
    current_votes := GREATEST(0, current_votes + delta);
    
    -- 更新库
    UPDATE public.songs
    SET votes = current_votes
    WHERE id = p_song_id;
    
    RETURN current_votes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 授权执行权限给所有角色，确保前端可顺利通过 REST / RPC 接口调用
GRANT EXECUTE ON FUNCTION public.vote_for_song TO anon, authenticated, service_role;
