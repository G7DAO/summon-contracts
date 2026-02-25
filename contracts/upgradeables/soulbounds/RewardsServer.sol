// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// @author Summon.xyz Team - https://summon.xyz
// @contributors: [ @ogarciarevett, @karacurt ]

import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Metadata } from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { ERC721HolderUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import { ERC1155HolderUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import { LibItems } from "../../libraries/LibItems.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {
    MessageHashUtils
} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";


interface IERC1155Metadata {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
}

/**
 * @title RewardsServer
 * @notice Per-server rewards contract: holds assets, whitelist, and reward reserve control.
 * @dev One RewardsServer per server; reward token definitions, supply, and reservations live here.
 *      Upgraded via UpgradeableBeacon (BeaconProxy); no per-instance UUPS.
 *      ERC721 reward supply cannot be increased after creation; when exhausted, create a new reward token.
 */
contract RewardsServer is Initializable, AccessControlUpgradeable, ERC721HolderUpgradeable, ERC1155HolderUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {

    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                               ERRORS
    //////////////////////////////////////////////////////////////*/
    error AddressIsZero();
    error InvalidAmount();
    error TokenNotWhitelisted();
    error TokenAlreadyWhitelisted();
    error RewardTokenAlreadyExists();
    error TokenNotExist();
    error InsufficientTreasuryBalance();
    error TokenHasReserves();
    error InsufficientBalance();
    error InsufficientERC721Ids();
    error ExceedMaxSupply();
    error ClaimRewardPaused();
    error InvalidInput();
    error DupTokenId();
    error TransferFailed();
    error InvalidLength();
    error NonceAlreadyUsed();
    error InvalidSignature();
    error SignerAlreadySet();
    error InvalidServerId();

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/
    bytes32 public constant SERVER_ADMIN_ROLE = keccak256("SERVER_ADMIN_ROLE");

    /*//////////////////////////////////////////////////////////////
                           STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    // Server-level access (admin, signers for claim)
    mapping(address => bool) public signers;
    address[] private signerList;

    // Whitelist
    mapping(address => bool) public whitelistedTokens;
    address[] private whitelistedTokenList;
    mapping(address => LibItems.RewardType) public tokenTypes;

    // Reservations (for rewards)
    mapping(address => uint256) public reservedAmounts;
    mapping(address => mapping(uint256 => bool)) public isErc721Reserved;
    mapping(address => uint256) public erc721TotalReserved;
    mapping(address => mapping(uint256 => uint256)) public erc1155ReservedAmounts;
    mapping(address => uint256) public erc1155TotalReserved;

    // Reward token state
    uint256[] public itemIds;
    mapping(uint256 => bool) public tokenExists;
    mapping(uint256 => LibItems.RewardToken) public tokenRewards;
    mapping(uint256 => mapping(uint256 => uint256)) public erc721RewardCurrentIndex;
    mapping(uint256 => uint256) public currentRewardSupply;

    // Per-user nonce (for mint/claim signatures)
    mapping(address => mapping(uint256 => bool)) public isUserNonceUsed;

    // ETH reserved for pending ETHER rewards (this server holds all its treasury ETH)
    uint256 public ethReservedTotal;

    uint8 public id;

    uint256[28] private __gap;

    /*//////////////////////////////////////////////////////////////
                               EVENTS
    //////////////////////////////////////////////////////////////*/
    event TreasuryDeposit(address indexed token, uint256 amount);
    event SignerUpdated(address indexed account, bool active);
    event AssetsWithdrawn(
        LibItems.RewardType rewardType,
        address indexed to,
        uint256 amount
    );
    /// @param oldSupply Previous max supply (reduceRewardSupply) or current claim count (increaseRewardSupply).
    /// @param newSupply New max supply after the change.
    event RewardSupplyChanged(
        uint256 indexed tokenId,
        uint256 oldSupply,
        uint256 newSupply
    );
    event Claimed(
        address indexed to,
        uint256 indexed tokenId
    );

    /*//////////////////////////////////////////////////////////////
                             INITIALIZER
    //////////////////////////////////////////////////////////////*/
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the server: access roles and server admin. Called once by the proxy.
    /// @param _serverAdmin Address that receives SERVER_ADMIN_ROLE (signers, withdrawers, transfer).
    /// @param _id Server id (must match router's serverId for this instance).
    function initialize(address _serverAdmin, uint8 _id) external initializer {
        if (_serverAdmin == address(0)) {
            revert AddressIsZero();
        }

        __AccessControl_init();
        __ERC721Holder_init();
        __ERC1155Holder_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _serverAdmin);
        _grantRole(SERVER_ADMIN_ROLE, _serverAdmin);
        id = _id;
    }

    /*//////////////////////////////////////////////////////////////
                    SERVER ACCESS CONTROL (admin, signers)
    //////////////////////////////////////////////////////////////*/


    /// @notice Same as setSigner but called by RewardsRouter; caller must be SERVER_ADMIN_ROLE.
    function setSigner(address account, bool active) external nonReentrant onlyRole(SERVER_ADMIN_ROLE) {
        if (account == address(0)) revert AddressIsZero();
        if (signers[account] == active) revert SignerAlreadySet();

        if (active) {
            signers[account] = true;
            signerList.push(account);
        } else {
            signers[account] = false;
            for (uint256 i = 0; i < signerList.length; i++) {
                if (signerList[i] == account) {
                    signerList[i] = signerList[signerList.length - 1];
                    signerList.pop();
                    emit SignerUpdated(account, false);
                    return;
                }
            }
        }
        emit SignerUpdated(account, active);
    }

    /*//////////////////////////////////////////////////////////////
                      TREASURY MANAGEMENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Adds a token to the whitelist for use in rewards. Only SERVER_ADMIN_ROLE.
    /// @param _token Token contract address.
    /// @param _type One of ERC20, ERC721, ERC1155.
    function whitelistToken(address _token, LibItems.RewardType _type) external nonReentrant onlyRole(SERVER_ADMIN_ROLE) {
        if (_token == address(0)) revert AddressIsZero();
        if (whitelistedTokens[_token]) revert TokenAlreadyWhitelisted();

        whitelistedTokens[_token] = true;
        tokenTypes[_token] = _type;
        whitelistedTokenList.push(_token);

        if (_type == LibItems.RewardType.ERC20) {
            reservedAmounts[_token] = 0;
        }
    }

    /// @notice Removes a token from the whitelist. Fails if the token has any reserves. Only SERVER_ADMIN_ROLE.
    /// @param _token Token contract address.
    function removeTokenFromWhitelist(address _token) external nonReentrant onlyRole(SERVER_ADMIN_ROLE) {
        LibItems.RewardType _type = tokenTypes[_token];
        if (!whitelistedTokens[_token]) revert TokenNotWhitelisted();

        if (_type == LibItems.RewardType.ERC20 && reservedAmounts[_token] > 0) revert TokenHasReserves();
        if (_type == LibItems.RewardType.ERC721 && erc721TotalReserved[_token] > 0) revert TokenHasReserves();
        if (_type == LibItems.RewardType.ERC1155 && erc1155TotalReserved[_token] > 0) revert TokenHasReserves();

        whitelistedTokens[_token] = false;
        delete tokenTypes[_token];
        for (uint256 i = 0; i < whitelistedTokenList.length; i++) {
            if (whitelistedTokenList[i] == _token) {
                whitelistedTokenList[i] = whitelistedTokenList[whitelistedTokenList.length - 1];
                whitelistedTokenList.pop();
                break;
            }
        }
    }

        /// @notice Withdraws assets from server treasury to recipient. Caller must be SERVER_ADMIN_ROLE on the server. ETHER: amounts[0]; ERC721: tokenIds; ERC1155: tokenIds + amounts.
    function withdrawAssets(
        LibItems.RewardType rewardType,
        address to,
        address tokenAddress,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external nonReentrant onlyRole(SERVER_ADMIN_ROLE) {
        if (to == address(0)) revert AddressIsZero();

        if (rewardType == LibItems.RewardType.ETHER) {
            if (amounts.length == 0) revert InvalidInput();
            withdrawEtherUnreservedTreasury(to, amounts[0]);
        } else if (rewardType == LibItems.RewardType.ERC20) {
            withdrawUnreservedTreasury(tokenAddress, to);
        } else if (rewardType == LibItems.RewardType.ERC721) {
            for (uint256 i = 0; i < tokenIds.length; i++) {
                withdrawERC721UnreservedTreasury(tokenAddress, to, tokenIds[i]);
            }
        } else if (rewardType == LibItems.RewardType.ERC1155) {
            if (tokenIds.length != amounts.length) revert InvalidLength();
            for (uint256 i = 0; i < tokenIds.length; i++) {
                withdrawERC1155UnreservedTreasury(tokenAddress, to, tokenIds[i], amounts[i]);
            }
        }
        uint256 emittedAmount = rewardType == LibItems.RewardType.ERC721
            ? tokenIds.length
            : (amounts.length > 0 ? amounts[0] : 0);
        emit AssetsWithdrawn(rewardType, to, emittedAmount);
    }

    /// @notice Sends all unreserved ERC20 balance of _token to _to. Only SERVER_ADMIN_ROLE.
    function withdrawUnreservedTreasury(address _token, address _to) public onlyRole(SERVER_ADMIN_ROLE) {
        if (_to == address(0)) revert AddressIsZero();
        if (!whitelistedTokens[_token]) revert TokenNotWhitelisted();

        uint256 balance = IERC20(_token).balanceOf(address(this));
        uint256 reserved = reservedAmounts[_token];

        if (balance <= reserved) revert InsufficientBalance();

        SafeERC20.safeTransfer(IERC20(_token), _to, balance - reserved);
    }

    /// @notice Sends one unreserved ERC721 token to _to. Only SERVER_ADMIN_ROLE. Fails if _tokenId is reserved.
    function withdrawERC721UnreservedTreasury(address _token, address _to, uint256 _tokenId) public onlyRole(SERVER_ADMIN_ROLE) {
        if (_to == address(0)) revert AddressIsZero();
        if (!whitelistedTokens[_token]) revert TokenNotWhitelisted();
        if (isErc721Reserved[_token][_tokenId]) revert InsufficientTreasuryBalance();

        IERC721(_token).safeTransferFrom(address(this), _to, _tokenId);
    }

    /// @notice Sends unreserved ERC1155 amount to _to. Only SERVER_ADMIN_ROLE.
    function withdrawERC1155UnreservedTreasury(address _token, address _to, uint256 _tokenId, uint256 _amount) public onlyRole(SERVER_ADMIN_ROLE) {
        if (_to == address(0)) revert AddressIsZero();
        if (!whitelistedTokens[_token]) revert TokenNotWhitelisted();

        uint256 balance = IERC1155(_token).balanceOf(address(this), _tokenId);
        uint256 reserved = erc1155ReservedAmounts[_token][_tokenId];

        if (balance <= reserved) revert InsufficientBalance();
        if (_amount > (balance - reserved)) revert InsufficientBalance();

        IERC1155(_token).safeTransferFrom(address(this), _to, _tokenId, _amount, "");
    }

    /// @notice Sends unreserved ETH from this server's treasury to _to. Only SERVER_ADMIN_ROLE.
    function withdrawEtherUnreservedTreasury(address _to, uint256 _amount) public onlyRole(SERVER_ADMIN_ROLE) {
        if (_to == address(0)) revert AddressIsZero();
        uint256 available = address(this).balance - ethReservedTotal;
        if (_amount > available) revert InsufficientBalance();
        (bool ok, ) = payable(_to).call{ value: _amount }("");
        if (!ok) revert TransferFailed();
    }

    /*//////////////////////////////////////////////////////////////
                      DISTRIBUTION FUNCTIONS (for claims)
    //////////////////////////////////////////////////////////////*/

        /// @notice Permissionless claim: anyone may submit; rewards are sent to the beneficiary in the signed data.
    /// @dev Caller may be beneficiary or a relayer. Signature is burned (replay protection).
    /// @param data ABI-encoded (contractAddress, chainId, beneficiary, userNonce, tokenIds).
    /// @param signature Server signer signature over the claim message.
    function claim(
        bytes calldata data,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        (
            address contractAddress,
            uint256 chainId,
            address beneficiary,
            uint256 userNonce,
            uint8 serverId,
            uint256[] memory tokenIds
        ) = decodeClaimData(data);

        if (contractAddress != address(this) || chainId != block.chainid) revert InvalidInput();

        _verifyServerSignature(serverId, beneficiary, tokenIds, userNonce, signature);
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _claimReward(beneficiary, tokenIds[i]);
        }
    }


    /// @notice Validates and creates a new reward token; reserves ERC20/721/1155 and ETH on this server. Only SERVER_ADMIN_ROLE. Send ETH if token has ETHER rewards.
    function createTokenAndReserveRewards(LibItems.RewardToken calldata token) external payable nonReentrant onlyRole(SERVER_ADMIN_ROLE) {
        if (token.maxSupply == 0) revert InvalidAmount();
        if (
            bytes(token.tokenUri).length == 0 ||
            token.rewards.length == 0 ||
            token.tokenId == 0
        ) revert InvalidInput();
        if (tokenExists[token.tokenId]) revert DupTokenId();

        uint256 ethRequired;
        for (uint256 i = 0; i < token.rewards.length; i++) {
            LibItems.Reward memory r = token.rewards[i];
            if (r.rewardType != LibItems.RewardType.ETHER && r.rewardTokenAddress == address(0)) revert AddressIsZero();
            if (r.rewardType == LibItems.RewardType.ETHER) {
                ethRequired += r.rewardAmount * token.maxSupply;
            } else if (r.rewardType == LibItems.RewardType.ERC721) {
                if (
                    r.rewardTokenIds.length == 0 ||
                    r.rewardTokenIds.length != r.rewardAmount * token.maxSupply
                ) revert InvalidInput();
            }
            if (r.rewardType != LibItems.RewardType.ERC721 && r.rewardAmount == 0) revert InvalidAmount();
        }
        if (ethRequired > 0) {
            if (msg.value < ethRequired) revert InsufficientBalance();
            ethReservedTotal += ethRequired;
        }

        for (uint256 i = 0; i < token.rewards.length; i++) {
            LibItems.Reward memory r = token.rewards[i];
            if (r.rewardType == LibItems.RewardType.ERC20) {
                if (!whitelistedTokens[r.rewardTokenAddress]) revert TokenNotWhitelisted();
                uint256 totalAmount = r.rewardAmount * token.maxSupply;
                uint256 balance = IERC20(r.rewardTokenAddress).balanceOf(address(this));
                uint256 reserved = reservedAmounts[r.rewardTokenAddress];
                if (balance < reserved + totalAmount) revert InsufficientTreasuryBalance();
                reservedAmounts[r.rewardTokenAddress] += totalAmount;
            } else if (r.rewardType == LibItems.RewardType.ERC721) {
                if (!whitelistedTokens[r.rewardTokenAddress]) revert TokenNotWhitelisted();
                IERC721 nft = IERC721(r.rewardTokenAddress);
                for (uint256 j = 0; j < r.rewardTokenIds.length; j++) {
                    uint256 tid = r.rewardTokenIds[j];
                    if (nft.ownerOf(tid) != address(this) || isErc721Reserved[r.rewardTokenAddress][tid]) {
                        revert InsufficientTreasuryBalance();
                    }
                }
                for (uint256 j = 0; j < r.rewardTokenIds.length; j++) {
                    isErc721Reserved[r.rewardTokenAddress][r.rewardTokenIds[j]] = true;
                    erc721TotalReserved[r.rewardTokenAddress]++;
                }
            } else if (r.rewardType == LibItems.RewardType.ERC1155) {
                if (!whitelistedTokens[r.rewardTokenAddress]) revert TokenNotWhitelisted();
                uint256 totalAmount = r.rewardAmount * token.maxSupply;
                uint256 balance = IERC1155(r.rewardTokenAddress).balanceOf(address(this), r.rewardTokenId);
                uint256 reserved = erc1155ReservedAmounts[r.rewardTokenAddress][r.rewardTokenId];
                if (balance < reserved + totalAmount) revert InsufficientTreasuryBalance();
                erc1155ReservedAmounts[r.rewardTokenAddress][r.rewardTokenId] += totalAmount;
                erc1155TotalReserved[r.rewardTokenAddress] += totalAmount;
            }
        }

        LibItems.RewardToken memory tokenMem = token;
        _addRewardToken(token.tokenId, tokenMem);
    }

    /// @notice Reduces max supply for a reward token; releases proportional ERC20/ERC1155/ERC721 reservations. Only SERVER_ADMIN_ROLE.
    /// @dev New max supply must not be below currentRewardSupply. ERC721: tail NFT IDs (no longer claimable) are un-reserved so they can be withdrawn.
    /// @param _tokenId Reward token id.
    /// @param _reduceBy Amount to subtract from max supply (must be > 0).
    function reduceRewardSupply(uint256 _tokenId, uint256 _reduceBy) external nonReentrant onlyRole(SERVER_ADMIN_ROLE) {
        if (!tokenExists[_tokenId]) revert TokenNotExist();
        if (_reduceBy == 0) revert InvalidAmount();

        LibItems.RewardToken memory rewardToken = tokenRewards[_tokenId];
        uint256 current = currentRewardSupply[_tokenId];
        uint256 oldMaxSupply = rewardToken.maxSupply;
        uint256 newSupply = oldMaxSupply - _reduceBy;
        if (current > newSupply) revert InsufficientBalance();

        for (uint256 i = 0; i < rewardToken.rewards.length; i++) {
            LibItems.Reward memory r = rewardToken.rewards[i];
            if (r.rewardType == LibItems.RewardType.ETHER) {
                ethReservedTotal -= r.rewardAmount * _reduceBy;
            } else if (r.rewardType == LibItems.RewardType.ERC20) {
                uint256 releaseAmount = r.rewardAmount * _reduceBy;
                reservedAmounts[r.rewardTokenAddress] -= releaseAmount;
            } else if (r.rewardType == LibItems.RewardType.ERC1155) {
                uint256 releaseAmount = r.rewardAmount * _reduceBy;
                erc1155ReservedAmounts[r.rewardTokenAddress][r.rewardTokenId] -= releaseAmount;
                erc1155TotalReserved[r.rewardTokenAddress] -= releaseAmount;
            } else if (r.rewardType == LibItems.RewardType.ERC721) {
                uint256 startIndex = newSupply * r.rewardAmount;
                for (uint256 j = startIndex; j < r.rewardTokenIds.length; j++) {
                    uint256 nftId = r.rewardTokenIds[j];
                    isErc721Reserved[r.rewardTokenAddress][nftId] = false;
                    erc721TotalReserved[r.rewardTokenAddress]--;
                }
            }
        }

        rewardToken.maxSupply = newSupply;
        tokenRewards[_tokenId] = rewardToken;

        emit RewardSupplyChanged(_tokenId, oldMaxSupply, newSupply);
    }

    /// @notice Increases max supply for a reward token; reserves additional ERC20/ERC1155/ETH on this server. Only SERVER_ADMIN_ROLE. Send ETH if token has ETHER rewards.
    /// @dev ERC721-backed rewards cannot have supply increased: rewardTokenIds length is fixed at creation. When ERC721 supply is exhausted, create a new reward token.
    /// @param _tokenId Reward token id.
    /// @param _additionalSupply Extra supply to add (must be > 0). For ERC721 rewards this will revert.
    function increaseRewardSupply(uint256 _tokenId, uint256 _additionalSupply) external payable nonReentrant onlyRole(SERVER_ADMIN_ROLE) {
        if (!tokenExists[_tokenId]) revert TokenNotExist();
        if (_additionalSupply == 0) revert InvalidAmount();

        uint256 additionalEthRequired = this.getEthRequiredForIncreaseSupply(_tokenId, _additionalSupply);
        if (additionalEthRequired > 0) {
            if (msg.value < additionalEthRequired) revert InsufficientBalance();
            ethReservedTotal += additionalEthRequired;
        }

        LibItems.RewardToken memory rewardToken = tokenRewards[_tokenId];
        uint256 newSupply = rewardToken.maxSupply + _additionalSupply;

        for (uint256 i = 0; i < rewardToken.rewards.length; i++) {
            LibItems.Reward memory r = rewardToken.rewards[i];
            if (r.rewardType == LibItems.RewardType.ERC721) {
                if (r.rewardTokenIds.length < r.rewardAmount * newSupply) revert InsufficientERC721Ids();
            } else if (r.rewardType == LibItems.RewardType.ERC20) {
                uint256 addAmount = r.rewardAmount * _additionalSupply;
                uint256 balance = IERC20(r.rewardTokenAddress).balanceOf(address(this));
                uint256 reserved = reservedAmounts[r.rewardTokenAddress];
                if (balance < reserved + addAmount) revert InsufficientTreasuryBalance();
                reservedAmounts[r.rewardTokenAddress] += addAmount;
            } else if (r.rewardType == LibItems.RewardType.ERC1155) {
                uint256 addAmount = r.rewardAmount * _additionalSupply;
                uint256 balance = IERC1155(r.rewardTokenAddress).balanceOf(address(this), r.rewardTokenId);
                uint256 reserved = erc1155ReservedAmounts[r.rewardTokenAddress][r.rewardTokenId];
                if (balance < reserved + addAmount) revert InsufficientTreasuryBalance();
                erc1155ReservedAmounts[r.rewardTokenAddress][r.rewardTokenId] += addAmount;
                erc1155TotalReserved[r.rewardTokenAddress] += addAmount;
            }
        }

        rewardToken.maxSupply = newSupply;
        tokenRewards[_tokenId] = rewardToken;

        emit RewardSupplyChanged(_tokenId, currentRewardSupply[_tokenId], newSupply);
    }

    /*//////////////////////////////////////////////////////////////
                           PAUSE
    //////////////////////////////////////////////////////////////*/

    /// @notice Pauses all claims. Only SERVER_ADMIN_ROLE.
    function pause() external onlyRole(SERVER_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Unpauses claims. Only SERVER_ADMIN_ROLE.
    function unpause() external onlyRole(SERVER_ADMIN_ROLE) {
        _unpause();
    }

    /*//////////////////////////////////////////////////////////////
                         TREASURY VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns aggregated treasury view: addresses, total/reserved/available balances, symbols, names, types, tokenIds for ERC1155.
    /// @return addresses Token addresses (whitelisted ERC20/721 plus one per ERC1155 token id).
    /// @return totalBalances Total balance per entry.
    /// @return reservedBalances Reserved amount per entry.
    /// @return availableBalances total - reserved per entry.
    /// @return symbols Token symbols where available.
    /// @return names Token names where available.
    /// @return types "fa" for ERC20/721, "1155" for ERC1155.
    /// @return tokenIds For ERC1155 entries the token id; 0 for ERC20/721.
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
            string[] memory types,
            uint256[] memory tokenIds
        )
    {
        address[] memory whitelistedTokensArray = whitelistedTokenList;

        uint256 erc20AndErc721Count = 0;
        for (uint256 i = 0; i < whitelistedTokensArray.length; i++) {
            LibItems.RewardType tokenType = tokenTypes[whitelistedTokensArray[i]];
            if (tokenType == LibItems.RewardType.ERC20 || tokenType == LibItems.RewardType.ERC721) {
                erc20AndErc721Count++;
            }
        }

        uint256 erc1155Count = _countUniqueErc1155TokenIds();
        uint256 totalCount = erc20AndErc721Count + erc1155Count;

        addresses = new address[](totalCount);
        totalBalances = new uint256[](totalCount);
        reservedBalances = new uint256[](totalCount);
        availableBalances = new uint256[](totalCount);
        symbols = new string[](totalCount);
        names = new string[](totalCount);
        types = new string[](totalCount);
        tokenIds = new uint256[](totalCount);

        uint256 currentIndex = 0;

        for (uint256 i = 0; i < whitelistedTokensArray.length; i++) {
            address tokenAddress = whitelistedTokensArray[i];
            LibItems.RewardType tokenType = tokenTypes[tokenAddress];

            addresses[currentIndex] = tokenAddress;

            if (tokenType == LibItems.RewardType.ERC20) {
                _processERC20Token(tokenAddress, currentIndex, totalBalances, reservedBalances, availableBalances, symbols, names, types);
                tokenIds[currentIndex] = 0;
                currentIndex++;
            } else if (tokenType == LibItems.RewardType.ERC721) {
                _processERC721Token(tokenAddress, currentIndex, totalBalances, reservedBalances, availableBalances, symbols, names, types);
                tokenIds[currentIndex] = 0;
                currentIndex++;
            }
        }

        currentIndex = _processERC1155Tokens(erc1155Count, currentIndex, addresses, totalBalances, reservedBalances, availableBalances, symbols, names, types, tokenIds);

        return (addresses, totalBalances, reservedBalances, availableBalances, symbols, names, types, tokenIds);
    }

    /// @notice ERC20 balance of this contract for _token.
    function getTreasuryBalance(address _token) external view returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }

    /// @notice Reserved amount for _token.
    function getReservedAmount(address _token) external view returns (uint256) {
        return reservedAmounts[_token];
    }

    /// @notice Unreserved ERC20 balance for _token.
    function getAvailableTreasuryBalance(address _token) external view returns (uint256) {
        uint256 balance = IERC20(_token).balanceOf(address(this));
        uint256 reserved = reservedAmounts[_token];
        return balance > reserved ? balance - reserved : 0;
    }

    /// @notice List of whitelisted token addresses.
    function getWhitelistedTokens() external view returns (address[] memory) {
        return whitelistedTokenList;
    }

    /// @notice Returns remaining claimable supply for a reward token (maxSupply - currentSupply), or 0 if exhausted/nonexistent.
    function getRemainingRewardSupply(
        uint256 tokenId
    ) external view returns (uint256) {
        if (!tokenExists[tokenId]) return 0;
        uint256 maxSupply = tokenRewards[tokenId].maxSupply;
        uint256 current = currentRewardSupply[tokenId];
        if (current >= maxSupply) return 0;
        return maxSupply - current;
    }

    /// @notice Whether _token is whitelisted.
    function isWhitelistedToken(address _token) external view returns (bool) {
        return whitelistedTokens[_token];
    }

    /*//////////////////////////////////////////////////////////////
                         REWARD RESERVE & VIEW
    //////////////////////////////////////////////////////////////*/

    /// @notice All reward token ids (item ids) defined on this server.
    function getAllItemIds() external view returns (uint256[] memory) {
        return itemIds;
    }

    /// @notice Reward definitions for a given reward token id.
    function getTokenRewards(uint256 _tokenId) external view returns (LibItems.Reward[] memory) {
        return tokenRewards[_tokenId].rewards;
    }

    /// @notice Full reward token struct for _tokenId (rewards, maxSupply, etc.).
    function getRewardToken(uint256 _tokenId) external view returns (LibItems.RewardToken memory) {
        return tokenRewards[_tokenId];
    }

    /// @notice ETH required to increase supply by _additionalSupply for a reward token that has ETHER rewards.
    function getEthRequiredForIncreaseSupply(uint256 _tokenId, uint256 _additionalSupply) external view returns (uint256) {
        if (!tokenExists[_tokenId] || _additionalSupply == 0) return 0;
        LibItems.RewardToken memory rewardToken = tokenRewards[_tokenId];
        uint256 additionalEthRequired;
        for (uint256 i = 0; i < rewardToken.rewards.length; i++) {
            if (rewardToken.rewards[i].rewardType == LibItems.RewardType.ETHER) {
                additionalEthRequired += rewardToken.rewards[i].rewardAmount * _additionalSupply;
            }
        }
        return additionalEthRequired;
    }

    /// @notice Returns structured reward token details (URI, maxSupply, reward types/amounts/addresses/tokenIds).
    function getTokenDetails(uint256 _tokenId)
        external
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
        LibItems.RewardToken memory rt = tokenRewards[_tokenId];
        tokenUri = rt.tokenUri;
        maxSupply = rt.maxSupply;
        LibItems.Reward[] memory rewards = rt.rewards;
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

    /// @notice Decodes claim data for debugging. Same encoding as used in claim(data, signature).
    /// @dev Decoded data order: (contractAddress, chainId, beneficiary, userNonce, serverId, tokenIds).
    ///      Hash for signing uses a different order: (contractAddress, chainId, serverId, beneficiary, userNonce, tokenIds). See _verifyServerSignature.
    function decodeClaimData(
        bytes calldata data
    ) public pure returns (address contractAddress, uint256 chainId, address beneficiary, uint256 userNonce, uint8 serverId, uint256[] memory tokenIds) {
        (contractAddress, chainId, beneficiary, userNonce, serverId, tokenIds) =
            abi.decode(data, (address, uint256, address, uint256, uint8, uint256[]));
    }

    /// @notice Whether a reward token with _tokenId exists.
    function isTokenExists(uint256 _tokenId) external view returns (bool) {
        return tokenExists[_tokenId];
    }

    /// @notice Current distribution index for an ERC721 reward slot (used to pick next token id).
    function getERC721RewardCurrentIndex(uint256 _rewardTokenId, uint256 _rewardIndex) external view returns (uint256) {
        return erc721RewardCurrentIndex[_rewardTokenId][_rewardIndex];
    }

    /// @notice Returns list of all active signer addresses (for rewards-get-whitelist-signers).
    function getSigners() external view returns (address[] memory) {
        return signerList;
    }


    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlUpgradeable, ERC1155HolderUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Internal helper to verify a server-scoped signature.
     *
     * Hash encoding order (for signing): contractAddress, chainId, serverId, beneficiary, userNonce, tokenIds.
     * Decoded claim data order (decodeClaimData / ABI of data): contractAddress, chainId, beneficiary, userNonce, serverId, tokenIds.
     * SDKs must use the hash order above when building the sign message; using the decode order will produce invalid signatures.
     * Message format: keccak256(abi.encode(...)) then EIP-191 prefix.
     */
    function _verifyServerSignature(
        uint8 serverId,
        address beneficiary,
        uint256[] memory tokenIds,
        uint256 userNonce,
        bytes calldata signature
    ) internal {
        uint256 currentChainId = block.chainid;
        bytes32 message = keccak256(
            abi.encode(
                address(this),
                currentChainId,
                serverId,
                beneficiary,
                userNonce,
                tokenIds
            )
        );
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(message);
        address signer = ECDSA.recover(hash, signature);

        if (!signers[signer]) {
            revert InvalidSignature();
        }
        if (serverId != id) revert InvalidServerId();
        if (isUserNonceUsed[beneficiary][userNonce]) revert NonceAlreadyUsed();
        isUserNonceUsed[beneficiary][userNonce] = true;
    }

    /*//////////////////////////////////////////////////////////////
              INTERNAL HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _addRewardToken(uint256 _tokenId, LibItems.RewardToken memory _rewardToken) internal {
        if (tokenExists[_tokenId]) revert RewardTokenAlreadyExists();
        tokenExists[_tokenId] = true;
        tokenRewards[_tokenId] = _rewardToken;
        itemIds.push(_tokenId);
        currentRewardSupply[_tokenId] = 0;
    }

    /// @notice Fulfills claim for a reward token: distributes rewards (including ETH from this server's treasury) to to and increments supply. Only REWARDS_ROUTER_ROLE (Router calls this from claim()).
    function _claimReward(address to, uint256 tokenId) internal {
        if (to == address(0)) revert AddressIsZero();
        if (!tokenExists[tokenId]) revert TokenNotExist();

        if (currentRewardSupply[tokenId] + 1 > tokenRewards[tokenId].maxSupply) revert ExceedMaxSupply();

        _distributeReward(to, tokenId);

        currentRewardSupply[tokenId]++;

        emit Claimed(to, tokenId);
    }

    /// @notice Internal: distributes one unit of a reward token to to (ETHER from this contract; ERC20/721/1155 from this contract).
    function _distributeReward(address to, uint256 rewardTokenId) internal {
        LibItems.RewardToken memory rewardToken = tokenRewards[rewardTokenId];
        LibItems.Reward[] memory rewards = rewardToken.rewards;

        for (uint256 i = 0; i < rewards.length; i++) {
            LibItems.Reward memory r = rewards[i];
            if (r.rewardType == LibItems.RewardType.ETHER) {
                if (address(this).balance < r.rewardAmount || ethReservedTotal < r.rewardAmount) revert InsufficientBalance();
                ethReservedTotal -= r.rewardAmount;
                (bool ok, ) = payable(to).call{ value: r.rewardAmount }("");
                if (!ok) revert TransferFailed();
            } else if (r.rewardType == LibItems.RewardType.ERC20) {
                SafeERC20.safeTransfer(IERC20(r.rewardTokenAddress), to, r.rewardAmount);
                reservedAmounts[r.rewardTokenAddress] -= r.rewardAmount;
            } else if (r.rewardType == LibItems.RewardType.ERC721) {
                uint256 currentIndex = erc721RewardCurrentIndex[rewardTokenId][i];
                uint256[] memory tokenIds = r.rewardTokenIds;
                for (uint256 j = 0; j < r.rewardAmount; j++) {
                    if (currentIndex + j >= tokenIds.length) revert InsufficientBalance();
                    uint256 nftId = tokenIds[currentIndex + j];
                    isErc721Reserved[r.rewardTokenAddress][nftId] = false;
                    erc721TotalReserved[r.rewardTokenAddress]--;
                    IERC721(r.rewardTokenAddress).safeTransferFrom(address(this), to, nftId);
                }
                erc721RewardCurrentIndex[rewardTokenId][i] += r.rewardAmount;
            } else if (r.rewardType == LibItems.RewardType.ERC1155) {
                erc1155ReservedAmounts[r.rewardTokenAddress][r.rewardTokenId] -= r.rewardAmount;
                erc1155TotalReserved[r.rewardTokenAddress] -= r.rewardAmount;
                IERC1155(r.rewardTokenAddress).safeTransferFrom(address(this), to, r.rewardTokenId, r.rewardAmount, "");
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                         INTERNAL HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _processERC20Token(
        address tokenAddress,
        uint256 index,
        uint256[] memory totalBalances,
        uint256[] memory reservedBalances,
        uint256[] memory availableBalances,
        string[] memory symbols,
        string[] memory names,
        string[] memory types
    ) private view {
        uint256 totalBalance = IERC20(tokenAddress).balanceOf(address(this));
        uint256 reserved = reservedAmounts[tokenAddress];

        totalBalances[index] = totalBalance;
        reservedBalances[index] = reserved;
        availableBalances[index] = totalBalance > reserved ? totalBalance - reserved : 0;

        try IERC20Metadata(tokenAddress).symbol() returns (string memory symbol) {
            symbols[index] = symbol;
        } catch {
            symbols[index] = "UNKNOWN";
        }

        try IERC20Metadata(tokenAddress).name() returns (string memory name) {
            names[index] = name;
        } catch {
            names[index] = "Unknown Token";
        }

        types[index] = "fa";
    }

    function _processERC721Token(
        address tokenAddress,
        uint256 index,
        uint256[] memory totalBalances,
        uint256[] memory reservedBalances,
        uint256[] memory availableBalances,
        string[] memory symbols,
        string[] memory names,
        string[] memory types
    ) private view {
        uint256 totalBalance = IERC721(tokenAddress).balanceOf(address(this));
        uint256 reserved = erc721TotalReserved[tokenAddress];

        totalBalances[index] = totalBalance;
        reservedBalances[index] = reserved;
        availableBalances[index] = totalBalance > reserved ? totalBalance - reserved : 0;

        try IERC721Metadata(tokenAddress).symbol() returns (string memory symbol) {
            symbols[index] = symbol;
        } catch {
            symbols[index] = "ERC721";
        }

        try IERC721Metadata(tokenAddress).name() returns (string memory name) {
            names[index] = name;
        } catch {
            names[index] = "NFT Collection";
        }

        types[index] = "nft";
    }

    function _processERC1155Tokens(
        uint256 erc1155Count,
        uint256 startIndex,
        address[] memory addresses,
        uint256[] memory totalBalances,
        uint256[] memory reservedBalances,
        uint256[] memory availableBalances,
        string[] memory symbols,
        string[] memory names,
        string[] memory types,
        uint256[] memory tokenIds
    ) private view returns (uint256) {
        uint256[] memory ids = itemIds;

        address[] memory processedErc1155Addresses = new address[](erc1155Count);
        uint256[] memory processedErc1155TokenIds = new uint256[](erc1155Count);
        uint256 processedCount = 0;
        uint256 currentIndex = startIndex;

        for (uint256 i = 0; i < ids.length; i++) {
            LibItems.Reward[] memory rewardsList = tokenRewards[ids[i]].rewards;

            for (uint256 j = 0; j < rewardsList.length; j++) {
                LibItems.Reward memory reward = rewardsList[j];

                if (reward.rewardType != LibItems.RewardType.ERC1155) continue;

                address erc1155Address = reward.rewardTokenAddress;
                uint256 erc1155TokenId = reward.rewardTokenId;

                bool alreadyAdded = false;
                for (uint256 k = 0; k < processedCount; k++) {
                    if (processedErc1155Addresses[k] == erc1155Address &&
                        processedErc1155TokenIds[k] == erc1155TokenId) {
                        alreadyAdded = true;
                        break;
                    }
                }

                if (!alreadyAdded && currentIndex < addresses.length) {
                    processedErc1155Addresses[processedCount] = erc1155Address;
                    processedErc1155TokenIds[processedCount] = erc1155TokenId;
                    processedCount++;

                    addresses[currentIndex] = erc1155Address;
                    tokenIds[currentIndex] = erc1155TokenId;

                    uint256 balance = IERC1155(erc1155Address).balanceOf(address(this), erc1155TokenId);
                    uint256 reserved = erc1155ReservedAmounts[erc1155Address][erc1155TokenId];

                    totalBalances[currentIndex] = balance;
                    reservedBalances[currentIndex] = reserved;
                    availableBalances[currentIndex] = balance > reserved ? balance - reserved : 0;

                    try IERC1155Metadata(erc1155Address).name() returns (string memory _name) {
                        names[currentIndex] = _name;
                    } catch {
                        names[currentIndex] = "ERC1155 Collection";
                    }

                    try IERC1155Metadata(erc1155Address).symbol() returns (string memory _symbol) {
                        symbols[currentIndex] = _symbol;
                    } catch {
                        symbols[currentIndex] = "ERC1155";
                    }

                    types[currentIndex] = "nft";

                    currentIndex++;
                }
            }
        }

        return currentIndex;
    }

    function _countUniqueErc1155TokenIds() private view returns (uint256) {
        uint256[] memory ids = itemIds;

        // Safe upper bound: total ERC1155 reward entries (unique count cannot exceed this)
        uint256 totalErc1155Entries = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            LibItems.Reward[] memory rewardsList = tokenRewards[ids[i]].rewards;
            for (uint256 j = 0; j < rewardsList.length; j++) {
                if (rewardsList[j].rewardType == LibItems.RewardType.ERC1155) totalErc1155Entries++;
            }
        }

        address[] memory uniqueAddresses = new address[](totalErc1155Entries);
        uint256[] memory uniqueTokenIds = new uint256[](totalErc1155Entries);
        uint256 count = 0;

        for (uint256 i = 0; i < ids.length; i++) {
            LibItems.Reward[] memory rewardsList = tokenRewards[ids[i]].rewards;

            for (uint256 j = 0; j < rewardsList.length; j++) {
                if (rewardsList[j].rewardType == LibItems.RewardType.ERC1155) {
                    address erc1155Address = rewardsList[j].rewardTokenAddress;
                    uint256 erc1155TokenId = rewardsList[j].rewardTokenId;

                    bool found = false;
                    for (uint256 k = 0; k < count; k++) {
                        if (uniqueAddresses[k] == erc1155Address &&
                            uniqueTokenIds[k] == erc1155TokenId) {
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


    /// @notice Accepts ETH sent to this server's treasury (e.g. for topping up unreserved ETH).
    receive() external payable {}
}
