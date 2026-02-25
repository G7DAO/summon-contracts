// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// @author Summon.xyz Team - https://summon.xyz
// @contributors: [ @ogarciarevett, @karacurt]

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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
import {
    MessageHashUtils
} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

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
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                               ERRORS
    //////////////////////////////////////////////////////////////*/
    error AddressIsZero();
    error ServerAlreadyExists();
    error ServerDoesNotExist();
    error InvalidServerId();
    error BeaconNotInitialized();
    error BeaconsAlreadyInitialized();
    error InvalidSignature();
    error UnauthorizedServerAdmin();
    error InsufficientBalance();
    error InvalidAmount();
    error InvalidInput();
    error NonceAlreadyUsed();
    error TokenNotExist();
    error ExceedMaxSupply();
    error MintPaused();
    error ClaimRewardPaused();
    error DupTokenId();
    error TokenNotWhitelisted();
    error InsufficientTreasuryBalance();
    error TransferFailed();
    error InvalidLength();

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/
    uint256 public constant MAX_CLAIM_TOKEN_IDS = 50;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");


    /*//////////////////////////////////////////////////////////////
                               STRUCTS
    //////////////////////////////////////////////////////////////*/

    /*//////////////////////////////////////////////////////////////
                               STATE
    //////////////////////////////////////////////////////////////*/

    // Per-server registry (one router has many servers). serverId is a small uint8.
    mapping(uint8 => address) private servers;

    // Beacons (single implementation per type, upgradeable for all servers)
    address public treasuryBeacon;

    uint256[44] private __gap;

    /*//////////////////////////////////////////////////////////////
                               EVENTS
    //////////////////////////////////////////////////////////////*/

    event ServerDeployed(uint8 indexed serverId, address treasury);

    event ServerSignerUpdated(
        uint8 indexed serverId,
        address indexed signer,
        bool isActive
    );

    event ServerAdminTransferred(
        uint8 indexed serverId,
        address indexed oldAdmin,
        address indexed newAdmin
    );

    event TokenAdded(uint8 indexed serverId, uint256 indexed tokenId);
    event Minted(
        uint8 indexed serverId,
        address indexed to,
        uint256 indexed tokenId,
        uint256 amount,
        bool soulbound
    );
    event Claimed(
        uint8 indexed serverId,
        address indexed to,
        uint256 indexed tokenId
    );
    event TokenMintPausedUpdated(
        uint8 indexed serverId,
        uint256 indexed tokenId,
        bool isPaused
    );
    event ClaimRewardPausedUpdated(
        uint8 indexed serverId,
        uint256 indexed tokenId,
        bool isPaused
    );
    event RewardSupplyChanged(
        uint8 indexed serverId,
        uint256 indexed tokenId,
        uint256 oldSupply,
        uint256 newSupply
    );
    event TokenURIChanged(
        uint8 indexed serverId,
        uint256 indexed tokenId,
        string newUri
    );
    event AssetsWithdrawn(
        uint8 indexed serverId,
        LibItems.RewardType rewardType,
        address indexed to,
        uint256 amount
    );
    event ServerRoleGranted(
        uint8 indexed serverId,
        bytes32 indexed role,
        address indexed to
    );
    event ServerRoleRevoked(
        uint8 indexed serverId,
        bytes32 indexed role,
        address indexed from
    );

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

    modifier onlyServerAdmin(uint8 serverId) {
        address server = _getServer(serverId);
        if (!RewardsServer(payable(server)).isServerAdmin(msg.sender)) revert UnauthorizedServerAdmin();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                         BEACON CONFIGURATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Sets the RewardsServer implementation beacon. Callable once by DEV_CONFIG_ROLE.
    /// @param _treasuryImplementation Implementation contract for RewardsServer (BeaconProxy targets this).
    function initializeBeacons(address _treasuryImplementation) external onlyRole(DEV_CONFIG_ROLE) {
        if (address(_treasuryImplementation) == address(0)) {
            revert AddressIsZero();
        }
        if (address(treasuryBeacon) != address(0)) {
            revert BeaconsAlreadyInitialized();
        }

        treasuryBeacon = address(new UpgradeableBeacon(
            _treasuryImplementation,
            address(this)
        ));
    }

    /*//////////////////////////////////////////////////////////////
                           SERVER MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    function _getServer(uint8 serverId) internal view returns (address treasury) {
        treasury = servers[serverId];
        if (treasury == address(0)) {
            revert ServerDoesNotExist();
        }
    }

    /// @notice Registers a new server (RewardsServer proxy) for the given serverId. Only FACTORY_ROLE (RewardsFactory).
    /// @param serverId Unique server identifier (small uint8).
    /// @param server Address of the deployed RewardsServer proxy.
    function registerServer(uint8 serverId, address server) external onlyRole(MANAGER_ROLE) {
        if (serverId == 0) revert InvalidServerId();
        if (servers[serverId] != address(0)) revert ServerAlreadyExists();
        if (server == address(0)) revert AddressIsZero();

        servers[serverId] = server;
        emit ServerDeployed(serverId, server);
    }

    /// @notice Deploys and registers a new RewardsServer treasury for the given serverId. Only FACTORY_ROLE.
    /// @dev Caller becomes SERVER_ADMIN_ROLE on the new server.
    /// @param serverId Unique server identifier (small uint8).
    function deployServer(uint8 serverId, address serverAdmin) external onlyRole(MANAGER_ROLE) returns (address server) {
        if (serverId == 0) revert InvalidServerId();
        if (servers[serverId] != address(0)) revert ServerAlreadyExists();
        if (address(treasuryBeacon) == address(0)) revert BeaconNotInitialized();

        bytes memory initData = abi.encodeWithSelector(
            RewardsServer.initialize.selector,
            address(this),
            address(this),
            serverAdmin
        );

        server = address(new BeaconProxy(address(treasuryBeacon), initData));

        servers[serverId] = server;
        emit ServerDeployed(serverId, server);
    }

    /// @notice Grants a role to an address on the server. Caller must be current SERVER_ADMIN_ROLE on the server.
    function grantServerRole(uint8 serverId, bytes32 role, address to) external onlyServerAdmin(serverId) {
        if (to == address(0)) revert AddressIsZero();
        address server = _getServer(serverId);
        RewardsServer(payable(server)).grantRole(role, to);
        emit ServerRoleGranted(serverId, role, to);
    }

    /// @notice Revokes a role from an address on the server. Caller must be current SERVER_ADMIN_ROLE on the server.
    function revokeServerRole(uint8 serverId, bytes32 role, address from) external onlyServerAdmin(serverId) {
        if (from == address(0)) revert AddressIsZero();
        address server = _getServer(serverId);
        RewardsServer(payable(server)).revokeRole(role, from);
        emit ServerRoleRevoked(serverId, role, from);
    }

    /// @notice Returns the RewardsServer (treasury) address for a server.
    function getServer(uint8 serverId) external view returns (address server) {
        return _getServer(serverId);
    }

    /*//////////////////////////////////////////////////////////////
                        PER-SERVER ACCESS CONTROL
    //////////////////////////////////////////////////////////////*/

    /// @notice Adds a claim signer for the server. Caller must be SERVER_ADMIN_ROLE on the server. For admin/DB parity.
    function addWhitelistSigner(uint8 serverId, address signer) external onlyServerAdmin(serverId) {
        address server = _getServer(serverId);
        RewardsServer(payable(server)).setSigner(signer, true);
        emit ServerSignerUpdated(serverId, signer, true);
    }

    /// @notice Removes a claim signer for the server. Caller must be SERVER_ADMIN_ROLE on the server. For admin/DB parity.
    function removeWhitelistSigner(uint8 serverId, address signer) external {
        address server = _getServer(serverId);
        RewardsServer(payable(server)).setSigner(signer, false);
        emit ServerSignerUpdated(serverId, signer, false);
    }

    /// @notice Returns whether the address is an active signer for the server.
    function isServerSigner(uint8 serverId, address signer) external view returns (bool) {
        address server = _getServer(serverId);
        return RewardsServer(payable(server)).isSigner(signer);
    }

    /// @notice Returns list of all active signer addresses for the server (rewards-get-whitelist-signers).
    function getServerSigners(uint8 serverId) external view returns (address[] memory) {
        address server = _getServer(serverId);
        return RewardsServer(payable(server)).getSigners();
    }

    /*//////////////////////////////////////////////////////////////
                          SIGNATURE VERIFICATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Internal helper to verify a tenant-scoped signature.
     *
     * Message format (hashed then wrapped in EIP-191 prefix):
     * keccak256(abi.encodePacked(contractAddress, chainId, serverId, beneficiary, expiration, tokenIds, nonce))
     */
    function _verifyServerSignature(
        uint8 serverId,
        address beneficiary,
        uint256 expiration,
        uint256[] memory tokenIds,
        uint256 nonce,
        bytes calldata signature
    ) internal view returns (address) {
        uint256 currentChainId = block.chainid;
        bytes32 message = keccak256(
            abi.encode(
                address(this),
                currentChainId,
                serverId,
                beneficiary,
                expiration,
                tokenIds,
                nonce
            )
        );
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(message);
        address signer = ECDSA.recover(hash, signature);

        address server = _getServer(serverId);
        if (!RewardsServer(payable(server)).isSigner(signer)) {
            revert InvalidSignature();
        }

        if (block.timestamp >= expiration) {
            revert InvalidSignature();
        }

        return signer;
    }

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
                    TREASURY MANAGEMENT (PER TENANT)
    //////////////////////////////////////////////////////////////*/

    /// @notice Adds a token to the server whitelist. Caller must be SERVER_ADMIN_ROLE on the server.
    function whitelistToken(
        uint8 serverId,
        address token,
        LibItems.RewardType rewardType
    ) external onlyServerAdmin(serverId) {
        address server = _getServer(serverId);
        RewardsServer serverContract = RewardsServer(payable(server));
        serverContract.whitelistToken(token, rewardType);
    }

    /// @notice Removes a token from the server whitelist (fails if token has reserves). Caller must be SERVER_ADMIN_ROLE on the server.
    function removeTokenFromWhitelist(
        uint8 serverId,
        address token
    ) external onlyServerAdmin(serverId) {
        address server = _getServer(serverId);
        RewardsServer serverContract = RewardsServer(payable(server));
        serverContract.removeTokenFromWhitelist(token);
    }

    /// @notice Deposits ERC20 from msg.sender into the server treasury. Token must be whitelisted. Reentrancy-protected.
    function depositToTreasury(
        uint8 serverId,
        address token,
        uint256 amount
    ) external nonReentrant {
        address server = _getServer(serverId);
        RewardsServer(payable(server)).depositToTreasury(token, amount, msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
              REWARD TOKEN CREATION AND SUPPLY (PER TENANT)
    //////////////////////////////////////////////////////////////*/

    /// @notice Creates a new reward token on the server and reserves/deposits rewards. Send ETH if token has ETHER rewards (forwarded to server). Caller must be SERVER_ADMIN_ROLE on the server.
    /// @param serverId Server id.
    /// @param token Reward token definition (tokenId, maxSupply, rewards, tokenUri). ERC721 rewards require exact rewardTokenIds length = rewardAmount * maxSupply.
    function createTokenAndDepositRewards(
        uint8 serverId,
        LibItems.RewardToken calldata token
    ) external payable nonReentrant onlyServerAdmin(serverId) {
        address server = _getServer(serverId);
        RewardsServer serverContract = RewardsServer(payable(server));
        serverContract.createTokenAndReserveRewards{ value: msg.value }(token);
        emit TokenAdded(serverId, token.tokenId);
    }

    /// @notice Pauses or unpauses minting for a reward token. Caller must be SERVER_ADMIN_ROLE on the server.
    function updateTokenMintPaused(
        uint8 serverId,
        uint256 tokenId,
        bool isPaused
    ) external onlyServerAdmin(serverId) {
        address server = _getServer(serverId);
        RewardsServer serverContract = RewardsServer(payable(server));
        serverContract.setTokenMintPaused(tokenId, isPaused);
        emit TokenMintPausedUpdated(serverId, tokenId, isPaused);
    }

    /// @notice Pauses or unpauses claiming for a reward token. Caller must be SERVER_ADMIN_ROLE on the server.
    function updateClaimRewardPaused(
        uint8 serverId,
        uint256 tokenId,
        bool isPaused
    ) external onlyServerAdmin(serverId) {
        address server = _getServer(serverId);
        RewardsServer serverContract = RewardsServer(payable(server));
        serverContract.setClaimRewardPaused(tokenId, isPaused);
        emit ClaimRewardPausedUpdated(serverId, tokenId, isPaused);
    }

    /// @notice Increases max supply for a reward token; reserves additional ERC20/ERC1155/ETH on server. Caller must be SERVER_ADMIN_ROLE on the server. Send ETH if token has ETHER rewards (forwarded to server).
    /// @param serverId Server id.
    /// @param tokenId Reward token id.
    /// @param additionalSupply Amount to add. Not supported for ERC721-backed rewards (create a new token instead).
    function increaseRewardSupply(
        uint8 serverId,
        uint256 tokenId,
        uint256 additionalSupply
    ) external payable onlyServerAdmin(serverId) {
        address server = _getServer(serverId);
        RewardsServer serverContract = RewardsServer(payable(server));
        if (!serverContract.isTokenExists(tokenId)) revert TokenNotExist();
        if (additionalSupply == 0) revert InvalidAmount();
        uint256 oldSupply = serverContract.getRewardToken(tokenId).maxSupply;
        serverContract.increaseRewardSupply{ value: msg.value }(tokenId, additionalSupply);
        emit RewardSupplyChanged(serverId, tokenId, oldSupply, oldSupply + additionalSupply);
    }

    /// @notice Reduces max supply of a reward token on the server. Caller must be SERVER_ADMIN_ROLE on the server. For admin/DB parity.
    function reduceRewardSupply(
        uint8 serverId,
        uint256 tokenId,
        uint256 reduceBy
    ) external onlyServerAdmin(serverId) {
        address server = _getServer(serverId);
        RewardsServer serverContract = RewardsServer(payable(server));
        uint256 oldSupply = serverContract.getRewardToken(tokenId).maxSupply;
        serverContract.reduceRewardSupply(tokenId, reduceBy);
        emit RewardSupplyChanged(serverId, tokenId, oldSupply, oldSupply - reduceBy);
    }

    /// @notice Decodes claim data for debugging. Same encoding as used in claim(serverId, data, nonce, signature).
    function decodeClaimData(
        bytes calldata data
    ) public pure returns (address contractAddress, uint256 chainId, address beneficiary, uint256 expiration, uint256[] memory tokenIds) {
        (contractAddress, chainId, beneficiary, expiration, tokenIds) =
            abi.decode(data, (address, uint256, address, uint256, uint256[]));
    }

    /// @notice Permissionless claim: anyone may submit; rewards are sent to the beneficiary in the signed data.
    /// @dev Caller may be beneficiary or a relayer. Signature is burned (replay protection). tokenIds length capped by MAX_CLAIM_TOKEN_IDS.
    /// @param serverId Server id.
    /// @param data ABI-encoded (contractAddress, chainId, beneficiary, expiration, tokenIds).
    /// @param nonce User nonce (must not be used before).
    /// @param signature Server signer signature over the claim message.
    function claim(
        uint8 serverId,
        bytes calldata data,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        (
            address contractAddress,
            uint256 chainId,
            address beneficiary,
            uint256 expiration,
            uint256[] memory tokenIds
        ) = decodeClaimData(data);

        if (contractAddress != address(this) || chainId != block.chainid) revert InvalidInput();
        if (tokenIds.length > MAX_CLAIM_TOKEN_IDS) revert InvalidInput();

        address server = _getServer(serverId);
        RewardsServer serverContract = RewardsServer(payable(server));
        if (serverContract.userNonces(beneficiary, nonce)) revert NonceAlreadyUsed();

        _verifyServerSignature(serverId, beneficiary, expiration, tokenIds, nonce, signature);
        serverContract.setUserNonce(beneficiary, nonce, true);

        for (uint256 i = 0; i < tokenIds.length; i++) {
            serverContract.claimReward(beneficiary, tokenIds[i]);
            emit Claimed(serverId, beneficiary, tokenIds[i]);
        }
    }

    /// @notice Withdraws assets from server treasury to recipient. Caller must be SERVER_ADMIN_ROLE on the server. ETHER: amounts[0]; ERC721: tokenIds; ERC1155: tokenIds + amounts.
    function withdrawAssets(
        uint8 serverId,
        LibItems.RewardType rewardType,
        address to,
        address tokenAddress,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external onlyServerAdmin(serverId) {
        if (to == address(0)) revert AddressIsZero();
        address server = _getServer(serverId);
        RewardsServer serverContract = RewardsServer(payable(server));

        if (rewardType == LibItems.RewardType.ETHER) {
            if (amounts.length == 0) revert InvalidInput();
            serverContract.withdrawEtherUnreservedTreasury(to, amounts[0]);
        } else if (rewardType == LibItems.RewardType.ERC20) {
            serverContract.withdrawUnreservedTreasury(tokenAddress, to);
        } else if (rewardType == LibItems.RewardType.ERC721) {
            for (uint256 i = 0; i < tokenIds.length; i++) {
                serverContract.withdrawERC721UnreservedTreasury(tokenAddress, to, tokenIds[i]);
            }
        } else if (rewardType == LibItems.RewardType.ERC1155) {
            if (tokenIds.length != amounts.length) revert InvalidLength();
            for (uint256 i = 0; i < tokenIds.length; i++) {
                serverContract.withdrawERC1155UnreservedTreasury(tokenAddress, to, tokenIds[i], amounts[i]);
            }
        }
        uint256 emittedAmount = rewardType == LibItems.RewardType.ERC721
            ? tokenIds.length
            : (amounts.length > 0 ? amounts[0] : 0);
        emit AssetsWithdrawn(serverId, rewardType, to, emittedAmount);
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
        address server = _getServer(serverId);
        return RewardsServer(payable(server)).getAllTreasuryBalances();
    }

    /// @notice Returns all reward token ids (item ids) for the server.
    function getServerAllItemIds(uint8 serverId) external view returns (uint256[] memory) {
        address server = _getServer(serverId);
        return RewardsServer(payable(server)).getAllItemIds();
    }

    /// @notice Returns reward definitions for a reward token on the server.
    function getServerTokenRewards(
        uint8 serverId,
        uint256 tokenId
    ) external view returns (LibItems.Reward[] memory) {
        address server = _getServer(serverId);
        return RewardsServer(payable(server)).getTokenRewards(tokenId);
    }

    /// @notice Returns server treasury ERC20 balance for token.
    function getServerTreasuryBalance(
        uint8 serverId,
        address token
    ) external view returns (uint256) {
        address server = _getServer(serverId);
        return RewardsServer(payable(server)).getTreasuryBalance(token);
    }

    /// @notice Returns reserved amount for token on the server.
    function getServerReservedAmount(
        uint8 serverId,
        address token
    ) external view returns (uint256) {
        address server = _getServer(serverId);
        return RewardsServer(payable(server)).getReservedAmount(token);
    }

    /// @notice Returns unreserved (available) treasury balance for token on the server.
    function getServerAvailableTreasuryBalance(
        uint8 serverId,
        address token
    ) external view returns (uint256) {
        address server = _getServer(serverId);
        return RewardsServer(payable(server)).getAvailableTreasuryBalance(token);
    }

    /// @notice Returns whitelisted token addresses for the server.
    function getServerWhitelistedTokens(
        uint8 serverId
    ) external view returns (address[] memory) {
        address server = _getServer(serverId);
        return RewardsServer(payable(server)).getWhitelistedTokens();
    }

    /// @notice Returns whether token is whitelisted on the server.
    function isServerWhitelistedToken(
        uint8 serverId,
        address token
    ) external view returns (bool) {
        address server = _getServer(serverId);
        return RewardsServer(payable(server)).isWhitelistedToken(token);
    }

    /// @notice Returns whether the reward token exists on the server.
    function isTokenExist(uint8 serverId, uint256 tokenId) public view returns (bool) {
        address server = _getServer(serverId);
        return RewardsServer(payable(server)).isTokenExists(tokenId);
    }

    /// @notice Returns whether minting is paused for the reward token on the server.
    function isTokenMintPaused(uint8 serverId, uint256 tokenId) external view returns (bool) {
        address server = _getServer(serverId);
        return RewardsServer(payable(server)).isTokenMintPaused(tokenId);
    }

    /// @notice Returns whether claiming is paused for the reward token on the server.
    function isClaimRewardPaused(uint8 serverId, uint256 tokenId) external view returns (bool) {
        address server = _getServer(serverId);
        return RewardsServer(payable(server)).isClaimRewardPaused(tokenId);
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
        address server = _getServer(serverId);
        return RewardsServer(payable(server)).getTokenDetails(tokenId);
    }

    /// @notice Returns remaining claimable supply for a reward token (maxSupply - currentSupply), or 0 if exhausted/nonexistent.
    function getRemainingSupply(
        uint8 serverId,
        uint256 tokenId
    ) external view returns (uint256) {
        address server = _getServer(serverId);
        RewardsServer serverContract = RewardsServer(payable(server));
        if (!serverContract.isTokenExists(tokenId)) return 0;
        uint256 maxSupply = serverContract.getRewardToken(tokenId).maxSupply;
        uint256 current = serverContract.currentRewardSupply(tokenId);
        if (current >= maxSupply) return 0;
        return maxSupply - current;
    }

    /// @notice Returns whether the user has already used the given nonce (replay protection).
    function isNonceUsed(
        uint8 serverId,
        address user,
        uint256 nonce
    ) external view returns (bool) {
        address server = _getServer(serverId);
        return RewardsServer(payable(server)).userNonces(user, nonce);
    }

    receive() external payable {}
}

