// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../libraries/LibItems.sol";

interface IRandomItem {
    function updateTiers(uint8[] memory _percents, LibItems.Tier[] memory _names) external;

    function randomItem(uint256 seed, uint256 level) external returns (uint256);

    function setItemBoundContract(address contractAddress) external;
}
