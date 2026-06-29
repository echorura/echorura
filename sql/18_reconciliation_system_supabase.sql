-- ==========================================================
-- ECHORURA MUSICCHAIN Idempotent Payment Reconciliation System (Supabase / UUID version)
-- Please run this script in your Supabase SQL Editor
-- ==========================================================

-- 1. Create processed_onchain_txs table to track processed Web3 transaction hashes
CREATE TABLE IF NOT EXISTS public.processed_onchain_txs (
  tx_hash VARCHAR(66) PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE, -- UUID version for Supabase
  share_amount INTEGER NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for security
ALTER TABLE public.processed_onchain_txs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read processed_onchain_txs" ON public.processed_onchain_txs;
CREATE POLICY "Allow authenticated read processed_onchain_txs" 
  ON public.processed_onchain_txs FOR SELECT 
  TO authenticated 
  USING (true);

-- 2. Create pending_purchases table to track initiated checkout flows
CREATE TABLE IF NOT EXISTS public.pending_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE, -- UUID version for Supabase
  share_amount INTEGER NOT NULL,
  buyer_address VARCHAR(42) NOT NULL,
  tx_hash VARCHAR(66) UNIQUE, -- Unique index ensures one hash is only bound to one purchase order
  status VARCHAR(20) DEFAULT 'pending' NOT NULL, -- 'pending', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for pending_purchases
ALTER TABLE public.pending_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own pending purchases" ON public.pending_purchases;
CREATE POLICY "Users can read their own pending purchases"
  ON public.pending_purchases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own pending purchases" ON public.pending_purchases;
CREATE POLICY "Users can insert their own pending purchases"
  ON public.pending_purchases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own pending purchases" ON public.pending_purchases;
CREATE POLICY "Users can update their own pending purchases"
  ON public.pending_purchases FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);


-- 3. Atomic Database Sync Function (RPC) for On-Chain IPO Purchases
-- Executes all database updates atomically inside a single transaction.
-- Guarantees 100% idempotency via processed_onchain_txs unique key.
DROP FUNCTION IF EXISTS public.purchase_equity_on_chain(uuid, uuid, integer, text, text);

CREATE OR REPLACE FUNCTION public.purchase_equity_on_chain(
  p_user_id UUID,
  p_song_id UUID, -- UUID version for Supabase
  p_share_amount INTEGER,
  p_tx_hash TEXT,
  p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining_shares INTEGER;
  v_song_title TEXT;
  v_creator_id UUID;
  v_tx_exists BOOLEAN;
BEGIN
  -- A. Enforce idempotency: Check if the transaction hash was already processed.
  SELECT EXISTS (
    SELECT 1 FROM public.processed_onchain_txs WHERE tx_hash = p_tx_hash
  ) INTO v_tx_exists;

  IF v_tx_exists THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', '重复记账: 该交易哈希已经被处理过，请勿重复提交！',
      'code', 'DUPLICATE_TX'
    );
  END IF;

  -- B. Record processed transaction to lock this tx_hash immediately
  INSERT INTO public.processed_onchain_txs (tx_hash, user_id, song_id, share_amount)
  VALUES (p_tx_hash, p_user_id, p_song_id, p_share_amount);

  -- C. Lock and query song info (FOR UPDATE row-level lock to prevent race conditions)
  SELECT remaining_shares, title, creator_id INTO v_remaining_shares, v_song_title, v_creator_id
  FROM public.songs
  WHERE id = p_song_id
  FOR UPDATE;

  IF v_remaining_shares IS NULL THEN
    RAISE EXCEPTION '目标共创歌曲不存在或已被删除！';
  END IF;

  IF v_remaining_shares < p_share_amount THEN
    RAISE EXCEPTION '当前歌曲剩余的可支持共创份额不足，认购失败！';
  END IF;

  -- D. Deduct remaining shares in songs table
  UPDATE public.songs
  SET remaining_shares = remaining_shares - p_share_amount
  WHERE id = p_song_id;

  -- E. Deduct creator shares in equities table (if creator is not the buyer)
  IF v_creator_id IS NOT NULL AND v_creator_id <> p_user_id THEN
    UPDATE public.equities
    SET shares = GREATEST(0, shares - p_share_amount)
    WHERE song_id = p_song_id AND user_id = v_creator_id;
  END IF;

  -- F. Credit buyer shares in equities table (upsert)
  INSERT INTO public.equities (song_id, user_id, shares)
  VALUES (p_song_id, p_user_id, p_share_amount)
  ON CONFLICT (song_id, user_id)
  DO UPDATE SET shares = public.equities.shares + p_share_amount;

  -- G. Write transactions log
  INSERT INTO public.transactions (user_id, amount, type, description, status, song_id)
  VALUES (p_user_id, -p_share_amount * 1.0, 'equity_purchase_on_chain', p_description, 'settled', p_song_id);

  -- H. Update status of corresponding pending purchase to completed
  UPDATE public.pending_purchases
  SET status = 'completed', updated_at = now()
  WHERE tx_hash = p_tx_hash;

  RETURN jsonb_build_object(
    'success', true,
    'remaining_shares', v_remaining_shares - p_share_amount,
    'purchased_shares', p_share_amount
  );
EXCEPTION WHEN OTHERS THEN
  -- Postgres automatically rolls back the entire transaction upon raise/exception
  RETURN jsonb_build_object(
    'success', false, 
    'error', SQLERRM,
    'code', 'DATABASE_EXCEPTION'
  );
END;
$$;

-- Allow authenticated users and service role to execute this function
GRANT EXECUTE ON FUNCTION public.purchase_equity_on_chain TO authenticated, service_role;
