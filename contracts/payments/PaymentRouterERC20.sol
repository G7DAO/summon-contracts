// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// @author Summon.xyz Team - https://summon.xyz
// @contributors: [ @ogarciarevett, @vasinl124]
//....................................................................................................................................................
//....................&&&&&&..........................................................................................................................
//..................&&&&&&&&&&&.......................................................................................................................
//..............X.....&&&&&&&&&&&&....................................................................................................................
//............&&&&&&.....&&&&&&&&&&&..................................................................................................................
//............&&&&&&&&&.....&&&&&.....................................................................................................................
//............&&&&&&&&&&&&.........&.............&&&&&&&&&&&&..&&&&....&&&&.&&&&&&&&..&&&&&&&.&&&&&&&&..&&&&&&&&.&&&&&&&&&&&&.&&&&&....&&&&...........
//...............&&&&&&&&&&&&.....&&$............&&&&..........&&&&....&&&&.&&&&&&&&.&&&&&&&&..&&&&&&&&.&&&&&&&&.&&&&&&&&&&&&.&&&&&&&..&&&&...........
//............&.....&&&&&&&&&&&&..................&&&&&&&&&&&..&&&&....&&&&.&&&&..&&&&&&.&&&&..&&&&.&&&&&&..&&&&.&&&&....&&&&.&&&&.&&&&&&&&...........
//............&&.......&&&&&&&&&&&&......................&&&&..&&&&&&&&&&&&.&&&&..&&&&&..&&&&..&&&&..&&&&...&&&&.&&&&&&&&&&&&.&&&&...&&&&&&...........
//................&&&.....&&&&&&&&&&+............&&&&&&&&&&&&...&&&&&&&&&&..&&&&...&&&&..&&&&.&&&&&..&&&&...&&&&.&&&&&&&&&&&&.&&&&....&&&&&...........
//.............&&&&&&&&&.....&&&&&&&..................................................................................................................
//.............&&&&&&&&&&&&.....&&&...................................................................................................................
//.................&&&&&&&&&&&........................................................................................................................
//....................&&&&&&&.........................................................................................................................
//....................................................................................................................................................

import {
    AccessControl
} from "@openzeppelin/contracts/access/AccessControl.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PaymentRouterERC20
 * @notice A contract for managing ERC20 payments with configurable prices and URIs
 * @dev Implements role-based access control, reentrancy protection, and token whitelist
 */
contract PaymentRouterERC20 is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Role identifier for admin privileges
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    /// @notice Role identifier for developer configuration privileges
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");
    /// @notice Role identifier for manager privileges
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    /// @notice Address of the multisig wallet that receives payments
    address public multiSigWallet;

    /**
     * @notice Structure for payment configuration
     * @param price The price in token amount
     * @param isPaused Whether payments for this ID are paused
     * @param paymentURI The URI containing metadata for this payment ID
     * @param token The ERC20 token address for this payment
     */
    struct PaymentConfig {
        uint256 price;
        bool isPaused;
        string paymentURI;
        address token;
    }

    /// @notice Mapping from payment ID to its configuration
    mapping(uint256 => PaymentConfig) public paymentConfigs;
    /// @notice Mapping to track whitelisted tokens
    mapping(address => bool) public whitelistedTokens;

    /// @notice Emitted when a payment is received
    event PaymentReceived(
        uint256 indexed id,
        address indexed sender,
        address indexed token,
        uint256 amount
    );
    /// @notice Emitted when a payment price is updated
    event PriceUpdated(uint256 indexed id, uint256 newPrice);
    /// @notice Emitted when a payment ID is paused
    event IdPaused(uint256 indexed id);
    /// @notice Emitted when a payment ID is unpaused
    event IdUnpaused(uint256 indexed id);
    /// @notice Emitted when the multisig wallet address is updated
    event MultiSigUpdated(
        address indexed oldMultiSig,
        address indexed newMultiSig
    );
    /// @notice Emitted when a token is added to whitelist
    event TokenWhitelisted(address indexed token);
    /// @notice Emitted when a token is removed from whitelist
    event TokenRemovedFromWhitelist(address indexed token);
    /// @notice Emitted when stuck tokens are withdrawn
    event EmergencyWithdrawal(
        address indexed token,
        address indexed to,
        uint256 amount
    );
    /// @notice Emitted when a payment URI is updated
    event UriUpdated(uint256 indexed id, string newUri);

    /// @notice Error thrown when an invalid multisig address is provided
    error InvalidMultiSigAddress();
    /// @notice Error thrown when an invalid payment ID is used
    error InvalidPaymentId();
    /// @notice Error thrown when attempting to set a zero price
    error ZeroPrice();
    /// @notice Error thrown when attempting to pay for a paused ID
    error PaymentIdPaused();
    /// @notice Error thrown when payment amount doesn't match the price
    error IncorrectPaymentAmount();
    /// @notice Error thrown when attempting to withdraw with no funds
    error NoFundsToWithdraw();
    /// @notice Error thrown when attempting to set an empty URI
    error EmptyUri();
    /// @notice Error thrown when token is not whitelisted
    error TokenNotWhitelisted();
    /// @notice Error thrown when token address is invalid
    error InvalidTokenAddress();
    /// @notice Error thrown when token is already whitelisted
    error TokenAlreadyWhitelisted();
    /// @notice Error thrown when token is not in whitelist
    error TokenNotInWhitelist();

    /**
     * @notice Contract constructor
     * @param _multiSigWallet Address of the multisig wallet
     * @param managerRole Address to receive manager role
     * @param adminRole Address to receive admin role
     */
    constructor(
        address _multiSigWallet,
        address managerRole,
        address adminRole
    ) {
        if (_multiSigWallet == address(0)) revert InvalidMultiSigAddress();
        multiSigWallet = _multiSigWallet;

        _grantRole(DEFAULT_ADMIN_ROLE, adminRole);
        _grantRole(ADMIN_ROLE, adminRole);
        _grantRole(DEV_CONFIG_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, managerRole);
    }

    /**
     * @notice Modifier to check if a payment ID is valid
     * @param id The payment ID to check
     */
    modifier validId(uint256 id) {
        if (paymentConfigs[id].price == 0) revert InvalidPaymentId();
        _;
    }

    /**
     * @notice Adds a token to the whitelist
     * @param token The token address to whitelist
     */
    function whitelistToken(address token) external onlyRole(MANAGER_ROLE) {
        if (token == address(0)) revert InvalidTokenAddress();
        if (whitelistedTokens[token]) revert TokenAlreadyWhitelisted();

        whitelistedTokens[token] = true;
        emit TokenWhitelisted(token);
    }

    /**
     * @notice Removes a token from the whitelist
     * @param token The token address to remove
     */
    function removeTokenFromWhitelist(
        address token
    ) external onlyRole(MANAGER_ROLE) {
        if (!whitelistedTokens[token]) revert TokenNotInWhitelist();

        whitelistedTokens[token] = false;
        emit TokenRemovedFromWhitelist(token);
    }

    /**
     * @notice Sets the payment configuration for a given ID
     * @param id The payment ID
     * @param price The price in token amount
     * @param uri The metadata URI
     * @param token The ERC20 token address for payment
     */
    function setPaymentConfig(
        uint256 id,
        uint256 price,
        string calldata uri,
        address token
    ) external onlyRole(DEV_CONFIG_ROLE) {
        if (price == 0) revert ZeroPrice();
        if (bytes(uri).length == 0) revert EmptyUri();
        if (!whitelistedTokens[token]) revert TokenNotWhitelisted();

        paymentConfigs[id].paymentURI = uri;
        paymentConfigs[id].price = price;
        paymentConfigs[id].token = token;
        emit PriceUpdated(id, price);
        emit UriUpdated(id, uri);
    }

    /**
     * @notice Updates the URI for an existing payment ID
     * @param id The payment ID
     * @param newUri The new metadata URI
     */
    function updateUri(
        uint256 id,
        string calldata newUri
    ) external onlyRole(DEV_CONFIG_ROLE) validId(id) {
        if (bytes(newUri).length == 0) revert EmptyUri();
        paymentConfigs[id].paymentURI = newUri;
        emit UriUpdated(id, newUri);
    }

    /**
     * @notice Retrieves the URI for a payment ID
     * @param id The payment ID
     * @return The payment URI
     */
    function paymentURI(uint256 id) external view returns (string memory) {
        if (paymentConfigs[id].price == 0) revert InvalidPaymentId();
        return paymentConfigs[id].paymentURI;
    }

    /**
     * @notice Pauses payments for a specific ID
     * @param id The payment ID to pause
     */
    function pauseId(uint256 id) external onlyRole(MANAGER_ROLE) validId(id) {
        paymentConfigs[id].isPaused = true;
        emit IdPaused(id);
    }

    /**
     * @notice Unpauses payments for a specific ID
     * @param id The payment ID to unpause
     */
    function unpauseId(uint256 id) external onlyRole(MANAGER_ROLE) validId(id) {
        paymentConfigs[id].isPaused = false;
        emit IdUnpaused(id);
    }

    /**
     * @notice Updates the multisig wallet address
     * @param newMultiSig The new multisig wallet address
     */
    function updateMultiSig(address newMultiSig) external onlyRole(ADMIN_ROLE) {
        if (newMultiSig == address(0)) revert InvalidMultiSigAddress();
        address oldMultiSig = multiSigWallet;
        multiSigWallet = newMultiSig;
        emit MultiSigUpdated(oldMultiSig, newMultiSig);
    }

    /**
     * @notice Makes a payment for a specific ID
     * @param id The payment ID
     */
    function pay(uint256 id) external nonReentrant validId(id) {
        PaymentConfig memory config = paymentConfigs[id];
        if (config.isPaused) revert PaymentIdPaused();
        if (!whitelistedTokens[config.token]) revert TokenNotWhitelisted();

        IERC20 token = IERC20(config.token);
        token.safeTransferFrom(msg.sender, multiSigWallet, config.price);

        emit PaymentReceived(id, msg.sender, config.token, config.price);
    }

    /**
     * @notice Withdraws any stuck tokens to the multisig wallet
     * @param token The ERC20 token address to withdraw
     */
    function withdrawStuckTokens(address token) external onlyRole(ADMIN_ROLE) {
        IERC20 erc20Token = IERC20(token);
        uint256 balance = erc20Token.balanceOf(address(this));
        if (balance == 0) revert NoFundsToWithdraw();

        erc20Token.safeTransfer(multiSigWallet, balance);
        emit EmergencyWithdrawal(token, multiSigWallet, balance);
    }

    /**
     * @notice Gets the payment configuration for a specific ID
     * @param id The payment ID
     * @return price The price in token amount
     * @return isPaused Whether the payment ID is paused
     * @return token The ERC20 token address for this payment
     */
    function getPaymentConfig(
        uint256 id
    ) external view returns (uint256 price, bool isPaused, address token) {
        PaymentConfig memory config = paymentConfigs[id];
        return (config.price, config.isPaused, config.token);
    }
}
