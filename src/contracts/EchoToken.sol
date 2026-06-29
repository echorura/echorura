// SPDX-License-Identifier: MIT
// Header: ECHORURA MUSICCHAIN Token v2.0 - Fixed Supply & Role-based Access
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title EchoTokenV2
 * @dev Implementation of the ECHORURA ($ECHO) Token V2.
 * Total Supply: 10,000,000,000 (10 Billion)
 * 
 * Tokenomics v1.2 Allocation:
 * - 50% Community Mining Pool: 5,000,000,000 (Minted on-demand by MiningPool contract)
 * - 25% Foundation Reserve: 2,500,000,000 (Initial Mint)
 * - 15% Investors: 1,500,000,000 (Initial Mint)
 * - 10% Management Tax Pool: 1,000,000,000 (Initial Mint)
 */
contract EchoToken is ERC20, ERC20Burnable, ERC20Capped, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    constructor(
        address admin,
        address foundationAccount,
        address investorAccount,
        address taxPoolAccount
    ) 
        ERC20("Echorura Token", "ECHO") 
        ERC20Capped(10_000_000_000 * 10**decimals()) 
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);

        // --- 初始分配 (Initial Allocations) ---
        
        // 25% 基金会储备 (Foundation Reserve)
        _mint(foundationAccount, 2_500_000_000 * 10**decimals());
        
        // 15% 投资人份额 (Investor Shares)
        _mint(investorAccount, 1_500_000_000 * 10**decimals());
        
        // 10% 管理税池 (Management Tax Pool)
        _mint(taxPoolAccount, 1_000_000_000 * 10**decimals());

        /**
         * 提示：
         * 剩余的 50% (50亿枚) 用于社区挖矿。
         * 这部分代币初始并不铸造，而是授予 MiningPool.sol 合约 MINTER_ROLE。
         * 随着用户产生“收听/分享”等行为，由矿场合约按需铸造。
         */
    }

    /**
     * @dev 铸币函数。仅限具有 MINTER_ROLE 的地址调用（如矿场合约）。
     * ERC20Capped 扩展确保了总量永远不会超过 100 亿枚。
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @dev 平台回购销毁函数。仅限具有 BURNER_ROLE 的地址调用。
     */
    function burnFromPlatform(uint256 amount) public onlyRole(BURNER_ROLE) {
        _burn(msg.sender, amount);
    }

    // 重写 ERC20Capped 所需的函数
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Capped)
    {
        super._update(from, to, value);
    }
}
