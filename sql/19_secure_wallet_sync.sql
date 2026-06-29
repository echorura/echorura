-- ==========================================================
-- ECHORURA MUSICCHAIN Secure Wallet Synchronization System (RPC Functions)
-- Please run this script in BOTH your Memfire Cloud and Supabase SQL Editors
-- ==========================================================

-- 1. Atomic Wallet Deposit RPC Function
-- Credits user balance and inserts transaction log, enforcing idempotency.
DROP FUNCTION IF EXISTS public.deposit_user_balance(uuid, numeric, text, text);

CREATE OR REPLACE FUNCTION public.deposit_user_balance(
  p_user_id UUID,
  p_amount NUMERIC,
  p_tx_hash TEXT,
  p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tx_exists BOOLEAN;
  v_new_balance NUMERIC;
BEGIN
  -- A. Enforce idempotency: Check if the transaction hash was already processed.
  SELECT EXISTS (
    SELECT 1 FROM public.processed_onchain_txs WHERE tx_hash = p_tx_hash
  ) INTO v_tx_exists;

  IF v_tx_exists THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', '重复充值: 该交易哈希已经被处理过，请勿重复提交！',
      'code', 'DUPLICATE_TX'
    );
  END IF;

  -- B. Record processed transaction to lock this tx_hash immediately
  -- song_id is NULL for deposit, and share_amount is 0. This is compatible with both bigint/uuid song_id.
  INSERT INTO public.processed_onchain_txs (tx_hash, user_id, song_id, share_amount)
  VALUES (p_tx_hash, p_user_id, NULL, 0);

  -- C. Credit user balance in public.wallets (upsert)
  INSERT INTO public.wallets (user_id, balance, updated_at)
  VALUES (p_user_id, p_amount, now())
  ON CONFLICT (user_id)
  DO UPDATE SET balance = public.wallets.balance + p_amount, updated_at = now()
  RETURNING balance INTO v_new_balance;

  -- D. Write transaction log
  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (p_user_id, p_amount, 'sync_deposit', p_description, 'settled');

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false, 
    'error', SQLERRM,
    'code', 'DATABASE_EXCEPTION'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.deposit_user_balance TO authenticated, service_role;


-- 2. Atomic Wallet Withdrawal RPC Function
-- Deducts user balance safely with row-level lock (FOR UPDATE), protecting against double spend.
DROP FUNCTION IF EXISTS public.withdraw_user_balance(uuid, numeric, text);

CREATE OR REPLACE FUNCTION public.withdraw_user_balance(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_tx_id BIGINT;
BEGIN
  -- A. Lock the user's wallet row to prevent concurrent modifications
  SELECT balance INTO v_current_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    -- If wallet row doesn't exist, initialize it with 0 to prevent crashes
    INSERT INTO public.wallets (user_id, balance, updated_at)
    VALUES (p_user_id, 0, now());
    v_current_balance := 0;
  END IF;

  -- B. Verify user has sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '余额不足，无法执行同步提现！',
      'code', 'INSUFFICIENT_BALANCE'
    );
  END IF;

  -- C. Deduct balance in public.wallets
  UPDATE public.wallets
  SET balance = balance - p_amount, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- D. Write transaction log with pending-settled state
  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (p_user_id, -p_amount, 'sync_withdrawal', p_description, 'settled')
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'transaction_id', v_tx_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false, 
    'error', SQLERRM,
    'code', 'DATABASE_EXCEPTION'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_user_balance TO authenticated, service_role;


-- 3. Transaction Hash Binder Function
-- Appends the final Web3 tx_hash to the description of a withdrawal transaction.
DROP FUNCTION IF EXISTS public.update_transaction_tx_hash(bigint, text);

CREATE OR REPLACE FUNCTION public.update_transaction_tx_hash(
  p_tx_id BIGINT,
  p_tx_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.transactions
  SET description = description || ' [Tx: ' || p_tx_hash || ']'
  WHERE id = p_tx_id;
  
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_transaction_tx_hash TO authenticated, service_role;
