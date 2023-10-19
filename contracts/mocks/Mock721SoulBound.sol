// SPDX-License-Identifier: UNLICENSED
///@notice This contract is for mock for WETH token.
pragma solidity ^0.8.17;

import "../ERCSoulBound.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Mock721SoulBound is ERC721, ERCSoulBound {

    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    constructor() ERC721("Mock721SoulBoundToken", "M721SBT") {}

    function mint(address to) public  {
        _tokenIdCounter.increment();
         uint256 tokenId = _tokenIdCounter.current();
        _safeMint(to, tokenId);
        _soulboundToken(tokenId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batch
    ) internal override(ERC721) soulboundTokenCheck(tokenId) {
        super._beforeTokenTransfer(from, to, tokenId, batch);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
