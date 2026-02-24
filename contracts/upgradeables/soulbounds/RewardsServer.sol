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

interface IRewards {
    function getAllItemIds() external view returns (uint256[] memory);
    function getTokenRewards(uint256 tokenId) external view returns (LibItems.Reward[] memory);
}

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
contract RewardsServer is Initializable, AccessControlUpgradeable, ERC721HolderUpgradeable, ERC1155HolderUpgradeable {

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
    error UnauthorizedServerAdmin();
    error InsufficientERC721Ids();

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/
    bytes32 public constant REWARDS_MANAGER_ROLE = keccak256("REWARDS_MANAGER_ROLE");
    bytes32 public constant SERVER_ADMIN_ROLE = keccak256("SERVER_ADMIN_ROLE");

    /*//////////////////////////////////////////////////////////////
                           STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    // Server-level access (admin, signers for claim, withdrawers)
    mapping(address => bool) public signers;
    address[] private signerList;
    mapping(address => bool) public withdrawers;

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
    mapping(uint256 => bool) public isTokenMintPaused;
    mapping(uint256 => bool) public isClaimRewardPaused;
    mapping(uint256 => mapping(uint256 => uint256)) public erc721RewardCurrentIndex;
    mapping(uint256 => uint256) public currentRewardSupply;

    // Per-user nonce (for mint/claim signatures)
    mapping(address => mapping(uint256 => bool)) public userNonces;

    uint256[32] private __gap;

    /*//////////////////////////////////////////////////////////////
                               EVENTS
    //////////////////////////////////////////////////////////////*/
    event TreasuryDeposit(address indexed token, uint256 amount);
    event SignerUpdated(address indexed account, bool active);
    event WithdrawerUpdated(address indexed account, bool active);
    event ServerAdminTransferred(address indexed oldAdmin, address indexed newAdmin);

    /*//////////////////////////////////////////////////////////////
                             INITIALIZER
    //////////////////////////////////////////////////////////////*/
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the server: access roles and server admin. Called once by the proxy.
    /// @param _admin Default admin (e.g. RewardsManager or deployer).
    /// @param _rewardsContract Address that receives REWARDS_MANAGER_ROLE (typically RewardsManager).
    /// @param _serverAdmin Address that receives SERVER_ADMIN_ROLE (signers, withdrawers, transfer).
    function initialize(address _admin, address _rewardsContract, address _serverAdmin) external initializer {
        if (_admin == address(0) || _rewardsContract == address(0) || _serverAdmin == address(0)) {
            revert AddressIsZero();
        }

        __AccessControl_init();
        __ERC721Holder_init();
        __ERC1155Holder_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(REWARDS_MANAGER_ROLE, _rewardsContract);
        _grantRole(SERVER_ADMIN_ROLE, _serverAdmin);
    }

    /*//////////////////////////////////////////////////////////////
                    SERVER ACCESS CONTROL (admin, signers, withdrawers)
    //////////////////////////////////////////////////////////////*/

    /// @notice Enables or disables a claim signer. Only SERVER_ADMIN_ROLE.
    /// @param account Signer address.
    /// @param active True to allow signing, false to revoke.
    function setSigner(address account, bool active) external onlyRole(SERVER_ADMIN_ROLE) {
        if (account == address(0)) revert AddressIsZero();
        if (active) {
            if (!signers[account]) {
                signers[account] = true;
                signerList.push(account);
            }
        } else {
            if (signers[account]) {
                signers[account] = false;
                _removeFromSignerList(account);
            }
        }
        emit SignerUpdated(account, active);
    }

    /// @notice Enables or disables a withdrawer. Only SERVER_ADMIN_ROLE.
    /// @param account Withdrawer address.
    /// @param active True to allow withdrawals, false to revoke.
    function setWithdrawer(address account, bool active) external onlyRole(SERVER_ADMIN_ROLE) {
        if (account == address(0)) revert AddressIsZero();
        withdrawers[account] = active;
        emit WithdrawerUpdated(account, active);
    }

    /// @notice Transfers SERVER_ADMIN_ROLE to another address. Caller loses the role.
    /// @param newAdmin Address to receive SERVER_ADMIN_ROLE.
    function transferServerAdmin(address newAdmin) external onlyRole(SERVER_ADMIN_ROLE) {
        if (newAdmin == address(0)) revert AddressIsZero();
        address oldAdmin = msg.sender;
        _revokeRole(SERVER_ADMIN_ROLE, oldAdmin);
        _grantRole(SERVER_ADMIN_ROLE, newAdmin);
        emit ServerAdminTransferred(oldAdmin, newAdmin);
    }

    /// @notice Returns whether the account is an active signer for claims.
    function isSigner(address account) external view returns (bool) {
        return signers[account];
    }

    /// @notice Returns list of all active signer addresses (for rewards-get-whitelist-signers).
    function getSigners() external view returns (address[] memory) {
        return signerList;
    }

    /// @notice Returns whether the account is an active withdrawer.
    function isWithdrawer(address account) external view returns (bool) {
        return withdrawers[account];
    }

    /// @notice Same as setSigner but called by RewardsManager; caller must be SERVER_ADMIN_ROLE.
    function setSignerAllowedBy(address caller, address account, bool active) external onlyRole(REWARDS_MANAGER_ROLE) {
        if (!hasRole(SERVER_ADMIN_ROLE, caller)) revert UnauthorizedServerAdmin();
        if (account == address(0)) revert AddressIsZero();
        if (active) {
            if (!signers[account]) {
                signers[account] = true;
                signerList.push(account);
            }
        } else {
            if (signers[account]) {
                signers[account] = false;
                _removeFromSignerList(account);
            }
        }
        emit SignerUpdated(account, active);
    }

    function _removeFromSignerList(address account) private {
        for (uint256 i = 0; i < signerList.length; i++) {
            if (signerList[i] == account) {
                signerList[i] = signerList[signerList.length - 1];
                signerList.pop();
                return;
            }
        }
    }

    /// @notice Same as setWithdrawer but called by RewardsManager; caller must be SERVER_ADMIN_ROLE.
    function setWithdrawerAllowedBy(address caller, address account, bool active) external onlyRole(REWARDS_MANAGER_ROLE) {
        if (!hasRole(SERVER_ADMIN_ROLE, caller)) revert UnauthorizedServerAdmin();
        if (account == address(0)) revert AddressIsZero();
        withdrawers[account] = active;
        emit WithdrawerUpdated(account, active);
    }

    /// @notice Same as transferServerAdmin but initiated by RewardsManager; caller becomes new admin.
    function transferServerAdminAllowedBy(address caller, address newAdmin) external onlyRole(REWARDS_MANAGER_ROLE) {
        if (!hasRole(SERVER_ADMIN_ROLE, caller)) revert UnauthorizedServerAdmin();
        if (newAdmin == address(0)) revert AddressIsZero();
        _revokeRole(SERVER_ADMIN_ROLE, caller);
        _grantRole(SERVER_ADMIN_ROLE, newAdmin);
        emit ServerAdminTransferred(caller, newAdmin);
    }

    /*//////////////////////////////////////////////////////////////
                      TREASURY MANAGEMENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Adds a token to the whitelist for use in rewards. Only REWARDS_MANAGER_ROLE.
    /// @param _token Token contract address.
    /// @param _type One of ERC20, ERC721, ERC1155.
    function whitelistToken(address _token, LibItems.RewardType _type) external onlyRole(REWARDS_MANAGER_ROLE) {
        if (_token == address(0)) revert AddressIsZero();
        if (whitelistedTokens[_token]) revert TokenAlreadyWhitelisted();

        whitelistedTokens[_token] = true;
        tokenTypes[_token] = _type;
        whitelistedTokenList.push(_token);

        if (_type == LibItems.RewardType.ERC20) {
            reservedAmounts[_token] = 0;
        }
    }

    /// @notice Removes a token from the whitelist. Fails if the token has any reserves. Only REWARDS_MANAGER_ROLE.
    /// @param _token Token contract address.
    function removeTokenFromWhitelist(address _token) external onlyRole(REWARDS_MANAGER_ROLE) {
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

    /// @notice Transfers tokens from _from into this treasury. Only REWARDS_MANAGER_ROLE. Token must be whitelisted.
    /// @param _token Token address (ERC20).
    /// @param _amount Amount to transfer.
    /// @param _from Source address (must have approved this contract).
    function depositToTreasury(address _token, uint256 _amount, address _from) external onlyRole(REWARDS_MANAGER_ROLE) {
        if (!whitelistedTokens[_token]) revert TokenNotWhitelisted();
        if (_amount == 0) revert InvalidAmount();

        SafeERC20.safeTransferFrom(IERC20(_token), _from, address(this), _amount);
        emit TreasuryDeposit(_token, _amount);
    }

    /// @notice Sends all unreserved ERC20 balance of _token to _to. Only REWARDS_MANAGER_ROLE.
    function withdrawUnreservedTreasury(address _token, address _to) external onlyRole(REWARDS_MANAGER_ROLE) {
        if (_to == address(0)) revert AddressIsZero();
        if (!whitelistedTokens[_token]) revert TokenNotWhitelisted();

        uint256 balance = IERC20(_token).balanceOf(address(this));
        uint256 reserved = reservedAmounts[_token];

        if (balance <= reserved) revert InsufficientBalance();

        SafeERC20.safeTransfer(IERC20(_token), _to, balance - reserved);
    }

    /// @notice Sends one unreserved ERC721 token to _to. Only REWARDS_MANAGER_ROLE. Fails if _tokenId is reserved.
    function withdrawERC721UnreservedTreasury(address _token, address _to, uint256 _tokenId) external onlyRole(REWARDS_MANAGER_ROLE) {
        if (_to == address(0)) revert AddressIsZero();
        if (!whitelistedTokens[_token]) revert TokenNotWhitelisted();
        if (isErc721Reserved[_token][_tokenId]) revert InsufficientTreasuryBalance();

        IERC721(_token).safeTransferFrom(address(this), _to, _tokenId);
    }

    /// @notice Sends unreserved ERC1155 amount to _to. Only REWARDS_MANAGER_ROLE.
    function withdrawERC1155UnreservedTreasury(address _token, address _to, uint256 _tokenId, uint256 _amount) external onlyRole(REWARDS_MANAGER_ROLE) {
        if (_to == address(0)) revert AddressIsZero();
        if (!whitelistedTokens[_token]) revert TokenNotWhitelisted();

        uint256 balance = IERC1155(_token).balanceOf(address(this), _tokenId);
        uint256 reserved = erc1155ReservedAmounts[_token][_tokenId];

        if (balance <= reserved) revert InsufficientBalance();
        if (_amount > (balance - reserved)) revert InsufficientBalance();

        IERC1155(_token).safeTransferFrom(address(this), _to, _tokenId, _amount, "");
    }

    /*//////////////////////////////////////////////////////////////
                      DISTRIBUTION FUNCTIONS (for claims)
    //////////////////////////////////////////////////////////////*/

    /// @notice Transfers ERC20 to recipient (used when fulfilling claims). Only REWARDS_MANAGER_ROLE.
    function distributeERC20(address _token, address _to, uint256 _amount) external onlyRole(REWARDS_MANAGER_ROLE) {
        SafeERC20.safeTransfer(IERC20(_token), _to, _amount);
    }

    /// @notice Transfers ERC721 to recipient (used when fulfilling claims). Only REWARDS_MANAGER_ROLE.
    function distributeERC721(address _token, address _to, uint256 _tokenId) external onlyRole(REWARDS_MANAGER_ROLE) {
        IERC721(_token).safeTransferFrom(address(this), _to, _tokenId);
    }

    /// @notice Transfers ERC1155 amount to recipient (used when fulfilling claims). Only REWARDS_MANAGER_ROLE.
    function distributeERC1155(address _token, address _to, uint256 _tokenId, uint256 _amount) external onlyRole(REWARDS_MANAGER_ROLE) {
        IERC1155(_token).safeTransferFrom(address(this), _to, _tokenId, _amount, "");
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

    /// @notice Whether a reward token with _tokenId exists.
    function isTokenExists(uint256 _tokenId) external view returns (bool) {
        return tokenExists[_tokenId];
    }

    /// @notice Current distribution index for an ERC721 reward slot (used to pick next token id).
    function getERC721RewardCurrentIndex(uint256 _rewardTokenId, uint256 _rewardIndex) external view returns (uint256) {
        return erc721RewardCurrentIndex[_rewardTokenId][_rewardIndex];
    }

    /*//////////////////////////////////////////////////////////////
                    RESERVATION & REWARD MUTATORS (REWARDS_MANAGER_ROLE)
    //////////////////////////////////////////////////////////////*/

    /// @notice Increases reserved ERC20 amount for _token (e.g. when creating or extending reward supply). Only REWARDS_MANAGER_ROLE.
    function increaseERC20Reserved(address _token, uint256 _amount) external onlyRole(REWARDS_MANAGER_ROLE) {
        reservedAmounts[_token] += _amount;
    }

    /// @notice Decreases reserved ERC20 amount. Only REWARDS_MANAGER_ROLE. Reverts if would go below zero.
    function decreaseERC20Reserved(address _token, uint256 _amount) external onlyRole(REWARDS_MANAGER_ROLE) {
        reservedAmounts[_token] -= _amount;
    }

    /// @notice Marks an ERC721 token id as reserved for rewards. Only REWARDS_MANAGER_ROLE.
    function reserveERC721(address _token, uint256 _tokenId) external onlyRole(REWARDS_MANAGER_ROLE) {
        isErc721Reserved[_token][_tokenId] = true;
        erc721TotalReserved[_token]++;
    }

    /// @notice Releases reservation of an ERC721 token id. Only REWARDS_MANAGER_ROLE.
    function releaseERC721(address _token, uint256 _tokenId) external onlyRole(REWARDS_MANAGER_ROLE) {
        isErc721Reserved[_token][_tokenId] = false;
        erc721TotalReserved[_token]--;
    }

    /// @notice Increases reserved ERC1155 amount for (_token, _tokenId). Only REWARDS_MANAGER_ROLE.
    function increaseERC1155Reserved(address _token, uint256 _tokenId, uint256 _amount) external onlyRole(REWARDS_MANAGER_ROLE) {
        erc1155ReservedAmounts[_token][_tokenId] += _amount;
        erc1155TotalReserved[_token] += _amount;
    }

    /// @notice Decreases reserved ERC1155 amount. Only REWARDS_MANAGER_ROLE. Reverts if would go below zero.
    function decreaseERC1155Reserved(address _token, uint256 _tokenId, uint256 _amount) external onlyRole(REWARDS_MANAGER_ROLE) {
        erc1155ReservedAmounts[_token][_tokenId] -= _amount;
        erc1155TotalReserved[_token] -= _amount;
    }

    /// @notice Registers a new reward token (item) with given id and reward definition. Only REWARDS_MANAGER_ROLE. Id must not exist.
    function addRewardToken(uint256 _tokenId, LibItems.RewardToken memory _rewardToken) external onlyRole(REWARDS_MANAGER_ROLE) {
        if (tokenExists[_tokenId]) revert RewardTokenAlreadyExists();

        tokenExists[_tokenId] = true;
        tokenRewards[_tokenId] = _rewardToken;
        itemIds.push(_tokenId);
        currentRewardSupply[_tokenId] = 0;
    }

    /// @notice Updates reward definition for an existing reward token (e.g. URI). Only REWARDS_MANAGER_ROLE. Does not extend ERC721 reward ids.
    function updateRewardToken(uint256 _tokenId, LibItems.RewardToken memory _rewardToken) external onlyRole(REWARDS_MANAGER_ROLE) {
        if (!tokenExists[_tokenId]) revert TokenNotWhitelisted();
        tokenRewards[_tokenId] = _rewardToken;
    }

    /// @notice Increases max supply for a reward token; reserves additional ERC20/ERC1155 on this server. Only REWARDS_MANAGER_ROLE.
    /// @dev ERC721-backed rewards cannot have supply increased: rewardTokenIds length is fixed at creation. When ERC721 supply is exhausted, create a new reward token.
    /// @param _tokenId Reward token id.
    /// @param _additionalSupply Extra supply to add (must be > 0). For ERC721 rewards this will revert.
    function increaseRewardSupply(uint256 _tokenId, uint256 _additionalSupply) external onlyRole(REWARDS_MANAGER_ROLE) {
        if (!tokenExists[_tokenId]) revert TokenNotExist();
        if (_additionalSupply == 0) revert InvalidAmount();

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
    }

    /// @notice Reduces max supply for a reward token; releases proportional ERC20/ERC1155 reservations. Only REWARDS_MANAGER_ROLE.
    /// @dev New max supply must not be below currentRewardSupply. ERC721: only maxSupply is reduced (reserved NFT ids unchanged).
    /// @param _tokenId Reward token id.
    /// @param _reduceBy Amount to subtract from max supply (must be > 0).
    function reduceRewardSupply(uint256 _tokenId, uint256 _reduceBy) external onlyRole(REWARDS_MANAGER_ROLE) {
        if (!tokenExists[_tokenId]) revert TokenNotExist();
        if (_reduceBy == 0) revert InvalidAmount();

        LibItems.RewardToken memory rewardToken = tokenRewards[_tokenId];
        uint256 current = currentRewardSupply[_tokenId];
        uint256 newSupply = rewardToken.maxSupply - _reduceBy;
        if (current > newSupply) revert InsufficientBalance();

        for (uint256 i = 0; i < rewardToken.rewards.length; i++) {
            LibItems.Reward memory r = rewardToken.rewards[i];
            if (r.rewardType == LibItems.RewardType.ERC20) {
                uint256 releaseAmount = r.rewardAmount * _reduceBy;
                reservedAmounts[r.rewardTokenAddress] -= releaseAmount;
            } else if (r.rewardType == LibItems.RewardType.ERC1155) {
                uint256 releaseAmount = r.rewardAmount * _reduceBy;
                erc1155ReservedAmounts[r.rewardTokenAddress][r.rewardTokenId] -= releaseAmount;
                erc1155TotalReserved[r.rewardTokenAddress] -= releaseAmount;
            }
            // ERC721: no reserved amount to release; maxSupply reduction only
        }

        rewardToken.maxSupply = newSupply;
        tokenRewards[_tokenId] = rewardToken;
    }

    /// @notice Pauses or unpauses minting for a reward token. Only REWARDS_MANAGER_ROLE.
    function setTokenMintPaused(uint256 _tokenId, bool _isPaused) external onlyRole(REWARDS_MANAGER_ROLE) {
        isTokenMintPaused[_tokenId] = _isPaused;
    }

    /// @notice Pauses or unpauses claiming rewards for a reward token. Only REWARDS_MANAGER_ROLE.
    function setClaimRewardPaused(uint256 _tokenId, bool _isPaused) external onlyRole(REWARDS_MANAGER_ROLE) {
        isClaimRewardPaused[_tokenId] = _isPaused;
    }

    /// @notice Increments current minted supply for a reward token (e.g. after mint). Only REWARDS_MANAGER_ROLE.
    function increaseCurrentSupply(uint256 _tokenId, uint256 _amount) external onlyRole(REWARDS_MANAGER_ROLE) {
        currentRewardSupply[_tokenId] += _amount;
    }

    /// @notice Decrements current supply (e.g. burn or correction). Only REWARDS_MANAGER_ROLE.
    function decreaseCurrentSupply(uint256 _tokenId, uint256 _amount) external onlyRole(REWARDS_MANAGER_ROLE) {
        currentRewardSupply[_tokenId] -= _amount;
    }

    /// @notice Sets a user nonce as used/unused (replay protection for mint/claim). Only REWARDS_MANAGER_ROLE.
    function setUserNonce(address _user, uint256 _nonce, bool _used) external onlyRole(REWARDS_MANAGER_ROLE) {
        userNonces[_user][_nonce] = _used;
    }

    /// @notice Advances the ERC721 distribution index for a reward slot by _delta (e.g. after distributing rewardAmount NFTs). Only REWARDS_MANAGER_ROLE.
    function incrementERC721RewardIndex(uint256 _rewardTokenId, uint256 _rewardIndex, uint256 _delta) external onlyRole(REWARDS_MANAGER_ROLE) {
        erc721RewardCurrentIndex[_rewardTokenId][_rewardIndex] += _delta;
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

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlUpgradeable, ERC1155HolderUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
