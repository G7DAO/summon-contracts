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
import { ERCWhitelistSignature } from "../ercs/ERCWhitelistSignature.sol";

/**
 * @title PaymentRouterNative.sol
 * @notice A contract for managing payments with configurable prices and URIs
 * @dev Implements role-based access control and reentrancy protection
 */
contract PaymentRouterNative is
    AccessControl,
    ReentrancyGuard,
    ERCWhitelistSignature
{
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
     * @param price The price in wei for this payment ID
     * @param isPaused Whether payments for this ID are paused
     * @param paymentURI The URI containing metadata for this payment ID
     */
    struct PaymentConfig {
        uint256 price;
        bool isPaused;
        string paymentURI;
    }

    /// @notice Mapping from payment ID to its configuration
    mapping(uint256 => PaymentConfig) public paymentConfigs;

    /// @notice Emitted when a payment is received
    event PaymentReceived(
        uint256 indexed id,
        address indexed sender,
        uint256 amount,
        uint256[] ids
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
    /// @notice Emitted when stuck funds are withdrawn
    event EmergencyWithdrawal(address indexed to, uint256 amount);
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
    /// @notice Error thrown when transfer to multisig fails
    error TransferToMultiSigFailed();
    /// @notice Error thrown when attempting to withdraw with no funds
    error NoFundsToWithdraw();
    /// @notice Error thrown when emergency withdrawal fails
    error EmergencyWithdrawalFailed();
    /// @notice Error thrown when the seed is invalid
    error InvalidSeed();

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
        _addWhitelistSigner(msg.sender);
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
     * @notice Sets the payment configuration for a given ID
     * @param id The payment ID
     * @param price The price in wei
     * @param uri The metadata URI
     */
    function setPaymentConfig(
        uint256 id,
        uint256 price,
        string calldata uri
    ) external onlyRole(DEV_CONFIG_ROLE) {
        if (price == 0) revert ZeroPrice();

        paymentConfigs[id].paymentURI = uri;
        paymentConfigs[id].price = price;
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
     * @param nonce The nonce for the signature
     * @param seed The seed for the signature
     * @param signature The signature for the payment
     */
    function pay(
        uint256 id,
        uint256 nonce,
        bytes calldata seed,
        bytes calldata signature
    )
        external
        payable
        nonReentrant
        validId(id)
        signatureCheck(_msgSender(), nonce, seed, signature)
    {
        if (paymentConfigs[id].isPaused) revert PaymentIdPaused();
        if (msg.value != paymentConfigs[id].price)
            revert IncorrectPaymentAmount();

        uint256[] memory ids = _verifyContractChainIdAndDecode(seed);

        (bool success, ) = multiSigWallet.call{ value: msg.value }("");
        if (!success) revert TransferToMultiSigFailed();
        emit PaymentReceived(id, msg.sender, msg.value, ids);
    }

    function addWhitelistSigner(
        address _signer
    ) external onlyRole(DEV_CONFIG_ROLE) {
        _addWhitelistSigner(_signer);
    }

    function removeWhitelistSigner(
        address signer
    ) external onlyRole(DEV_CONFIG_ROLE) {
        _removeWhitelistSigner(signer);
    }

    function getChainID() public view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    function _decodeData(
        bytes calldata _seed
    ) private pure returns (address, uint256, uint256[] memory) {
        (
            address contractAddress,
            uint256 chainId,
            uint256[] memory _itemIds
        ) = abi.decode(_seed, (address, uint256, uint256[]));
        return (contractAddress, chainId, _itemIds);
    }

    function _verifyContractChainIdAndDecode(
        bytes calldata data
    ) private view returns (uint256[] memory) {
        uint256 currentChainId = getChainID();
        (
            address contractAddress,
            uint256 chainId,
            uint256[] memory tokenIds
        ) = _decodeData(data);

        if (chainId != currentChainId || contractAddress != address(this)) {
            revert InvalidSeed();
        }
        return tokenIds;
    }

    /**
     * @notice Withdraws any stuck funds to the multisig wallet
     * @dev Only callable by admin role
     */
    function withdrawStuckFunds() external onlyRole(ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFundsToWithdraw();

        (bool success, ) = multiSigWallet.call{ value: balance }("");
        if (!success) revert EmergencyWithdrawalFailed();

        emit EmergencyWithdrawal(multiSigWallet, balance);
    }

    /**
     * @notice Allows the contract to receive ETH directly
     * @dev Required for handling direct ETH transfers and emergency withdrawals
     */
    receive() external payable {}

    /**
     * @notice Gets the payment configuration for a specific ID
     * @param id The payment ID
     * @return price The price in wei
     * @return isPaused Whether the payment ID is paused
     */
    function getPaymentConfig(
        uint256 id
    ) external view returns (uint256 price, bool isPaused) {
        return (paymentConfigs[id].price, paymentConfigs[id].isPaused);
    }
}
