// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// @author Summon.xyz Team - https://summon.xyz
// @contributors: [ @ogarciarevett, @karacurt]

import {
    AccessControlUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {
    PausableUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { UpgradeableBeacon } from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import { BeaconProxy } from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

import { LibItems } from "../../libraries/LibItems.sol";
import { RewardsServer } from "./RewardsServer.sol";

/**
 * @title RewardsRouter
 * @notice Multitenant rewards router: per-tenant RewardsServer; permissionless claim via server signature.
 *         No AccessToken: users claim rewards directly with a signed message.
 */
contract RewardsRouter is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{

    /*//////////////////////////////////////////////////////////////
                               ERRORS
    //////////////////////////////////////////////////////////////*/
    error AddressIsZero();
    error ServerAlreadyExists();
    error ServerDoesNotExist();
    error InvalidServerId();
    error BeaconNotInitialized();
    error BeaconsAlreadyInitialized();
    
    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");


    /*//////////////////////////////////////////////////////////////
                               STATE
    //////////////////////////////////////////////////////////////*/

    // Per-server registry (one router has many servers). serverId is a small uint8.
    mapping(uint8 => address) private servers;

    // Beacons (single implementation per type, upgradeable for all servers)
    address public serverBeacon;

    uint256[44] private __gap;

    /*//////////////////////////////////////////////////////////////
                               EVENTS
    //////////////////////////////////////////////////////////////*/

    event ServerDeployed(uint8 indexed serverId, address treasury);

    /*//////////////////////////////////////////////////////////////
                               INITIALIZER
    //////////////////////////////////////////////////////////////*/

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes roles (dev, router, upgrader). Called once by the proxy.
    /// @param _devWallet Receives DEFAULT_ADMIN_ROLE, DEV_CONFIG_ROLE, UPGRADER_ROLE.
    /// @param _routerWallet Receives MANAGER_ROLE.
    /// @dev _devWallet is a single point of failure: compromise allows router (and beacon) upgrades. Recommend using a multisig (e.g. Gnosis Safe) and timelock for UPGRADER_ROLE actions. See README Security / Operations.
    function initialize(
        address _devWallet,
        address _routerWallet
    ) external initializer {
        if (
            _devWallet == address(0) ||
            _routerWallet == address(0)
        ) {
            revert AddressIsZero();
        }

        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _devWallet);
        _grantRole(DEV_CONFIG_ROLE, _devWallet);
        _grantRole(UPGRADER_ROLE, _devWallet);
        _grantRole(MANAGER_ROLE, _routerWallet);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}

    /*//////////////////////////////////////////////////////////////
                           PAUSE
    //////////////////////////////////////////////////////////////*/

    /// @notice Pauses all claims. Only MANAGER_ROLE.
    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    /// @notice Unpauses claims. Only MANAGER_ROLE.
    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    /*//////////////////////////////////////////////////////////////
                         BEACON CONFIGURATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Sets the RewardsServer implementation beacon. Callable once by DEV_CONFIG_ROLE.
    /// @param _serverImplementation Implementation contract for RewardsServer (BeaconProxy targets this).
    function initializeBeacons(address _serverImplementation) external onlyRole(DEV_CONFIG_ROLE) {
        if (address(_serverImplementation) == address(0)) {
            revert AddressIsZero();
        }
        if (serverBeacon != address(0)) {
            revert BeaconsAlreadyInitialized();
        }

        serverBeacon = address(new UpgradeableBeacon(
            _serverImplementation,
            address(this)
        ));
    }

    /// @notice Deploys and registers a new RewardsServer treasury for the given serverId. Only MANAGER_ROLE.
    /// @dev Caller becomes SERVER_ADMIN_ROLE on the new server.
    /// @param serverId Unique server identifier (small uint8).
    function deployServer(uint8 serverId, address serverAdmin) external nonReentrant onlyRole(MANAGER_ROLE) returns (address server) {
        if (serverId == 0) revert InvalidServerId();
        if (servers[serverId] != address(0)) revert ServerAlreadyExists();
        if (serverBeacon == address(0)) revert BeaconNotInitialized();

        bytes memory initData = abi.encodeWithSelector(
            RewardsServer.initialize.selector,
            serverAdmin,
            serverId
        );

        server = address(new BeaconProxy(serverBeacon, initData));

        servers[serverId] = server;
        emit ServerDeployed(serverId, server);
    }

    /// @notice Permissionless claim: anyone may submit; rewards are sent to the beneficiary in the signed data.
    /// @dev Caller may be beneficiary or a relayer. Signature is burned (replay protection).
    /// @param data ABI-encoded (contractAddress, chainId, beneficiary, userNonce, serverId, tokenIds).
    /// @param signature Server signer signature over the claim message.
    function claim(
        uint8 serverId,
        bytes calldata data,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        RewardsServer server = getServer(serverId);
        server.claim(data, signature);
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW HELPERS (PER TENANT)
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns full treasury balance view for the server (addresses, total/reserved/available, symbols, names, types, tokenIds).
    function getServerTreasuryBalances(
        uint8 serverId
    )
        external
        view
        returns (
            address[] memory addresses,
            uint256[] memory totalBalances,
            uint256[] memory reservedBalances,
            uint256[] memory availableBalances,
            string[] memory symbols,
            string[] memory names,
            string[] memory types_,
            uint256[] memory tokenIds
        )
    {
        RewardsServer server = getServer(serverId);
        return server.getAllTreasuryBalances();
    }

    /// @notice Returns all reward token ids (item ids) for the server.
    function getServerAllItemIds(uint8 serverId) external view returns (uint256[] memory) {
        RewardsServer server = getServer(serverId);
        return server.getAllItemIds();
    }

    /// @notice Returns reward definitions for a reward token on the server.
    function getServerTokenRewards(
        uint8 serverId,
        uint256 tokenId
    ) external view returns (LibItems.Reward[] memory) {
        RewardsServer server = getServer(serverId);
        return server.getTokenRewards(tokenId);
    }

    /// @notice Returns server treasury ERC20 balance for token.
    function getServerTreasuryBalance(
        uint8 serverId,
        address token
    ) external view returns (uint256) {
        RewardsServer server = getServer(serverId);
        return server.getTreasuryBalance(token);
    }

    /// @notice Returns reserved amount for token on the server.
    function getServerReservedAmount(
        uint8 serverId,
        address token
    ) external view returns (uint256) {
        RewardsServer server = getServer(serverId);
        return server.getReservedAmount(token);
    }

    /// @notice Returns unreserved (available) treasury balance for token on the server.
    function getServerAvailableTreasuryBalance(
        uint8 serverId,
        address token
    ) external view returns (uint256) {
        RewardsServer server = getServer(serverId);
        return server.getAvailableTreasuryBalance(token);
    }

    /// @notice Returns whitelisted token addresses for the server.
    function getServerWhitelistedTokens(
        uint8 serverId
    ) external view returns (address[] memory) {
        RewardsServer server = getServer(serverId);
        return server.getWhitelistedTokens();
    }

    /// @notice Returns whether token is whitelisted on the server.
    function isServerWhitelistedToken(
        uint8 serverId,
        address token
    ) external view returns (bool) {
        RewardsServer server = getServer(serverId);
        return server.isWhitelistedToken(token);
    }

    /// @notice Returns whether the reward token exists on the server.
    function isTokenExist(uint8 serverId, uint256 tokenId) public view returns (bool) {
        RewardsServer server = getServer(serverId);
        return server.isTokenExists(tokenId);
    }

    /// @notice Returns structured reward token details (URI, maxSupply, reward types/amounts/addresses/tokenIds).
    function getTokenDetails(
        uint8 serverId,
        uint256 tokenId
    )
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
        RewardsServer server = getServer(serverId);
        return server.getTokenDetails(tokenId);
    }

    /// @notice Returns remaining claimable supply for a reward token (maxSupply - currentSupply), or 0 if exhausted/nonexistent.
    function getRemainingSupply(
        uint8 serverId,
        uint256 tokenId
    ) external view returns (uint256) {
        RewardsServer server = getServer(serverId);
        return server.getRemainingRewardSupply(tokenId);
    }

    /// @notice Returns list of all active signer addresses for the server (rewards-get-whitelist-signers).
    function getServerSigners(uint8 serverId) external view returns (address[] memory) {
        RewardsServer server = getServer(serverId);
        return server.getSigners();
    }

    /// @notice Returns the RewardsServer (treasury) address for a server.
    function getServer(uint8 serverId) public view returns (RewardsServer) {
        address serverAddress = servers[serverId];
        if (serverAddress == address(0)) revert ServerDoesNotExist();
        return RewardsServer(payable(serverAddress));
    }

    /// @notice Decodes claim data for debugging. Same encoding as used in claim(serverId, data, nonce, signature).
    function decodeClaimData(
        bytes calldata data
    ) public pure returns (address contractAddress, uint256 chainId, address beneficiary, uint256 userNonce, uint8 serverId, uint256[] memory tokenIds) {
        (contractAddress, chainId, beneficiary, userNonce, serverId, tokenIds) =
            abi.decode(data, (address, uint256, address, uint256, uint8, uint256[]));
    }

    receive() external payable {}
}

