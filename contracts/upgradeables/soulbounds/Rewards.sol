// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// @author Summon.xyz Team - https://summon.xyz
// @contributors: [ @ogarciarevett, @karacurt]
//....................................................................................................................................................
//....................&&&&&&..........................................................................................................................
//..................&&&&&&&&&&&.......................................................................................................................
//..............X.....&&&&&&&&&&&&....................................................................................................................
//............&&&&&&.....&&&&&&&&&&&..................................................................................................................
//............&&&&&&&&&.....&&&&&.....................................................................................................................
//............&&&&&&&&&&&&.........&.............&&&&&&&&&&&&..&&&&....&&&&.&&&&&&&&..&&&&&&&.&&&&&&&&..&&&&&&&&.&&&&&&&&&&&&.&&&&&....&&&&...........
//...............&&&&&&&&&&&&.....&&$............&&&&..........&&&&....&&&&.&&&&&&&&.&&&&&&&&..&&&&&&&&.&&&&&&&&.&&&&&&&&&&&&.&&&&&&&..&&&&...........
//............&.....&&&&&&&&&&&&..................&&&&&&&&&&&..&&&&....&&&&.&&&&..&&&&&&.&&&&..&&&&.&&&&&&..&&&&.&&&&....&&&&.&&&&.&&&&&&&&...........
//............&&.......&&&&&&&&&&&&......................&&&&..&&&&&&&&&&&&.&&&&..&&&&&..&&&&..&&&&..&&&&...&&&&.&&&&&&&&&&&&.&&&&...&&&&&&...........
//................&&&.....&&&&&&&&&&+............&&&&&&&&&&&&...&&&&&&&&&&..&&&&...&&&&..&&&&.&&&&&..&&&&...&&&&.&&&&&&&&&&&&.&&&&....&&&&&...........
//.............&&&&&&&&&.....&&&&&&&..................................................................................................................
//.............&&&&&&&&&&&&.....&&&...................................................................................................................
//.................&&&&&&&&&&&........................................................................................................................
//....................&&&&&&&.........................................................................................................................
//....................................................................................................................................................

import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { IERC1155MetadataURI } from "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Metadata } from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {
    AccessControlUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {
    ERC1155HolderUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import {
    ERC721HolderUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import {
    ContextUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { AccessToken } from "../../soulbounds/AccessToken.sol";
import { ERCWhitelistSignatureUpgradeable } from "../ercs/ERCWhitelistSignatureUpgradeable.sol";
import { LibItems } from "../../libraries/LibItems.sol";

contract Rewards is
    Initializable,
    ERCWhitelistSignatureUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    ERC1155HolderUpgradeable,
    ERC721HolderUpgradeable
{
    /*//////////////////////////////////////////////////////////////
                               ERRORS
    //////////////////////////////////////////////////////////////*/
    error AddressIsZero();
    error InvalidTokenId();
    error InvalidAmount();
    error ExceedMaxSupply();
    error InvalidLength();
    error TokenNotExist();
    error InvalidInput();
    error InsufficientBalance();
    error TransferFailed();
    error MintPaused();
    error ClaimRewardPaused();
    error DupTokenId();
    error TokenNotWhitelisted();
    error TokenAlreadyWhitelisted();
    error InsufficientTreasuryBalance();
    error CannotReduceSupply();
    error TokenHasReserves();
    error SignatureExpired();
    error NonceAlreadyUsed();

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /*//////////////////////////////////////////////////////////////
                               STATE-VARS
    //////////////////////////////////////////////////////////////*/
    AccessToken private rewardTokenContract;

    uint256[] public itemIds;
    mapping(uint256 => bool) private tokenExists;
    mapping(uint256 => LibItems.RewardToken) public tokenRewards;
    mapping(uint256 => bool) public isTokenMintPaused; // tokenId => bool - default is false
    mapping(uint256 => bool) public isClaimRewardPaused; // tokenId => bool - default is false
    mapping(uint256 => mapping(uint256 => uint256))
        private erc721RewardCurrentIndex; // rewardTokenId => rewardIndex => erc721RewardCurrentIndex
    mapping(uint256 => uint256) public currentRewardSupply; // rewardTokenId => currentRewardSupply

    // Treasury system
    mapping(address => bool) public whitelistedTokens; // token address => whitelisted
    address[] private whitelistedTokenList; // list of whitelisted token addresses
    mapping(address => uint256) public reservedAmounts; // token address => reserved amount

    // Per-user nonce tracking
    mapping(address => mapping(uint256 => bool)) public userNonces; // user => nonce => used

    // ERC721 Reservation Tracking
    mapping(address => mapping(uint256 => bool)) public isErc721Reserved; // token address => tokenId => isReserved
    mapping(address => uint256) public erc721TotalReserved; // token address => reserved amounts

    // ERC1155 Reservation Tracking
    mapping(address => mapping(uint256 => uint256)) public erc1155ReservedAmounts; // token address => tokenId => reserved
    mapping(address => uint256) public erc1155TotalReserved; // token address => total reserved (all IDs)
    mapping(address => LibItems.RewardType) public tokenTypes; // token address => type

    uint256[33] private __gap;

    /*//////////////////////////////////////////////////////////////
                               EVENTS
    //////////////////////////////////////////////////////////////*/
    event TokenAdded(uint256 indexed tokenId);
    event Minted(
        address indexed to,
        uint256 indexed tokenId,
        uint256 amount,
        bool soulbound
    );
    event Claimed(address indexed to, uint256 indexed tokenId, uint256 amount);
    event TokenMintPausedUpdated(uint256 indexed tokenId, bool isPaused);
    event ClaimRewardPausedUpdated(uint256 indexed tokenId, bool isPaused);
    event AssetsWithdrawn(
        LibItems.RewardType rewardType,
        address indexed to,
        uint256 amount
    );
    event TokenWhitelisted(address indexed token);
    event TokenRemovedFromWhitelist(address indexed token);
    event TreasuryDeposit(address indexed token, uint256 amount);
    event RewardSupplyChanged(
        uint256 indexed tokenId,
        uint256 oldSupply,
        uint256 newSupply
    );
    event TokenURIChanged(uint256 indexed tokenId, string newUri);

    function initialize(
        address _devWallet,
        address _managerWallet,
        address _minterWallet,
        address _rewardTokenAddress
    ) external initializer {
         if (_devWallet == address(0)) {
            revert AddressIsZero();
         }

        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __ERC1155Holder_init();
        __ERC721Holder_init();
        __ERCWhitelistSignatureUpgradeable_init();

        if (
            _devWallet == address(0) ||
            _managerWallet == address(0) ||
            _minterWallet == address(0) ||
            _rewardTokenAddress == address(0)
        ) {
            revert AddressIsZero();
        }

        rewardTokenContract = AccessToken(_rewardTokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, _devWallet);
        _grantRole(DEV_CONFIG_ROLE, _devWallet);
        _grantRole(MANAGER_ROLE, _managerWallet);
        _grantRole(MINTER_ROLE, _minterWallet);
        _grantRole(UPGRADER_ROLE, _devWallet);
        _addWhitelistSigner(_devWallet);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override {
        _checkRole(UPGRADER_ROLE);
    }

    function updateRewardTokenContract(
        address _rewardTokenAddress
    ) external onlyRole(DEV_CONFIG_ROLE) {
        if (_rewardTokenAddress == address(0)) {
            revert AddressIsZero();
        }

        rewardTokenContract = AccessToken(_rewardTokenAddress);
    }

    function isTokenExist(uint256 _tokenId) public view returns (bool) {
        return tokenExists[_tokenId];
    }

    function getRewardTokenContract() external view returns (address) {
        return address(rewardTokenContract);
    }

    /**
     * @dev Get treasury balances for all whitelisted tokens with full balance breakdown.
     * Includes ERC20 tokens (fa), ERC721 tokens (nft), and ERC1155 tokens (nft) from the treasury.
     * @return addresses Array of token addresses.
     * @return totalBalances Array of total balances in the contract.
     * @return reservedBalances Array of reserved amounts for rewards.
     * @return availableBalances Array of available (unreserved) balances.
     * @return symbols Array of token symbols.
     * @return names Array of token names.
     * @return types Array of token types ("fa" for fungible assets, "nft" for NFTs).
     */
    function getAllTreasuryBalances()
        external
        view
        returns (
            address[] memory addresses,
            uint256[] memory totalBalances,
            uint256[] memory reservedBalances,
            uint256[] memory availableBalances,
            string[] memory symbols,
            string[] memory names,
            string[] memory types
        )
    {
        // Count ERC20 and ERC721 tokens from whitelistedTokenList (excluding ERC1155)
        uint256 erc20AndErc721Count = 0;
        for (uint256 i = 0; i < whitelistedTokenList.length; i++) {
            LibItems.RewardType tokenType = tokenTypes[whitelistedTokenList[i]];
            if (tokenType == LibItems.RewardType.ERC20 || tokenType == LibItems.RewardType.ERC721) {
                erc20AndErc721Count++;
            }
        }

        // Count unique ERC1155 token IDs (since one ERC1155 contract can have multiple token IDs)
        uint256 erc1155Count = _countUniqueErc1155TokenIds();
        uint256 totalCount = erc20AndErc721Count + erc1155Count;

        addresses = new address[](totalCount);
        totalBalances = new uint256[](totalCount);
        reservedBalances = new uint256[](totalCount);
        availableBalances = new uint256[](totalCount);
        symbols = new string[](totalCount);
        names = new string[](totalCount);
        types = new string[](totalCount);

        uint256 currentIndex = 0;

        // Process all whitelisted tokens
        for (uint256 i = 0; i < whitelistedTokenList.length; i++) {
            address tokenAddress = whitelistedTokenList[i];
            LibItems.RewardType tokenType = tokenTypes[tokenAddress];

            addresses[currentIndex] = tokenAddress;

            if (tokenType == LibItems.RewardType.ERC20) {
                // ERC20 token
                uint256 totalBalance = IERC20(tokenAddress).balanceOf(address(this));
                uint256 reserved = reservedAmounts[tokenAddress];

                totalBalances[currentIndex] = totalBalance;
                reservedBalances[currentIndex] = reserved;
                availableBalances[currentIndex] = totalBalance > reserved ? totalBalance - reserved : 0;

                try IERC20Metadata(tokenAddress).symbol() returns (string memory symbol) {
                    symbols[currentIndex] = symbol;
                } catch {
                    symbols[currentIndex] = "UNKNOWN";
                }

                try IERC20Metadata(tokenAddress).name() returns (string memory name) {
                    names[currentIndex] = name;
                } catch {
                    names[currentIndex] = "Unknown Token";
                }

                types[currentIndex] = "fa";
                currentIndex++;

            } else if (tokenType == LibItems.RewardType.ERC721) {
                // ERC721 token
                uint256 totalBalance = IERC721(tokenAddress).balanceOf(address(this));
                uint256 reserved = erc721TotalReserved[tokenAddress];

                totalBalances[currentIndex] = totalBalance;
                reservedBalances[currentIndex] = reserved;
                availableBalances[currentIndex] = totalBalance > reserved ? totalBalance - reserved : 0;

                // Try to get ERC721 metadata
                try IERC721Metadata(tokenAddress).symbol() returns (string memory symbol) {
                    symbols[currentIndex] = symbol;
                } catch {
                    symbols[currentIndex] = "ERC721";
                }

                try IERC721Metadata(tokenAddress).name() returns (string memory name) {
                    names[currentIndex] = name;
                } catch {
                    names[currentIndex] = "NFT Collection";
                }

                types[currentIndex] = "nft";
                currentIndex++;

            } else if (tokenType == LibItems.RewardType.ERC1155) {
                // ERC1155 tokens - need to iterate through rewards to get token IDs
                // We'll handle these separately below
                continue;
            }
        }

        // Process ERC1155 tokens separately (since they have multiple token IDs per contract)
        // Track processed ERC1155 combinations to avoid duplicates
        address[] memory processedErc1155Addresses = new address[](erc1155Count);
        uint256[] memory processedErc1155TokenIds = new uint256[](erc1155Count);
        uint256 processedCount = 0;

        for (uint256 i = 0; i < itemIds.length; i++) {
            uint256 tokenId = itemIds[i];
            LibItems.RewardToken storage rewardToken = tokenRewards[tokenId];

            for (uint256 j = 0; j < rewardToken.rewards.length; j++) {
                LibItems.Reward storage reward = rewardToken.rewards[j];

                if (reward.rewardType != LibItems.RewardType.ERC1155) {
                    continue;
                }

                address erc1155Address = reward.rewardTokenAddress;
                uint256 erc1155TokenId = reward.rewardTokenId;

                // Check if this exact address+tokenID combination was already added
                bool alreadyAdded = false;
                for (uint256 k = 0; k < processedCount; k++) {
                    if (processedErc1155Addresses[k] == erc1155Address &&
                        processedErc1155TokenIds[k] == erc1155TokenId) {
                        alreadyAdded = true;
                        break;
                    }
                }

                if (!alreadyAdded && currentIndex < totalCount) {
                    // Track this combination
                    processedErc1155Addresses[processedCount] = erc1155Address;
                    processedErc1155TokenIds[processedCount] = erc1155TokenId;
                    processedCount++;

                    addresses[currentIndex] = erc1155Address;

                    uint256 balance = IERC1155(erc1155Address).balanceOf(address(this), erc1155TokenId);
                    uint256 reserved = erc1155ReservedAmounts[erc1155Address][erc1155TokenId];

                    totalBalances[currentIndex] = balance;
                    reservedBalances[currentIndex] = reserved;
                    availableBalances[currentIndex] = balance > reserved ? balance - reserved : 0;

                    // ERC1155 standard does not include name() or symbol() functions
                    // Use generic names for ERC1155 tokens
                    names[currentIndex] = "ERC1155 Collection";
                    symbols[currentIndex] = "ERC1155";
                    types[currentIndex] = "nft";
                    currentIndex++;
                }
            }
        }
    }
    
    /**
     * @dev Count unique ERC1155 token IDs used in rewards.
     * ERC1155 contracts can have multiple token IDs, so we need to count them separately.
     */
    function _countUniqueErc1155TokenIds() private view returns (uint256) {
        // Use a large enough array to track unique combinations
        address[] memory uniqueAddresses = new address[](itemIds.length * 10);
        uint256[] memory uniqueTokenIds = new uint256[](itemIds.length * 10);
        uint256 count = 0;

        for (uint256 i = 0; i < itemIds.length; i++) {
            uint256 tokenId = itemIds[i];
            LibItems.RewardToken storage rewardToken = tokenRewards[tokenId];

            for (uint256 j = 0; j < rewardToken.rewards.length; j++) {
                LibItems.Reward storage reward = rewardToken.rewards[j];

                if (reward.rewardType == LibItems.RewardType.ERC1155) {
                    address erc1155Address = reward.rewardTokenAddress;
                    uint256 erc1155TokenId = reward.rewardTokenId;

                    // Check if this combination already exists
                    bool found = false;
                    for (uint256 k = 0; k < count; k++) {
                        if (uniqueAddresses[k] == erc1155Address && uniqueTokenIds[k] == erc1155TokenId) {
                            found = true;
                            break;
                        }
                    }

                    if (!found) {
                        uniqueAddresses[count] = erc1155Address;
                        uniqueTokenIds[count] = erc1155TokenId;
                        count++;
                    }
                }
            }
        }

        return count;
    }


    function getAllItemIds() external view returns (uint256[] memory) {
        return itemIds;
    }

    function decodeData(
        bytes calldata _data
    )
        external
        view
        onlyRole(DEV_CONFIG_ROLE)
        returns (address, uint256, uint256, uint256[] memory)
    {
        return _decodeData(_data);
    }

    function _decodeData(
        bytes calldata _data
    ) private pure returns (address, uint256, uint256, uint256[] memory) {
        (
            address contractAddress,
            uint256 chainId,
            uint256 expiration,
            uint256[] memory _itemIds
        ) = abi.decode(_data, (address, uint256, uint256, uint256[]));
        return (contractAddress, chainId, expiration, _itemIds);
    }

    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    function _validateTokenInputs(
        LibItems.RewardToken calldata _token
    ) private view {
        if (_token.maxSupply == 0) {
            revert InvalidAmount();
        }

        if (
            bytes(_token.tokenUri).length == 0 ||
            _token.rewards.length == 0 ||
            _token.tokenId == 0
        ) {
            revert InvalidInput();
        }

        if (isTokenExist(_token.tokenId)) {
            revert DupTokenId();
        }

        for (uint256 i = 0; i < _token.rewards.length; i++) {
            LibItems.Reward memory reward = _token.rewards[i];
            if (reward.rewardType != LibItems.RewardType.ETHER) {
                if (reward.rewardTokenAddress == address(0)) {
                    revert AddressIsZero();
                }
            }

            if (reward.rewardType == LibItems.RewardType.ERC721) {
                if (
                    reward.rewardTokenIds.length == 0 ||
                    reward.rewardTokenIds.length !=
                    reward.rewardAmount * _token.maxSupply
                ) {
                    revert InvalidInput();
                }
            }

            if (
                reward.rewardType != LibItems.RewardType.ERC721 &&
                reward.rewardAmount == 0
            ) {
                revert InvalidAmount();
            }
        }
    }

    function _calculateETHRequiredForToken(
        LibItems.RewardToken calldata _token
    ) private pure returns (uint256) {
        uint256 totalETHRequired;
        for (uint256 i = 0; i < _token.rewards.length; i++) {
            LibItems.Reward memory reward = _token.rewards[i];
            if (reward.rewardType == LibItems.RewardType.ETHER) {
                totalETHRequired += reward.rewardAmount;
            }
        }
        return totalETHRequired * _token.maxSupply;
    }

    function _createTokenAndDepositRewards(
        LibItems.RewardToken calldata _token
    ) private {
        // have to approve all the assets first
        // Validate token inputs
        _validateTokenInputs(_token);

        // Validate ERC20 tokens are whitelisted and reserve amounts
        for (uint256 i = 0; i < _token.rewards.length; i++) {
            LibItems.Reward memory reward = _token.rewards[i];
            if (reward.rewardType == LibItems.RewardType.ERC20) {
                if (!whitelistedTokens[reward.rewardTokenAddress]) {
                    revert TokenNotWhitelisted();
                }
                uint256 totalAmount = reward.rewardAmount * _token.maxSupply;
                uint256 balance = IERC20(reward.rewardTokenAddress).balanceOf(
                    address(this)
                );
                uint256 reserved = reservedAmounts[reward.rewardTokenAddress];
                if (balance < reserved + totalAmount) {
                    revert InsufficientTreasuryBalance();
                }
                // Reserve the amount
                reservedAmounts[reward.rewardTokenAddress] += totalAmount;
            } else if (reward.rewardType == LibItems.RewardType.ERC721) {
                // Validate token is whitelisted
                if (!whitelistedTokens[reward.rewardTokenAddress]) {
                    revert TokenNotWhitelisted();
                }
                IERC721 nftContract = IERC721(reward.rewardTokenAddress);
                // Verify all tokenIds are owned by this contract and unreserved
                for (uint256 j = 0; j < reward.rewardTokenIds.length; j++) {
                    uint256 tokenId = reward.rewardTokenIds[j];
                    // Check contract owns this NFT and it is not already reserved
                    if (nftContract.ownerOf(tokenId) != address(this) || isErc721Reserved[reward.rewardTokenAddress][tokenId]) {
                        revert InsufficientTreasuryBalance();
                    }
                }
                // Reserve all tokenIds
                for (uint256 j = 0; j < reward.rewardTokenIds.length; j++) {
                    uint256 tokenId = reward.rewardTokenIds[j];
                    isErc721Reserved[reward.rewardTokenAddress][tokenId] = true;
                    erc721TotalReserved[reward.rewardTokenAddress]++;
                }
            } else if (reward.rewardType == LibItems.RewardType.ERC1155) {
                // Validate token is whitelisted
                if (!whitelistedTokens[reward.rewardTokenAddress]) {
                    revert TokenNotWhitelisted();
                }
                uint256 totalAmount = reward.rewardAmount * _token.maxSupply;
                uint256 balance = IERC1155(reward.rewardTokenAddress).balanceOf(address(this), reward.rewardTokenId);
                uint256 reserved = erc1155ReservedAmounts[reward.rewardTokenAddress][reward.rewardTokenId];
                if (balance < reserved + totalAmount) {
                    revert InsufficientTreasuryBalance();
                }
                // Reserve the amount
                erc1155ReservedAmounts[reward.rewardTokenAddress][
                    reward.rewardTokenId
                ] += totalAmount;
                erc1155TotalReserved[reward.rewardTokenAddress] += totalAmount;
            }
        }

        tokenRewards[_token.tokenId] = _token;
        tokenExists[_token.tokenId] = true;
        itemIds.push(_token.tokenId);
        rewardTokenContract.addNewToken(_token.tokenId);

        emit TokenAdded(_token.tokenId);
    }

    function createTokenAndDepositRewards(
        LibItems.RewardToken calldata _token
    ) public payable onlyRole(MANAGER_ROLE) {
        uint256 _ethRequired = _calculateETHRequiredForToken(_token);

        if (msg.value < _ethRequired) {
            revert InsufficientBalance();
        }

        _createTokenAndDepositRewards(_token);
    }

    function createMultipleTokensAndDepositRewards(
        LibItems.RewardToken[] calldata _tokens
    ) external payable onlyRole(MANAGER_ROLE) {
        uint256 totalETHRequired;

        // Calculate the total ETH required for all tokens
        for (uint256 i = 0; i < _tokens.length; i++) {
            totalETHRequired += _calculateETHRequiredForToken(_tokens[i]);
        }

        // Check if the provided ETH is enough
        if (msg.value < totalETHRequired) {
            revert InsufficientBalance();
        }

        // Create tokens and deposit rewards
        for (uint256 i = 0; i < _tokens.length; i++) {
            _createTokenAndDepositRewards(_tokens[i]);
        }
    }

    function updateTokenMintPaused(
        uint256 _tokenId,
        bool _isTokenMintPaused
    ) public onlyRole(MANAGER_ROLE) {
        isTokenMintPaused[_tokenId] = _isTokenMintPaused;
        emit TokenMintPausedUpdated(_tokenId, _isTokenMintPaused);
    }

    function updateClaimRewardPaused(
        uint256 _tokenId,
        bool _isClaimRewardPaused
    ) public onlyRole(MANAGER_ROLE) {
        isClaimRewardPaused[_tokenId] = _isClaimRewardPaused;
        emit ClaimRewardPausedUpdated(_tokenId, _isClaimRewardPaused);
    }

    /*//////////////////////////////////////////////////////////////
                         TREASURY MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Whitelist a token for use in the treasury system.
     * @param _token The address of the token to whitelist.
     * @param _type The type of the token (ERC20, ERC721, ERC1155).
     */
    function whitelistToken(
        address _token,
        LibItems.RewardType _type
    ) external onlyRole(MANAGER_ROLE) {
        if (_token == address(0)) {
            revert AddressIsZero();
        }
        if (whitelistedTokens[_token]) {
            revert TokenAlreadyWhitelisted();
        }
        whitelistedTokens[_token] = true;
        tokenTypes[_token] = _type;
        whitelistedTokenList.push(_token);
        
        if (_type == LibItems.RewardType.ERC20) {
            reservedAmounts[_token] = 0;
        }
        
        emit TokenWhitelisted(_token);
    }

    /**
     * @dev Remove a token from the whitelist.
     * @param _token The address of the token to remove.
     */
    function removeTokenFromWhitelist(
        address _token
    ) external onlyRole(MANAGER_ROLE) {
        if (!whitelistedTokens[_token]) {
            revert TokenNotWhitelisted();
        }

        LibItems.RewardType _type = tokenTypes[_token];
        
        if (_type == LibItems.RewardType.ERC20) {
            // Ensure no reserved amounts before removing
            if (reservedAmounts[_token] > 0) {
                revert TokenHasReserves();
            }
            // Ensure contract has no balance for this token
            uint256 balance = IERC20(_token).balanceOf(address(this));
            if (balance > 0) {
                revert TokenHasReserves();
            }
        } else if (_type == LibItems.RewardType.ERC721) {
            // Ensure no reserved amounts before removing
            if (erc721TotalReserved[_token] > 0) {
                revert TokenHasReserves();
            }
            // Ensure contract has no balance for this token
            uint256 balance = IERC721(_token).balanceOf(address(this));
            if (balance > 0) {
                revert TokenHasReserves();
            }
        } else if (_type == LibItems.RewardType.ERC1155) {
             // Ensure no reserved amounts before removing
            if (erc1155TotalReserved[_token] > 0) {
                revert TokenHasReserves();
            }
        }

        whitelistedTokens[_token] = false;

        // Remove from list
        for (uint256 i = 0; i < whitelistedTokenList.length; i++) {
            if (whitelistedTokenList[i] == _token) {
                whitelistedTokenList[i] = whitelistedTokenList[
                    whitelistedTokenList.length - 1
                ];
                whitelistedTokenList.pop();
                break;
            }
        }
        emit TokenRemovedFromWhitelist(_token);
    }

    /**
     * @dev Deposit tokens to the treasury.
     * @param _token The address of the ERC20 token to deposit.
     * @param _amount The amount to deposit.
     */
    function depositToTreasury(address _token, uint256 _amount) external {
        if (!whitelistedTokens[_token]) {
            revert TokenNotWhitelisted();
        }
        if (_amount == 0) {
            revert InvalidAmount();
        }
        SafeERC20.safeTransferFrom(
            IERC20(_token),
            _msgSender(),
            address(this),
            _amount
        );
        emit TreasuryDeposit(_token, _amount);
    }

    /**
     * @dev Withdraw unreserved tokens from the treasury.
     * @param _token The address of the ERC20 token to withdraw.
     * @param _to The address to send the tokens to.
     */
    function withdrawUnreservedTreasury(
        address _token,
        address _to
    ) external onlyRole(MANAGER_ROLE) {
        if (_to == address(0)) {
            revert AddressIsZero();
        }
        if (!whitelistedTokens[_token]) {
            revert TokenNotWhitelisted();
        }

        uint256 balance = IERC20(_token).balanceOf(address(this));
        uint256 reserved = reservedAmounts[_token];

        if (balance <= reserved) {
            revert InsufficientBalance();
        }

        uint256 withdrawable = balance - reserved;
        SafeERC20.safeTransfer(IERC20(_token), _to, withdrawable);
    }

    /**
     * @dev Withdraw unreserved ERC721 tokens from the treasury.
     * @param _token The address of the ERC721 token to withdraw.
     * @param _to The address to send the tokens to.
     * @param _tokenId The token ID to withdraw.
     */
    function withdrawERC721UnreservedTreasury(
        address _token,
        address _to,
        uint256 _tokenId
    ) external onlyRole(MANAGER_ROLE) {
        if (_to == address(0)) {
            revert AddressIsZero();
        }
        if (!whitelistedTokens[_token]) {
            revert TokenNotWhitelisted();
        }

        if (isErc721Reserved[_token][_tokenId]) {
             revert InsufficientTreasuryBalance();
        }
        
        // This will revert if we don't own it
        if (IERC721(_token).ownerOf(_tokenId) != address(this)) {
            revert InsufficientBalance();
        }

        IERC721(_token).safeTransferFrom(address(this), _to, _tokenId);
    }

    /**
     * @dev Withdraw unreserved ERC1155 tokens from the treasury.
     * @param _token The address of the ERC1155 token to withdraw.
     * @param _to The address to send the tokens to.
     * @param _tokenId The token ID to withdraw.
     * @param _amount The amount to withdraw.
     */
    function withdrawERC1155UnreservedTreasury(
        address _token,
        address _to,
        uint256 _tokenId,
        uint256 _amount
    ) external onlyRole(MANAGER_ROLE) {
        if (_to == address(0)) {
            revert AddressIsZero();
        }
        if (!whitelistedTokens[_token]) {
            revert TokenNotWhitelisted();
        }
        
        uint256 balance = IERC1155(_token).balanceOf(address(this), _tokenId);
        uint256 reserved = erc1155ReservedAmounts[_token][_tokenId];

        if (balance <= reserved) {
            revert InsufficientBalance();
        }

        uint256 withdrawable = balance - reserved;
        
        if (_amount > withdrawable) {
            revert InsufficientBalance();
        }
        
        IERC1155(_token).safeTransferFrom(address(this), _to, _tokenId, _amount, "");
    }
    
    /**
     * @dev Get the treasury balance for a token.
     * @param _token The address of the ERC20 token.
     * @return The balance of the token in the treasury.
     */
    function getTreasuryBalance(
        address _token
    ) external view returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }

    /**
     * @dev Get the reserved amount for a token.
     * @param _token The address of the ERC20 token.
     * @return The reserved amount of the token.
     */
    function getReservedAmount(address _token) external view returns (uint256) {
        return reservedAmounts[_token];
    }

    /**
     * @dev Get the available (unreserved) treasury balance for a token.
     * @param _token The address of the ERC20 token.
     * @return The available balance.
     */
    function getAvailableTreasuryBalance(
        address _token
    ) external view returns (uint256) {
        uint256 balance = IERC20(_token).balanceOf(address(this));
        uint256 reserved = reservedAmounts[_token];
        if (balance <= reserved) {
            return 0;
        }
        return balance - reserved;
    }

    /**
     * @dev Get all whitelisted tokens.
     * @return Array of whitelisted token addresses.
     */
    function getWhitelistedTokens() external view returns (address[] memory) {
        return whitelistedTokenList;
    }

    /**
     * @dev Check if a token is whitelisted.
     * @param _token The address of the ERC20 token.
     * @return True if whitelisted, false otherwise.
     */
    function isWhitelistedToken(address _token) external view returns (bool) {
        return whitelistedTokens[_token];
    }

    /*//////////////////////////////////////////////////////////////
                          SUPPLY MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Increase the max supply of a reward token.
     * @param _tokenId The ID of the reward token.
     * @param _additionalSupply The amount to increase the supply by.
     */
    function increaseRewardSupply(
        uint256 _tokenId,
        uint256 _additionalSupply
    ) external onlyRole(MANAGER_ROLE) {
        if (!isTokenExist(_tokenId)) {
            revert TokenNotExist();
        }
        if (_additionalSupply == 0) {
            revert InvalidAmount();
        }

        LibItems.RewardToken storage rewardToken = tokenRewards[_tokenId];
        uint256 oldSupply = rewardToken.maxSupply;
        uint256 newSupply = oldSupply + _additionalSupply;

        // Validate treasury has enough balance for ERC20 rewards
        for (uint256 i = 0; i < rewardToken.rewards.length; i++) {
            LibItems.Reward memory reward = rewardToken.rewards[i];
            if (reward.rewardType == LibItems.RewardType.ERC20) {
                uint256 additionalAmount = reward.rewardAmount * _additionalSupply;
                uint256 balance = IERC20(reward.rewardTokenAddress).balanceOf(
                    address(this)
                );
                uint256 reserved = reservedAmounts[reward.rewardTokenAddress];
                if (balance < reserved + additionalAmount) {
                    revert InsufficientTreasuryBalance();
                }
                // Reserve additional amount
                reservedAmounts[reward.rewardTokenAddress] += additionalAmount;
            }
        }

        rewardToken.maxSupply = newSupply;
        emit RewardSupplyChanged(_tokenId, oldSupply, newSupply);
    }

    /**
     * @dev Reduce the max supply of a reward token.
     * @param _tokenId The ID of the reward token.
     * @param _reduceBy The amount to reduce the supply by.
     */
    function reduceRewardSupply(
        uint256 _tokenId,
        uint256 _reduceBy
    ) external onlyRole(MANAGER_ROLE) {
        if (!isTokenExist(_tokenId)) {
            revert TokenNotExist();
        }
        if (_reduceBy == 0) {
            revert InvalidAmount();
        }

        LibItems.RewardToken storage rewardToken = tokenRewards[_tokenId];
        uint256 oldSupply = rewardToken.maxSupply;

        // Ensure we don't reduce below current supply (already minted)
        if (oldSupply < _reduceBy) {
            revert CannotReduceSupply();
        }
        uint256 newSupply = oldSupply - _reduceBy;
        if (newSupply < currentRewardSupply[_tokenId]) {
            revert CannotReduceSupply();
        }

        // Release reserved amounts for ERC20 rewards
        for (uint256 i = 0; i < rewardToken.rewards.length; i++) {
            LibItems.Reward memory reward = rewardToken.rewards[i];
            if (reward.rewardType == LibItems.RewardType.ERC20) {
                uint256 releaseAmount = reward.rewardAmount * _reduceBy;
                if (reservedAmounts[reward.rewardTokenAddress] >= releaseAmount) {
                    reservedAmounts[reward.rewardTokenAddress] -= releaseAmount;
                }
            }
        }

        rewardToken.maxSupply = newSupply;
        emit RewardSupplyChanged(_tokenId, oldSupply, newSupply);
    }

    /*//////////////////////////////////////////////////////////////
                          TOKEN MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Update the token URI for a reward token.
     * @param _tokenId The ID of the reward token.
     * @param _newUri The new URI.
     */
    function updateTokenUri(
        uint256 _tokenId,
        string calldata _newUri
    ) external onlyRole(MANAGER_ROLE) {
        if (!isTokenExist(_tokenId)) {
            revert TokenNotExist();
        }
        tokenRewards[_tokenId].tokenUri = _newUri;
        emit TokenURIChanged(_tokenId, _newUri);
    }

    /**
     * @dev Allows the contract owner to withdraw all available assets from the contract.
     * @param _rewardType The type of reward to withdraw.
     * @param _to The address to send the assets to.
     * @param _tokenAddress The address of the token to withdraw. (required for ERC20, ERC721, and ERC1155 tokens)
     * @param _tokenIds The token IDs to withdraw. (required for ERC721 and ERC1155 tokens)
     * @param _amounts The amounts to withdraw. (required for ETHER, ERC20, and ERC1155 tokens)
     */
    function withdrawAssets(
        LibItems.RewardType _rewardType,
        address _to,
        address _tokenAddress, // required for ERC20, ERC721, and ERC1155
        uint256[] calldata _tokenIds, // required for ERC721 and ERC1155
        uint256[] calldata _amounts // required for ETHER, ERC20, and ERC1155
    ) external onlyRole(MANAGER_ROLE) {
        if (_to == address(0)) {
            revert AddressIsZero();
        }

        address _from = address(this);

        if (_rewardType == LibItems.RewardType.ETHER) {
            _transferEther(payable(_to), _amounts[0]);
        } else if (_rewardType == LibItems.RewardType.ERC20) {
            // Check if withdrawal would violate reserved amounts
            if (whitelistedTokens[_tokenAddress]) {
                uint256 balance = IERC20(_tokenAddress).balanceOf(address(this));
                uint256 reserved = reservedAmounts[_tokenAddress];
                if (balance < reserved + _amounts[0]) {
                    revert InsufficientTreasuryBalance();
                }
            }
            _transferERC20(IERC20(_tokenAddress), _to, _amounts[0]);
        } else if (_rewardType == LibItems.RewardType.ERC721) {
            IERC721 token = IERC721(_tokenAddress);
            for (uint256 i = 0; i < _tokenIds.length; i++) {
                // Check if NFT is reserved
                if (isErc721Reserved[_tokenAddress][_tokenIds[i]]) {
                    revert InsufficientTreasuryBalance();
                }
                _transferERC721(token, _from, _to, _tokenIds[i]);
            }
        } else if (_rewardType == LibItems.RewardType.ERC1155) {
            if (_tokenIds.length != _amounts.length) {
                revert InvalidLength();
            }
            for (uint256 i = 0; i < _tokenIds.length; i++) {
                // Check if amount exceeds unreserved balance
                uint256 balance = IERC1155(_tokenAddress).balanceOf(address(this), _tokenIds[i]);
                uint256 reserved = erc1155ReservedAmounts[_tokenAddress][_tokenIds[i]];
                uint256 available = balance > reserved ? balance - reserved : 0;
                if (_amounts[i] > available) {
                    revert InsufficientTreasuryBalance();
                }
                _transferERC1155(
                    IERC1155(_tokenAddress),
                    _from,
                    _to,
                    _tokenIds[i],
                    _amounts[i]
                );
            }
        }

        emit AssetsWithdrawn(_rewardType, _to, _amounts.length > 0 ? _amounts[0] : 0);
    }

    function _transferEther(address payable _to, uint256 _amount) private {
        if (address(this).balance < _amount) {
            revert InsufficientBalance();
        }

        (bool success, ) = _to.call{ value: _amount }("");
        if (!success) {
            revert TransferFailed();
        }
    }

    function _transferERC20(
        IERC20 _token,
        address _to,
        uint256 _amount
    ) private {
        uint256 balanceInContract = _token.balanceOf(address(this));
        if (balanceInContract < _amount) {
            revert InsufficientBalance();
        }

        SafeERC20.safeTransfer(_token, _to, _amount);
    }

    function _transferERC721(
        IERC721 _token,
        address _from,
        address _to,
        uint256 _tokenId
    ) private {
        _token.safeTransferFrom(_from, _to, _tokenId);
    }

    function _transferERC1155(
        IERC1155 _token,
        address _from,
        address _to,
        uint256 _tokenId,
        uint256 _amount
    ) private {
        _token.safeTransferFrom(_from, _to, _tokenId, _amount, "");
    }

    function claimReward(uint256 _tokenId) external nonReentrant whenNotPaused {
        _claimReward(_msgSender(), _tokenId);
    }

    function claimRewards(
        uint256[] calldata _tokenIds
    ) external nonReentrant whenNotPaused {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            _claimReward(_msgSender(), _tokenIds[i]);
        }
    }

    function adminClaimReward(
        address _to,
        uint256[] calldata _tokenIds
    ) external onlyRole(MANAGER_ROLE) whenNotPaused {
        if (_to == address(0)) {
            revert AddressIsZero();
        }
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            _claimReward(_to, _tokenIds[i]);
        }
    }

    function _claimReward(address _to, uint256 _rewardTokenId) private {
        if (isClaimRewardPaused[_rewardTokenId]) {
            revert ClaimRewardPaused();
        }

        if (_to == address(0)) {
            revert AddressIsZero();
        }

        // check if the user has the reward token to redeem or not
        if (rewardTokenContract.balanceOf(_to, _rewardTokenId) == 0) {
            revert InsufficientBalance();
        }

        // then burn the reward token
        rewardTokenContract.whitelistBurn(_to, _rewardTokenId, 1);

        _distributeReward(_to, _rewardTokenId);
    }

    function _distributeReward(address _to, uint256 _rewardTokenId) private {
        LibItems.RewardToken memory _rewardToken = tokenRewards[_rewardTokenId];
        LibItems.Reward[] memory rewards = _rewardToken.rewards;

        for (uint256 i = 0; i < rewards.length; i++) {
            LibItems.Reward memory reward = rewards[i];
            address _from = address(this);

            if (reward.rewardType == LibItems.RewardType.ETHER) {
                _transferEther(payable(_to), reward.rewardAmount);
            } else if (reward.rewardType == LibItems.RewardType.ERC20) {
                _transferERC20(
                    IERC20(reward.rewardTokenAddress),
                    _to,
                    reward.rewardAmount
                );
                // Reduce reserved amount
                if (reservedAmounts[reward.rewardTokenAddress] >= reward.rewardAmount) {
                    reservedAmounts[reward.rewardTokenAddress] -= reward.rewardAmount;
                }
            } else if (reward.rewardType == LibItems.RewardType.ERC721) {
                uint256 currentIndex = erc721RewardCurrentIndex[_rewardTokenId][
                    i
                ];
                uint256[] memory tokenIds = reward.rewardTokenIds;
                for (uint256 j = 0; j < reward.rewardAmount; j++) {
                    if (currentIndex + j >= tokenIds.length) {
                        revert InsufficientBalance();
                    }
                    uint256 tokenId = tokenIds[currentIndex + j];

                    // Release reservation
                    isErc721Reserved[reward.rewardTokenAddress][tokenId] = false;
                    erc721TotalReserved[reward.rewardTokenAddress]--;

                    _transferERC721(
                        IERC721(reward.rewardTokenAddress),
                        _from,
                        _to,
                        tokenId
                    );
                }

                erc721RewardCurrentIndex[_rewardTokenId][i] += reward.rewardAmount;
            } else if (reward.rewardType == LibItems.RewardType.ERC1155) {
                // Release reservation
                if (erc1155ReservedAmounts[reward.rewardTokenAddress][reward.rewardTokenId] >= reward.rewardAmount) {
                    erc1155ReservedAmounts[reward.rewardTokenAddress][
                        reward.rewardTokenId
                    ] -= reward.rewardAmount;
                    if (erc1155TotalReserved[reward.rewardTokenAddress] >= reward.rewardAmount) {
                        erc1155TotalReserved[reward.rewardTokenAddress] -= reward.rewardAmount;
                    }
                }

                _transferERC1155(
                    IERC1155(reward.rewardTokenAddress),
                    _from,
                    _to,
                    reward.rewardTokenId,
                    reward.rewardAmount
                );
            }
        }

        emit Claimed(_to, _rewardTokenId, 1);
    }

    function _mintAndClaimRewardTokenBatch(
        address to,
        uint256[] memory _tokenIds,
        uint256 _amount,
        bool soulbound,
        bool isClaimReward
    ) private {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            _mintAndClaimRewardToken(
                to,
                _tokenIds[i],
                _amount,
                soulbound,
                isClaimReward
            );
        }
    }

    function _mintAndClaimRewardToken(
        address to,
        uint256 _tokenId,
        uint256 _amount,
        bool soulbound,
        bool isClaimReward
    ) private {
        if (to == address(0)) {
            revert AddressIsZero();
        }

        if (!isTokenExist(_tokenId)) {
            revert TokenNotExist();
        }

        if (isTokenMintPaused[_tokenId]) {
            revert MintPaused();
        }

        if (_amount == 0) {
            revert InvalidAmount();
        }

        uint256 newSupply = currentRewardSupply[_tokenId] + _amount;
        if (newSupply > tokenRewards[_tokenId].maxSupply) {
            revert ExceedMaxSupply();
        }
        currentRewardSupply[_tokenId] = newSupply;

        // claim the reward
        if (isClaimReward) {
            for (uint256 i = 0; i < _amount; i++) {
                _distributeReward(to, _tokenId);
            }
        } else {
            // mint reward token
            rewardTokenContract.adminMintId(to, _tokenId, _amount, soulbound);
            emit Minted(to, _tokenId, _amount, soulbound);
        }
    }

    function _verifyContractChainIdAndDecode(
        bytes calldata data
    ) private view returns (uint256[] memory) {
        uint256 currentChainId = getChainID();
        (
            address contractAddress,
            uint256 chainId,
            uint256 expiration,
            uint256[] memory tokenIds
        ) = _decodeData(data);

        if (chainId != currentChainId || contractAddress != address(this)) {
            revert InvalidInput();
        }

        // Verify expiration
        if (block.timestamp >= expiration) {
            revert SignatureExpired();
        }

        return tokenIds;
    }

    function getTokenDetails(
        uint256 tokenId
    )
        public
        view
        returns (
            string memory tokenUri,
            uint256 maxSupply,
            LibItems.RewardType[] memory rewardTypes,
            uint256[] memory rewardAmounts,
            address[] memory rewardTokenAddresses,
            uint256[][] memory rewardTokenIds,
            uint256[] memory rewardTokenId
        )
    {
        tokenUri = tokenRewards[tokenId].tokenUri;
        maxSupply = tokenRewards[tokenId].maxSupply;
        LibItems.Reward[] memory rewards = tokenRewards[tokenId].rewards;

        rewardTypes = new LibItems.RewardType[](rewards.length);
        rewardAmounts = new uint256[](rewards.length);
        rewardTokenAddresses = new address[](rewards.length);
        rewardTokenIds = new uint256[][](rewards.length);
        rewardTokenId = new uint256[](rewards.length);

        for (uint256 i = 0; i < rewards.length; i++) {
            rewardTypes[i] = rewards[i].rewardType;
            rewardAmounts[i] = rewards[i].rewardAmount;
            rewardTokenAddresses[i] = rewards[i].rewardTokenAddress;
            rewardTokenIds[i] = rewards[i].rewardTokenIds;
            rewardTokenId[i] = rewards[i].rewardTokenId;
        }
    }

    /*//////////////////////////////////////////////////////////////
                          ADDITIONAL VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Get the balance of reward tokens a user holds (how many can be claimed).
     * @param _user The address of the user.
     * @param _tokenId The ID of the reward token.
     * @return The balance of reward tokens.
     */
    function getUserRewardBalance(
        address _user,
        uint256 _tokenId
    ) external view returns (uint256) {
        return rewardTokenContract.balanceOf(_user, _tokenId);
    }

    /**
     * @dev Check if a user can claim a reward.
     * @param _user The address of the user.
     * @param _tokenId The ID of the reward token.
     * @return True if the user can claim, false otherwise.
     */
    function canUserClaim(
        address _user,
        uint256 _tokenId
    ) external view returns (bool) {
        if (!isTokenExist(_tokenId)) {
            return false;
        }
        if (isClaimRewardPaused[_tokenId]) {
            return false;
        }
        return rewardTokenContract.balanceOf(_user, _tokenId) > 0;
    }

    /**
     * @dev Get the NFT distribution progress for a reward token.
     * @param _tokenId The ID of the reward token.
     * @param _rewardIndex The index of the reward in the rewards array.
     * @return distributed The number of NFTs already distributed.
     * @return total The total number of NFTs for this reward.
     */
    function getNftDistributionProgress(
        uint256 _tokenId,
        uint256 _rewardIndex
    ) external view returns (uint256 distributed, uint256 total) {
        if (!isTokenExist(_tokenId)) {
            return (0, 0);
        }
        LibItems.RewardToken memory rewardToken = tokenRewards[_tokenId];
        if (_rewardIndex >= rewardToken.rewards.length) {
            return (0, 0);
        }
        LibItems.Reward memory reward = rewardToken.rewards[_rewardIndex];
        if (reward.rewardType != LibItems.RewardType.ERC721) {
            return (0, 0);
        }
        distributed = erc721RewardCurrentIndex[_tokenId][_rewardIndex];
        total = reward.rewardTokenIds.length;
    }

    /**
     * @dev Get the remaining supply for a reward token.
     * @param _tokenId The ID of the reward token.
     * @return The remaining supply (maxSupply - currentSupply).
     */
    function getRemainingSupply(
        uint256 _tokenId
    ) external view returns (uint256) {
        if (!isTokenExist(_tokenId)) {
            return 0;
        }
        uint256 maxSupply = tokenRewards[_tokenId].maxSupply;
        uint256 current = currentRewardSupply[_tokenId];
        if (current >= maxSupply) {
            return 0;
        }
        return maxSupply - current;
    }

    /**
     * @dev Check if a nonce has been used by a user.
     * @param _user The address of the user.
     * @param _nonce The nonce to check.
     * @return True if the nonce has been used, false otherwise.
     */
    function isNonceUsed(
        address _user,
        uint256 _nonce
    ) external view returns (bool) {
        return userNonces[_user][_nonce];
    }

    /**
     * @dev Get all whitelist signers.
     * @return Array of whitelisted signer addresses.
     */
    function getWhitelistSigners() external view returns (address[] memory) {
        return _getWhitelistSigners();
    }

    function mint(
        bytes calldata data,
        bool isSoulbound,
        uint256 nonce,
        bytes calldata signature,
        bool isClaimReward
    )
        external
        nonReentrant
        signatureCheck(_msgSender(), nonce, data, signature)
        whenNotPaused
    {
        // Check user nonce not already used
        address user = _msgSender();
        if (userNonces[user][nonce]) {
            revert NonceAlreadyUsed();
        }
        // Mark nonce as used
        userNonces[user][nonce] = true;

        uint256[] memory _tokenIds = _verifyContractChainIdAndDecode(data);
        _mintAndClaimRewardTokenBatch(
            user,
            _tokenIds,
            1,
            isSoulbound,
            isClaimReward
        );
    }

    function adminMint(
        address to,
        bytes calldata data,
        bool isSoulbound,
        bool isClaimReward
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        uint256[] memory _tokenIds = _verifyContractChainIdAndDecode(data);
        _mintAndClaimRewardTokenBatch(
            to,
            _tokenIds,
            1,
            isSoulbound,
            isClaimReward
        );
    }

    function adminMintById(
        address toAddress,
        uint256 _tokenId,
        uint256 _amount,
        bool isSoulbound
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        _mintAndClaimRewardToken(
            toAddress,
            _tokenId,
            _amount,
            isSoulbound,
            false
        );
    }

    function adminBatchMintById(
        address[] calldata toAddresses,
        uint256 _tokenId,
        uint256[] calldata _amounts,
        bool isSoulbound
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        if (toAddresses.length != _amounts.length) {
            revert InvalidLength();
        }

        for (uint256 i = 0; i < toAddresses.length; i++) {
            _mintAndClaimRewardToken(
                toAddresses[i],
                _tokenId,
                _amounts[i],
                isSoulbound,
                false
            );
        }
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControlUpgradeable, ERC1155HolderUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}

    function adminVerifySignature(
        address to,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) public onlyRole(DEV_CONFIG_ROLE) returns (bool) {
        return _verifySignature(to, nonce, data, signature);
    }

    function addWhitelistSigner(
        address _signer
    ) external onlyRole(DEV_CONFIG_ROLE) {
        _addWhitelistSigner(_signer);
    }

    function removeWhitelistSigner(
        address signer
    ) external onlyRole(DEV_CONFIG_ROLE) {
        _removeWhitelistSigner(signer);
    }

    function getChainID() public view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }
}
