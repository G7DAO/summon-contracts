// SPDX-License-Identifier: MIT

// @author Summon.xyz Team - https://summon.xyz
// @contributors: [ @ogarciarevett, @vasinl124]
//....................................................................................................................................................
//....................&&&&&&..........................................................................................................................
//..................&&&&&&&&&&&.......................................................................................................................
//..............X.....&&&&&&&&&&&&....................................................................................................................
//............&&&&&&.....&&&&&&&&&&&..................................................................................................................
//............&&&&&&&&&.....&&&&&.....................................................................................................................
//............&&&&&&&&&&&&.........&.............&&&&&&&&&&&&..&&&&....&&&&.&&&&&&&&..&&&&&&&.&&&&&&&&..&&&&&&&&.&&&&&&&&&&&&.&&&&&....&&&&...........
//...............&&&&&&&&&&&&.....&&$............&&&&..........&&&&....&&&&.&&&&&&&&.&&&&&&&&..&&&&&&&&.&&&&&&&&.&&&&&&&&&&&&.&&&&&&&..&&&&...........
//............&.....&&&&&&&&&&&&..................&&&&&&&&&&&..&&&&....&&&&.&&&&..&&&&&&.&&&&..&&&&.&&&&&&..&&&&.&&&&....&&&&.&&&&.&&&&&&&&...........
//............&&.......&&&&&&&&&&&&......................&&&&..&&&&&&&&&&&&.&&&&..&&&&&..&&&&..&&&&..&&&&...&&&&.&&&&&&&&&&&&.&&&&...&&&&&&...........
//................&&&.....&&&&&&&&&&+............&&&&&&&&&&&&...&&&&&&&&&&..&&&&...&&&&..&&&&.&&&&&..&&&&...&&&&.&&&&&&&&&&&&.&&&&....&&&&&...........
//.............&&&&&&&&&.....&&&&&&&..................................................................................................................
//.............&&&&&&&&&&&&.....&&&...................................................................................................................
//.................&&&&&&&&&&&........................................................................................................................
//....................&&&&&&&.........................................................................................................................
//....................................................................................................................................................

pragma solidity ^0.8.24;

interface ISoulbound1155 {
    // From ERC1155
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external;

    function burn(address to, uint256 id, uint256 amount) external;

    function burnBatch(address to, uint256[] calldata ids, uint256[] calldata amounts) external;

    // From Soulbound1155.sol
    function pause() external;

    function unpause() external;

    function addNewToken(uint256 tokenId) external;

    function mint(address to, uint256 id, uint256 amount, bool soulbound) external;

    function adminMintId(address to, uint256 id, uint256 amount, bool soulbound) external;

    function adminMint(address to, bytes calldata data, bool soulbound) external;

    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts, bool soulbound) external;

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
