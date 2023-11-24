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
import "./libraries/LibItems.sol";
import "./interfaces/IItemBound.sol";

contract RandomItem is AccessControl {
    bytes32 public constant WHITELISTED_ROLE = keccak256("WHITELISTED_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    address private itemBoundContract;

    struct Tier {
        uint8 percent;
        LibItems.Tier name;
    }

    uint256 private _nonce;

    Tier[] public tiers;

    function _addTier(uint8 _percent, LibItems.Tier _name) private {
        require(_percent > 0);
        tiers.push(Tier({ percent: _percent, name: _name }));
    }

    function _updateTierPercents() internal {
        uint totalPercent;
        for (uint i = 0; i < tiers.length; i++) {
            totalPercent += tiers[i].percent;
        }
        require(totalPercent == 100, "totalPercent != 100");
    }

    function updateTiers(uint8[] memory _percents, LibItems.Tier[] memory _names) external onlyRole(MANAGER_ROLE) {
        require(_percents.length == _names.length, "Invalid input");

        for (uint i = 0; i < _percents.length; i++) {
            tiers[i].percent = _percents[i];
            tiers[i].name = _names[i];
        }
        _updateTierPercents();
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);

        _addTier(60, LibItems.Tier.COMMON);
        _addTier(24, LibItems.Tier.UNCOMMON);
        _addTier(10, LibItems.Tier.RARE);
        _addTier(4, LibItems.Tier.LEGENDARY);
        _addTier(2, LibItems.Tier.MYTHICAL);
    }

    function getRandomNumber(uint256 userProvidedSeed, uint256 maxNumber) private returns (uint256) {
        _nonce++;
        uint256 randomNumber = uint256(keccak256(abi.encodePacked(block.number, block.timestamp, blockhash(block.number - 1), userProvidedSeed, _nonce)));
        return (randomNumber % maxNumber) + 1;
    }

    function getTier(uint256 randomNumber) public returns (LibItems.Tier) {
        uint runningPercent = 0;
        for (uint i = 0; i < tiers.length; i++) {
            runningPercent += tiers[i].percent;
            if (randomNumber <= runningPercent) {
                return tiers[i].name;
            }
        }
    }

    function getItem(uint256 seed, LibItems.Tier tier, uint256 level) private returns (uint256) {
        if (itemBoundContract == address(0)) {
            revert("AddressIsZero");
        }

        uint256[] memory _items = IItemBound(itemBoundContract).getItemsPerTierPerLevel(tier, level);

        // if _items.length == 0 because there is no item in that tier and level, then we need to reroll
        if (_items.length == 0) {
            return _randomItem(seed, level);
        }

        uint256 _randomNumber = getRandomNumber(seed, _items.length);

        return uint256(keccak256(abi.encodePacked(_items[_randomNumber], level, tier)));
    }

    function randomItem(uint256 seed, uint256 level) public onlyRole(WHITELISTED_ROLE) returns (uint256) {
        if (itemBoundContract == address(0)) {
            revert("AddressIsZero");
        }
        IItemBound factory = IItemBound(itemBoundContract);
        uint256 _currentMaxLevel = factory.getCurrentMaxLevel();
        uint256 _level = level;
        if (_level > _currentMaxLevel) {
            revert("InvalidLevel");
        }

        if (_level == 0) {
            _level = getRandomNumber(seed, _currentMaxLevel);
        }

        return _randomItem(seed, _level);
    }

    function _randomItem(uint256 seed, uint256 level) private returns (uint256) {
        LibItems.Tier tier = getTier(getRandomNumber(seed, 100));
        return getItem(seed, tier, level);
    }

    function setItemBoundContract(address contractAddress) external onlyRole(MANAGER_ROLE) {
        if (contractAddress == address(0)) {
            revert("AddressIsZero");
        }

        itemBoundContract = contractAddress;
        _grantRole(WHITELISTED_ROLE, contractAddress);
    }
}
