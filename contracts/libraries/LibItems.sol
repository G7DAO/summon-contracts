// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

library LibItems {
    enum Tier {
        COMMON,
        UNCOMMON,
        RARE,
        LEGENDARY,
        MYTHICAL,
        NONE
    }

    struct TokenInfo {
        bool exists;
        bool availableToMint;
        string tokenUri;
        uint256 itemId;
        uint256 level;
        Tier tier;
    }
}
