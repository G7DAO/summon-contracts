// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

/**
 * Author: Max <max@game7.io>(https://github.com/vasinl124)
 * Co-Authors: Omar <omar@game7.io>(https://github.com/ogarciarevett)
 */

/*                        .;c;.
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

import { LibItems } from "./libraries/LibItems.sol";
import "forge-std/Test.sol";

contract ItemTierManager {
    event TierAdded(uint256 tierId, string tierName);
    event TierRemoved(uint256 tierId, string tierName);

    mapping(uint256 => LibItems.Tier) public tiers; // tierId => tier

    constructor() {
        LibItems.Tier[] memory _tiers = new LibItems.Tier[](6);
        _tiers[0] = LibItems.Tier({ tierId: 0, tierName: "NONE" });
        _tiers[1] = LibItems.Tier({ tierId: 1, tierName: "COMMON" });
        _tiers[2] = LibItems.Tier({ tierId: 2, tierName: "UNCOMMON" });
        _tiers[3] = LibItems.Tier({ tierId: 3, tierName: "RARE" });
        _tiers[4] = LibItems.Tier({ tierId: 4, tierName: "LEGENDARY" });
        _tiers[5] = LibItems.Tier({ tierId: 5, tierName: "MYTHICAL" });

        _addTiers(_tiers);
    }

    function _addTier(LibItems.Tier memory _tier) internal {
        tiers[_tier.tierId] = _tier;
        emit TierAdded(_tier.tierId, _tier.tierName);
    }

    function _addTiers(LibItems.Tier[] memory _tiers) internal {
        for (uint256 i = 0; i < _tiers.length; i++) {
            _addTier(_tiers[i]);
        }
    }

    function _removeTier(uint256 _tierId) internal {
        LibItems.Tier memory _tier = tiers[_tierId];
        delete tiers[_tierId];
        emit TierRemoved(_tier.tierId, _tier.tierName);
    }

    function _removeTiers(uint256[] memory _tierIds) internal {
        for (uint256 i = 0; i < _tierIds.length; i++) {
            _removeTier(_tierIds[i]);
        }
    }

    function isTierExist(uint256 _tierId) public view returns (bool) {
        if (bytes(tiers[_tierId].tierName).length > 0) {
            return true;
        }
    }
}
