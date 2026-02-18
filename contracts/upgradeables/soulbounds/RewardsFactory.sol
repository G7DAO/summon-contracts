// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// @author Summon.xyz Team - https://summon.xyz

import { UpgradeableBeacon } from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import { BeaconProxy } from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

import { RewardsServer } from "./RewardsServer.sol";

/**
 * @title RewardsFactory
 * @notice Deploys per-server RewardsServer, registers with RewardsManager.
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

    UpgradeableBeacon public treasuryBeacon;

    event BeaconsSet(address treasuryBeacon);
    event ServerDeployed(bytes32 indexed serverId, address indexed serverAdmin);

    constructor(address _manager) {
        if (_manager == address(0)) revert AddressIsZero();
        manager = _manager;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function setBeacons(address _treasuryBeacon) external onlyOwner {
        if (_treasuryBeacon == address(0)) revert AddressIsZero();
        if (address(treasuryBeacon) != address(0)) revert BeaconsAlreadySet();
        treasuryBeacon = UpgradeableBeacon(_treasuryBeacon);
        emit BeaconsSet(_treasuryBeacon);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert AddressIsZero();
        owner = newOwner;
    }

    /**
     * @dev Deploy a new server: RewardsServer proxy. Register with manager. Caller = server admin.
     */
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
