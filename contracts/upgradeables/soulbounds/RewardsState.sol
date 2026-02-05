// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// @author Summon.xyz Team - https://summon.xyz
// @contributors: [ @ogarciarevett, @karacurt]

import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { LibItems } from "../../libraries/LibItems.sol";

/**
 * @title RewardsState
 * @notice Centralized state storage for the Rewards system
 * @dev This contract holds all state that is shared between Rewards and Treasury contracts.
 *      Only authorized contracts (with STATE_MANAGER_ROLE) can modify state.
 *      This contract is upgradeable using the UUPS pattern.
 */
contract RewardsState is Initializable, AccessControlUpgradeable, UUPSUpgradeable {

    /*//////////////////////////////////////////////////////////////
                               ERRORS
    //////////////////////////////////////////////////////////////*/
    error AddressIsZero();
    error TokenAlreadyWhitelisted();
    error TokenNotWhitelisted();

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/
    bytes32 public constant STATE_MANAGER_ROLE = keccak256("STATE_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /*//////////////////////////////////////////////////////////////
                           STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    // Treasury whitelist
    mapping(address => bool) public whitelistedTokens;
    address[] private whitelistedTokenList;
    mapping(address => LibItems.RewardType) public tokenTypes;

    // ERC20 Reservations
    mapping(address => uint256) public reservedAmounts;

    // ERC721 Reservations
    mapping(address => mapping(uint256 => bool)) public isErc721Reserved;
    mapping(address => uint256) public erc721TotalReserved;

    // ERC1155 Reservations
    mapping(address => mapping(uint256 => uint256)) public erc1155ReservedAmounts;
    mapping(address => uint256) public erc1155TotalReserved;

    // Reward Token Management
    uint256[] public itemIds;
    mapping(uint256 => bool) public tokenExists;
    mapping(uint256 => LibItems.RewardToken) public tokenRewards;
    mapping(uint256 => bool) public isTokenMintPaused;
    mapping(uint256 => bool) public isClaimRewardPaused;
    mapping(uint256 => mapping(uint256 => uint256)) public erc721RewardCurrentIndex; // rewardTokenId => rewardIndex => erc721RewardCurrentIndex
    mapping(uint256 => uint256) public currentRewardSupply;

    // Per-user nonce tracking
    mapping(address => mapping(uint256 => bool)) public userNonces;

    uint256[50] private __gap;

    /*//////////////////////////////////////////////////////////////
                               EVENTS
    //////////////////////////////////////////////////////////////*/
    event TokenWhitelisted(address indexed token, LibItems.RewardType tokenType);
    event TokenRemovedFromWhitelist(address indexed token);
    event RewardTokenAdded(uint256 indexed tokenId);
    event RewardTokenUpdated(uint256 indexed tokenId);
    event TokenMintPausedUpdated(uint256 indexed tokenId, bool isPaused);
    event ClaimRewardPausedUpdated(uint256 indexed tokenId, bool isPaused);
    event UserNonceUsed(address indexed user, uint256 indexed nonce);

    /*//////////////////////////////////////////////////////////////
                             INITIALIZER
    //////////////////////////////////////////////////////////////*/
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _admin) external initializer {
        if (_admin == address(0)) revert AddressIsZero();

        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    /*//////////////////////////////////////////////////////////////
                         WHITELIST MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    function whitelistToken(address _token, LibItems.RewardType _type) external onlyRole(STATE_MANAGER_ROLE) {
        if (_token == address(0)) revert AddressIsZero();
        if (whitelistedTokens[_token]) revert TokenAlreadyWhitelisted();

        whitelistedTokens[_token] = true;
        tokenTypes[_token] = _type;
        whitelistedTokenList.push(_token);

        if (_type == LibItems.RewardType.ERC20) {
            reservedAmounts[_token] = 0;
        }

        emit TokenWhitelisted(_token, _type);
    }

    function removeTokenFromWhitelist(address _token) external onlyRole(STATE_MANAGER_ROLE) {
        if (!whitelistedTokens[_token]) revert TokenNotWhitelisted();

        whitelistedTokens[_token] = false;

        // Remove from list
        for (uint256 i = 0; i < whitelistedTokenList.length; i++) {
            if (whitelistedTokenList[i] == _token) {
                whitelistedTokenList[i] = whitelistedTokenList[whitelistedTokenList.length - 1];
                whitelistedTokenList.pop();
                break;
            }
        }

        emit TokenRemovedFromWhitelist(_token);
    }

    function getWhitelistedTokens() external view returns (address[] memory) {
        return whitelistedTokenList;
    }

    /*//////////////////////////////////////////////////////////////
                      RESERVATION MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    function increaseERC20Reserved(address _token, uint256 _amount) external onlyRole(STATE_MANAGER_ROLE) {
        reservedAmounts[_token] += _amount;
    }

    function decreaseERC20Reserved(address _token, uint256 _amount) external onlyRole(STATE_MANAGER_ROLE) {
        if (reservedAmounts[_token] >= _amount) {
            reservedAmounts[_token] -= _amount;
        }
    }

    function reserveERC721(address _token, uint256 _tokenId) external onlyRole(STATE_MANAGER_ROLE) {
        isErc721Reserved[_token][_tokenId] = true;
        erc721TotalReserved[_token]++;
    }

    function releaseERC721(address _token, uint256 _tokenId) external onlyRole(STATE_MANAGER_ROLE) {
        isErc721Reserved[_token][_tokenId] = false;
        if (erc721TotalReserved[_token] > 0) {
            erc721TotalReserved[_token]--;
        }
    }

    function increaseERC1155Reserved(address _token, uint256 _tokenId, uint256 _amount) external onlyRole(STATE_MANAGER_ROLE) {
        erc1155ReservedAmounts[_token][_tokenId] += _amount;
        erc1155TotalReserved[_token] += _amount;
    }

    function decreaseERC1155Reserved(address _token, uint256 _tokenId, uint256 _amount) external onlyRole(STATE_MANAGER_ROLE) {
        if (erc1155ReservedAmounts[_token][_tokenId] >= _amount) {
            erc1155ReservedAmounts[_token][_tokenId] -= _amount;
        }
        if (erc1155TotalReserved[_token] >= _amount) {
            erc1155TotalReserved[_token] -= _amount;
        }
    }

    /*//////////////////////////////////////////////////////////////
                    REWARD TOKEN MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    function addRewardToken(uint256 _tokenId, LibItems.RewardToken memory _rewardToken) external onlyRole(STATE_MANAGER_ROLE) {
        if (tokenExists[_tokenId]) revert TokenAlreadyWhitelisted();

        tokenExists[_tokenId] = true;
        tokenRewards[_tokenId] = _rewardToken;
        itemIds.push(_tokenId);
        currentRewardSupply[_tokenId] = 0;

        emit RewardTokenAdded(_tokenId);
    }

    function updateRewardToken(uint256 _tokenId, LibItems.RewardToken memory _rewardToken) external onlyRole(STATE_MANAGER_ROLE) {
        if (!tokenExists[_tokenId]) revert TokenNotWhitelisted();
        tokenRewards[_tokenId] = _rewardToken;
        emit RewardTokenUpdated(_tokenId);
    }

    function setTokenMintPaused(uint256 _tokenId, bool _isPaused) external onlyRole(STATE_MANAGER_ROLE) {
        isTokenMintPaused[_tokenId] = _isPaused;
        emit TokenMintPausedUpdated(_tokenId, _isPaused);
    }

    function setClaimRewardPaused(uint256 _tokenId, bool _isPaused) external onlyRole(STATE_MANAGER_ROLE) {
        isClaimRewardPaused[_tokenId] = _isPaused;
        emit ClaimRewardPausedUpdated(_tokenId, _isPaused);
    }

    function increaseCurrentSupply(uint256 _tokenId, uint256 _amount) external onlyRole(STATE_MANAGER_ROLE) {
        currentRewardSupply[_tokenId] += _amount;
    }

    function decreaseCurrentSupply(uint256 _tokenId, uint256 _amount) external onlyRole(STATE_MANAGER_ROLE) {
        if (currentRewardSupply[_tokenId] >= _amount) {
            currentRewardSupply[_tokenId] -= _amount;
        }
    }

    function setUserNonce(address _user, uint256 _nonce, bool _used) external onlyRole(STATE_MANAGER_ROLE) {
        userNonces[_user][_nonce] = _used;
        if (_used) {
            emit UserNonceUsed(_user, _nonce);
        }
    }

    function incrementERC721RewardIndex(uint256 _rewardTokenId, uint256 _rewardIndex) external onlyRole(STATE_MANAGER_ROLE) {
        erc721RewardCurrentIndex[_rewardTokenId][_rewardIndex]++;
    }

    function getERC721RewardCurrentIndex(uint256 _rewardTokenId, uint256 _rewardIndex) external view returns (uint256) {
        return erc721RewardCurrentIndex[_rewardTokenId][_rewardIndex];
    }

    function getAllItemIds() external view returns (uint256[] memory) {
        return itemIds;
    }

    function getRewardToken(uint256 _tokenId) external view returns (LibItems.RewardToken memory) {
        return tokenRewards[_tokenId];
    }

    function isTokenExists(uint256 _tokenId) external view returns (bool) {
        return tokenExists[_tokenId];
    }
}
