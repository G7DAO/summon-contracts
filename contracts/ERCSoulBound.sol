// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;



contract ERCSoulBound {
    mapping(uint256 => bool) internal _soulboundTokens; // low gas usage
    mapping(address => bool) internal _soulboundAddresses; // mid gas usage
    mapping(address => mapping(uint256 => uint256)) internal _soulbounds; // high gas usage

    event SoulboundToken(uint256 indexed tokenId);
    event SoulboundAddress(address indexed to);
    event Soulbound(address indexed to, uint256 indexed tokenId, uint256 amount);
    event SoulboundBatch(address indexed to, uint256[] indexed tokenIds, uint256[] indexed  amounts);


    modifier soulboundTokenCheck(uint256 tokenId) {
        require(!_soulboundTokens[tokenId], "ERCSoulbound: This token is soul bounded");
        _;
    }

    modifier soulboundAddressCheck(address from) {
        require(from != address(0), "ERCSoulbound: can't be zero address");
        require(!_soulboundAddresses[from], "ERCSoulbound: This address is soul bounded");
        _;
    }

    modifier soulboundCheck(address from, uint256 tokenId, uint256 amount) {
        _checkMultipleAmounts(from, tokenId, amount);
        _;
    }

    modifier soulboundCheckBatch(address from, uint256[] memory tokenIds, uint256[] memory amount) {
        require(tokenIds.length == amount.length, "ERCSoulbound: tokenIds and amounts length mismatch");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            _checkMultipleAmounts(from, tokenIds[i], amount[i]);
        }
        _;
    }

    modifier syncSoulboundToken(uint256 tokenId) {
        _;
        _soulboundTokens[tokenId] = true;
    }

    modifier syncSoulbound(uint256 tokenId, uint256 amount) {
        _;
        _soulbounds[msg.sender][tokenId] -= amount;
    }

    modifier syncBatchSoulbound(uint256[] memory tokenIds, uint256[] memory amounts) {
        _;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _soulbounds[msg.sender][tokenIds[i]] -= amounts[i];
        }
    }

    function _checkMultipleAmounts(address from, uint256 tokenId, uint256 amount) private view {
        require(from != address(0), "ERCSoulbound: can't be zero address");
        require(amount > 0, "ERCSoulbound: can't be zero amount");

        if(_soulbounds[from][tokenId] > amount) {
            revert("ERCSoulbound: The amount of soul bounded tokens  is more than the amount of tokens to be transferred");
        }

        if(_soulbounds[from][tokenId] == amount) {
            revert("ERCSoulbound: The amount of soul bounded tokens  is equal to the amount of tokens to be transferred");
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