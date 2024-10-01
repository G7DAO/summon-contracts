// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { IStaker } from "../../interfaces/IStaker.sol";


contract MiddlewareStakerNativeTokenV1 is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    IStaker public stakerContract;

    bytes32 public constant STAKER_ROLE = keccak256("STAKER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 public MINIMUM_STAKE_AMOUNT;

    struct PositionInfo {
        address user;
        uint256 poolID;
        uint256 amount;
        bool active;
        uint256 stakedAt;
        uint256 unlockAt;
    }

    mapping(uint256 => PositionInfo) public positions;
    mapping(address => uint256[]) public userPositions;

    uint256 public totalStaked;
    uint256 public totalPositions;

    event Staked(address indexed user, uint256 indexed poolID, uint256 amount, uint256 positionTokenID, address indexed staker);
    event UnstakeInitiated(address indexed user, uint256 indexed positionTokenID, address indexed staker);
    event Unstaked(address indexed user, uint256 indexed positionTokenID, uint256 amount, address indexed staker);

    error NotYourPosition(address caller);
    error TransferFailed();
    error InvalidAmount();
    error PositionInactive(uint256 positionTokenID);
    error PoolDoesNotExist(uint256 poolID);

    function initialize(address _stakerContract, address admin) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        stakerContract = IStaker(_stakerContract);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(STAKER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        MINIMUM_STAKE_AMOUNT = 1;
    }

    function setMinimumStakeAmount(uint256 newAmount) public onlyRole(STAKER_ROLE) nonReentrant whenNotPaused {
        if(MINIMUM_STAKE_AMOUNT == newAmount) revert InvalidAmount();

        if(newAmount < 1) revert InvalidAmount();

        MINIMUM_STAKE_AMOUNT = newAmount;
    }

    function stakeNative(
        uint256 poolID,
        address playerAddress
    ) external payable onlyRole(STAKER_ROLE) nonReentrant whenNotPaused  returns (uint256 positionTokenId) {
        if (msg.value < MINIMUM_STAKE_AMOUNT) revert InvalidAmount();

        uint256 totalPools = stakerContract.TotalPools();

        if (totalPools < poolID) {
            revert PoolDoesNotExist(poolID);
        }

        uint256 positionTokenID = stakerContract.stakeNative{value: msg.value}(playerAddress, poolID);

        // Retrieve pool data
        (
        /* address administrator */,
        /* uint256 tokenType */,
        /* address tokenAddress */,
        /* uint256 tokenID */,
        /* bool transferable */,
            uint256 lockupSeconds,
        /* uint256 cooldownSeconds */
        ) = stakerContract.Pools(poolID);

        positions[positionTokenID] = PositionInfo({
            user: playerAddress,
            poolID: poolID,
            amount: msg.value,
            active: true,
            stakedAt: block.timestamp,
            unlockAt: block.timestamp + lockupSeconds
        });

        userPositions[playerAddress].push(positionTokenID);

        totalStaked += msg.value;
        totalPositions++;

        emit Staked(playerAddress, poolID, msg.value, positionTokenID, msg.sender);
        return positionTokenID;
    }

    function initiateUnstake(uint256 positionTokenID, address playerAddress) external onlyRole(STAKER_ROLE) nonReentrant whenNotPaused {
        PositionInfo storage position = positions[positionTokenID];
        if (position.user != playerAddress) revert NotYourPosition(playerAddress);
        if (!position.active) revert PositionInactive(positionTokenID);

        stakerContract.initiateUnstake(positionTokenID);

        emit UnstakeInitiated(playerAddress, positionTokenID, msg.sender);
    }

    function unstake(uint256 positionTokenID, address playerAddress) external onlyRole(STAKER_ROLE) nonReentrant whenNotPaused {
        PositionInfo storage position = positions[positionTokenID];
        if (position.user != playerAddress) revert NotYourPosition(playerAddress);
        if (!position.active) revert PositionInactive(positionTokenID);

        stakerContract.unstake(positionTokenID);

        (bool success, ) = msg.sender.call{value: position.amount}("");
        if (!success) revert TransferFailed();

        position.active = false;

        totalStaked -= position.amount;
        totalPositions--;

        emit Unstaked(playerAddress, positionTokenID, position.amount, msg.sender);
    }

    function getUserPositions(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    receive() external payable {}

    uint256[45] private __gap;
}