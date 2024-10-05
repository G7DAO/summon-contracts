// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title Forwarder
 * @dev Contract that automatically forwards any incoming native tokens to the parent address
 * and allows flushing of ERC20 tokens. It also includes withdraw functions for admin.
 */
contract Forwarder is
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    address public parentAddress;

    event ForwarderDeposited(address indexed from, uint256 value);
    event ERC20TokensFlushed(address indexed token, uint256 amount);
    event ParentAddressUpdated(address newParentAddress);
    event WithdrawnERC20(address indexed token, address indexed to, uint256 amount);

    error OnlyParentAllowed();
    error ForwardFailed();
    error InvalidParentAddress();
    error WithdrawFailed();

    constructor(address _parentAddress, address _admin) {
        if (_parentAddress == address(0)) revert InvalidParentAddress();
        parentAddress = _parentAddress;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(PAUSER_ROLE, _admin);
    }

    /**
     * @dev Modifier that only allows the parent address to call the function
     */
    modifier onlyParent() {
        if (msg.sender != parentAddress) revert OnlyParentAllowed();
        _;
    }

    /**
     * @dev Fallback function to receive native tokens and forward them
     */
    receive() external payable {
        _forwardNativeToken(msg.value);
    }

    /**
     * @dev Internal function to forward native tokens to the parent address
     */
    function _forwardNativeToken(uint256 value) internal {
        if (value > 0) {
            (bool success, ) = parentAddress.call{value: value}("");
            if (!success) revert ForwardFailed();
            emit ForwarderDeposited(msg.sender, value);
        }
    }

    /**
     * @dev Function to update the parent address
     * @param newParentAddress The new parent address
     */
    function updateParentAddress(address newParentAddress) external onlyRole(ADMIN_ROLE) {
        if (newParentAddress == address(0)) revert InvalidParentAddress();
        parentAddress = newParentAddress;
        emit ParentAddressUpdated(newParentAddress);
    }

    /**
     * @dev Pauses the contract
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses the contract
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Withdraws ERC20 tokens from the contract
     * @param erc20TokenAddress The address of the ERC20 token contract
     * @param to The address to send the tokens to
     * @param amount The amount of tokens to withdraw
     */
    function withdrawERC20(address erc20TokenAddress, address to, uint256 amount) external onlyRole(ADMIN_ROLE) nonReentrant {
        IERC20 erc20Token = IERC20(erc20TokenAddress);
        if (erc20Token.balanceOf(address(this)) < amount) revert WithdrawFailed();
        erc20Token.safeTransfer(to, amount);
        emit WithdrawnERC20(erc20TokenAddress, to, amount);
    }
}