// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGUnits {
    function deposit(
        bytes calldata data,
        uint256 nonce,
        bytes calldata signature
    ) external;

    function withdraw(
        bytes calldata data,
        uint256 nonce,
        bytes calldata signature
    ) external;

    function pause() external;

    function unpause() external;

    function adminDeposit(
        address[] memory users,
        uint256[] memory amounts
    ) external;

    function withdrawAllAdmin(address[] memory users) external;

    function balanceOf(address account) external view returns (uint256);

    function getExchangeRate() external view returns (uint256, uint256);

    function parseGUnitsToCurrency(
        uint256 _gUnitsAmount
    ) external view returns (uint256);
}
