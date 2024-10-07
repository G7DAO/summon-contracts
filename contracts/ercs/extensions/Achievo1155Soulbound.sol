// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
 * Author: Achievo Team - (https://achievo.xyz/)
 */

// @author Summon.xyz Team - https://summon.xyz
// @contributors: [ @ogarciarevett, @vasinl124]
//....................................................................................................................................................
//....................&&&&&&..........................................................................................................................
//..................&&&&&&&&&&&.......................................................................................................................
//..............X.....&&&&&&&&&&&&....................................................................................................................
//............&&&&&&.....&&&&&&&&&&&..................................................................................................................
//............&&&&&&&&&.....&&&&&.....................................................................................................................
//............&&&&&&&&&&&&.........&.............&&&&&&&&&&&&..&&&&....&&&&.&&&&&&&&..&&&&&&&.&&&&&&&&..&&&&&&&&.&&&&&&&&&&&&.&&&&&....&&&&...........
//...............&&&&&&&&&&&&.....&&$............&&&&..........&&&&....&&&&.&&&&&&&&.&&&&&&&&..&&&&&&&&.&&&&&&&&.&&&&&&&&&&&&.&&&&&&&..&&&&...........
//............&.....&&&&&&&&&&&&..................&&&&&&&&&&&..&&&&....&&&&.&&&&..&&&&&&.&&&&..&&&&.&&&&&&..&&&&.&&&&....&&&&.&&&&.&&&&&&&&...........
//............&&.......&&&&&&&&&&&&......................&&&&..&&&&&&&&&&&&.&&&&..&&&&&..&&&&..&&&&..&&&&...&&&&.&&&&&&&&&&&&.&&&&...&&&&&&...........
//................&&&.....&&&&&&&&&&+............&&&&&&&&&&&&...&&&&&&&&&&..&&&&...&&&&..&&&&.&&&&&..&&&&...&&&&.&&&&&&&&&&&&.&&&&....&&&&&...........
//.............&&&&&&&&&.....&&&&&&&..................................................................................................................
//.............&&&&&&&&&&&&.....&&&...................................................................................................................
//.................&&&&&&&&&&&........................................................................................................................
//....................&&&&&&&.........................................................................................................................
//....................................................................................................................................................

contract Achievo1155Soulbound {
    mapping(address => bool) internal _soulboundAddresses; // mid gas usage
    mapping(address => mapping(uint256 => uint256)) internal _soulbounds; // high gas usage
    mapping(address => bool) internal whitelistAddresses;

    event SoulboundAddress(address indexed to);
    event Soulbound(address indexed to, uint256 indexed tokenId, uint256 amount);
    event SoulboundBatch(address indexed to, uint256[] indexed tokenIds, uint256[] indexed amounts);

    modifier soulboundCheckAndSync(
        address from,
        address to,
        uint256 tokenId,
        uint256 amount,
        uint256 totalAmount
    ) {
        _checkMultipleAmounts(from, to, tokenId, amount, totalAmount);
        _syncSoulbound(from, to, tokenId, amount, totalAmount);
        _;
    }

    modifier soulboundCheckAndSyncBatch(
        address from,
        address to,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        uint256[] memory totalAmounts
    ) {
        require(amounts.length == totalAmounts.length, "Achievo1155Soulbound: tokenIds and amounts length mismatch");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            _checkMultipleAmounts(from, to, tokenIds[i], amounts[i], totalAmounts[i]);
            _syncSoulbound(from, to, tokenIds[i], amounts[i], totalAmounts[i]);
        }
        _;
    }

    modifier revertOperation() {
        revert("Achievo1155Soulbound: Operation denied, soulbounded");
        _;
    }

    /**
     * @dev Returns if a `tokenId` is soulbound
     *
     */
    function soulboundBalance(address to, uint256 tokenId) external view virtual returns (uint256) {
        return _soulbounds[to][tokenId];
    }

    /**
     * @dev Returns if a `address` is soulbound
     *
     */
    function isSoulboundAddress(address to) public view virtual returns (bool) {
        return _soulboundAddresses[to];
    }

    function _getWhitelistAddress(address _address) internal view returns (bool) {
        return whitelistAddresses[_address];
    }

    function _updateWhitelistAddress(address _address, bool _isWhitelisted) internal {
        whitelistAddresses[_address] = _isWhitelisted;
    }

    function _checkMultipleAmounts(
        address from,
        address to,
        uint256 tokenId,
        uint256 amount,
        uint256 totalAmount
    ) private view {
        require(amount > 0, "Achievo1155Soulbound: can't be zero amount");
        // check if from or to whitelist addresses let it through
        if (whitelistAddresses[from] || whitelistAddresses[to] || whitelistAddresses[msg.sender]) {
            return;
        }

        if (totalAmount - _soulbounds[from][tokenId] < amount) {
            revert(
                "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
            );
        }
    }

    function _syncSoulbound(address from, address to, uint256 tokenId, uint256 amount, uint256 totalAmount) private {
        if (_soulbounds[from][tokenId] > 0) {
            uint256 nonSoulboundAmount = totalAmount - _soulbounds[from][tokenId];

            if (nonSoulboundAmount < amount) {
                uint256 soulboundDiffAmount = amount - nonSoulboundAmount;
                _soulbounds[from][tokenId] -= soulboundDiffAmount;
                if (to != address(0)) {
                    _soulbounds[to][tokenId] += soulboundDiffAmount;
                }
            }
        }
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
        require(tokenIds.length == amounts.length, "Achievo1155Soulbound: tokenIds and amounts length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _soulbounds[to][tokenIds[i]] += amounts[i];
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
        require(to != address(0), "Achievo1155Soulbound: Bound to the zero address not allowed");
        _soulboundAddresses[to] = true;
        emit SoulboundAddress(to);
    }
}
