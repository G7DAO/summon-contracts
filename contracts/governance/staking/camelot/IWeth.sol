// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

interface IWeth {
    /// @notice Unwraps ERC20 token into native token
    /// @param amount Amount to withdraw
    function withdraw(uint256 amount) external;

    /// @notice Wraps native token into ERC20 token
    function deposit() external payable;
}
