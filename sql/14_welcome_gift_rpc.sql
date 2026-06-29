-- ==========================================
-- ECHORURA MUSICCHAIN: Newcomer Welcome Gift & Referral Reward System (Secure RPC)
-- 请在 Memfire Cloud -> SQL 编辑器 中运行此脚本
-- ==========================================

CREATE OR REPLACE FUNCTION public.claim_welcome_gift()
RETURNS numeric AS $$
DECLARE
    v_user_id uuid;
    v_has_claimed boolean;
    v_current_balance numeric := 0;
    v_new_balance numeric := 0;
    v_referrer_phone text;
    v_referrer_id uuid;
    v_referrer_balance numeric := 0;
    v_new_referrer_balance numeric := 0;
    v_user_identifier text;
    v_user_email text;
    v_user_phone text;
BEGIN
    -- 1. 获取当前登录用户的 ID 并进行校验
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '未授权登录，无法领取礼包';
    END IF;

    -- 2. 检查该用户是否已经领过系统赠送的新手欢迎礼包
    SELECT EXISTS (
        SELECT 1 FROM public.transactions 
        WHERE user_id = v_user_id AND type = 'system_gift' AND description LIKE '注册新手欢迎礼包%'
    ) INTO v_has_claimed;

    -- 获取当前钱包余额
    SELECT balance INTO v_current_balance FROM public.wallets WHERE user_id = v_user_id;
    IF v_current_balance IS NULL THEN
        v_current_balance := 0;
    END IF;

    -- 3. 如果已经领过，直接返回当前余额
    IF v_has_claimed THEN
        RETURN v_current_balance;
    END IF;

    -- 4. 尚未领过，开始初始化/增加 10.0 ECHO 欢迎礼包
    v_new_balance := v_current_balance + 10.0;

    -- 自动初始化/更新新钱包余额
    INSERT INTO public.wallets (user_id, balance, updated_at)
    VALUES (v_user_id, v_new_balance, now())
    ON CONFLICT (user_id)
    DO UPDATE SET balance = EXCLUDED.balance, updated_at = now();

    -- 写入新手欢迎礼包流水
    INSERT INTO public.transactions (user_id, amount, type, description, status)
    VALUES (v_user_id, 10.0, 'system_gift', '注册新手欢迎礼包 (10 ECHO)', 'settled');

    -- 5. 从 auth.users 读取元数据，检查是否有推荐人并进行派奖
    SELECT 
        raw_user_meta_data->>'referrer_phone',
        email,
        phone
    INTO 
        v_referrer_phone,
        v_user_email,
        v_user_phone
    FROM auth.users 
    WHERE id = v_user_id;

    -- 定义新用户的标识名称，用于给推荐人的流水描述
    v_user_identifier := COALESCE(v_user_phone, v_user_email, '新成员');

    IF v_referrer_phone IS NOT NULL AND v_referrer_phone <> '' THEN
        -- 通过 auth.users.phone 查询推荐人 ID（兼容有无 +86 前缀两种格式）
        SELECT id INTO v_referrer_id
        FROM auth.users
        WHERE phone = '+86' || v_referrer_phone
           OR phone = v_referrer_phone
        LIMIT 1;

        IF v_referrer_id IS NOT NULL AND v_referrer_id <> v_user_id THEN
            -- 获取推荐人钱包余额
            SELECT balance INTO v_referrer_balance FROM public.wallets WHERE user_id = v_referrer_id;
            IF v_referrer_balance IS NULL THEN
                v_referrer_balance := 0;
            END IF;

            v_new_referrer_balance := v_referrer_balance + 5.0;

            -- 更新推荐人钱包余额
            INSERT INTO public.wallets (user_id, balance, updated_at)
            VALUES (v_referrer_id, v_new_referrer_balance, now())
            ON CONFLICT (user_id)
            DO UPDATE SET balance = EXCLUDED.balance, updated_at = now();

            -- 写入推荐人邀请好友流水
            INSERT INTO public.transactions (user_id, amount, type, description, status)
            VALUES (v_referrer_id, 5.0, 'system_gift', '邀请好友注册奖励 (新成员: ' || v_user_identifier || ')', 'settled');
        END IF;
    END IF;

    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授权 authenticated 用户执行此 RPC
GRANT EXECUTE ON FUNCTION public.claim_welcome_gift TO authenticated;
