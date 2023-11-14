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

contract ERCSoulBound {
    mapping(uint256 => bool) internal _soulboundTokens; // low gas usage
    mapping(address => bool) internal _soulboundAddresses; // mid gas usage
    mapping(address => mapping(uint256 => uint256)) internal _soulbounds; // high gas usage
    mapping(address => bool) internal whitelistAddresses;

    event SoulboundToken(uint256 indexed tokenId);
    event SoulboundAddress(address indexed to);
    event Soulbound(address indexed to, uint256 indexed tokenId, uint256 amount);
    event SoulboundBatch(address indexed to, uint256[] indexed tokenIds, uint256[] indexed amounts);


    modifier soulboundTokenCheck(uint256 tokenId) {
        require(!_soulboundTokens[tokenId], "ERCSoulbound: This token is soulbounded");
        _;
    }

    modifier soulboundAddressCheck(address from) {
        require(from != address(0), "ERCSoulbound: can't be zero address");
        require(!_soulboundAddresses[from], "ERCSoulbound: This address is soulbounded");
        _;
    }

    modifier soulboundCheck(
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) {
        _checkMultipleAmounts(from, to, tokenId, amount);
        _;
    }

    modifier soulboundCheckBatch(
        address from,
        address to,
        uint256[] memory tokenIds,
        uint256[] memory amount
    ) {
        require(tokenIds.length == amount.length, "ERCSoulbound: tokenIds and amounts length mismatch");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            _checkMultipleAmounts(from, to, tokenIds[i], amount[i]);
        }
        _;
    }

    modifier syncSoulboundToken(uint256 tokenId) {
        _;
        _soulboundTokens[tokenId] = true;
    }

    modifier syncSoulbound(
        address from,
        uint256 tokenId,
        uint256 amount
    ) {
        _;
        if (_soulbounds[from][tokenId] > 0) {
            _soulbounds[from][tokenId] -= amount;
        }
    }

    modifier syncBatchSoulbound(
        address from,
        uint256[] memory tokenIds,
        uint256[] memory amounts
    ) {
        _;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (_soulbounds[from][tokenIds[i]] > 0) {
                _soulbounds[from][tokenIds[i]] -= amounts[i];
            }
        }
    }

    modifier revertOperation() {
        revert("ERCSoulbound: Operation denied, soulbounded");
        _;
    }

    function _updateWhitelistAddress(address _address, bool _isWhitelisted) internal {
        whitelistAddresses[_address] = _isWhitelisted;
    }

    function _checkMultipleAmounts(address from, address to, uint256 tokenId, uint256 amount) private view {
        require(from != address(0), "ERCSoulbound: can't be zero address");
        require(amount > 0, "ERCSoulbound: can't be zero amount");

        // check if from or to whitelist addresses let it through
        if (whitelistAddresses[from] || whitelistAddresses[to]) {
            return;
        }

        if (_soulbounds[from][tokenId] > amount) {
            revert("ERCSoulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred");
        }

        if (_soulbounds[from][tokenId] == amount) {
            revert("ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred");
        }
    }


    /**
     * @dev Soulbound `tokenId` - ERC721 use cases
     *
     * Emits a {SoulboundToken} event.
     *
     */
    function _soulboundToken(uint256 tokenId) internal virtual {
        _soulboundTokens[tokenId] = true;
        emit SoulboundToken(tokenId);
    }

    /**
     * @dev Soulbound `tokenId` - ERC1155 use cases
     *
     * Emits a {Soulbound} event.
     *
     */
    function _soulbound(address to, uint256 tokenId, uint256 amount) internal virtual {
        _soulbounds[to][tokenId] += amount;
        emit Soulbound(to, tokenId, amount);
    }

    /**
     * @dev Soulbound `tokenIds` - ERC1155 use cases
     *
     * Emits a {SoulboundBatch} event.
     *
     */
    function _soulboundBatch(address to, uint256[] memory tokenIds, uint256[] memory amounts) internal virtual {
        require(tokenIds.length == amounts.length, "ERCSoulbound: tokenIds and amounts length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _soulbounds[to][tokenIds[i]] = amounts[i];
        }
        emit SoulboundBatch(to, tokenIds, amounts);
    }

    /**
     * @dev Soulbound `address` to save that address  - Custom use cases
     *
     * Emits a {SoulboundAddress} event.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     */
    function _soulboundAddress(address to) internal virtual {
        require(to != address(0), "ERCSoulbound: Bound to the zero address not allowed");
        _soulboundAddresses[to] = true;
        emit SoulboundAddress(to);
    }

    /**
     * @dev Returns if a `tokenId` is soulBound
     *
     */
    function isSoulboundToken(uint256 tokenId) public view virtual returns (bool) {
        return _soulboundTokens[tokenId];
    }

    /**
     * @dev Returns if a `tokenId` is soulBound
     *
     */
    function soulboundBalance(address to, uint256 tokenId) public view virtual returns (uint256) {
        return _soulbounds[to][tokenId];
    }

    /**
     * @dev Returns if a `address` is soulBound
     *
     */
    function isSoulboundAddress(address to) public view virtual returns (bool) {
        return _soulboundAddresses[to];
    }
}
