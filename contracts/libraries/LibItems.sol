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
    }

    struct TokenReturn {
        uint256 tokenId;
        string tokenUri;
        uint256 amount;
    }
}

library TestLibItems {
    enum Tier {
        NONE,
        COMMON,
        UNCOMMON,
        RARE,
        LEGENDARY,
        MYTHICAL
    }
}
