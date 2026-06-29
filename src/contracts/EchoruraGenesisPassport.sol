// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract EchoruraGenesisPassport is ERC721, Ownable {
    using ECDSA for bytes32;

    // State variables
    address public signerAddress;
    bool public transfersEnabled = false;
    string private _baseTokenURI;

    // Track which member numbers have been minted to prevent duplicate claims
    mapping(uint256 => bool) public numberMinted;

    // Events
    event PassportClaimed(address indexed user, uint256 indexed tokenId, uint256 memberNumber);
    event SignerAddressChanged(address indexed oldSigner, address indexed newSigner);
    event TransfersEnabledSet(bool enabled);

    constructor(
        address initialOwner,
        address initialSignerAddress,
        address teamWallet,
        string memory baseTokenURI_
    ) ERC721("Echorura Genesis Passport", "EGP") Ownable(initialOwner) {
        require(initialSignerAddress != address(0), "EGP: Invalid signer");
        require(teamWallet != address(0), "EGP: Invalid team wallet");
        
        signerAddress = initialSignerAddress;
        _baseTokenURI = baseTokenURI_;

        // Premint first 11 tokens (0-10) to team wallet
        for (uint256 i = 0; i <= 10; i++) {
            _safeMint(teamWallet, i);
            numberMinted[i] = true;
        }
    }

    // Set base URI
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseURI(string memory baseTokenURI_) external onlyOwner {
        _baseTokenURI = baseTokenURI_;
    }

    // Change authorized backend signer
    function setSignerAddress(address _signer) external onlyOwner {
        require(_signer != address(0), "EGP: Invalid signer address");
        emit SignerAddressChanged(signerAddress, _signer);
        signerAddress = _signer;
    }

    // Allow/disallow secondary market transfers (SBT toggle)
    function setTransfersEnabled(bool _enabled) external onlyOwner {
        transfersEnabled = _enabled;
        emit TransfersEnabledSet(_enabled);
    }

    // Claim a Genesis Passport
    function claimPassport(uint256 memberNumber, bytes calldata signature) external {
        require(memberNumber > 10, "EGP: Member numbers 1-10 are reserved");
        require(!numberMinted[memberNumber], "EGP: Member number already minted");
        
        // Verify signature: must be signed by the backend signer address
        // The message includes user wallet address, memberNumber, this contract address, and chainID (prevents cross-chain replay)
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, memberNumber, address(this), block.chainid));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        
        address signer = ethSignedMessageHash.recover(signature);
        require(signer == signerAddress, "EGP: Invalid signature");

        // Mark as minted
        numberMinted[memberNumber] = true;

        // Mint token (tokenId equals memberNumber)
        _safeMint(msg.sender, memberNumber);

        emit PassportClaimed(msg.sender, memberNumber, memberNumber);
    }

    // Soulbound implementation in OpenZeppelin v5 ERC721
    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        address previousOwner = super._update(to, tokenId, auth);
        
        // Prohibit transfer between wallets (except minting from 0x0 or burning to 0x0) unless explicitly enabled
        if (previousOwner != address(0) && to != address(0)) {
            require(transfersEnabled, "EGP: SBT tokens are non-transferable");
        }
        
        return previousOwner;
    }
}
