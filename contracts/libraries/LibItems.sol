// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

library LibItems {
    struct Tier {
        uint256 tierId;
        string tierName;
    }

    struct TokenCreate {
        uint256 tokenId;
        string tokenUri;
        uint256 tier;
        uint256 level;
    }

    struct TokenReturn {
        uint256 tokenId;
        string tokenUri;
        uint256 amount;
    }
}
