// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

interface IStaker {
    function NATIVE_TOKEN_TYPE() external view returns (uint256);
    function stakeNative(uint256 poolID) external payable returns (uint256 positionTokenID);
    function initiateUnstake(uint256 positionTokenID) external;
    function unstake(uint256 positionTokenID) external;
}

contract MiddlewareStaker is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable {
    IStaker public stakerContract;
    uint256 public constant NATIVE_TOKEN_TYPE = 1;

    bytes32 public constant STAKER_ROLE = keccak256("STAKER_ROLE");

    struct PositionInfo {
        address user;
        uint256 poolID;
        uint256 amount;
    }

    // Map positionTokenID to PositionInfo
    mapping(uint256 => PositionInfo) public positions;

    // Map user address to array of position IDs
    mapping(address => uint256[]) public userPositions;

    // Custom errors
    error NotYourPosition(address caller);
    error TransferFailed();
    error InvalidAmount();

    // Upgradeable contracts cannot have constructors. Use an initializer instead.
    function initialize(address _stakerContract, address admin) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        stakerContract = IStaker(_stakerContract);
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(STAKER_ROLE, admin);
    }

    // Function to stake native tokens
    function stakeNative(uint256 poolID, address playerAddress) external payable onlyRole(STAKER_ROLE) nonReentrant {
        if (msg.value == 0) revert InvalidAmount();

        // Stake the native tokens in the Staker contract
        uint256 positionTokenID = stakerContract.stakeNative{value: msg.value}(poolID);

        // Store position info
        positions[positionTokenID] = PositionInfo({
            user: playerAddress,
            poolID: poolID,
            amount: msg.value
        });

        // Keep track of user's positions
        userPositions[playerAddress].push(positionTokenID);
    }

    // Function to initiate unstake
    function initiateUnstake(uint256 positionTokenID, address playerAddress) external onlyRole(STAKER_ROLE) nonReentrant {
        PositionInfo storage position = positions[positionTokenID];
        if (position.user != playerAddress) revert NotYourPosition(msg.sender);

        stakerContract.initiateUnstake(positionTokenID);
    }

    // Function to unstake
    function unstake(uint256 positionTokenID, address playerAddress) external onlyRole(STAKER_ROLE) nonReentrant {
        PositionInfo storage position = positions[positionTokenID];
        if (position.user != playerAddress) revert NotYourPosition(msg.sender);

        stakerContract.unstake(positionTokenID);

        // Transfer the unstaked native tokens back to the STAKER_ROLE address
        (bool success, ) = msg.sender.call{value: position.amount}("");
        if (!success) revert TransferFailed();

        // Remove position from user's positions
        _removeUserPosition(playerAddress, positionTokenID);
        delete positions[positionTokenID];
    }

    // Helper function to remove position from user's positions
    function _removeUserPosition(address user, uint256 positionTokenID) internal {
        uint256[] storage positionsArray = userPositions[user];
        uint256 length = positionsArray.length;
        for (uint256 i = 0; i < length; i++) {
            if (positionsArray[i] == positionTokenID) {
                positionsArray[i] = positionsArray[length - 1];
                positionsArray.pop();
                break;
            }
        }
    }

    // Allow the contract to receive Ether
    receive() external payable {}
}
