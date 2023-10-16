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
        _soulBoundToken(tokenId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batch
    ) internal override(ERC721) soulBoundTokenCheck(tokenId) {
        super._beforeTokenTransfer(from, to, tokenId, batch);
    }

    //  TODO: check all the ids here, checking only one for now
//    function safeBatchTransferFrom(address _from, address _to, uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data) soulBoundCheck(_from, _id) public virtual override {
//        super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);
//    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721) returns (bool) {
        return super.supportsInterface(interfaceId);
    }


}
