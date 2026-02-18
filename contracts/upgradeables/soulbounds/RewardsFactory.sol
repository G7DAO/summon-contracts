// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// @author Summon.xyz Team - https://summon.xyz

import { UpgradeableBeacon } from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import { BeaconProxy } from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

import { RewardsServer } from "./RewardsServer.sol";

/**
 * @title RewardsFactory
 * @notice Deploys per-server RewardsServer (BeaconProxy) and registers each server with RewardsManager.
 * @dev Caller of deployServer becomes the server admin. Requires FACTORY_ROLE on the manager to be granted to this contract.
 */
interface IRewardsManagerFactory {
    function registerServer(bytes32 serverId, address treasury) external;
}

contract RewardsFactory {
    error AddressIsZero();
    error Unauthorized();
    error BeaconNotSet();
    error BeaconsAlreadySet();

    address public immutable manager;
    address public owner;
    address public pendingOwner;

    UpgradeableBeacon public treasuryBeacon;

    event BeaconsSet(address treasuryBeacon);
    event ServerDeployed(bytes32 indexed serverId, address indexed serverAdmin);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address _manager) {
        if (_manager == address(0)) revert AddressIsZero();
        manager = _manager;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /// @notice Sets the UpgradeableBeacon used for RewardsServer implementations. Callable only once by owner.
    /// @param _treasuryBeacon Address of the deployed RewardsServer beacon.
    function setBeacons(address _treasuryBeacon) external onlyOwner {
        if (_treasuryBeacon == address(0)) revert AddressIsZero();
        if (address(treasuryBeacon) != address(0)) revert BeaconsAlreadySet();
        treasuryBeacon = UpgradeableBeacon(_treasuryBeacon);
        emit BeaconsSet(_treasuryBeacon);
    }

    /// @notice Starts a two-step ownership transfer. New owner must call acceptOwnership.
    /// @param newOwner Address that will be able to call acceptOwnership.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert AddressIsZero();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Completes ownership transfer. Callable only by the address set via transferOwnership.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        address previousOwner = owner;
        owner = pendingOwner;
        delete pendingOwner;
        emit OwnershipTransferred(previousOwner, owner);
    }

    /// @notice Deploys a new RewardsServer (BeaconProxy) for the given server and registers it with the RewardsManager.
    /// @dev Caller becomes the server admin. Requires FACTORY_ROLE on the manager to be granted to this contract.
    /// @param serverId Unique identifier for the server (e.g. keccak256 of a string id).
    function deployServer(bytes32 serverId) external {
        if (address(treasuryBeacon) == address(0)) revert BeaconNotSet();

        address serverAdmin = msg.sender;

        bytes memory treasuryInitData = abi.encodeWithSelector(
            RewardsServer.initialize.selector,
            manager,
            manager,
            serverAdmin
        );
        address treasuryProxy = address(
            new BeaconProxy(address(treasuryBeacon), treasuryInitData)
        );

        IRewardsManagerFactory(manager).registerServer(serverId, treasuryProxy);

        emit ServerDeployed(serverId, serverAdmin);
    }
}
