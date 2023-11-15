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

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract Mock721ERC721 is ERC721 {
    uint256 private _tokenIdCounter;

    constructor() ERC721("MockERC721", "ERC721") {}

    function mint(address to) public {
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
    }

    function reveal(uint256 tokenId, string memory newURI) public view {
        console.log(newURI);
        console.log(tokenId);
    }
}
