// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../contracts/ItemBound.sol";
import "../contracts/RandomItem.sol";
import "../contracts/mocks/MockERC1155Receiver.sol";

contract ItemBoundTest is Test {
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

    function getWallet(string memory walletLabel) public returns (Wallet memory) {
        (address addr, uint256 privateKey) = makeAddrAndKey(walletLabel);
        Wallet memory wallet = Wallet(addr, privateKey);
        return wallet;
    }

    function generateSignature(address wallet, uint256 seedOrTokenId, string memory signerLabel) public returns (uint256, bytes memory) {
        Wallet memory signerWallet = getWallet(signerLabel);

        uint256 _nonce = uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty, signerWallet.addr))) % 50;

        bytes32 message = keccak256(abi.encodePacked(wallet, _nonce, seedOrTokenId));
        bytes32 hash = ECDSA.toEthSignedMessageHash(message);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerWallet.privateKey, hash);
        return (_nonce, abi.encodePacked(r, s, v));
    }

    function concatenateStrings(string memory a, string memory b) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }

    function generateTokenId(uint256 item, uint256 level, LibItems.Tier tier) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(item, level, tier)));
    }

    function setUp() public {
        playerWallet = getWallet(playerLabel);
        playerWallet2 = getWallet(player2Label);
        playerWallet3 = getWallet(player3Label);
        minterWallet = getWallet(minterLabel);

        itemBound = new ItemBound("Test1155", "T1155", "MISSING_BASE_URL", 1, false, minterWallet.addr, 250);
        randomItem = new RandomItem();

        itemBound.setSigner(minterWallet.addr);

        itemBound.setRandomItemContract(address(randomItem));
        randomItem.setItemBoundContract(address(itemBound));

        tokenId = generateTokenId(1000, 1, LibItems.Tier.RARE);

        LibItems.TokenInfo memory _token = LibItems.TokenInfo({
            exists: true,
            availableToMint: true,
            tokenUri: "",
            itemId: 1000,
            level: 1,
            tier: LibItems.Tier.RARE
        });

        itemBound.addNewToken(tokenId, _token);

        (nonce, signature) = generateSignature(playerWallet.addr, tokenId, minterLabel);
        (nonce2, signature2) = generateSignature(playerWallet2.addr, tokenId, minterLabel);

        mockERC1155Receiver = new MockERC1155Receiver();
    }

    function testTokenExists() public {
        assertEq(itemBound.paused(), false);
        itemBound.pause();
        assertEq(itemBound.paused(), true);

        uint256 _tokenId = generateTokenId(1000, 2, LibItems.Tier.RARE);
        (uint256 _nonce, bytes memory _signature) = generateSignature(playerWallet.addr, _tokenId, minterLabel);

        vm.expectRevert(ItemBound_TokenNotExist.selector);
        vm.prank(playerWallet.addr);
        itemBound.mint(_tokenId, 1, true, _nonce, _signature);

        LibItems.TokenInfo memory _token = LibItems.TokenInfo({
            exists: true,
            availableToMint: true,
            tokenUri: "MISSING_BASE_URL1",
            itemId: 1000,
            level: 2,
            tier: LibItems.Tier.RARE
        });

        itemBound.unpause();
        itemBound.addNewToken(_tokenId, _token);
        assertEq(itemBound.paused(), false);

        vm.prank(playerWallet.addr);
        itemBound.mint(_tokenId, 1, true, _nonce, _signature);
    }

    function testPauseUnpause() public {
        itemBound.pause();
        vm.expectRevert("Pausable: paused");
        itemBound.adminMint(address(this), tokenId, 1, true);
        itemBound.unpause();

        itemBound.adminMint(address(mockERC1155Receiver), tokenId, 1, true);
        assertEq(itemBound.balanceOf(address(mockERC1155Receiver), tokenId), 1);
    }

    // testVerifySignature
    function testInvalidSignature() public {
        vm.prank(playerWallet.addr);
        vm.expectRevert(ItemBound_InvalidSignature.selector);
        itemBound.mint(tokenId, 1, true, nonce, signature2);
    }

    function testReuseSignatureMint() public {
        vm.prank(playerWallet.addr);
        itemBound.mint(tokenId, 1, true, nonce, signature);
        assertEq(itemBound.usedSignatures(signature), true);
        vm.prank(playerWallet.addr);
        vm.expectRevert(ItemBound_AlreadyUsedSignature.selector);
        itemBound.mint(tokenId, 1, true, nonce, signature);
    }

    function testMintShouldPass() public {
        vm.prank(playerWallet.addr);
        itemBound.mint(tokenId, 1, true, nonce, signature);

        vm.expectRevert("ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred");
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, tokenId, 1, "");

        vm.expectRevert("ERCSoulbound: can't be zero amount");
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, tokenId, 0, "");

        vm.prank(playerWallet2.addr);
        itemBound.mint(tokenId, 1, false, nonce2, signature2);

        vm.prank(playerWallet2.addr);
        itemBound.safeTransferFrom(playerWallet2.addr, minterWallet.addr, tokenId, 1, "");

        assertEq(itemBound.balanceOf(playerWallet.addr, tokenId), 1);
        assertEq(itemBound.balanceOf(playerWallet2.addr, tokenId), 0);
        assertEq(itemBound.balanceOf(minterWallet.addr, tokenId), 1);
    }

    function testMintMoreThanLimit() public {
        vm.expectRevert(ItemBound_ExceedMaxMint.selector);
        vm.prank(playerWallet.addr);
        itemBound.mint(tokenId, 2, true, nonce, signature);
    }

    function testMintInvalidTokenId() public {
        (uint256 _nonce, bytes memory _signature) = generateSignature(playerWallet.addr, 30, minterLabel);

        vm.expectRevert(ItemBound_TokenNotExist.selector);
        vm.prank(playerWallet.addr);
        itemBound.mint(30, 1, true, _nonce, _signature);
    }

    function testAdminMintNotMinterRole() public {
        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"
        );
        vm.prank(playerWallet.addr);
        itemBound.adminMint(playerWallet.addr, 1, 1, true);
    }

    function testAdminMint() public {
        itemBound.adminMint(playerWallet.addr, tokenId, 1, true);
    }

    function testBurn() public {
        vm.prank(playerWallet.addr);
        itemBound.mint(tokenId, 1, true, nonce, signature);
        assertEq(itemBound.balanceOf(playerWallet.addr, tokenId), 1);

        vm.expectRevert("ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred");
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, tokenId, 1, "");

        vm.prank(playerWallet.addr);
        itemBound.burn(playerWallet.addr, tokenId, 1);

        assertEq(itemBound.balanceOf(playerWallet.addr, tokenId), 0);

        vm.prank(playerWallet2.addr);
        itemBound.mint(tokenId, 1, false, nonce2, signature2);

        vm.prank(playerWallet2.addr);
        itemBound.safeTransferFrom(playerWallet2.addr, playerWallet3.addr, tokenId, 1, "");

        assertEq(itemBound.balanceOf(playerWallet2.addr, tokenId), 0);
        assertEq(itemBound.balanceOf(playerWallet3.addr, tokenId), 1);

        vm.prank(playerWallet3.addr);
        itemBound.burn(playerWallet3.addr, tokenId, 1);

        assertEq(itemBound.balanceOf(playerWallet3.addr, tokenId), 0);
    }

    // TODO * user mintRandom()
    // TODO * user mintRandomAtLevel()
    // TODO * admin adminMintRandom()
    // TODO * admin adminMintRandomAtLevel()

    function testTokenURIIfTokenIdNotExist() public {
        vm.expectRevert(ItemBound_TokenNotExist.selector);
        itemBound.uri(1);
    }

    function testTokenURIIfTokenIdExistNOSpeficTokenURIFallbackToBaseURI() public {
        assertEq(itemBound.uri(tokenId), string(abi.encodePacked("MISSING_BASE_URL", "/", tokenId.toString())));
    }

    function testTokenURIIfTokenIdExistWithSpeficTokenURI() public {
        uint256 _tokenId = generateTokenId(1001, 1, LibItems.Tier.RARE);
        LibItems.TokenInfo memory _token = LibItems.TokenInfo({
            exists: true,
            availableToMint: true,
            tokenUri: "ipfs://specific-token-uri.com",
            itemId: 1001,
            level: 1,
            tier: LibItems.Tier.RARE
        });

        itemBound.addNewToken(_tokenId, _token);
        assertEq(itemBound.uri(_tokenId), "ipfs://specific-token-uri.com");
    }

    function testUpdateTokenURIFailNotManagerRole() public {
        string memory newBaseURI = "https://something-new.com";

        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08"
        );
        vm.prank(playerWallet.addr);
        itemBound.updateBaseUri(newBaseURI);
    }

    function testUpdateTokenURIPass() public {
        string memory newBaseURI = "https://something-new.com";

        assertEq(itemBound.uri(tokenId), string(abi.encodePacked("MISSING_BASE_URL", "/", tokenId.toString())));
        itemBound.updateBaseUri(newBaseURI);
        assertEq(itemBound.uri(tokenId), string(abi.encodePacked("https://something-new.com", "/", tokenId.toString())));
    }

    function testNonSoulboundTokenTransfer() public {
        vm.prank(playerWallet.addr);
        itemBound.mint(tokenId, 1, false, nonce, signature);

        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, tokenId, 1, "");

        assertEq(itemBound.balanceOf(playerWallet.addr, tokenId), 0);
        assertEq(itemBound.balanceOf(minterWallet.addr, tokenId), 1);
    }

    function testSoulboundTokenNotTransfer() public {
        vm.prank(playerWallet.addr);
        itemBound.mint(tokenId, 1, true, nonce, signature);

        vm.expectRevert("ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred");
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, tokenId, 1, "");

        vm.expectRevert("ERCSoulbound: can't be zero amount");
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, tokenId, 0, "");
    }

    function testSoulboundTokenTransferOnlyWhitelistAddresses() public {
        vm.prank(playerWallet.addr);
        itemBound.mint(tokenId, 1, true, nonce, signature);

        vm.expectRevert("ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred");
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, tokenId, 1, "");

        itemBound.updateWhitelistAddress(playerWallet3.addr, true);

        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, playerWallet3.addr, tokenId, 1, "");

        vm.prank(playerWallet3.addr);
        itemBound.safeTransferFrom(playerWallet3.addr, playerWallet.addr, tokenId, 1, "");

        itemBound.updateWhitelistAddress(playerWallet3.addr, false);

        vm.expectRevert("ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred");
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, playerWallet3.addr, tokenId, 1, "");
    }

    function testTokenRoyaltyDefault() public {
        uint256 mintPrice = 1 ether;
        uint256 expectedRoyalty = (mintPrice * 250) / 10000;

        (address receiver, uint256 royaltyAmount) = itemBound.royaltyInfo(1, mintPrice);

        assertEq(receiver, minterWallet.addr);
        assertEq(royaltyAmount, expectedRoyalty);
    }

    function testUpdateTokenRoyalty() public {
        uint256 mintPrice = 1 ether;
        uint256 expectedRoyalty = (mintPrice * 250) / 10000;

        (address receiver, uint256 royaltyAmount) = itemBound.royaltyInfo(1, mintPrice);

        assertEq(receiver, minterWallet.addr);
        assertEq(royaltyAmount, expectedRoyalty);

        uint256 expectedRoyaltyAfter = (mintPrice * 300) / 10000;
        itemBound.setRoyaltyInfo(playerWallet.addr, 300);

        (address receiverAfter, uint256 royaltyAmountAfter) = itemBound.royaltyInfo(1, mintPrice);

        assertEq(receiverAfter, playerWallet.addr);
        assertEq(royaltyAmountAfter, expectedRoyaltyAfter);
    }
}
