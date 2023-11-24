// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../contracts/ItemBound.sol";
import "../contracts/RandomItem.sol";
import "../contracts/mocks/MockERC1155Receiver.sol";

contract RandomItemTest is Test {
    using Strings for uint256;

    ItemBound public itemBound;
    RandomItem public randomItem;
    MockERC1155Receiver public mockERC1155Receiver;

    struct Wallet {
        address addr;
        uint256 privateKey;
    }

    string minterLabel = "minter";
    string playerLabel = "player";
    string player2Label = "player2";
    string player3Label = "player3";

    Wallet minterWallet;
    Wallet playerWallet;
    Wallet playerWallet2;
    Wallet playerWallet3;

    uint256 seed1 = 1234;
    uint256 seed2 = 4321;
    uint256 nonce;
    bytes signature;
    uint256 nonce2;
    bytes signature2;

    uint256 tokenId;

    uint256 private _seed;
    uint256[] _tokenIds;
    LibItems.TokenInfo[] _tokens;

    function getWallet(string memory walletLabel) public returns (Wallet memory) {
        (address addr, uint256 privateKey) = makeAddrAndKey(walletLabel);
        Wallet memory wallet = Wallet(addr, privateKey);
        return wallet;
    }

    function setUp() public {
        playerWallet = getWallet(playerLabel);
        playerWallet2 = getWallet(player2Label);
        playerWallet3 = getWallet(player3Label);
        minterWallet = getWallet(minterLabel);

        itemBound = new ItemBound("Test1155", "T1155", "MISSING_BASE_URL", 1, false, minterWallet.addr, 250);
        randomItem = new RandomItem();
    }

    function testRandomItemNotWhitelisted() public {
        vm.expectRevert(
            "AccessControl: account 0x7fa9385be102ac3eac297483dd6233d62b3e1496 is missing role 0x8429d542926e6695b59ac6fbdcd9b37e8b1aeb757afab06ab60b1bb5878c3b49"
        );
        randomItem.randomItem(seed1, 1);
    }

    // update rarity randomness
    function testUpdateTiersNotManager() public {
        uint8[] memory percents = new uint8[](5);
        percents[0] = 60;
        percents[1] = 24;
        percents[2] = 10;
        percents[3] = 4;
        percents[4] = 2;

        LibItems.Tier[] memory tiers = new LibItems.Tier[](5);
        tiers[0] = LibItems.Tier.COMMON;
        tiers[1] = LibItems.Tier.UNCOMMON;
        tiers[2] = LibItems.Tier.RARE;
        tiers[3] = LibItems.Tier.LEGENDARY;
        tiers[4] = LibItems.Tier.MYTHICAL;

        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08"
        );
        vm.prank(playerWallet.addr);
        randomItem.updateTiers(percents, tiers);
    }

    function testUpdateTiersMoreThan100Percents() public {
        uint8[] memory percents = new uint8[](5);
        percents[0] = 70;
        percents[1] = 24;
        percents[2] = 14;
        percents[3] = 10;
        percents[4] = 2;

        LibItems.Tier[] memory tiers = new LibItems.Tier[](5);
        tiers[0] = LibItems.Tier.COMMON;
        tiers[1] = LibItems.Tier.UNCOMMON;
        tiers[2] = LibItems.Tier.RARE;
        tiers[3] = LibItems.Tier.LEGENDARY;
        tiers[4] = LibItems.Tier.MYTHICAL;

        vm.expectRevert("totalPercent != 100");
        randomItem.updateTiers(percents, tiers);
    }

    function testUpdateTiers() public {
        uint8[] memory percents = new uint8[](5);
        percents[0] = 50;
        percents[1] = 24;
        percents[2] = 19;
        percents[3] = 5;
        percents[4] = 2;

        LibItems.Tier[] memory tiers = new LibItems.Tier[](5);
        tiers[0] = LibItems.Tier.COMMON;
        tiers[1] = LibItems.Tier.UNCOMMON;
        tiers[2] = LibItems.Tier.RARE;
        tiers[3] = LibItems.Tier.LEGENDARY;
        tiers[4] = LibItems.Tier.MYTHICAL;

        randomItem.updateTiers(percents, tiers);

        (uint8 _percent, LibItems.Tier _tier) = randomItem.tiers(0);
        (uint8 _percent2, LibItems.Tier _tier2) = randomItem.tiers(2);
        (uint8 _percent3, LibItems.Tier _tier3) = randomItem.tiers(3);
        (uint8 _percent4, LibItems.Tier _tier4) = randomItem.tiers(4);

        assertEq(_percent, 50);
        assertEq(_percent2, 19);
        assertEq(_percent3, 5);
        assertEq(_percent4, 2);
    }

    // setItemBoundContract fail not manager wallet
    function testSetItemBoundContractNotManager() public {
        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08"
        );
        vm.prank(playerWallet.addr);
        randomItem.setItemBoundContract(playerWallet2.addr);
    }

    // setItemBoundContract fail when address is zero
    function testSetItemBoundContractAddressZero() public {
        vm.expectRevert("AddressIsZero");
        randomItem.setItemBoundContract(address(0));
    }

    // setItemBoundContract pass and grant role to new contract
    function testSetItemBoundContractHasWhitelistRole() public {
        assertEq(randomItem.hasRole(randomItem.WHITELISTED_ROLE(), playerWallet2.addr), false);
        randomItem.setItemBoundContract(playerWallet2.addr);

        assertEq(randomItem.hasRole(randomItem.WHITELISTED_ROLE(), playerWallet2.addr), true);
    }
}
