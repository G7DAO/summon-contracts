// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * Authors: Omar Garcia <omar@game7.io>
 * GitHub: https://github.com/ogarciarevett
 */

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AvatarBound is ERC721URIStorage, ERC721Enumerable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 private _tokenIdCounter;
    //    TODO: FILL ME
    string public baseTokenURI;
    // TODO: change this to the latest image - waiting for product
    string private _contractURI = "";

    event URIChanged(uint256 indexed tokenId);
    event BaseURIChanged(string indexed uri);
    mapping(uint256 => bool) private _soulboundTokens;



    constructor(string memory _name, string memory _symbol, string memory _baseTokenURI) ERC721(_name, _symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        baseTokenURI = _baseTokenURI;
    }

    function safeMint(address to, string memory uri) public  {
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batch
    ) internal override(ERC721, ERC721Enumerable) {
        require(!_soulboundTokens[tokenId], "This token is soulbound and cannot be transferred");
        super._beforeTokenTransfer(from, to, tokenId, batch);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        require(!_soulboundTokens[tokenId], "This token is soulbound and cannot be burned");
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
    public
    view
    override(ERC721, ERC721URIStorage)
    returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function batchSetTokenURI(uint256[] memory tokenIds, string[] memory tokenURIs) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tokenIds.length == tokenURIs.length, "OpenMintZk: tokenIds and URIs length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(_exists(tokenIds[i]), "OpenMintZk: URI set of nonexistent token");
            _setTokenURI(tokenIds[i], tokenURIs[i]);
        }
    }

    function changeURI(uint256 tokenId, string memory tokenURL) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_exists(tokenId), "URI set of nonexistent token");
        _setTokenURI(tokenId, tokenURL);
        emit URIChanged(tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    function setBaseURI(string memory _baseTokenURI) public onlyRole(DEFAULT_ADMIN_ROLE) {
        baseTokenURI = _baseTokenURI;
        emit BaseURIChanged(baseTokenURI);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, ERC721Enumerable, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
