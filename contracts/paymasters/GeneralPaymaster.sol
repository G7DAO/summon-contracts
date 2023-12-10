// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {
    ExecutionResult,
    PAYMASTER_VALIDATION_SUCCESS_MAGIC,
    IPaymaster
} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol";
import { IPaymasterFlow } from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol";
import {
    TransactionHelper,
    Transaction
} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

import "@openzeppelin/contracts/security/Pausable.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";

contract GasLessOpenMintPaymasterETH is IPaymaster, AccessControl, Pausable {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("MANAGER_ROLE");

    mapping(address => bool) public allowedRecipients;

    event PaymasterPayment(address indexed from, uint256 amount);

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MANAGER_ROLE, msg.sender);
        _setupRole(PAUSER_ROLE, msg.sender);
    }

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "Only bootloader can call this method");
        // Continue execution if called from the bootloader.
        _;
    }

    function validateAndPayForPaymasterTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable onlyBootloader whenNotPaused returns (bytes4 magic, bytes memory context) {

        address recipient = address(uint160(_transaction.to));
        require(allowedRecipients[recipient], "Invalid recipient");

        // By default we consider the transaction as accepted.
        magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;
        require(_transaction.paymasterInput.length >= 4, "The standard paymaster input must be at least 4 bytes long");

        bytes4 paymasterInputSelector = bytes4(_transaction.paymasterInput[0:4]);

        if (paymasterInputSelector == IPaymasterFlow.general.selector) {
            address userAddress = address(uint160(_transaction.from));

            uint256 requiredETH = _transaction.gasLimit * _transaction.maxFeePerGas;

            (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{ value: requiredETH }("");
            require(success, "Failed to transfer tx fee to the Bootloader. Paymaster balance might not be enough.");
            emit PaymasterPayment(userAddress, requiredETH);
        } else {
            revert("Unsupported paymaster flow");
        }
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function postTransaction(
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32,
        bytes32,
        ExecutionResult _txResult,
        uint256 _maxRefundedGas
    ) external payable onlyBootloader whenNotPaused {
        // Refunds are not supported yet.
    }

    function withdraw(address payable _to) external onlyRole(MANAGER_ROLE) {
        // send paymaster funds to the owner
        uint256 balance = address(this).balance;
        (bool success, ) = _to.call{ value: balance }("");
        require(success, "Failed to withdraw funds from paymaster.");
    }

    function addRecipient(address _recipient) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_recipient != address(0), "NonAddressZero");
        allowedRecipients[_recipient] = true;
    }

    function removeRecipient(address _recipient) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_recipient != address(0), "NonAddressZero");
        allowedRecipients[_recipient] = false;
    }

    receive() external payable {}
}
