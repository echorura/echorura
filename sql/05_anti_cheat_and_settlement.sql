-- ==========================================
-- ECHORURA MUSICCHAIN T+1 Settlement Engine
-- ==========================================

-- 创建 T+1 核心结算逻辑 RPC
CREATE OR REPLACE FUNCTION public.run_daily_settlement() RETURNS jsonb AS $$
DECLARE
    total_distributed numeric := 0;
    settled_songs_count integer := 0;
    pool_record RECORD;
    holder_record RECORD;
    dividend_per_share numeric;
    user_payout numeric;
BEGIN
    -- 1. 查找所有待结算的版权池收益 (按 song_id 汇总)
    FOR pool_record IN 
        SELECT song_id, SUM(amount) as total_pool
        FROM public.transactions
        WHERE type = 'dividend_pool_reward' AND status = 'pending' AND song_id IS NOT NULL
        GROUP BY song_id
    LOOP
        -- 每首歌结算
        settled_songs_count := settled_songs_count + 1;
        
        -- 计算每 1% 股份的分红金额 (保留足够精度)
        -- 这里假设 total_shares 为 100，实际可从 equities 或 songs 表读取
        dividend_per_share := pool_record.total_pool / 100.0;

        -- 2. 查找该歌曲的所有份额持有者
        FOR holder_record IN
            SELECT user_id, shares
            FROM public.equities
            WHERE song_id = pool_record.song_id AND shares > 0
        LOOP
            -- 计算该用户应得分红
            user_payout := dividend_per_share * holder_record.shares;

            IF user_payout > 0 THEN
                -- 记录个人的结算流水
                INSERT INTO public.transactions (user_id, amount, type, description, status, song_id)
                VALUES (holder_record.user_id, user_payout, 'dividend_payout', '昨日版权分红结算入账', 'settled', pool_record.song_id);

                -- 增加用户钱包余额
                UPDATE public.wallets
                SET balance = balance + user_payout,
                    updated_at = now()
                WHERE user_id = holder_record.user_id;

                total_distributed := total_distributed + user_payout;
            END IF;
        END LOOP;
    END LOOP;

    -- 3. 将所有已处理的版权池流水标记为 settled
    UPDATE public.transactions
    SET status = 'settled'
    WHERE type = 'dividend_pool_reward' AND status = 'pending';

    -- 将听歌奖励也一并标记为 settled
    UPDATE public.transactions
    SET status = 'settled'
    WHERE type = 'listen_reward' AND status = 'pending';

    -- 返回结算报告
    RETURN jsonb_build_object(
        'success', true,
        'settled_songs_count', settled_songs_count,
        'total_distributed', total_distributed,
        'timestamp', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.run_daily_settlement TO service_role;
