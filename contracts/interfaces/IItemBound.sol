// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../libraries/LibItems.sol";
import "./ISoulbound1155.sol";

interface IItemBound is ISoulbound1155 {
    function addNewToken(uint256 _tokenId, LibItems.TokenInfo calldata _token) external;

    function addNewTokens(uint256[] calldata _tokenIds, LibItems.TokenInfo[] calldata _tokens) external;

    function updateTokenInfo(uint256 _tokenId, LibItems.TokenInfo calldata _token) external;

    function getTokenInfo(uint256 _tokenId) external returns (LibItems.TokenInfo memory);

    function isTokenExist(uint256 tokenId) external view returns (bool);

    function checkTokenId(uint256 _tokenId, uint256 _itemId, uint256 _level, LibItems.Tier _tier) external pure;

    function getCurrentMaxLevel() external view returns (uint256);

    function getItemsPerTierPerLevel(LibItems.Tier _tier, uint256 _level) external view returns (uint256[] memory);

    function mint(uint256 id, uint256 amount, bool soulbound, uint256 nonce, bytes memory signature) external returns (uint256, uint256, bool);

    function mintRandom(uint256 seed, uint256 amount, bool soulbound, uint256 nonce, bytes memory signature) external returns (uint256, uint256, bool);

    function mintRandomAtLevel(
        uint256 seed,
        uint256 level,
        uint256 amount,
        bool soulbound,
        uint256 nonce,
        bytes memory signature
    ) external returns (uint256, uint256, bool);

    function adminMint(address to, uint256 id, uint256 amount, bool soulbound) external returns (address, uint256, uint256, bool);

    function adminMintRandom(address to, uint256 seed, uint256 amount, bool soulbound) external returns (address, uint256, uint256, bool);

    function adminMintRandomAtLevel(address to, uint256 seed, uint256 level, uint256 amount, bool soulbound) external returns (address, uint256, uint256, bool);

    function setSigner(address _signer) external;

    function removeSigner(address signer) external;

    function setRandomItemContract(address contractAddress) external;
}
