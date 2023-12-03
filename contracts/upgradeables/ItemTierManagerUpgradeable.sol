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
import { ERC1155Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {
    ERC1155BurnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import {
    ERC1155SupplyUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import { StringsUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import { ERC2981Upgradeable } from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import { ECDSAUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import { ERCSoulboundUpgradeable } from "./ERCSoulboundUpgradeable.sol";
import { ERCWhitelistSignatureUpgradeable } from "./ERCWhitelistSignatureUpgradeable.sol";
import { LibItems } from "../libraries/LibItems.sol";

contract ItemTierManagerUpgradeable is Initializable, AccessControlUpgradeable {
    event TierAdded(uint256 tierId, string tierName);
    event TierRemoved(uint256 tierId, string tierName);

    bytes32 private constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    mapping(uint256 => LibItems.Tier) public tiers; // tierId => tier

    function __ItemTierManagerUpgradeableUpgradeable_init() internal onlyInitializing {
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);

        LibItems.Tier[] memory _tiers = new LibItems.Tier[](6);
        _tiers[0] = LibItems.Tier({ tierId: 0, tierName: "NONE" });
        _tiers[1] = LibItems.Tier({ tierId: 1, tierName: "COMMON" });
        _tiers[2] = LibItems.Tier({ tierId: 2, tierName: "UNCOMMON" });
        _tiers[3] = LibItems.Tier({ tierId: 3, tierName: "RARE" });
        _tiers[4] = LibItems.Tier({ tierId: 4, tierName: "LEGENDARY" });
        _tiers[5] = LibItems.Tier({ tierId: 5, tierName: "MYTHICAL" });

        addTiers(_tiers);
    }

    function addTier(LibItems.Tier memory _tier) public onlyRole(MANAGER_ROLE) {
        tiers[_tier.tierId] = _tier;
        emit TierAdded(_tier.tierId, _tier.tierName);
    }

    function addTiers(LibItems.Tier[] memory _tiers) public onlyRole(MANAGER_ROLE) {
        for (uint256 i = 0; i < _tiers.length; i++) {
            addTier(_tiers[i]);
        }
    }

    function removeTier(uint256 _tierId) public onlyRole(MANAGER_ROLE) {
        LibItems.Tier memory _tier = tiers[_tierId];
        delete tiers[_tierId];
        emit TierRemoved(_tier.tierId, _tier.tierName);
    }

    function removeTiers(uint256[] memory _tierIds) public onlyRole(MANAGER_ROLE) {
        for (uint256 i = 0; i < _tierIds.length; i++) {
            removeTier(_tierIds[i]);
        }
    }

    function isTierExist(uint256 _tierId) public view returns (bool) {
        if (bytes(tiers[_tierId].tierName).length > 0) {
            return true;
        }
    }
}
