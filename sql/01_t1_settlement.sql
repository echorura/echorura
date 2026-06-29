-- ==========================================
-- ECHORURA MUSICCHAIN T+1 混合清算架构升级 SQL
-- 请在 Memfire Cloud -> SQL Editor 中运行此脚本
-- ==========================================

-- 1. 为 transactions 表增加审核状态和所属歌曲关联字段
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS song_id BIGINT REFERENCES public.songs(id) ON DELETE CASCADE;

-- 将旧数据标记为 settled 以免影响新的 T+1 逻辑
UPDATE public.transactions SET status = 'settled' WHERE status = 'pending';

-- 2. 创建 RPC：高频并发记录挖矿奖励 (T+0)
CREATE OR REPLACE FUNCTION public.record_mining_reward(
    p_user_id UUID,        -- 接收人 ID (如果是发给单首歌曲版权池的，可以为 NULL)
    p_amount NUMERIC,      -- 获得金额
    p_type TEXT,           -- 收益类型 ('upload_reward', 'listen_reward', 'dividend_pool_reward')
    p_description TEXT,    -- 描述信息
    p_song_id BIGINT DEFAULT NULL -- 关联的歌曲 ID
) RETURNS void AS $$
BEGIN
    -- 插入流水账 (状态默认为 pending，24小时后由预言机审计并上链结算)
    INSERT INTO public.transactions (user_id, amount, type, description, status, song_id)
    VALUES (p_user_id, p_amount, p_type, p_description, 'pending', p_song_id);

    -- 如果这笔钱是直接给用户的，就在资产中心更新"未审计余额"
    IF p_user_id IS NOT NULL THEN
        UPDATE public.wallets
        SET balance = balance + p_amount,
            updated_at = now()
        WHERE user_id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 允许外部匿名和认证用户通过 Supabase Client 调用此 RPC
GRANT EXECUTE ON FUNCTION public.record_mining_reward TO anon, authenticated, service_role;
