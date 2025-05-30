// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library LibGUnits {
    struct PayoutData {
        address player;
        bool isWinner;
        uint256 amount;
    }
}
