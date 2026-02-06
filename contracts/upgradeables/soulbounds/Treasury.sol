// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// @author Summon.xyz Team - https://summon.xyz
// @contributors: [ @ogarciarevett, @karacurt]

import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Metadata } from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { ERC721HolderUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import { ERC1155HolderUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import { LibItems } from "../../libraries/LibItems.sol";
import { RewardsState } from "./RewardsState.sol";

interface IRewards {
    function getAllItemIds() external view returns (uint256[] memory);
    function getTokenRewards(uint256 tokenId) external view returns (LibItems.Reward[] memory);
}

interface IERC1155Metadata {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
}

/**
 * @title Treasury
 * @notice Treasury contract for managing token deposits, withdrawals, and whitelisting
 * @dev This contract handles treasury business logic and delegates state management
 *      to RewardsState contract. Only the Rewards contract can call management functions.
 *      This contract is upgradeable using the UUPS pattern.
 */
contract Treasury is Initializable, AccessControlUpgradeable, UUPSUpgradeable, ERC721HolderUpgradeable, ERC1155HolderUpgradeable {

    /*//////////////////////////////////////////////////////////////
                               ERRORS
    //////////////////////////////////////////////////////////////*/
    error AddressIsZero();
    error InvalidAmount();
    error TokenNotWhitelisted();
    error InsufficientTreasuryBalance();
    error TokenHasReserves();
    error InsufficientBalance();

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/
    bytes32 public constant REWARDS_MANAGER_ROLE = keccak256("REWARDS_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /*//////////////////////////////////////////////////////////////
                           STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    RewardsState public rewardsState;

    uint256[50] private __gap;

    /*//////////////////////////////////////////////////////////////
                               EVENTS
    //////////////////////////////////////////////////////////////*/
    event TreasuryDeposit(address indexed token, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                             INITIALIZER
    //////////////////////////////////////////////////////////////*/
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _admin, address _rewardsContract, address _rewardsState) external initializer {
        if (_admin == address(0) || _rewardsContract == address(0) || _rewardsState == address(0)) {
            revert AddressIsZero();
        }

        __AccessControl_init();
        __ERC721Holder_init();
        __ERC1155Holder_init();

        rewardsState = RewardsState(_rewardsState);
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
        _grantRole(REWARDS_MANAGER_ROLE, _rewardsContract);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    /*//////////////////////////////////////////////////////////////
                      TREASURY MANAGEMENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function whitelistToken(address _token, LibItems.RewardType _type) external onlyRole(REWARDS_MANAGER_ROLE) {
        rewardsState.whitelistToken(_token, _type);
    }

    function removeTokenFromWhitelist(address _token) external onlyRole(REWARDS_MANAGER_ROLE) {
        LibItems.RewardType _type = rewardsState.tokenTypes(_token);

        if (_type == LibItems.RewardType.ERC20 && rewardsState.reservedAmounts(_token) > 0) revert TokenHasReserves();
        if (_type == LibItems.RewardType.ERC721 && rewardsState.erc721TotalReserved(_token) > 0) revert TokenHasReserves();
        if (_type == LibItems.RewardType.ERC1155 && rewardsState.erc1155TotalReserved(_token) > 0) revert TokenHasReserves();

        rewardsState.removeTokenFromWhitelist(_token);
    }

    function depositToTreasury(address _token, uint256 _amount, address _from) external onlyRole(REWARDS_MANAGER_ROLE) {
        if (!rewardsState.whitelistedTokens(_token)) revert TokenNotWhitelisted();
        if (_amount == 0) revert InvalidAmount();

        SafeERC20.safeTransferFrom(IERC20(_token), _from, address(this), _amount);
        emit TreasuryDeposit(_token, _amount);
    }

    function withdrawUnreservedTreasury(address _token, address _to) external onlyRole(REWARDS_MANAGER_ROLE) {
        if (_to == address(0)) revert AddressIsZero();
        if (!rewardsState.whitelistedTokens(_token)) revert TokenNotWhitelisted();

        uint256 balance = IERC20(_token).balanceOf(address(this));
        uint256 reserved = rewardsState.reservedAmounts(_token);

        if (balance <= reserved) revert InsufficientBalance();

        SafeERC20.safeTransfer(IERC20(_token), _to, balance - reserved);
    }

    function withdrawERC721UnreservedTreasury(address _token, address _to, uint256 _tokenId) external onlyRole(REWARDS_MANAGER_ROLE) {
        if (_to == address(0)) revert AddressIsZero();
        if (!rewardsState.whitelistedTokens(_token)) revert TokenNotWhitelisted();
        if (rewardsState.isErc721Reserved(_token, _tokenId)) revert InsufficientTreasuryBalance();

        IERC721(_token).safeTransferFrom(address(this), _to, _tokenId);
    }

    function withdrawERC1155UnreservedTreasury(address _token, address _to, uint256 _tokenId, uint256 _amount) external onlyRole(REWARDS_MANAGER_ROLE) {
        if (_to == address(0)) revert AddressIsZero();
        if (!rewardsState.whitelistedTokens(_token)) revert TokenNotWhitelisted();

        uint256 balance = IERC1155(_token).balanceOf(address(this), _tokenId);
        uint256 reserved = rewardsState.erc1155ReservedAmounts(_token, _tokenId);

        if (balance <= reserved) revert InsufficientBalance();
        if (_amount > (balance - reserved)) revert InsufficientBalance();

        IERC1155(_token).safeTransferFrom(address(this), _to, _tokenId, _amount, "");
    }

    /*//////////////////////////////////////////////////////////////
                      DISTRIBUTION FUNCTIONS (for claims)
    //////////////////////////////////////////////////////////////*/

    function distributeERC20(address _token, address _to, uint256 _amount) external onlyRole(REWARDS_MANAGER_ROLE) {
        SafeERC20.safeTransfer(IERC20(_token), _to, _amount);
    }

    function distributeERC721(address _token, address _to, uint256 _tokenId) external onlyRole(REWARDS_MANAGER_ROLE) {
        IERC721(_token).safeTransferFrom(address(this), _to, _tokenId);
    }

    function distributeERC1155(address _token, address _to, uint256 _tokenId, uint256 _amount) external onlyRole(REWARDS_MANAGER_ROLE) {
        IERC1155(_token).safeTransferFrom(address(this), _to, _tokenId, _amount, "");
    }

    /*//////////////////////////////////////////////////////////////
                         TREASURY VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getAllTreasuryBalances(address rewardsContract)
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
        address[] memory whitelistedTokensArray = rewardsState.getWhitelistedTokens();

        uint256 erc20AndErc721Count = 0;
        for (uint256 i = 0; i < whitelistedTokensArray.length; i++) {
            LibItems.RewardType tokenType = rewardsState.tokenTypes(whitelistedTokensArray[i]);
            if (tokenType == LibItems.RewardType.ERC20 || tokenType == LibItems.RewardType.ERC721) {
                erc20AndErc721Count++;
            }
        }

        uint256 erc1155Count = _countUniqueErc1155TokenIds(rewardsContract);
        uint256 totalCount = erc20AndErc721Count + erc1155Count;

        addresses = new address[](totalCount);
        totalBalances = new uint256[](totalCount);
        reservedBalances = new uint256[](totalCount);
        availableBalances = new uint256[](totalCount);
        symbols = new string[](totalCount);
        names = new string[](totalCount);
        types = new string[](totalCount);

        uint256 currentIndex = 0;

        for (uint256 i = 0; i < whitelistedTokensArray.length; i++) {
            address tokenAddress = whitelistedTokensArray[i];
            LibItems.RewardType tokenType = rewardsState.tokenTypes(tokenAddress);

            addresses[currentIndex] = tokenAddress;

            if (tokenType == LibItems.RewardType.ERC20) {
                _processERC20Token(rewardsContract, tokenAddress, currentIndex, totalBalances, reservedBalances, availableBalances, symbols, names, types);
                currentIndex++;
            } else if (tokenType == LibItems.RewardType.ERC721) {
                _processERC721Token(rewardsContract, tokenAddress, currentIndex, totalBalances, reservedBalances, availableBalances, symbols, names, types);
                currentIndex++;
            }
        }

        currentIndex = _processERC1155Tokens(rewardsContract, erc1155Count, currentIndex, addresses, totalBalances, reservedBalances, availableBalances, symbols, names, types);

        return (addresses, totalBalances, reservedBalances, availableBalances, symbols, names, types);
    }

    function getTreasuryBalance(address, address _token) external view returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }

    function getReservedAmount(address, address _token) external view returns (uint256) {
        return rewardsState.reservedAmounts(_token);
    }

    function getAvailableTreasuryBalance(address, address _token) external view returns (uint256) {
        uint256 balance = IERC20(_token).balanceOf(address(this));
        uint256 reserved = rewardsState.reservedAmounts(_token);
        return balance > reserved ? balance - reserved : 0;
    }

    function getWhitelistedTokens(address) external view returns (address[] memory) {
        return rewardsState.getWhitelistedTokens();
    }

    function isWhitelistedToken(address, address _token) external view returns (bool) {
        return rewardsState.whitelistedTokens(_token);
    }

    /*//////////////////////////////////////////////////////////////
                         INTERNAL HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _processERC20Token(
        address,
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
        uint256 reserved = rewardsState.reservedAmounts(tokenAddress);

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
        address,
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
        uint256 reserved = rewardsState.erc721TotalReserved(tokenAddress);

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
        address rewardsContract,
        uint256 erc1155Count,
        uint256 startIndex,
        address[] memory addresses,
        uint256[] memory totalBalances,
        uint256[] memory reservedBalances,
        uint256[] memory availableBalances,
        string[] memory symbols,
        string[] memory names,
        string[] memory types
    ) private view returns (uint256) {
        IRewards rewards = IRewards(rewardsContract);
        uint256[] memory itemIds = rewards.getAllItemIds();

        address[] memory processedErc1155Addresses = new address[](erc1155Count);
        uint256[] memory processedErc1155TokenIds = new uint256[](erc1155Count);
        uint256 processedCount = 0;
        uint256 currentIndex = startIndex;

        for (uint256 i = 0; i < itemIds.length; i++) {
            LibItems.Reward[] memory tokenRewards = rewards.getTokenRewards(itemIds[i]);

            for (uint256 j = 0; j < tokenRewards.length; j++) {
                LibItems.Reward memory reward = tokenRewards[j];

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

                    uint256 balance = IERC1155(erc1155Address).balanceOf(address(this), erc1155TokenId);
                    uint256 reserved = rewardsState.erc1155ReservedAmounts(erc1155Address, erc1155TokenId);

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

    function _countUniqueErc1155TokenIds(address rewardsContract) private view returns (uint256) {
        IRewards rewards = IRewards(rewardsContract);
        uint256[] memory itemIds = rewards.getAllItemIds();

        address[] memory uniqueAddresses = new address[](itemIds.length * 10);
        uint256[] memory uniqueTokenIds = new uint256[](itemIds.length * 10);
        uint256 count = 0;

        for (uint256 i = 0; i < itemIds.length; i++) {
            LibItems.Reward[] memory tokenRewards = rewards.getTokenRewards(itemIds[i]);

            for (uint256 j = 0; j < tokenRewards.length; j++) {
                if (tokenRewards[j].rewardType == LibItems.RewardType.ERC1155) {
                    address erc1155Address = tokenRewards[j].rewardTokenAddress;
                    uint256 erc1155TokenId = tokenRewards[j].rewardTokenId;

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
