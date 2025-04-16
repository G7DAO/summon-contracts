// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../Game.sol"; // original Game contract

contract GameV2 is Game {
    function upgradeTestFunction() external pure returns (string memory) {
        return "Successful test!";
    }
}