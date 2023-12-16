// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

/**
 * Author: Omar <omar@game7.io>(https://github.com/ogarciarevett)
 * Co-Authors: Max <max@game7.io>(https://github.com/vasinl124)
 */

// MMMMNkc. .,oKWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// MWXd,.      .cONMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// Wx'           .cKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// x.              ;KMMMMMMMMMMMMWKxlcclxKWMMMMMMMMWKxlc::::::::ckWMMXd:cOMMMMMMMMKo:oKMMWkccxWMWKdccccccccccccoKMM0l:l0MMMMMMMMMWkc:dXMMMXkoc::::::clxKW
// '                lNMMMMMMMMMMNd.  ..  .dNMMMMMMNd.  ..........oWMM0'  oWMMMMMMMk. .kMMN:  :XMNl   .''''''''';OMMX:  ,0MMMMMMMWk.  oNMWk'  ........  .o
// .                :XMMMMMMMMMWd. .o00l. .dWMMMMWx. .o0KKXKKXXXXNMMM0'  oNWWWWWWWk. .kMMN:  :NMNc  .kNNNNNNNNNNWMMM0,  :XMMMMMM0,  cXMMO.  c0KKKKXK0o.
// , .lkxo.  ;dkx,  oWMMMMMMMMWk.  oNMMNo. .kWMMMWl  ;KMMMMMMMMMMMMMM0'  .',',,,,,.  .kMMN:  :NMNc   ,:;;;;;;dXMMMMMMO.  lNMMMMK:  ;KMMMd. .OMMMMMMMMX;
// :  :KWX: .xMWx. .kMMMMMMMMM0'  cXMMMMXc  ,0MMMWl  ;KMMMMMMMMMMMMMM0'  .',,'',,,.  .kMMN:  :NMNc   ',,;;,;;oXMMMMMMWx. .dWMMNc  'OMMMMd. .OMMMMMMMMX;
// l   ,0WO:oXWd.  .OMMMMMMMMK;  ;KMMMMMMK;  :KMMWd. .o0KKXXKKKXXNMMM0'  oNWWWWWWWx. .kMMN:  :XMNc  .kNNNNNNNNWWWMMMMMNo. .dK0l. .xWMMMMO. .c0KKKXXK0o.
// o    dWMWWMK,   '0MMMMMMMXc  'OMMMMMMMMO'  cNMMNd.  ..........oWMM0'  oWMMMMMMMk. .kMMN:  :XMNl   .,,,,,,,,,:0MMMMMMNo.  ..  'xWMMMMMWx'   .......  .o
// O'   :XMMMMk.   cXMMMMMMMKo:cOWMMMMMMMMWOc:oKMMMWKxlc::::::::ckWMMXd:cOMMMMMMMMKo:oKMMWkc:xWMWKoc:::::::::::lKMMMMMMMWKdlcclxXWMMMMMMMMXkoc::::::clxKW
// WO;  'OMMMWl  .oXMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// MMNx'.dWMMK;.:0WMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// MMMM0cdNMM0cdNMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { LibItems } from "../libraries/LibItems.sol";

contract ItemTierManagerUpgradeable is Initializable {
    event TierAdded(uint256 tierId, string tierName);
    event TierRemoved(uint256 tierId, string tierName);

    mapping(uint256 => LibItems.Tier) public tiers; // tierId => tier

    function __ItemTierManagerUpgradeableUpgradeable_init() internal onlyInitializing {
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
