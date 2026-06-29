-- ==========================================
-- ECHORURA MUSICCHAIN Purchase Equity (Sound Equity IPO) RPC
-- 请在 Memfire Cloud -> SQL Editor 中运行此脚本
-- ==========================================

-- 1. 先安全地删掉旧的同名函数（如果有的话，防止重载类型冲突）
DROP FUNCTION IF EXISTS public.purchase_equity(uuid, integer);
DROP FUNCTION IF EXISTS public.purchase_equity(text, integer);
DROP FUNCTION IF EXISTS public.purchase_equity(bigint, integer);
DROP FUNCTION IF EXISTS public.purchase_equity(bigint, integer, boolean);

-- 2. 重新创建支持 BIGINT 歌曲 ID 且兼容信用代付的安全交易函数
CREATE OR REPLACE FUNCTION public.purchase_equity(
  p_song_id BIGINT,
  p_share_amount INTEGER,
  p_use_credit BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_wallet_balance NUMERIC;
  v_remaining_shares INTEGER;
  v_unit_price NUMERIC := 1.0; -- 每一份共创份额固定价值为 1.00 ECHO
  v_total_cost NUMERIC;
  v_song_title TEXT;
  v_creator_id UUID;
  v_used_credit NUMERIC;
BEGIN
  -- A. 获取当前请求认证的听众（用户）ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '未登录或登录状态已过期，请重新登录！');
  END IF;

  v_total_cost := p_share_amount * v_unit_price;

  -- B. 锁定并校验资金或信用额度
  IF p_use_credit THEN
    -- 计算当前用户在数据库中已使用的信用额度 (所有 equity_purchase_credit 流水扣款之和)
    SELECT COALESCE(SUM(-amount), 0) INTO v_used_credit
    FROM public.transactions
    WHERE user_id = v_user_id AND type = 'equity_purchase_credit';

    IF v_used_credit + v_total_cost > 500.00 THEN
      RETURN jsonb_build_object('success', false, 'error', '您的专属信用代付额度不足，认购失败！');
    END IF;
  ELSE
    -- 锁定并查询当前用户的钱包余额 (FOR UPDATE 行级锁防并发冲突)
    SELECT balance INTO v_wallet_balance
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF v_wallet_balance IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', '未检测到您的有效数字钱包账户，请检查账户状态！');
    END IF;

    IF v_wallet_balance < v_total_cost THEN
      RETURN jsonb_build_object('success', false, 'error', '您的数字钱包 ECHO 余额不足，交易已自动回滚！');
    END IF;
  END IF;

  -- C. 锁定并查询目标共创歌曲的剩余份额、标题及创作者 ID (FOR UPDATE 行级锁)
  SELECT remaining_shares, title, creator_id INTO v_remaining_shares, v_song_title, v_creator_id
  FROM public.songs
  WHERE id = p_song_id
  FOR UPDATE;

  IF v_remaining_shares IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '目标共创歌曲不存在或已被删除！');
  END IF;

  IF v_remaining_shares < p_share_amount THEN
    RETURN jsonb_build_object('success', false, 'error', '当前歌曲剩余的可支持共创份额不足，请减少支持数量！');
  END IF;

  -- D. 如果是积分支付，扣除积分余额；如果是信用代付，不改变钱包余额
  IF NOT p_use_credit THEN
    UPDATE public.wallets
    SET balance = balance - v_total_cost
    WHERE user_id = v_user_id;
  END IF;

  -- E. 扣减歌曲剩余的共创份额
  UPDATE public.songs
  SET remaining_shares = remaining_shares - p_share_amount
  WHERE id = p_song_id;

  -- F. 记录扣款交易流水 (区分现金认购和信用代付)
  IF p_use_credit THEN
    INSERT INTO public.transactions (user_id, amount, type, description, status, song_id)
    VALUES (v_user_id, -v_total_cost, 'equity_purchase_credit', '信用额度认购作品《' || v_song_title || '》的版权股份', 'settled', p_song_id);
  ELSE
    INSERT INTO public.transactions (user_id, amount, type, description, status, song_id)
    VALUES (v_user_id, -v_total_cost, 'equity_purchase', '共创认购作品《' || v_song_title || '》的版权股份', 'settled', p_song_id);
  END IF;

  -- F.1 更新/插入股权记录 (equities 表)
  -- 扣减创作者持有的股份
  IF v_creator_id IS NOT NULL AND v_creator_id <> v_user_id THEN
    UPDATE public.equities
    SET shares = GREATEST(0, shares - p_share_amount)
    WHERE song_id = p_song_id AND user_id = v_creator_id;
  END IF;

  -- 增加购买者的股份 (upsert)
  INSERT INTO public.equities (song_id, user_id, shares)
  VALUES (p_song_id, v_user_id, p_share_amount)
  ON CONFLICT (song_id, user_id)
  DO UPDATE SET shares = public.equities.shares + p_share_amount;

  -- G. 返回购买成功元数据及最新余额
  IF p_use_credit THEN
    RETURN jsonb_build_object(
      'success', true,
      'new_balance', 500.00 - (v_used_credit + v_total_cost), -- 返回最新信用剩余额度
      'purchased_shares', p_share_amount
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'new_balance', v_wallet_balance - v_total_cost, -- 返回最新积分余额
      'purchased_shares', p_share_amount
    );
  END IF;
END;
$$;

-- 允许已登录认证的用户及服务角色执行此 RPC
GRANT EXECUTE ON FUNCTION public.purchase_equity TO authenticated, service_role;

-- 确保 equities 表启用行级安全 (RLS) 并在客户端可查询自己的持股
ALTER TABLE public.equities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read their own equities" ON public.equities;
CREATE POLICY "Allow users to read their own equities"
  ON public.equities FOR SELECT
  USING (auth.uid() = user_id);

-- ==========================================================
-- 3. [一次性历史数据修复] 根据历史交易流水重建旧股权记录
-- ==========================================================

-- A. 确保所有进行过认购的歌曲，在 equities 中创作者至少拥有初始 100 股（若不存在则初始化）
INSERT INTO public.equities (song_id, user_id, shares)
SELECT DISTINCT s.id, s.creator_id, 100
FROM public.songs s
JOIN public.transactions t ON t.song_id = s.id
WHERE t.type = 'equity_purchase'
ON CONFLICT (song_id, user_id) DO NOTHING;

-- B. 遍历历史 'equity_purchase' 流水，重新划转股权
DO $$
DECLARE
  r RECORD;
  v_creator_id UUID;
BEGIN
  -- 遍历所有的历史认购交易（确保为已结算且金额为负数的扣款流水）
  FOR r IN 
    SELECT user_id as buyer_id, song_id, CAST(-amount AS INTEGER) as purchased_shares
    FROM public.transactions
    WHERE type = 'equity_purchase' AND status = 'settled' AND song_id IS NOT NULL AND amount < 0
  LOOP
    -- 找到该歌曲的创作者 ID
    SELECT creator_id INTO v_creator_id
    FROM public.songs
    WHERE id = r.song_id;

    IF v_creator_id IS NOT NULL THEN
      -- 1. 扣减创作者的股本
      UPDATE public.equities
      SET shares = GREATEST(0, shares - r.purchased_shares)
      WHERE song_id = r.song_id AND user_id = v_creator_id;

      -- 2. 增加/更新购买者的股本 (upsert)
      INSERT INTO public.equities (song_id, user_id, shares)
      VALUES (r.song_id, r.buyer_id, r.purchased_shares)
      ON CONFLICT (song_id, user_id)
      DO UPDATE SET shares = public.equities.shares + r.purchased_shares;
    END IF;
  END LOOP;
END $$;

