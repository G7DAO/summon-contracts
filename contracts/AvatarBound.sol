// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
* Author: Omar <omar@game7.io>(https://github.com/ogarciarevett)
* Co-Authors: Max <max@game7.io>(https://github.com/vasinl124)
*/

/**                        .;c;.
*                      'lkXWWWXk:.
*                    .dXMMMMMMMMWXkc'.
*               .,..  ,dKNMMMMMMMMMMN0o,.
*             ,dKNXOo'. .;dKNMMMMMMMMMWN0c.
*            .kMMMMMWN0o;. .,lkNMMMMMMWKd,
*            .OMMMMMMMMMN0x:. .'ckXN0o;. ..               .,coooooolloll:..;llll:.   .coll:..colllooll;. ,llollolc'..colllool;. ,lllllolc,..;loooolllloll;..lllol:.   .:looc.
*             :ONMMMMMMMMMMWKxc. .... .:d0d.              :XMMMMWWWWWWWWNk:xWMMW0'   cXMMM0:dWMMMMMMMMX:'OMMMMMMMWKcdWMMMMMMMK:.kWMMMMMMW0:lNMMMMMMMMMMMMWdoNMMMMNk,  lNMMMK,
*              .'cxKWMMMMMMMMMWXkl,.  'o0Nk.              dMMMMW0xddxdddl,,xWMMM0'   cXMMM0cxMMMMWXWMMWOxNMWXXWMMMXlxMMMMWNWMWkxXMWNNWMMMKlkMMMMNK0O0NMMMMOxWMMMMMWKc'oWMMMK,
*            .:l,  .:dKWMMMMMMMMMMNOl,. .;,               ;0NNNNNXXXNWWNXd;xWMMM0'   cNMMM0:xMMMMk:kWMMWWMMKcoNMMMXlxMMMMOlOWMWWMMKldNMMMKlkMMMMO,..,kMMMMOxWMMMWKKWN0KWMMMK,
*            .OMKl.   .;oOXWMMMMMMMMMN0o;.                .coddddddxKMMMMKoxNMMMNkddx0WMMM0:xMMMMx.;XMMMMMWd.cNMMMXlxMMMMk.:XMMMMNo.lNMMMKlkMMMMXOkkOXMMMMOxWMMMXl,dXMMMMMMK,
*            .co;.  .;,. .'lOXWMMMMMMMMMWKl.              :KNNNNNNNNWMMMM0;;OWMMMMMMMMMMMNo'xMMMMx..dNWMMWO,.cNMMMXlxMMMMk..oWMMMO,.lNMMMKcoNMMMMMMMMMMMMWdoNMMMX:  :0WMMMMK,
*               .:dOXWWKd;.  'ckXWMMMMMMMMk.              .;odddddddddddo,  .:loddddddddl,. ;dddd;  .clddo;  ,odddl,:dddd:  .lddd;  ,odddl..:oddddddddddo:.'lddd:.   'lddddl.
*             .c0WMMMMMMMWKd:.  .:xXWMMMWNo.
*             ,oONWMMMMMMMMWXOl.  .;okxl'
*                .,lkXWMMMMMMMMWXO:
*                    .ckKWMMMMMWKd;
*                       .:d0X0d:.
*                          ...
*/


import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import { ERCSoulBound } from "./ERCSoulBound.sol";

contract AvatarBound is ERC721URIStorage, ERC721Enumerable, AccessControl, ERCSoulBound {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant URI_SETTER_ROLE = keccak256("URI_SETTER_ROLE");
    uint256 private _tokenIdCounter;
    string public baseTokenURI;
    string private contractURI = "";

    event URIChanged(uint256 indexed tokenId);
    event BaseURIChanged(string indexed uri);


    constructor(string memory _name, string memory _symbol, string memory _baseTokenURI, string memory _contractURI) ERC721(_name, _symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        baseTokenURI = _baseTokenURI;
        contractURI = _contractURI;
    }

    function mint(address to, string memory uri) public  {
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        _soulboundToken(tokenId);
    }

    function tokenURI(uint256 tokenId)
    public
    view
    override(ERC721, ERC721URIStorage)
    returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function batchSetTokenURI(uint256[] memory tokenIds, string[] memory tokenURIs) public onlyRole(URI_SETTER_ROLE) {
        require(tokenIds.length == tokenURIs.length, "TokenIds and URIs length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(_ownerOf(tokenIds[i] != address(0)), "URI set of nonexistent token");
            _setTokenURI(tokenIds[i], tokenURIs[i]);
        }
    }

    function setContractURI(string memory _contractURI) public onlyRole(DEFAULT_ADMIN_ROLE) {
        contractURI = _contractURI;
    }

    function setTokenURI(uint256 tokenId, string memory tokenURL) public onlyRole(URI_SETTER_ROLE) {
        require(_ownerOf(tokenId != address(0)), "URI set of nonexistent token");
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

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batch
    ) internal override(ERC721, ERC721Enumerable) soulboundTokenCheck(tokenId) {
        super._beforeTokenTransfer(from, to, tokenId, batch);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) revertOperation {
        super._burn(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, ERC721Enumerable, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
