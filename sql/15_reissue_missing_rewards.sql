-- =======================================================
-- ECHORURA MUSICCHAIN: 批量补发新账户礼包与推荐奖励脚本
-- 请在 Memfire Cloud / Supabase -> SQL 编辑器中运行此脚本
-- =======================================================

DO $$
DECLARE
    r_user RECORD;
    v_has_claimed boolean;
    v_current_balance numeric;
    v_new_balance numeric;
    v_referrer_phone text;
    v_referrer_id uuid;
    v_referrer_balance numeric;
    v_new_referrer_balance numeric;
    v_user_identifier text;
    v_reissued_count integer := 0;
    v_referrer_reward_count integer := 0;
BEGIN
    RAISE NOTICE '⚡ 开始检查并补发新用户注册礼包与推荐奖励...';

    -- 1. 遍历所有注册用户 (包含邮箱注册和手机号注册)
    FOR r_user IN 
        SELECT id, email, phone, raw_user_meta_data, created_at 
        FROM auth.users 
        ORDER BY created_at ASC
    LOOP
        -- 定义新用户的标识名称，用于流水描述和控制台打印
        v_user_identifier := COALESCE(r_user.phone, r_user.email, '新成员');

        -- 2. 检查该用户是否已经领过注册新手礼包
        SELECT EXISTS (
            SELECT 1 FROM public.transactions 
            WHERE user_id = r_user.id AND type = 'system_gift' AND description LIKE '注册新手欢迎礼包%'
        ) INTO v_has_claimed;

        -- 3. 如果尚未领过礼包，开始补发！
        IF NOT v_has_claimed THEN
            v_reissued_count := v_reissued_count + 1;
            RAISE NOTICE '👉 发现未领奖账号: %, 注册时间: %, 开始补发 10 ECHO...', v_user_identifier, r_user.created_at;

            -- 获取当前钱包余额
            SELECT balance INTO v_current_balance FROM public.wallets WHERE user_id = r_user.id;
            IF v_current_balance IS NULL THEN
                v_current_balance := 0;
            END IF;

            v_new_balance := v_current_balance + 10.0;

            -- 初始化/更新该用户的钱包余额
            INSERT INTO public.wallets (user_id, balance, updated_at)
            VALUES (r_user.id, v_new_balance, now())
            ON CONFLICT (user_id)
            DO UPDATE SET balance = EXCLUDED.balance, updated_at = now();

            -- 写入新手欢迎礼包流水 (标记为补发)
            INSERT INTO public.transactions (user_id, amount, type, description, status)
            VALUES (r_user.id, 10.0, 'system_gift', '注册新手欢迎礼包 (10 ECHO) - 系统补发', 'settled');

            -- 4. 检查是否有推荐人，并补发推荐奖励
            v_referrer_phone := r_user.raw_user_meta_data->>'referrer_phone';
            
            IF v_referrer_phone IS NOT NULL AND v_referrer_phone <> '' THEN
                -- 通过 auth.users.phone 查询推荐人 ID（兼容有无 +86 前缀两种格式）
                SELECT id INTO v_referrer_id
                FROM auth.users
                WHERE phone = '+86' || v_referrer_phone
                   OR phone = v_referrer_phone
                LIMIT 1;

                IF v_referrer_id IS NOT NULL AND v_referrer_id <> r_user.id THEN
                    -- 检查推荐人是否已经领过这个新用户的邀请奖励 (防止重复补发)
                    SELECT NOT EXISTS (
                        SELECT 1 FROM public.transactions
                        WHERE user_id = v_referrer_id AND type = 'system_gift' AND description LIKE '%' || v_user_identifier || '%'
                    ) INTO v_has_claimed; -- 这里复用变量

                    IF v_has_claimed THEN
                        v_referrer_reward_count := v_referrer_reward_count + 1;
                        RAISE NOTICE '   🎉 关联推荐人: %, 补发 5 ECHO 邀请奖励...', v_referrer_phone;

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
                        VALUES (v_referrer_id, 5.0, 'system_gift', '邀请好友注册奖励 (新成员: ' || v_user_identifier || ') - 系统补发', 'settled');
                    END IF;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RAISE NOTICE '✅ 补发完成！共成功初始化/补发新用户礼包: % 个，补发推荐人邀请奖励: % 个。', v_reissued_count, v_referrer_reward_count;
END;
$$;
