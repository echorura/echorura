export interface ComplianceConfig {
  region: 'HK' | 'SG' | 'GLOBAL';
  appName: string;
  tokenDisplayName: string; // "ECHO 社区积分" in HK, "ECHO Token" in Global
  equityDisplayName: string; // "共创共享权益" in HK, "音乐版权股权" in Global
  requirePiVerification: boolean; // Set to false under "Shared economy" model!
  requireSfcWarning: boolean; // Show SFC warnings
  allowFiatTopUp: boolean; // Allow Stripe/fiat top-up
  fiatCurrencySymbol: string; // "HKD" or "SGD"
  fiatExchangeRateText: string;
}

export const COMPLIANCE_REGIONS = {
  HK: {
    region: 'HK' as const,
    appName: '极声音乐 (ECHORURA HK)',
    tokenDisplayName: 'ECHO 社区积分',
    equityDisplayName: '共创共享权益', // Brilliant regulatory pivot to "Shared Economy Model" (similar to shared-bike usage sharing)
    requirePiVerification: false, // Bypassed! Bypasses SFC Securities definition by framing as a Shared Economy Utility
    requireSfcWarning: true, // Still display compliance notices for absolute safety
    allowFiatTopUp: true,
    fiatCurrencySymbol: 'HKD',
    fiatExchangeRateText: '10.00 HKD = 10.00 ECHO 积分'
  },
  SG: {
    region: 'SG' as const,
    appName: 'ECHORURA SG',
    tokenDisplayName: 'ECHO Token',
    equityDisplayName: '粉丝成就徽章 (Fan Badges)',
    requirePiVerification: false,
    requireSfcWarning: false,
    allowFiatTopUp: true,
    fiatCurrencySymbol: 'SGD',
    fiatExchangeRateText: '1.50 SGD = 10.00 ECHO Token'
  },
  GLOBAL: {
    region: 'GLOBAL' as const,
    appName: 'ECHORURA Global',
    tokenDisplayName: 'ECHO Token',
    equityDisplayName: '版权股权 (Music Equity)',
    requirePiVerification: false,
    requireSfcWarning: false,
    allowFiatTopUp: true,
    fiatCurrencySymbol: 'USD',
    fiatExchangeRateText: '1.00 USD = 10.00 ECHO Token'
  }
};

// Define active region. Default is 'HK' specifically for the Hong Kong Version!
export const ACTIVE_REGION: keyof typeof COMPLIANCE_REGIONS = 'GLOBAL';
export const activeConfig = COMPLIANCE_REGIONS[ACTIVE_REGION];
