-- ==========================================
-- ECHORURA MUSICCHAIN: Core Tables RLS & Security Policies
-- 请在 Memfire Cloud -> SQL Editor 中运行此脚本
-- ==========================================

-- 1. Profiles 表安全策略
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- 允许所有人读取用户主页资料
CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);
-- 允许用户修改自己的资料
CREATE POLICY "Allow user update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
-- 允许用户注册时插入自己的资料
CREATE POLICY "Allow user insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);


-- 2. Songs 表安全策略
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
-- 允许所有人读取歌曲列表
CREATE POLICY "Allow public read songs" ON public.songs FOR SELECT USING (true);
-- 允许作者发布歌曲
CREATE POLICY "Allow user insert own songs" ON public.songs FOR INSERT WITH CHECK (auth.uid() = creator_id);
-- 允许作者修改自己的歌曲信息
CREATE POLICY "Allow user update own songs" ON public.songs FOR UPDATE USING (auth.uid() = creator_id);
-- 注意：点赞 (likes) 的权限已经在 04 脚本里给过所有用户了，不会冲突。


-- 3. Transactions 流水表安全策略 (极其重要：防止财务数据泄露)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
-- 允许所有人读取 "听歌挖矿" 和 "版权分红" 的数据，这是为了支撑首页的“动态热播榜”和“新锐艺人榜”视图能正常计算
CREATE POLICY "Allow public read public txs" ON public.transactions FOR SELECT USING (type = 'listen_reward' OR type = 'dividend_pool_reward');
-- 允许用户读取自己的私密账单（比如充值、扣费等）
CREATE POLICY "Allow user read own txs" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
-- 禁止任何人直接通过 API 插入/修改流水，只能通过我们写的底层 RPC (带有 Security Definer 权限) 操作。


-- 4. Wallets 钱包表安全策略 (极其重要：防止偷窥他人余额)
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
-- 仅允许用户读取自己的钱包余额
CREATE POLICY "Allow user read own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
-- 禁止任何人直接通过 API 插入/修改钱包余额，只能通过 RPC 操作。
