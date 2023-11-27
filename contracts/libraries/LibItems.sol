// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

library LibItems {
    enum Tier {
        NONE,
        COMMON,
        UNCOMMON,
        RARE,
        LEGENDARY,
        MYTHICAL
    }

    struct TokenCreate {
        uint256 tokenId;
        string tokenUri;
        LibItems.Tier tier;
        uint256 level;
    }
}
