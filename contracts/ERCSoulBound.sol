// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;



contract ERCSoulBound {
    mapping(uint256 => bool) internal _soulBoundTokens; // low gas usage
    mapping(address => bool) internal _soulBoundAddresses; // mid gas usage
    mapping(address => mapping(uint256 => uint256)) internal _soulBounds; // high gas usage

    event SoulBoundToken(uint256 indexed tokenId);
    event SoulBoundAddress(address indexed to);
    event SoulBound(address indexed to, uint256 indexed tokenId, uint256 amount);
    event SoulBoundBatch(address indexed to, uint256[] indexed tokenIds, uint256[] indexed  amounts);


    modifier soulBoundTokenCheck(uint256 tokenId) {
        require(!_soulBoundTokens[tokenId], "ERCSoulBound: This token is soul bounded");
        _;
    }

    modifier soulBoundAddressCheck(address from) {
        require(from != address(0), "ERCSoulBound: can't be zero address");
        require(!_soulBoundAddresses[from], "ERCSoulBound: This address is soul bounded");
        _;
    }

    modifier soulBoundCheck(address from, uint256 tokenId, uint256 amount) {
        _checkMultipleAmounts(from, tokenId, amount);
        _;
    }

    modifier soulBoundCheckBatch(address from, uint256[] memory tokenIds, uint256[] memory amount) {
        require(tokenIds.length == amount.length, "ERCSoulBound: tokenIds and amounts length mismatch");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            _checkMultipleAmounts(from, tokenIds[i], amount[i]);
        }
        _;
    }

    modifier syncSoulBoundToken(uint256 tokenId) {
        _;
        _soulBoundTokens[tokenId] = true;
    }

    modifier syncSoulBound(uint256 tokenId, uint256 amount) {
        _;
        _soulBounds[msg.sender][tokenId] -= amount;
    }

    modifier syncBatchSoulBound(uint256[] memory tokenIds, uint256[] memory amounts) {
        _;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _soulBounds[msg.sender][tokenIds[i]] -= amounts[i];
        }
    }

    function _checkMultipleAmounts(address from, uint256 tokenId, uint256 amount) private view {
        require(from != address(0), "ERCSoulBound: can't be zero address");
        require(amount > 0, "ERCSoulBound: can't be zero amount");

        if(_soulBounds[from][tokenId] > amount) {
            revert("ERCSoulBound: The amount of soul bounded tokens  is more than the amount of tokens to be transferred");
        }

        if(_soulBounds[from][tokenId] == amount) {
            revert("ERCSoulBound: The amount of soul bounded tokens  is equal to the amount of tokens to be transferred");
        }
    }


    /**
     * @dev SoulBound `tokenId` - ERC721 use cases
     *
     * Emits a {SoulBoundToken} event.
     *
     */
    function _soulBoundToken(uint256 tokenId) internal virtual {
        _soulBoundTokens[tokenId] = true;
        emit SoulBoundToken(tokenId);
    }

    /**
     * @dev SoulBound `tokenId` - ERC1155 use cases
     *
     * Emits a {SoulBound} event.
     *
     */
    function _soulBound(address to, uint256 tokenId, uint256 amount) internal virtual {
        _soulBounds[to][tokenId] += amount;
        emit SoulBound(to, tokenId, amount);
    }

    /**
     * @dev SoulBound `tokenIds` - ERC1155 use cases
     *
     * Emits a {SoulBoundBatch} event.
     *
     */
    function _soulBoundBatch(address to, uint256[] memory tokenIds, uint256[] memory amounts) internal virtual {
        require(tokenIds.length == amounts.length, "ERCSoulBound: tokenIds and amounts length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _soulBounds[to][tokenIds[i]] = amounts[i];
        }
        emit SoulBoundBatch(to, tokenIds, amounts);
    }

    /**
     * @dev SoulBound `address` to save that address  - Custom use cases
     *
     * Emits a {SoulBoundAddress} event.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     */
    function _soulBoundAddress(address to) internal virtual {
        require(to != address(0), "ERCSoulBound: Bound to the zero address not allowed");
        _soulBoundAddresses[to] = true;
        emit SoulBoundAddress(to);
    }

    /**
     * @dev Returns if a `tokenId` is soulBound
     *
     */
    function isSoulBound(uint256 tokenId) public view virtual returns (bool) {
        return _soulBoundTokens[tokenId];
    }

    /**
     * @dev Returns if a `address` is soulBound
     *
     */
    function isSoulBoundAddress(address to) public view virtual returns (bool) {
        return _soulBoundAddresses[to];
    }

}