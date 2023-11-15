// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

interface ISoulBound1155 {
    // From ERC1155
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external;

    function burn(
        address to,
        uint256 id,
        uint256 amount
    ) external;

    function burnBatch(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external;

    // From SoulBound1155
    function pause() external;
    function unpause() external;
    function addNewToken(uint256 tokenId) external;
    function mint(address to, uint256 id, uint256 amount, bool soulBound) external;
    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts, bool soulBound) external;
    function uri(uint256 tokenId) external view returns (string memory);
    function updateBaseUri(string calldata _baseURI) external;
    function setRoyaltyInfo(address receiver, uint96 feeBasisPoints) external;
    function updateWhitelistAddress(address _address, bool _isWhitelisted) external;

    // From AccessControl
    function hasRole(bytes32 role, address account) external view returns (bool);

    // Additional getters (optional, based on your requirements)
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function MAX_PER_MINT() external view returns (uint256);
    function tokenExists(uint256 tokenId) external view returns (bool);
}