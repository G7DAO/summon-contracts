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
    
    /// @notice 100% in basis points (10000)
    uint256 public constant HUNDRED_PERCENT = 10000;
    
    /**
     * @notice Structure for fee recipient configuration
     * @param active Whether this recipient is currently active
     * @param percentage The percentage of payment they receive (in basis points)
     */
    struct FeeRecipient {
        bool active;
        uint256 percentage;
    }

    /// @notice Mapping of addresses to their fee configuration
    mapping(address => FeeRecipient) public feeRecipients;
    /// @notice Array to keep track of all fee recipient addresses
    address[] public feeRecipientAddresses;

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
        string[] ids
    );
    /// @notice Emitted when a payment price is updated
    event PriceUpdated(uint256 indexed id, uint256 newPrice);
    /// @notice Emitted when a payment ID is paused
    event IdPaused(uint256 indexed id);
    /// @notice Emitted when a payment ID is unpaused
    event IdUnpaused(uint256 indexed id);
    /// @notice Emitted when stuck funds are withdrawn
    event EmergencyWithdrawal(address indexed to, uint256 amount);
    /// @notice Emitted when a payment URI is updated
    event UriUpdated(uint256 indexed id, string newUri);
    /// @notice Emitted when a fee recipient is added or updated
    event FeeRecipientUpdated(address indexed recipient, uint256 percentage);
    /// @notice Emitted when a fee recipient is removed
    event FeeRecipientRemoved(address indexed recipient);

    /// @notice Error thrown when an invalid payment ID is used
    error InvalidPaymentId();
    /// @notice Error thrown when attempting to set a zero price
    error ZeroPrice();
    /// @notice Error thrown when attempting to pay for a paused ID
    error PaymentIdPaused();
    /// @notice Error thrown when payment amount doesn't match the price
    error IncorrectPaymentAmount();
    /// @notice Error thrown when emergency withdrawal fails
    error EmergencyWithdrawalFailed();
    /// @notice Error thrown when the seed is invalid
    error InvalidSeed();
    /// @notice Error thrown when an invalid percentage is provided
    error InvalidPercentage();
    /// @notice Error thrown when total fee percentage exceeds 100%
    error TotalPercentageExceedsLimit();
    /// @notice Error thrown when fee recipient doesn't exist
    error FeeRecipientDoesNotExist();
    /// @notice Error thrown when an invalid recipient address is provided
    error InvalidRecipientAddress();
    /// @notice Error thrown when no active fee recipients exist
    error NoActiveFeeRecipients();
    /// @notice Error thrown when total fee percentage is not 100%
    error TotalPercentageMustBe100();
    /// @notice Error thrown when the address is zero
    error ZeroAddress();
    /// @notice Error thrown when transfer to the recipient fails
    error TransferToFeeRecipientFailed();
    /// @notice Error thrown when the admin try to withdraw funds that don't exist
    error NoFundsToWithdraw();

    /**
     * @notice Contract constructor
     * @param managerRole Address to receive manager role
     * @param adminRole Address to receive admin role
     */
    constructor(
        address managerRole,
        address adminRole
    ) {
        if (managerRole == address(0) || adminRole == address(0)) revert ZeroAddress();
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
    function paymentURI(uint256 id) external validId(id) view returns (string memory) {
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
     * @notice Adds or updates a fee recipient
     * @param recipient The address of the fee recipient
     * @param percentage The percentage they should receive (in basis points)
     */
    function setFeeRecipient(
        address recipient,
        uint256 percentage
    ) external onlyRole(MANAGER_ROLE) {
        if (recipient == address(0)) revert InvalidRecipientAddress();
        if (percentage > HUNDRED_PERCENT) revert InvalidPercentage();
        
        uint256 totalPercentage = getTotalFeePercentage();
        if (!feeRecipients[recipient].active) {
            totalPercentage += percentage;
        } else {
            totalPercentage = totalPercentage - feeRecipients[recipient].percentage + percentage;
        }

        if (!feeRecipients[recipient].active) {
            feeRecipientAddresses.push(recipient);
        }
        
        feeRecipients[recipient] = FeeRecipient({
            active: true,
            percentage: percentage
        });
        
        emit FeeRecipientUpdated(recipient, percentage);
    }

    /**
     * @notice Removes a fee recipient
     * @param recipient The address of the fee recipient to remove
     */
    function removeFeeRecipient(address recipient) external onlyRole(MANAGER_ROLE) {
        if (!feeRecipients[recipient].active) revert FeeRecipientDoesNotExist();
        
        // Remove from mapping
        feeRecipients[recipient].active = false;
        feeRecipients[recipient].percentage = 0;
        
        // Remove from array by replacing with last element and popping
        for (uint256 i = 0; i < feeRecipientAddresses.length; i++) {
            if (feeRecipientAddresses[i] == recipient) {
                if (i != feeRecipientAddresses.length - 1) {
                    feeRecipientAddresses[i] = feeRecipientAddresses[feeRecipientAddresses.length - 1];
                }
                feeRecipientAddresses.pop();
                break;
            }
        }
        
        emit FeeRecipientRemoved(recipient);
    }

    /**
     * @notice Gets all active fee recipients and their percentages
     * @return recipients Array of recipient addresses
     * @return percentages Array of corresponding percentages
     */
    function getFeeRecipients() external view returns (
        address[] memory recipients,
        uint256[] memory percentages
    ) {
        uint256 count = 0;
        for (uint256 i = 0; i < feeRecipientAddresses.length; i++) {
            if (feeRecipients[feeRecipientAddresses[i]].active) {
                count++;
            }
        }

        recipients = new address[](count);
        percentages = new uint256[](count);
        
        uint256 j = 0;
        for (uint256 i = 0; i < feeRecipientAddresses.length; i++) {
            address recipient = feeRecipientAddresses[i];
            if (feeRecipients[recipient].active) {
                recipients[j] = recipient;
                percentages[j] = feeRecipients[recipient].percentage;
                j++;
            }
        }
    }

    /**
     * @notice Gets the total percentage allocated to fee recipients
     * @return total The total percentage allocated (in basis points)
     */
    function getTotalFeePercentage() public view returns (uint256 total) {
        for (uint256 i = 0; i < feeRecipientAddresses.length; i++) {
            if (feeRecipients[feeRecipientAddresses[i]].active) {
                total += feeRecipients[feeRecipientAddresses[i]].percentage;
            }
        }
        return total;
    }

    /**
     * @notice Checks if an address is a fee recipient
     * @param recipient The address to check
     * @return bool Whether the address is an active fee recipient
     */
    function isFeeRecipient(address recipient) public view returns (bool) {
        return feeRecipients[recipient].active;
    }

    /**
     * @notice Gets a specific fee recipient's configuration
     * @param recipient The address of the fee recipient
     * @return active Whether the recipient is active
     * @return percentage The recipient's percentage
     */
    function getFeeRecipient(address recipient) external view returns (
        bool active,
        uint256 percentage
    ) {
        FeeRecipient memory config = feeRecipients[recipient];
        return (config.active, config.percentage);
    }

    /**
     * @notice Batch updates fee recipients
     * @param recipients Array of recipient addresses
     * @param percentages Array of corresponding percentages
     */
    function batchSetFeeRecipients(
        address[] calldata recipients,
        uint256[] calldata percentages
    ) external onlyRole(MANAGER_ROLE) {
        if (recipients.length != percentages.length) revert InvalidPaymentId();
        
        uint256 totalPercentage;
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert InvalidRecipientAddress();
            if (percentages[i] > HUNDRED_PERCENT) revert InvalidPercentage();
            totalPercentage += percentages[i];
        }
        if (totalPercentage > HUNDRED_PERCENT) revert TotalPercentageExceedsLimit();

        for (uint256 i = 0; i < recipients.length; i++) {
            if (!feeRecipients[recipients[i]].active) {
                feeRecipientAddresses.push(recipients[i]);
            }
            
            feeRecipients[recipients[i]] = FeeRecipient({
                active: true,
                percentage: percentages[i]
            });
            
            emit FeeRecipientUpdated(recipients[i], percentages[i]);
        }
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
        if (msg.value != paymentConfigs[id].price) revert IncorrectPaymentAmount();
        if (getTotalFeePercentage() != HUNDRED_PERCENT) revert TotalPercentageMustBe100();

        string[] memory ids = _verifyContractChainIdAndDecode(seed);
        
        // Distribute fees to recipients
        for (uint256 i = 0; i < feeRecipientAddresses.length; i++) {
            address recipient = feeRecipientAddresses[i];
            if (feeRecipients[recipient].active) {
                uint256 feeAmount = (msg.value * feeRecipients[recipient].percentage) / HUNDRED_PERCENT;
                if (feeAmount > 0) {
                    (bool success, ) = recipient.call{ value: feeAmount }("");
                    if (!success) revert TransferToFeeRecipientFailed();
                }
            }
        }

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
    ) private pure returns (address, uint256, string[] memory) {
        (
            address contractAddress,
            uint256 chainId,
            string[] memory _itemIds
        ) = abi.decode(_seed, (address, uint256, string[]));
        return (contractAddress, chainId, _itemIds);
    }

    function _verifyContractChainIdAndDecode(
        bytes calldata data
    ) private view returns (string[] memory) {
        uint256 currentChainId = getChainID();
        (
            address contractAddress,
            uint256 chainId,
            string[] memory tokenIds
        ) = _decodeData(data);

        if (chainId != currentChainId || contractAddress != address(this)) {
            revert InvalidSeed();
        }
        return tokenIds;
    }

    /**
    * @notice Withdraws any stuck funds to the message sender
    * @dev Only callable by admin role
    */
    function withdrawStuckFunds() external onlyRole(ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFundsToWithdraw();

        (bool success, ) = msg.sender.call{ value: balance }("");
        if (!success) revert EmergencyWithdrawalFailed();

        emit EmergencyWithdrawal(msg.sender, balance);
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
