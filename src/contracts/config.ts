// ECHORURA MUSICCHAIN Smart Contract Configuration
// Deployed on Base Sepolia Testnet (100% Verified on Sourcify)

export const CONTRACT_ADDRESSES = {
  EchoToken: '0x462a9C1FC3f69C8b663B9d365bb30e690D7f3094',
  MiningPool: '0x6bB3b6D3f580Fe5cd680e96c78c1214B05B1E744',
  MusicIP: '0xEDe38Ab93a9fD25E594a85819A50583b47F0a11e',
  AdminAddress: '0x92F62F22fE34dAD6127862A87bCc57ECC8e23b11',
  GenesisPassport: '0xC2eac0E1256386bC802E7a445D3BE7eA95E2b535', // Deployed on Base Sepolia
};

export const BASE_SEPOLIA_CHAIN_INFO = {
  chainId: '0x14a34', // 84532 in hex
  chainName: 'Base Sepolia Testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://sepolia.base.org'],
  blockExplorerUrls: ['https://sepolia.basescan.org'],
};

export const BASE_MAINNET_CHAIN_INFO = {
  chainId: '0x2105', // 8453 in hex (Base Mainnet)
  chainName: 'Base Mainnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
};

export const EchoTokenABI = [
  // Read-only functions
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  
  // Authenticated/Write functions
  'function transfer(address to, uint256 value) returns (bool)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function transferFrom(address from, address to, uint256 value) returns (bool)',
  'function mint(address to, uint256 amount)',
  'function grantRole(bytes32 role, address account)',
  
  // Events
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

export const MiningPoolABI = [
  // Read-only
  'function echoToken() view returns (address)',
  'function taxPoolAddress() view returns (address)',
  'function USER_SHARE() view returns (uint256)',
  'function TAX_SHARE() view returns (uint256)',
  
  // Distribute rewards
  'function distributeReward(address user, uint256 totalAmount)',
  'function updateTaxPoolAddress(address _newTaxPoolAddress)',
  
  // Events
  'event RewardDistributed(address indexed user, uint256 userAmount, uint256 taxAmount)'
];

export const MusicIPABI = [
  // Read-only
  'function echoToken() view returns (address)',
  'function songs(uint256 songId) view returns (address creator, uint256 totalShares, uint256 accumulatedDividendsPerShare)',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function getPendingDividends(address user, uint256 songId) view returns (uint256)',
  
  // Write functions
  'function createIPO(uint256 songId, uint256 totalShares, address creator)',
  'function injectDividends(uint256 songId, uint256 amount)',
  'function claimDividends(uint256 songId)',
  
  // Standard ERC-1155 approvals
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address account, address operator) view returns (bool)',
  'function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)'
];

export const GenesisPassportABI = [
  // Read-only
  'function signerAddress() view returns (address)',
  'function transfersEnabled() view returns (bool)',
  'function numberMinted(uint256 memberNumber) view returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  
  // Write functions
  'function claimPassport(uint256 memberNumber, bytes signature)',
  'function setSignerAddress(address _signer)',
  'function setTransfersEnabled(bool _enabled)',
  'function setBaseURI(string baseTokenURI_)'
];
