-- ==========================================
-- ECHORURA MUSICCHAIN Purchase Download RPC
-- 请在 Memfire Cloud -> SQL Editor 中运行此脚本
-- ==========================================

CREATE OR REPLACE FUNCTION public.purchase_song_download(
    p_user_id UUID, 
    p_song_id BIGINT, 
    p_amount NUMERIC
) RETURNS jsonb AS $$
DECLARE
    current_balance NUMERIC;
BEGIN
    -- 1. Check user balance
    SELECT balance INTO current_balance 
    FROM public.wallets 
    WHERE user_id = p_user_id;

    IF current_balance IS NULL OR current_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'ECHO 余额不足，无法完成下载扣费');
    END IF;

    -- 2. Deduct fee from user's wallet
    UPDATE public.wallets 
    SET balance = balance - p_amount, 
        updated_at = now() 
    WHERE user_id = p_user_id;

    -- 3. Record the deduction transaction for the user (settled immediately)
    INSERT INTO public.transactions (user_id, amount, type, description, status, song_id)
    VALUES (p_user_id, -p_amount, 'download_fee', '支付作品高保真下载授权费', 'settled', p_song_id);

    -- 4. Inject the fee into the song's dividend pool (user_id is NULL for pool, status pending for nightly settlement)
    INSERT INTO public.transactions (user_id, amount, type, description, status, song_id)
    VALUES (NULL, p_amount, 'dividend_pool_reward', '作品被下载产生的版权分红', 'pending', p_song_id);

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 允许认证用户调用此 RPC
GRANT EXECUTE ON FUNCTION public.purchase_song_download TO authenticated, service_role;
