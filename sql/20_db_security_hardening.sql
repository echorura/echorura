-- ==========================================================
-- ECHORURA Database RLS Security Hardening
-- Please run this script in your Memfire Cloud / Supabase SQL Editor
-- ==========================================================

-- 1. Hardening pending_purchases table
-- Insertion and updates of checkout orders are handled exclusively by the backend API 
-- (using service_role key). Normal users must NOT have direct INSERT or UPDATE 
-- access to this table via public REST endpoints.
-- We drop these public policies, leaving only the SELECT policy so users can track their own orders.

DROP POLICY IF EXISTS "Users can insert their own pending purchases" ON public.pending_purchases;
DROP POLICY IF EXISTS "Users can update their own pending purchases" ON public.pending_purchases;

-- 2. Hardening processed_onchain_txs table
-- Ensure only SELECT access is granted to authenticated users (already in place).
-- Ensure no INSERT/UPDATE/DELETE policies are defined for this table.
DROP POLICY IF EXISTS "Users can insert processed_onchain_txs" ON public.processed_onchain_txs;
DROP POLICY IF EXISTS "Users can update processed_onchain_txs" ON public.processed_onchain_txs;
DROP POLICY IF EXISTS "Users can delete processed_onchain_txs" ON public.processed_onchain_txs;

-- 3. Hardening wallets table
-- Users must only be allowed to view their own wallets. No direct modifications are allowed.
DROP POLICY IF EXISTS "Users can insert wallets" ON public.wallets;
DROP POLICY IF EXISTS "Users can update wallets" ON public.wallets;
DROP POLICY IF EXISTS "Users can delete wallets" ON public.wallets;

-- 4. Hardening transactions table
-- Users must only be allowed to view their own transactions. No direct modifications are allowed.
DROP POLICY IF EXISTS "Users can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete transactions" ON public.transactions;
