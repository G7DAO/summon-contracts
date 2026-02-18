// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// @author Summon.xyz Team - https://summon.xyz
// @contributors: [ @ogarciarevett, @karacurt]

import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
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
import {
    MessageHashUtils
} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { LibItems } from "../../libraries/LibItems.sol";
import { RewardsServer } from "./RewardsServer.sol";

/**
 * @title RewardsManager
 * @notice Multitenant rewards manager: per-tenant RewardsServer; permissionless claim via server signature.
 *         No AccessToken: users claim rewards directly with a signed message.
 */
contract RewardsManager is
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
    error AlreadyUsedSignature();
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
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");
    bytes32 private constant REWARDS_MANAGER_ROLE =
        keccak256("REWARDS_MANAGER_ROLE");

    /*//////////////////////////////////////////////////////////////
                               STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct Server {
        address treasury;
        bool exists;
    }

    /*//////////////////////////////////////////////////////////////
                               STATE
    //////////////////////////////////////////////////////////////*/

    // Per-server registry (one manager has many servers)
    mapping(bytes32 => Server) private servers;

    // Beacons (single implementation per type, upgradeable for all servers)
    UpgradeableBeacon public treasuryBeacon;

    // Global signature replay protection
    mapping(bytes => bool) private usedSignatures;

    // ETH reserved for pending claims (withdrawals cannot exceed balance - this)
    uint256 private ethReservedTotal;

    uint256[44] private __gap;

    /*//////////////////////////////////////////////////////////////
                               EVENTS
    //////////////////////////////////////////////////////////////*/

    event ServerDeployed(bytes32 indexed serverId, address treasury);

    event ServerSignerUpdated(
        bytes32 indexed serverId,
        address indexed signer,
        bool isActive
    );

    event ServerWithdrawerUpdated(
        bytes32 indexed serverId,
        address indexed account,
        bool isActive
    );

    event ServerAdminTransferred(
        bytes32 indexed serverId,
        address indexed oldAdmin,
        address indexed newAdmin
    );

    event TokenAdded(bytes32 indexed serverId, uint256 indexed tokenId);
    event Minted(
        bytes32 indexed serverId,
        address indexed to,
        uint256 indexed tokenId,
        uint256 amount,
        bool soulbound
    );
    event Claimed(
        bytes32 indexed serverId,
        address indexed to,
        uint256 indexed tokenId,
        uint256 amount
    );
    event TokenMintPausedUpdated(
        bytes32 indexed serverId,
        uint256 indexed tokenId,
        bool isPaused
    );
    event ClaimRewardPausedUpdated(
        bytes32 indexed serverId,
        uint256 indexed tokenId,
        bool isPaused
    );
    event RewardSupplyChanged(
        bytes32 indexed serverId,
        uint256 indexed tokenId,
        uint256 oldSupply,
        uint256 newSupply
    );
    event TokenURIChanged(
        bytes32 indexed serverId,
        uint256 indexed tokenId,
        string newUri
    );
    event AssetsWithdrawn(
        bytes32 indexed serverId,
        LibItems.RewardType rewardType,
        address indexed to,
        uint256 amount
    );

    /*//////////////////////////////////////////////////////////////
                               INITIALIZER
    //////////////////////////////////////////////////////////////*/

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes roles (dev, manager, upgrader). Called once by the proxy.
    /// @param _devWallet Receives DEFAULT_ADMIN_ROLE, DEV_CONFIG_ROLE, UPGRADER_ROLE.
    /// @param _managerWallet Receives MANAGER_ROLE, MINTER_ROLE.
    function initialize(
        address _devWallet,
        address _managerWallet
    ) external initializer {
        if (
            _devWallet == address(0) ||
            _managerWallet == address(0)
        ) {
            revert AddressIsZero();
        }

        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _devWallet);
        _grantRole(DEV_CONFIG_ROLE, _devWallet);
        _grantRole(UPGRADER_ROLE, _devWallet);
        _grantRole(MANAGER_ROLE, _managerWallet);
        _grantRole(MINTER_ROLE, _managerWallet);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}

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

        treasuryBeacon = new UpgradeableBeacon(
            _treasuryImplementation,
            address(this)
        );
    }

    /*//////////////////////////////////////////////////////////////
                           SERVER MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    function _getServer(
        bytes32 serverId
    ) internal view returns (Server storage s) {
        s = servers[serverId];
        if (!s.exists) {
            revert ServerDoesNotExist();
        }
    }

    /// @notice Registers a new server (RewardsServer proxy) for the given serverId. Only FACTORY_ROLE (RewardsFactory).
    /// @param serverId Unique server identifier.
    /// @param treasury Address of the deployed RewardsServer proxy.
    function registerServer(bytes32 serverId, address treasury) external onlyRole(FACTORY_ROLE) {
        if (serverId == bytes32(0)) revert InvalidServerId();
        if (servers[serverId].exists) revert ServerAlreadyExists();
        if (treasury == address(0)) revert AddressIsZero();

        servers[serverId] = Server({ treasury: treasury, exists: true });

        emit ServerDeployed(serverId, treasury);
    }

    /// @notice Transfers server admin to newAdmin. Caller must be current SERVER_ADMIN_ROLE on the server.
    function transferServerAdmin(bytes32 serverId, address newAdmin) external {
        if (newAdmin == address(0)) revert AddressIsZero();
        Server storage s = _getServer(serverId);
        RewardsServer(s.treasury).transferServerAdminAllowedBy(msg.sender, newAdmin);
        emit ServerAdminTransferred(serverId, msg.sender, newAdmin);
    }

    /// @notice Returns the RewardsServer (treasury) address for a server.
    function getServer(bytes32 serverId) external view returns (address treasury) {
        Server storage s = _getServer(serverId);
        return s.treasury;
    }

    /*//////////////////////////////////////////////////////////////
                        PER-SERVER ACCESS CONTROL
    //////////////////////////////////////////////////////////////*/

    /// @notice Enables or disables a claim signer for the server. Caller must be SERVER_ADMIN_ROLE on the server.
    function setServerSigner(
        bytes32 serverId,
        address signer,
        bool isActive
    ) external {
        Server storage s = _getServer(serverId);
        RewardsServer(s.treasury).setSignerAllowedBy(msg.sender, signer, isActive);
        emit ServerSignerUpdated(serverId, signer, isActive);
    }

    /// @notice Returns whether the address is an active signer for the server.
    function isServerSigner(bytes32 serverId, address signer) external view returns (bool) {
        Server storage s = _getServer(serverId);
        return RewardsServer(s.treasury).isSigner(signer);
    }

    /// @notice Enables or disables a withdrawer for the server. Caller must be SERVER_ADMIN_ROLE on the server.
    function setServerWithdrawer(
        bytes32 serverId,
        address account,
        bool isActive
    ) external {
        Server storage s = _getServer(serverId);
        RewardsServer(s.treasury).setWithdrawerAllowedBy(msg.sender, account, isActive);
        emit ServerWithdrawerUpdated(serverId, account, isActive);
    }

    /// @notice Returns whether the account is an active withdrawer for the server.
    function isServerWithdrawer(bytes32 serverId, address account) external view returns (bool) {
        Server storage s = _getServer(serverId);
        return RewardsServer(s.treasury).isWithdrawer(account);
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
        bytes32 serverId,
        address beneficiary,
        uint256 expiration,
        uint256[] memory tokenIds,
        uint256 nonce,
        bytes calldata signature
    ) internal view returns (address) {
        if (usedSignatures[signature]) {
            revert AlreadyUsedSignature();
        }

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

        Server storage s = _getServer(serverId);
        if (!RewardsServer(s.treasury).isSigner(signer)) {
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

    /// @notice Adds a token to the server whitelist. Only MANAGER_ROLE.
    function whitelistToken(
        bytes32 serverId,
        address token,
        LibItems.RewardType rewardType
    ) external onlyRole(MANAGER_ROLE) {
        Server storage s = _getServer(serverId);
        RewardsServer(s.treasury).whitelistToken(token, rewardType);
    }

    /// @notice Removes a token from the server whitelist (fails if token has reserves). Only MANAGER_ROLE.
    function removeTokenFromWhitelist(
        bytes32 serverId,
        address token
    ) external onlyRole(MANAGER_ROLE) {
        Server storage s = _getServer(serverId);
        RewardsServer(s.treasury).removeTokenFromWhitelist(token);
    }

    /// @notice Deposits ERC20 from msg.sender into the server treasury. Token must be whitelisted. Reentrancy-protected.
    function depositToTreasury(
        bytes32 serverId,
        address token,
        uint256 amount
    ) external nonReentrant {
        Server storage s = _getServer(serverId);
        RewardsServer(s.treasury).depositToTreasury(token, amount, msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
              REWARD TOKEN CREATION AND SUPPLY (PER TENANT)
    //////////////////////////////////////////////////////////////*/

    /// @notice Creates a new reward token on the server and reserves/deposits rewards. Send ETH if token has ETHER rewards. Only MANAGER_ROLE.
    /// @param serverId Server id.
    /// @param token Reward token definition (tokenId, maxSupply, rewards, tokenUri). ERC721 rewards require exact rewardTokenIds length = rewardAmount * maxSupply.
    function createTokenAndDepositRewards(
        bytes32 serverId,
        LibItems.RewardToken calldata token
    ) external payable onlyRole(MANAGER_ROLE) nonReentrant {
        uint256 ethRequired = _calculateETHRequiredForToken(token);
        if (msg.value < ethRequired) revert InsufficientBalance();
        Server storage s = _getServer(serverId);
        _validateAndCreateTokenAndDepositRewards(s.treasury, token);
        ethReservedTotal += ethRequired;
        emit TokenAdded(serverId, token.tokenId);
    }

    /// @notice Pauses or unpauses minting for a reward token. Only MANAGER_ROLE.
    function updateTokenMintPaused(
        bytes32 serverId,
        uint256 tokenId,
        bool isPaused
    ) external onlyRole(MANAGER_ROLE) {
        Server storage s = _getServer(serverId);
        RewardsServer(s.treasury).setTokenMintPaused(tokenId, isPaused);
        emit TokenMintPausedUpdated(serverId, tokenId, isPaused);
    }

    /// @notice Pauses or unpauses claiming for a reward token. Only MANAGER_ROLE.
    function updateClaimRewardPaused(
        bytes32 serverId,
        uint256 tokenId,
        bool isPaused
    ) external onlyRole(MANAGER_ROLE) {
        Server storage s = _getServer(serverId);
        RewardsServer(s.treasury).setClaimRewardPaused(tokenId, isPaused);
        emit ClaimRewardPausedUpdated(serverId, tokenId, isPaused);
    }

    /// @notice Increases max supply for a reward token; reserves additional ERC20/ERC1155/ETH. Only MANAGER_ROLE. Not supported for ERC721-backed rewards (create a new token instead).
    /// @param serverId Server id.
    /// @param tokenId Reward token id.
    /// @param additionalSupply Amount to add. Send ETH if token has ETHER rewards (amount = sum of ETHER rewardAmount * additionalSupply).
    function increaseRewardSupply(
        bytes32 serverId,
        uint256 tokenId,
        uint256 additionalSupply
    ) external payable onlyRole(MANAGER_ROLE) {
        Server storage s = _getServer(serverId);
        RewardsServer serverContract = RewardsServer(s.treasury);
        if (!serverContract.isTokenExists(tokenId)) revert TokenNotExist();
        if (additionalSupply == 0) revert InvalidAmount();
        LibItems.RewardToken memory rewardToken = serverContract.getRewardToken(tokenId);
        uint256 additionalEthRequired;
        for (uint256 i = 0; i < rewardToken.rewards.length; i++) {
            if (rewardToken.rewards[i].rewardType == LibItems.RewardType.ETHER) {
                additionalEthRequired += rewardToken.rewards[i].rewardAmount * additionalSupply;
            }
        }
        if (additionalEthRequired > 0) {
            if (msg.value < additionalEthRequired) revert InsufficientBalance();
            ethReservedTotal += additionalEthRequired;
        }
        uint256 oldSupply = rewardToken.maxSupply;
        serverContract.increaseRewardSupply(tokenId, additionalSupply);
        emit RewardSupplyChanged(serverId, tokenId, oldSupply, oldSupply + additionalSupply);
    }

    /// @notice Updates the token URI for a reward token. Only MANAGER_ROLE.
    function updateTokenUri(
        bytes32 serverId,
        uint256 tokenId,
        string calldata newUri
    ) external onlyRole(MANAGER_ROLE) {
        Server storage s = _getServer(serverId);
        _updateTokenUri(s.treasury, tokenId, newUri);
        emit TokenURIChanged(serverId, tokenId, newUri);
    }

    function _transferEther(address payable to, uint256 amount) private {
        if (address(this).balance < amount) revert InsufficientBalance();
        (bool ok, ) = to.call{ value: amount }("");
        if (!ok) revert TransferFailed();
    }

    function _calculateETHRequiredForToken(
        LibItems.RewardToken calldata token
    ) internal pure returns (uint256) {
        uint256 total;
        for (uint256 i = 0; i < token.rewards.length; i++) {
            if (token.rewards[i].rewardType == LibItems.RewardType.ETHER) {
                total += token.rewards[i].rewardAmount;
            }
        }
        return total * token.maxSupply;
    }

    function _validateAndCreateTokenAndDepositRewards(
        address treasuryAddr,
        LibItems.RewardToken calldata token
    ) internal {
        RewardsServer server = RewardsServer(treasuryAddr);
        if (token.maxSupply == 0) revert InvalidAmount();
        if (
            bytes(token.tokenUri).length == 0 ||
            token.rewards.length == 0 ||
            token.tokenId == 0
        ) revert InvalidInput();
        if (server.isTokenExists(token.tokenId)) revert DupTokenId();

        for (uint256 i = 0; i < token.rewards.length; i++) {
            LibItems.Reward memory r = token.rewards[i];
            if (r.rewardType != LibItems.RewardType.ETHER && r.rewardTokenAddress == address(0)) revert AddressIsZero();
            if (r.rewardType == LibItems.RewardType.ERC721) {
                if (
                    r.rewardTokenIds.length == 0 ||
                    r.rewardTokenIds.length != r.rewardAmount * token.maxSupply
                ) revert InvalidInput();
            }
            if (r.rewardType != LibItems.RewardType.ERC721 && r.rewardAmount == 0) revert InvalidAmount();
        }

        for (uint256 i = 0; i < token.rewards.length; i++) {
            LibItems.Reward memory r = token.rewards[i];
            if (r.rewardType == LibItems.RewardType.ERC20) {
                if (!server.whitelistedTokens(r.rewardTokenAddress)) revert TokenNotWhitelisted();
                uint256 totalAmount = r.rewardAmount * token.maxSupply;
                uint256 balance = IERC20(r.rewardTokenAddress).balanceOf(treasuryAddr);
                uint256 reserved = server.reservedAmounts(r.rewardTokenAddress);
                if (balance < reserved + totalAmount) revert InsufficientTreasuryBalance();
                server.increaseERC20Reserved(r.rewardTokenAddress, totalAmount);
            } else if (r.rewardType == LibItems.RewardType.ERC721) {
                if (!server.whitelistedTokens(r.rewardTokenAddress)) revert TokenNotWhitelisted();
                IERC721 nft = IERC721(r.rewardTokenAddress);
                for (uint256 j = 0; j < r.rewardTokenIds.length; j++) {
                    uint256 tid = r.rewardTokenIds[j];
                    if (nft.ownerOf(tid) != treasuryAddr || server.isErc721Reserved(r.rewardTokenAddress, tid)) {
                        revert InsufficientTreasuryBalance();
                    }
                }
                for (uint256 j = 0; j < r.rewardTokenIds.length; j++) {
                    server.reserveERC721(r.rewardTokenAddress, r.rewardTokenIds[j]);
                }
            } else if (r.rewardType == LibItems.RewardType.ERC1155) {
                if (!server.whitelistedTokens(r.rewardTokenAddress)) revert TokenNotWhitelisted();
                uint256 totalAmount = r.rewardAmount * token.maxSupply;
                uint256 balance = IERC1155(r.rewardTokenAddress).balanceOf(treasuryAddr, r.rewardTokenId);
                uint256 reserved = server.erc1155ReservedAmounts(r.rewardTokenAddress, r.rewardTokenId);
                if (balance < reserved + totalAmount) revert InsufficientTreasuryBalance();
                server.increaseERC1155Reserved(r.rewardTokenAddress, r.rewardTokenId, totalAmount);
            }
        }

        server.addRewardToken(token.tokenId, token);
    }

    function _updateTokenUri(
        address treasuryAddr,
        uint256 tokenId,
        string calldata newUri
    ) internal {
        RewardsServer server = RewardsServer(treasuryAddr);
        if (!server.isTokenExists(tokenId)) revert TokenNotExist();
        LibItems.RewardToken memory rt = server.getRewardToken(tokenId);
        rt.tokenUri = newUri;
        server.updateRewardToken(tokenId, rt);
    }

    function _distributeReward(
        address treasuryAddr,
        address to,
        uint256 rewardTokenId
    ) internal {
        RewardsServer serverContract = RewardsServer(treasuryAddr);
        LibItems.RewardToken memory rewardToken = serverContract.getRewardToken(rewardTokenId);
        LibItems.Reward[] memory rewards = rewardToken.rewards;

        for (uint256 i = 0; i < rewards.length; i++) {
            LibItems.Reward memory r = rewards[i];
            if (r.rewardType == LibItems.RewardType.ETHER) {
                ethReservedTotal -= r.rewardAmount;
                _transferEther(payable(to), r.rewardAmount);
            } else if (r.rewardType == LibItems.RewardType.ERC20) {
                serverContract.distributeERC20(r.rewardTokenAddress, to, r.rewardAmount);
                serverContract.decreaseERC20Reserved(r.rewardTokenAddress, r.rewardAmount);
            } else if (r.rewardType == LibItems.RewardType.ERC721) {
                uint256 currentIndex = serverContract.getERC721RewardCurrentIndex(rewardTokenId, i);
                uint256[] memory tokenIds = r.rewardTokenIds;
                for (uint256 j = 0; j < r.rewardAmount; j++) {
                    if (currentIndex + j >= tokenIds.length) revert InsufficientBalance();
                    uint256 nftId = tokenIds[currentIndex + j];
                    serverContract.releaseERC721(r.rewardTokenAddress, nftId);
                    serverContract.distributeERC721(r.rewardTokenAddress, to, nftId);
                }
                serverContract.incrementERC721RewardIndex(rewardTokenId, i, r.rewardAmount);
            } else if (r.rewardType == LibItems.RewardType.ERC1155) {
                serverContract.decreaseERC1155Reserved(r.rewardTokenAddress, r.rewardTokenId, r.rewardAmount);
                serverContract.distributeERC1155(r.rewardTokenAddress, to, r.rewardTokenId, r.rewardAmount);
            }
        }
    }

    function _claimRewards(
        address treasuryAddr,
        address to,
        uint256 tokenId,
        uint256 amount
    ) internal {
        RewardsServer server = RewardsServer(treasuryAddr);
        if (to == address(0)) revert AddressIsZero();
        if (!server.isTokenExists(tokenId)) revert TokenNotExist();
        if (server.isClaimRewardPaused(tokenId)) revert ClaimRewardPaused();
        if (amount == 0) revert InvalidAmount();

        uint256 newSupply = server.currentRewardSupply(tokenId) + amount;
        if (newSupply > server.getRewardToken(tokenId).maxSupply) revert ExceedMaxSupply();
        server.increaseCurrentSupply(tokenId, amount);

        for (uint256 i = 0; i < amount; i++) {
            _distributeReward(treasuryAddr, to, tokenId);
        }
    }

    function _decodeClaimData(
        bytes calldata data
    ) private pure returns (address contractAddress, uint256 chainId, address beneficiary, uint256 expiration, uint256[] memory tokenIds) {
        (contractAddress, chainId, beneficiary, expiration, tokenIds) =
            abi.decode(data, (address, uint256, address, uint256, uint256[]));
    }

    /// @notice Permissionless claim: beneficiary presents server signature and receives one unit of reward per tokenId.
    /// @dev Caller must be beneficiary. Signature is burned (replay protection). tokenIds length capped by MAX_CLAIM_TOKEN_IDS.
    /// @param serverId Server id.
    /// @param data ABI-encoded (contractAddress, chainId, beneficiary, expiration, tokenIds).
    /// @param nonce User nonce (must not be used before).
    /// @param signature Server signer signature over the claim message.
    function claim(
        bytes32 serverId,
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
        ) = _decodeClaimData(data);

        if (contractAddress != address(this) || chainId != block.chainid) revert InvalidInput();
        if (msg.sender != beneficiary) revert InvalidInput();
        if (tokenIds.length > MAX_CLAIM_TOKEN_IDS) revert InvalidInput();

        Server storage s = _getServer(serverId);
        RewardsServer serverContract = RewardsServer(s.treasury);
        if (serverContract.userNonces(beneficiary, nonce)) revert NonceAlreadyUsed();

        _verifyServerSignature(serverId, beneficiary, expiration, tokenIds, nonce, signature);
        usedSignatures[signature] = true;
        serverContract.setUserNonce(beneficiary, nonce, true);

        for (uint256 i = 0; i < tokenIds.length; i++) {
            _claimRewards(s.treasury, beneficiary, tokenIds[i], 1);
            emit Claimed(serverId, beneficiary, tokenIds[i], 1);
        }
    }

    /// @notice Withdraws assets from manager (ETHER) or server treasury (ERC20/721/1155) to recipient. Only MANAGER_ROLE. ETHER: amounts[0]; ERC721: tokenIds; ERC1155: tokenIds + amounts.
    function withdrawAssets(
        bytes32 serverId,
        LibItems.RewardType rewardType,
        address to,
        address tokenAddress,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external onlyRole(MANAGER_ROLE) {
        if (to == address(0)) revert AddressIsZero();
        Server storage s = _getServer(serverId);
        RewardsServer serverContract = RewardsServer(s.treasury);

        if (rewardType == LibItems.RewardType.ETHER) {
            if (amounts.length == 0) revert InvalidInput();
            uint256 amount = amounts[0];
            if (amount > address(this).balance - ethReservedTotal) revert InsufficientBalance();
            _transferEther(payable(to), amount);
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
                      TREASURY WITHDRAW (PER TENANT)
    //////////////////////////////////////////////////////////////*/

    /// @notice Withdraws all unreserved ERC20 for token to to. Caller must be server withdrawer. Reentrancy-protected.
    function withdrawUnreservedTreasury(
        bytes32 serverId,
        address token,
        address to
    ) external nonReentrant {
        Server storage s = _getServer(serverId);
        if (!RewardsServer(s.treasury).isWithdrawer(msg.sender)) revert UnauthorizedServerAdmin();
        RewardsServer(s.treasury).withdrawUnreservedTreasury(token, to);
    }

    /// @notice Withdraws one unreserved ERC721 (tokenId) to to. Caller must be server withdrawer. Reentrancy-protected.
    function withdrawERC721UnreservedTreasury(
        bytes32 serverId,
        address token,
        address to,
        uint256 tokenId
    ) external nonReentrant {
        Server storage s = _getServer(serverId);
        if (!RewardsServer(s.treasury).isWithdrawer(msg.sender)) revert UnauthorizedServerAdmin();
        RewardsServer(s.treasury).withdrawERC721UnreservedTreasury(token, to, tokenId);
    }

    /// @notice Withdraws unreserved ERC1155 amount to to. Caller must be server withdrawer. Reentrancy-protected.
    function withdrawERC1155UnreservedTreasury(
        bytes32 serverId,
        address token,
        address to,
        uint256 tokenId,
        uint256 amount
    ) external nonReentrant {
        Server storage s = _getServer(serverId);
        if (!RewardsServer(s.treasury).isWithdrawer(msg.sender)) revert UnauthorizedServerAdmin();
        RewardsServer(s.treasury).withdrawERC1155UnreservedTreasury(token, to, tokenId, amount);
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW HELPERS (PER TENANT)
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns full treasury balance view for the server (addresses, total/reserved/available, symbols, names, types, tokenIds).
    function getServerTreasuryBalances(
        bytes32 serverId
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
        Server storage s = _getServer(serverId);
        return RewardsServer(s.treasury).getAllTreasuryBalances();
    }

    /// @notice Returns all reward token ids (item ids) for the server.
    function getServerAllItemIds(bytes32 serverId) external view returns (uint256[] memory) {
        Server storage s = _getServer(serverId);
        return RewardsServer(s.treasury).getAllItemIds();
    }

    /// @notice Returns reward definitions for a reward token on the server.
    function getServerTokenRewards(
        bytes32 serverId,
        uint256 tokenId
    ) external view returns (LibItems.Reward[] memory) {
        Server storage s = _getServer(serverId);
        return RewardsServer(s.treasury).getTokenRewards(tokenId);
    }

    /// @notice Returns server treasury ERC20 balance for token.
    function getServerTreasuryBalance(
        bytes32 serverId,
        address token
    ) external view returns (uint256) {
        Server storage s = _getServer(serverId);
        return
            RewardsServer(s.treasury).getTreasuryBalance(
                s.treasury,
                token
            );
    }

    /// @notice Returns reserved amount for token on the server.
    function getServerReservedAmount(
        bytes32 serverId,
        address token
    ) external view returns (uint256) {
        Server storage s = _getServer(serverId);
        return
            RewardsServer(s.treasury).getReservedAmount(
                s.treasury,
                token
            );
    }

    /// @notice Returns unreserved (available) treasury balance for token on the server.
    function getServerAvailableTreasuryBalance(
        bytes32 serverId,
        address token
    ) external view returns (uint256) {
        Server storage s = _getServer(serverId);
        return
            RewardsServer(s.treasury).getAvailableTreasuryBalance(
                s.treasury,
                token
            );
    }

    /// @notice Returns whitelisted token addresses for the server.
    function getServerWhitelistedTokens(
        bytes32 serverId
    ) external view returns (address[] memory) {
        Server storage s = _getServer(serverId);
        return
            RewardsServer(s.treasury).getWhitelistedTokens(
                s.treasury
            );
    }

    /// @notice Returns whether token is whitelisted on the server.
    function isServerWhitelistedToken(
        bytes32 serverId,
        address token
    ) external view returns (bool) {
        Server storage s = _getServer(serverId);
        return
            RewardsServer(s.treasury).isWhitelistedToken(
                s.treasury,
                token
            );
    }

    /// @notice Returns whether the reward token exists on the server.
    function isTokenExist(bytes32 serverId, uint256 tokenId) public view returns (bool) {
        Server storage s = _getServer(serverId);
        return RewardsServer(s.treasury).isTokenExists(tokenId);
    }

    /// @notice Returns structured reward token details (URI, maxSupply, reward types/amounts/addresses/tokenIds).
    function getTokenDetails(
        bytes32 serverId,
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
        Server storage s = _getServer(serverId);
        LibItems.RewardToken memory rt = RewardsServer(s.treasury).getRewardToken(tokenId);
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

    /// @notice Returns true if the reward token exists, claim is not paused, and there is remaining supply to claim.
    function canUserClaim(
        bytes32 serverId,
        address,
        uint256 tokenId
    ) external view returns (bool) {
        Server storage s = _getServer(serverId);
        RewardsServer serverContract = RewardsServer(s.treasury);
        if (!serverContract.isTokenExists(tokenId)) return false;
        if (serverContract.isClaimRewardPaused(tokenId)) return false;
        uint256 maxSupply = serverContract.getRewardToken(tokenId).maxSupply;
        uint256 current = serverContract.currentRewardSupply(tokenId);
        return current < maxSupply;
    }

    /// @notice Returns remaining claimable supply for a reward token (maxSupply - currentSupply), or 0 if exhausted/nonexistent.
    function getRemainingSupply(
        bytes32 serverId,
        uint256 tokenId
    ) external view returns (uint256) {
        Server storage s = _getServer(serverId);
        RewardsServer serverContract = RewardsServer(s.treasury);
        if (!serverContract.isTokenExists(tokenId)) return 0;
        uint256 maxSupply = serverContract.getRewardToken(tokenId).maxSupply;
        uint256 current = serverContract.currentRewardSupply(tokenId);
        if (current >= maxSupply) return 0;
        return maxSupply - current;
    }

    /// @notice Returns whether the user has already used the given nonce (replay protection).
    function isNonceUsed(
        bytes32 serverId,
        address user,
        uint256 nonce
    ) external view returns (bool) {
        Server storage s = _getServer(serverId);
        return RewardsServer(s.treasury).userNonces(user, nonce);
    }

    receive() external payable {}
}

