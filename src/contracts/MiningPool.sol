// SPDX-License-Identifier: MIT
// Header: ECHORURA MUSICCHAIN Mining v1.2
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./EchoToken.sol";

/**
 * @title MiningPool
 * @dev Handles the behavior-driven rewards distribution.
 * Implements the 90/10 split: 90% to users, 10% to the Management Tax Pool.
 */
contract MiningPool is AccessControl {
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    
    EchoToken public immutable echoToken;
    address public taxPoolAddress;
    
    uint256 public constant USER_SHARE = 90;
    uint256 public constant TAX_SHARE = 10;
    uint256 public constant DENOMINATOR = 100;

    event RewardDistributed(address indexed user, uint256 userAmount, uint256 taxAmount);

    constructor(address _echoToken, address _taxPoolAddress, address admin) {
        echoToken = EchoToken(_echoToken);
        taxPoolAddress = _taxPoolAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DISTRIBUTOR_ROLE, admin);
    }

    /**
     * @dev Distributes rewards based on off-chain behavior validation.
     * Only addresses with DISTRIBUTOR_ROLE (e.g., the platform's backend oracle) can call this.
     */
    function distributeReward(address user, uint256 totalAmount) external onlyRole(DISTRIBUTOR_ROLE) {
        uint256 userAmount = (totalAmount * USER_SHARE) / DENOMINATOR;
        uint256 taxAmount = totalAmount - userAmount; // Ensures no dust remains due to precision

        // Mint 90% to user
        echoToken.mint(user, userAmount);
        
        // Mint 10% to Management Tax Pool
        echoToken.mint(taxPoolAddress, taxAmount);

        emit RewardDistributed(user, userAmount, taxAmount);
    }

    /**
     * @dev Updates the management tax pool address.
     */
    function updateTaxPoolAddress(address _newTaxPoolAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        taxPoolAddress = _newTaxPoolAddress;
    }
}
