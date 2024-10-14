// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

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

contract Summon721Soulbound {
    mapping(uint256 => bool) internal _soulboundTokens; // low gas usage
    mapping(address => bool) internal _soulboundAddresses; // mid gas usage
    mapping(address => bool) internal whitelistAddresses;

    event SoulboundToken(uint256 indexed tokenId);
    event SoulboundAddress(address indexed to);

    error TokenIsSoulbound(uint256 tokenId);
    error AddressIsSoulbound(address addr);
    error OperationDeniedSoulbound();
    error BoundToZeroAddressNotAllowed();

    modifier soulboundTokenCheck(uint256 tokenId) {
        if (_soulboundTokens[tokenId]) {
            revert TokenIsSoulbound(tokenId);
        }
        _;
    }

    modifier soulboundAddressCheck(address from) {
        if (_soulboundAddresses[from]) {
            revert AddressIsSoulbound(from);
        }
        _;
    }

    modifier revertOperation() {
        revert OperationDeniedSoulbound();
        _;
    }

    /**
     * @dev Returns if a `tokenId` is soulbound
     *
     */
    function isSoulboundToken(
        uint256 tokenId
    ) external view virtual returns (bool) {
        return _soulboundTokens[tokenId];
    }

    /**
     * @dev Returns if a `address` is soulbound
     *
     */
    function isSoulboundAddress(address to) public view virtual returns (bool) {
        return _soulboundAddresses[to];
    }

    function _updateWhitelistAddress(
        address _address,
        bool _isWhitelisted
    ) internal {
        whitelistAddresses[_address] = _isWhitelisted;
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
     * @dev Soulbound `address` to save that address  - Custom use cases
     *
     * Emits a {SoulboundAddress} event.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     */
    function _soulboundAddress(address to) internal virtual {
        if (to == address(0)) {
            revert BoundToZeroAddressNotAllowed();
        }
        _soulboundAddresses[to] = true;
        emit SoulboundAddress(to);
    }
}
