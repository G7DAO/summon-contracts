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

contract ERC721SoulboundUpgradeable is Initializable {
    mapping(address => bool) internal _soulboundAddresses; // mid gas usage
    mapping(address => bool) internal whitelistAddresses;

    event SoulboundToken(uint256 indexed tokenId);
    event SoulboundAddress(address indexed to);

    modifier soulboundAddressCheck(address from) {
        require(!_soulboundAddresses[from], "ERC721SoulboundUpgradeable: This address is soulbounded");
        _;
    }

    modifier revertOperation() {
        revert("ERC721SoulboundUpgradeable: Operation denied, soulbounded");
        _;
    }

    function __ERC721SoulboundUpgradable_init() internal onlyInitializing {}

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
        require(to != address(0), "ERC721SoulboundUpgradeable: Bound to the zero address not allowed");
        _soulboundAddresses[to] = true;
        emit SoulboundAddress(to);
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[48] private __gap;
}
