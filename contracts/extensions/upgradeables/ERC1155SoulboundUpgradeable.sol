// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

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
 *            .OMMMMMMMMMN0x:. .'ckXN0o;. ..
 *             :ONMMMMMMMMMMWKxc. .... .:d0d.
 *              .'cxKWMMMMMMMMMWXkl,.  'o0Nk.
 *            .:l,  .:dKWMMMMMMMMMMNOl,. .;,
 *            .OMKl.   .;oOXWMMMMMMMMMN0o;.
 *            .co;.  .;,. .'lOXWMMMMMMMMMWKl.
 *               .:dOXWWKd;.  'ckXWMMMMMMMMk.
 *             .c0WMMMMMMMWKd:.  .:xXWMMMWNo.
 *             ,oONWMMMMMMMMWXOl.  .;okxl'
 *                .,lkXWMMMMMMMMWXO:
 *                    .ckKWMMMMMWKd;
 *                       .:d0X0d:.
 *                          ...
 */

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ERC1155SoulboundUpgradeable is Initializable {
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
        require(tokenIds.length == amounts.length, "ERC1155SoulboundUpgradeable: tokenIds and amounts length mismatch");
        require(
            amounts.length == totalAmounts.length,
            "ERC1155SoulboundUpgradeable: tokenIds and amounts length mismatch"
        );

        for (uint256 i = 0; i < tokenIds.length; i++) {
            _checkMultipleAmounts(from, to, tokenIds[i], amounts[i], totalAmounts[i]);
            _syncSoulbound(from, to, tokenIds[i], amounts[i], totalAmounts[i]);
        }
        _;
    }

    modifier revertOperation() {
        revert("ERC1155SoulboundUpgradeable: Operation denied, soulbounded");
        _;
    }

    function __ERC1155SoulboundUpgradable_init() internal onlyInitializing {}

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
        require(from != address(0), "ERC1155SoulboundUpgradeable: can't be zero address");
        require(amount > 0, "ERC1155SoulboundUpgradeable: can't be zero amount");
        require(amount <= totalAmount, "ERC1155SoulboundUpgradeable: can't transfer more than you have");
        // check if from or to whitelist addresses let it through
        if (whitelistAddresses[from] || whitelistAddresses[to]) {
            return;
        }

        if (totalAmount - _soulbounds[from][tokenId] < amount) {
            revert(
                "ERC1155SoulboundUpgradeable: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
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
        require(tokenIds.length == amounts.length, "ERC1155SoulboundUpgradeable: tokenIds and amounts length mismatch");
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
        require(to != address(0), "ERC1155SoulboundUpgradeable: Bound to the zero address not allowed");
        _soulboundAddresses[to] = true;
        emit SoulboundAddress(to);
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[47] private __gap;
}