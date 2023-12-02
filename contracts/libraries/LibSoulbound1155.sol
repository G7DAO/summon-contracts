// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

library LibSoulbound1155 {
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
