// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.17;

import "../libraries/LibItems.sol";

interface IItemBound {
    event SignerAdded(address indexed signer);

    event SignerRemoved(address indexed signer);

    event ContractURIChanged(string indexed uri);

    function getAllItems(address _owner) external view returns (LibItems.TokenReturn[] memory);

    function isTokenExist(uint256 _tokenId) external view returns (bool);

    function addNewToken(LibItems.TokenCreate calldata _token) external;

    function addNewTokens(LibItems.TokenCreate[] calldata _tokens) external;

    function updateTokenUri(uint256 _tokenId, string calldata _tokenUri) external;

    function updateTokenMintPaused(uint256 _tokenId, bool _isTokenMintPaused) external;

    function getCurrentMaxLevel() external view returns (uint256);

    function getItemsPerTierPerLevel(LibItems.Tier _tier, uint256 _level) external view returns (uint256[] memory);

    function mint(
        bytes calldata data,
        uint256 amount,
        bool soulbound,
        uint256 nonce,
        bytes calldata signature
    ) external;

    function adminMint(address to, bytes calldata data, bool soulbound) external;

    function adminMintId(address to, uint256 id, uint256 amount, bool soulbound) external;

    function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _amount, bytes memory _data) external;

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) external;

    function burn(address to, uint256 tokenId, uint256 amount) external;

    function burnBatch(address to, uint256[] memory tokenIds, uint256[] memory amounts) external;

    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    function uri(uint256 tokenId) external view returns (string memory);

    function updateBaseUri(string memory _baseURI) external;

    function setRoyaltyInfo(address receiver, uint96 feeBasisPoints) external;

    function updateWhitelistAddress(address _address, bool _isWhitelisted) external;

    function setContractURI(string memory _contractURI) external;

    function adminVerifySignature(
        address to,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) external view returns (bool);

    function addWhitelistSigner(address _signer) external;

    function removeWhitelistSigner(address signer) external;
}
