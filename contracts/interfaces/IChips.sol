// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IChips {
    function deposit(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function retrieveBuyIn(address from, uint256 amount) external;

    function distributeChips(
        address[] memory users,
        uint256[] memory amounts
    ) external;

    function pause() external;

    function unpause() external;

    function adminDeposit(
        address[] memory users,
        uint256[] memory amounts
    ) external;

    function withdrawAllAdmin(address[] memory users) external;

    function balanceOf(address account) external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function decimals() external view returns (uint8);
}
