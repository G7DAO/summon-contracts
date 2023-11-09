// SPDX-License-Identifier: UNLICENSED
///@notice This contract is for mock for WETH token.
pragma solidity ^0.8.20;

import "../ERCSoulBound.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract Mock721SoulBound is ERC721, ERCSoulBound {
    uint256 private _tokenIdCounter;

    constructor() ERC721("Mock721SoulBoundToken", "M721SBT") {}

    function mint(address to) public {
        _tokenIdCounter += 1;
        uint256 tokenId = _tokenIdCounter;
        _safeMint(to, tokenId);
        _soulboundToken(tokenId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override soulboundTokenCheck(tokenId) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
