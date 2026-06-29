// SPDX-License-Identifier: MIT
// Header: ECHORURA MUSICCHAIN MusicIP v1.2
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MusicIP
 * @dev Manages Music IPOs (Fractionalized IP) and automatic dividend distribution using ERC-1155.
 */
contract MusicIP is ERC1155, AccessControl, ReentrancyGuard {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    IERC20 public immutable echoToken;
    
    struct Song {
        address creator;
        uint256 totalShares;
        uint256 accumulatedDividendsPerShare; // Precision scaled by 1e18
    }

    mapping(uint256 => Song) public songs;
    mapping(uint256 => mapping(address => uint256)) public lastAccumulatedDividendsPerShare;
    mapping(uint256 => mapping(address => uint256)) public pendingClaims;

    // --- Compliance Upgrades ---
    bool public transfersEnabled = false; // Global switch, false by default
    mapping(uint256 => uint256) public ipoReleaseTimes; // Unlock timestamp for each songId

    event IPOCreated(uint256 indexed songId, address indexed creator, uint256 totalShares);
    event DividendsInjected(uint256 indexed songId, uint256 amount);
    event DividendsClaimed(address indexed shareholder, uint256 indexed songId, uint256 amount);
    event TransfersEnabledSet(bool enabled);

    constructor(address _echoToken, address admin) ERC1155("https://api.echorura.com/metadata/{id}.json") {
        echoToken = IERC20(_echoToken);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);
    }

    /**
     * @dev Creates a new Music IPO.
     */
    function createIPO(uint256 songId, uint256 totalShares, address creator) external onlyRole(ORACLE_ROLE) {
        require(songs[songId].creator == address(0), "IPO already exists");
        
        songs[songId] = Song({
            creator: creator,
            totalShares: totalShares,
            accumulatedDividendsPerShare: 0
        });

        // Set unlock time to 12 months (365 days) from now
        ipoReleaseTimes[songId] = block.timestamp + 365 days;

        _mint(creator, songId, totalShares, "");
        emit IPOCreated(songId, creator, totalShares);
    }

    /**
     * @dev Sets whether secondary transfers are globally enabled.
     * Only callable by DEFAULT_ADMIN_ROLE once the platform obtains a license.
     */
    function setTransfersEnabled(bool _enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        transfersEnabled = _enabled;
        emit TransfersEnabledSet(_enabled);
    }

    /**
     * @dev Injects ECHO dividends into a song's profit pool.
     * The ECHO tokens must be approved or transferred to this contract.
     */
    function injectDividends(uint256 songId, uint256 amount) external nonReentrant {
        require(songs[songId].totalShares > 0, "Song not found");
        require(echoToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        // Scale by 1e18 to prevent precision loss
        songs[songId].accumulatedDividendsPerShare += (amount * 1e18) / songs[songId].totalShares;

        emit DividendsInjected(songId, amount);
    }

    /**
     * @dev Shareholders claim their dividends.
     */
    function claimDividends(uint256 songId) external nonReentrant {
        uint256 shares = balanceOf(msg.sender, songId);
        require(shares > 0, "No shares held");

        uint256 claimable = _calculateClaimable(msg.sender, songId, shares);
        require(claimable > 0, "Nothing to claim");

        lastAccumulatedDividendsPerShare[songId][msg.sender] = songs[songId].accumulatedDividendsPerShare;
        
        require(echoToken.transfer(msg.sender, claimable), "Payment failed");
        emit DividendsClaimed(msg.sender, songId, claimable);
    }

    function _calculateClaimable(address user, uint256 songId, uint256 shares) internal view returns (uint256) {
        uint256 diff = songs[songId].accumulatedDividendsPerShare - lastAccumulatedDividendsPerShare[songId][user];
        return (shares * diff) / 1e18;
    }

    // Helper to see pending dividends
    function getPendingDividends(address user, uint256 songId) external view returns (uint256) {
        uint256 shares = balanceOf(user, songId);
        return _calculateClaimable(user, songId, shares);
    }

    /**
     * @dev ERC1155 Hook: Ensure we update dividend state before tokens are transferred.
     * Also enforces transfer restrictions (transfersEnabled switch and 12-month lockup).
     */
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override
    {
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 songId = ids[i];

            // Enforce transfer restrictions for wallet-to-wallet transfers (from != 0 && to != 0)
            if (from != address(0) && to != address(0)) {
                require(transfersEnabled, "Secondary transfers are globally disabled");
                require(block.timestamp >= ipoReleaseTimes[songId], "Song shares are under 12-month lockup");
            }

            if (from != address(0)) {
                // Sender claims their current pending dividends before sending shares
                uint256 fromShares = balanceOf(from, songId);
                pendingClaims[songId][from] += _calculateClaimable(from, songId, fromShares);
                lastAccumulatedDividendsPerShare[songId][from] = songs[songId].accumulatedDividendsPerShare;
            }
            if (to != address(0)) {
                // Recipient's current pending is locked at current rate
                uint256 toShares = balanceOf(to, songId);
                pendingClaims[songId][to] += _calculateClaimable(to, songId, toShares);
                lastAccumulatedDividendsPerShare[songId][to] = songs[songId].accumulatedDividendsPerShare;
            }
        }
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
