pragma solidity ^0.8.17;

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

import "@openzeppelin/contracts/access/AccessControl.sol";

error RandomItem_AddressIsZero();
error RandomItem_InvalidLevel();

enum TierEnum {
    COMMON,
    UNCOMMON,
    RARE,
    LEGENDARY,
    MYTHICAL,
    NONE
}

abstract contract ItemBoundFactory {
    function getCurrentMaxLevel() public virtual returns (uint256);

    function getItemsPerTierPerLevel(TierEnum _tier, uint256 _level) public virtual returns (uint256[] memory);
}

contract RandomItem is AccessControl {
    address private itemBoundContract;

    struct Tier {
        uint8 percent;
        TierEnum name;
    }

    uint256 private _nonce;

    Tier[] public tiers;

    function addTier(uint8 _percent, TierEnum _name) public {
        require(_percent > 0);
        tiers.push(Tier(_percent, _name));
        updateTierPercents();
    }

    function updateTierPercents() internal {
        uint totalPercent;
        for (uint i = 0; i < tiers.length; i++) {
            totalPercent += tiers[i].percent;
        }
        require(totalPercent == 100);
    }

    function removeTier(uint index) public {
        require(index < tiers.length, "Invalid index");

        for (uint i = index; i < tiers.length - 1; i++) {
            tiers[i] = tiers[i + 1];
        }
        tiers.pop();

        updateTierPercents();
    }

    constructor() {}

    function getRandomNumber(uint256 userProvidedSeed, uint256 maxNumber) public returns (uint256) {
        _nonce++;
        uint256 randomNumber = uint256(keccak256(abi.encodePacked(block.number, block.timestamp, blockhash(block.number - 1), userProvidedSeed, _nonce)));
        return (randomNumber % maxNumber) + 1;
    }

    function getTier(uint256 randomNumber) public returns (TierEnum) {
        uint runningPercent = 0;
        for (uint i = 0; i < tiers.length; i++) {
            runningPercent += tiers[i].percent;
            if (randomNumber <= runningPercent) {
                return tiers[i].name;
            }
        }
    }

    function getItem(uint256 seed, TierEnum tier, uint256 level) public returns (uint256) {
        ItemBoundFactory factory = ItemBoundFactory(itemBoundContract);
        uint256[] memory _items = factory.getItemsPerTierPerLevel(tier, level);
        uint256 _randomNumber = getRandomNumber(seed, _items.length);
        return _items[_randomNumber];
    }

    function randomItem(uint256 seed, uint256 level) public returns (uint256) {
        ItemBoundFactory factory = ItemBoundFactory(itemBoundContract);
        uint256 _level = level;
        if (_level > factory.getCurrentMaxLevel()) {
            revert RandomItem_InvalidLevel();
        }

        if (_level == 0) {
            _level = getRandomNumber(seed, factory.getCurrentMaxLevel());
        }

        return _randomItem(seed, level);
    }

    function _randomItem(uint256 seed, uint256 level) private returns (uint256) {
        TierEnum tier = getTier(getRandomNumber(seed, 100));
        uint256 item = getItem(seed, tier, level);

        // populate everythign into tokenId -> tierId + itemNumber -> hash = tokenId
        return uint256(keccak256(abi.encodePacked(tier, level, item)));
    }

    function setItemBoundContract(address contractAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (contractAddress != address(0)) {
            revert RandomItem_AddressIsZero();
        }

        itemBoundContract = contractAddress;
    }
}
