// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

/*                        .;c;.
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

import "../ERCSoulbound.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract Mock721Soulbound is ERC721, ERCSoulbound {
    uint256 private _tokenIdCounter;

    constructor() ERC721("Mock721SoulboundToken", "M721SBT") {}

    function mint(address to) public {
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        _soulboundToken(tokenId);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batch) internal override(ERC721) soulboundTokenCheck(tokenId) {
        super._beforeTokenTransfer(from, to, tokenId, batch);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
