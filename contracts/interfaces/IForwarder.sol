// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IForwarder {
    event ForwarderDeposited(address indexed from, uint256 value);
    event ERC20TokensFlushed(address indexed token, uint256 amount);
    event ParentAddressUpdated(address newParentAddress);

    function parentAddress() external view returns (address);
    function flushERC20Tokens(address tokenAddress) external;
    function updateParentAddress(address newParentAddress) external;
    function pause() external;
    function unpause() external;

    // AccessControl functions
    function hasRole(bytes32 role, address account) external view returns (bool);
    function getRoleAdmin(bytes32 role) external view returns (bytes32);
    function grantRole(bytes32 role, address account) external;
    function revokeRole(bytes32 role, address account) external;
    function renounceRole(bytes32 role, address account) external;
}