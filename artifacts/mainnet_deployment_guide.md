# ECHORURA Base Mainnet Deployment Guide

This guide details the step-by-step procedure required to migrate the ECHORURA platform from **Base Sepolia (Testnet)** to **Base Mainnet (Production)**.

---

## 📋 1. Smart Contract Deployment & Verification

Before updating the application backend, you must deploy and verify the platform's smart contracts on **Base Mainnet**:

1.  **Deploy Contracts**:
    *   Deploy **`EchoToken`** (ERC-20 token contract).
    *   Deploy **`MusicIP`** (ERC-1155 copyright NFT contract).
    *   Deploy **`MiningPool`** (reward distribution contract).
2.  **Verification**:
    *   Verify all contracts on **BaseScan** (Mainnet) using Hardhat/Foundry or via the explorer interface.
3.  **Roles & Access Control**:
    *   Set the `AdminAddress` in the `MusicIP` and `MiningPool` contracts.
    *   Transfer ownership/admin permissions of the contracts to a secure platform wallet (ideally a multi-signature wallet like **Gnosis Safe**).
4.  **Funding**:
    *   Deposit a sufficient amount of **Base ETH** into the `MiningPool` distributor signer wallet to cover transaction gas fees.
    *   Transfer a pool of **ECHO** tokens to the `MiningPool` contract for reward distribution, and to the `AdminAddress` wallet to distribute shares during IPO checkouts.

---

## ⚙️ 2. Environment Variables & App Configuration

Update the environment variables on your production server (e.g., Vercel, Zeabur, or AWS) and the local configurations:

### 1. Backend Environment Variables (`.env` in Production)
```env
# Database Credentials (pointing to your Production Supabase instance)
NEXT_PUBLIC_SUPABASE_URL=https://your-production-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key

# Base Mainnet RPC Provider (e.g., Alchemy, QuickNode, or Infura)
# Avoid public RPC endpoints in production to prevent rate-limiting and transaction drop issues.
NEXT_PUBLIC_RPC_PROVIDER_URL=https://base-mainnet.g.alchemy.com/v2/YOUR-API-KEY

# Production Web3 Signer Private Key (Keep this extremely secure!)
MINING_POOL_DISTRIBUTOR_PRIVATE_KEY=your-production-signer-wallet-private-key

# Cron Job Authorization Token
CRON_SECRET=your-random-secure-cron-token
```

### 2. Smart Contract Config
Modify [src/contracts/config.ts](file:///c:/Users/Administrator/Desktop/极声音乐/src/contracts/config.ts):
*   Replace all **Base Sepolia addresses** with the newly deployed **Base Mainnet contract addresses**:
```typescript
export const CONTRACT_ADDRESSES = {
  EchoToken: '0xYourMainnetEchoTokenAddress',
  MusicIP: '0xYourMainnetMusicIPAddress',
  MiningPool: '0xYourMainnetMiningPoolAddress',
  AdminAddress: '0xYourMainnetAdminAddress', // Platform cold/hot wallet receiving payments
};
```
*   Update the RPC network provider configurations inside [src/app/api/](file:///c:/Users/Administrator/Desktop/极声音乐/src/app/api/) endpoints from:
    `new ethers.JsonRpcProvider('https://sepolia.base.org')`
    to use the Mainnet provider:
    `new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_PROVIDER_URL || 'https://mainnet.base.org')`

---

## 🗄️ 3. Production Database Initialization

1.  **Initialize Tables**:
    *   Run the initial table schemas (migrations `01` to `17`) on your production Supabase database.
2.  **Install Security & Concurrency Controls**:
    *   Run [18_reconciliation_system_supabase.sql](file:///c:/Users/Administrator/Desktop/极声音乐/sql/18_reconciliation_system_supabase.sql) (UUID version) to configure the idempotent IPO checkout system.
    *   Run [19_secure_wallet_sync.sql](file:///c:/Users/Administrator/Desktop/极声音乐/sql/19_secure_wallet_sync.sql) to configure row-level locked wallet syncing.
3.  **Confirm RLS (Row Level Security)**:
    *   Ensure RLS is enabled on all tables.
    *   Verify that only authenticated users can insert comments/likes and read their own wallets.

---

## 🔒 4. Security Checklist for Mainnet Launch

Before opening the site to public users, verify the following:

| Category | Item | Description | Status |
| :--- | :--- | :--- | :--- |
| **Gas Signer** | Key Security | Ensure `MINING_POOL_DISTRIBUTOR_PRIVATE_KEY` is NOT committed to Git (it is already ignored by `.env.local`). | 🛡️ Secure |
| **Gas Signer** | Gas Monitoring | Set up a notifier (e.g., via OpenZeppelin Defender or a script) to alert you when the distributor wallet's ETH balance drops below 0.05 ETH. | ⚠️ Pending |
| **API Sec** | Cron Verification | Secure the `/api/cron/reconcile` endpoint by checking the `Authorization: Bearer <CRON_SECRET>` header, so that external bots cannot trigger it continuously. | ⚠️ Pending |
| **Web3 Client**| Chain Switching | Verify that Wagmi/RainbowKit/AppKit in the frontend is configured with the `base` mainnet object, and that users are prompted to connect to **Base Mainnet (chainId: 8453)** rather than Sepolia. | ⚠️ Pending |
| **Rate Limit** | IP Rate Limiting | Set up rate-limiting on `/api/market/purchase`, `/api/wallet/sync`, and `/api/wallet/deposit` using Upstash Redis or Vercel Edge Middlewares to prevent DDOS/Sybil attacks. | ⚠️ Pending |
