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

    uint256 private _seed;
    uint256[] _tokenIds;
    LibItems.TokenInfo[] _tokens;

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

    function generateRandomItemId() internal returns (uint256) {
        _seed = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), _seed)));
        return _seed;
    }

    function generateRandomLevel() internal returns (uint256) {
        uint256 _seed = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), _seed)));
        return (_seed % 10) + 1; // 1 - 10
    }

    function generateRandomTier() internal returns (LibItems.Tier) {
        uint256 _seed = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), _seed)));
        uint256 random = _seed % 5; // 0 - 4

        if (random == 0) {
            return LibItems.Tier.COMMON;
        } else if (random == 1) {
            return LibItems.Tier.UNCOMMON;
        } else if (random == 2) {
            return LibItems.Tier.RARE;
        } else if (random == 3) {
            return LibItems.Tier.LEGENDARY;
        } else if (random == 4) {
            return LibItems.Tier.MYTHICAL;
        } else {
            return LibItems.Tier.COMMON;
        }
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

        for (uint256 i = 0; i < 300; i++) {
            uint256 _itemId = generateRandomItemId(); // totally random

            uint256 _level = generateRandomLevel(); // level 1-10

            LibItems.Tier _tier = generateRandomTier(); // tier 0-4

            uint256 _tokenId = generateTokenId(_itemId, _level, _tier);

            LibItems.TokenInfo memory _token = LibItems.TokenInfo({
                exists: true,
                availableToMint: true,
                tokenUri: "",
                itemId: _itemId,
                level: _level,
                tier: _tier
            });

            _tokenIds.push(_tokenId);
            _tokens.push(_token);
        }

        itemBound.addNewTokens(_tokenIds, _tokens);
    }

    function testTokenExists() public {
        assertEq(itemBound.paused(), false);
        itemBound.pause();
        assertEq(itemBound.paused(), true);

        uint256 _tokenId = generateTokenId(1000, 2, LibItems.Tier.RARE);
        (uint256 _nonce, bytes memory _signature) = generateSignature(playerWallet.addr, _tokenId, minterLabel);

        vm.expectRevert("TokenNotExist");
        itemBound.isTokenExist(_tokenId);

        vm.expectRevert("TokenNotExist");
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

        itemBound.isTokenExist(_tokenId);

        assertEq(itemBound.paused(), false);

        vm.prank(playerWallet.addr);
        itemBound.mint(_tokenId, 1, true, _nonce, _signature);
    }

    function testAddAlreadyExistingToken() public {
        uint256 _tokenId = generateTokenId(1000, 2, LibItems.Tier.RARE);
        LibItems.TokenInfo memory _token = LibItems.TokenInfo({
            exists: true,
            availableToMint: true,
            tokenUri: "MISSING_BASE_URL1",
            itemId: 1000,
            level: 2,
            tier: LibItems.Tier.RARE
        });

        itemBound.addNewToken(_tokenId, _token);

        vm.expectRevert("TokenAlreadyExist");
        itemBound.addNewToken(_tokenId, _token);
    }

    function testAddNewTokensFailInvalidLength() public {
        for (uint256 i = 0; i < 300; i++) {
            uint256 _itemId = generateRandomItemId(); // totally random

            uint256 _level = generateRandomLevel(); // level 1-10

            LibItems.Tier _tier = generateRandomTier(); // tier 0-4

            uint256 _tokenId = generateTokenId(_itemId, _level, _tier);

            LibItems.TokenInfo memory _token = LibItems.TokenInfo({
                exists: true,
                availableToMint: true,
                tokenUri: "",
                itemId: _itemId,
                level: _level,
                tier: _tier
            });

            _tokenIds.push(_tokenId);
            _tokens.push(_token);
        }

        _tokenIds.pop();

        vm.expectRevert("TokenInvalidLength");
        itemBound.addNewTokens(_tokenIds, _tokens);
    }

    function testAddNewTokens() public {
        uint256[] memory _tokenIds = new uint256[](3);
        LibItems.TokenInfo[] memory _tokens = new LibItems.TokenInfo[](3);

        skip(36000);
        for (uint256 i = 0; i < 3; i++) {
            uint256 _level = generateRandomLevel(); // level 1-10

            LibItems.Tier _tier = generateRandomTier(); // tier 0-4

            uint256 _tokenId = generateTokenId(i, _level, _tier);

            LibItems.TokenInfo memory _token = LibItems.TokenInfo({ exists: true, availableToMint: true, tokenUri: "", itemId: i, level: _level, tier: _tier });

            _tokenIds[i] = _tokenId;
            _tokens[i] = _token;
        }

        itemBound.addNewTokens(_tokenIds, _tokens);
    }

    // updateTokenInfo
    function testUpdateTokenInfoTokenNotExist() public {
        uint256 _tokenId = generateTokenId(9999, 1, LibItems.Tier.UNCOMMON);

        LibItems.TokenInfo memory _token = LibItems.TokenInfo({
            exists: true,
            availableToMint: true,
            tokenUri: "",
            itemId: 9999,
            level: 1,
            tier: LibItems.Tier.UNCOMMON
        });

        vm.expectRevert("TokenNotExist");
        itemBound.updateTokenInfo(_tokenId, _token);
    }

    function testUpdateTokenInfoTokenNotMANAGER() public {
        uint256 _tokenId = generateTokenId(9999, 1, LibItems.Tier.UNCOMMON);

        LibItems.TokenInfo memory _token = LibItems.TokenInfo({
            exists: true,
            availableToMint: true,
            tokenUri: "",
            itemId: 9999,
            level: 1,
            tier: LibItems.Tier.UNCOMMON
        });

        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08"
        );
        vm.prank(playerWallet.addr);
        itemBound.updateTokenInfo(_tokenId, _token);
    }

    function testUpdateTokenInfo() public {
        uint256 _tokenId = generateTokenId(9999, 1, LibItems.Tier.UNCOMMON);

        LibItems.TokenInfo memory _token = LibItems.TokenInfo({
            exists: true,
            availableToMint: true,
            tokenUri: "",
            itemId: 9999,
            level: 1,
            tier: LibItems.Tier.UNCOMMON
        });

        LibItems.TokenInfo memory _updatedToken = LibItems.TokenInfo({
            exists: true,
            availableToMint: true,
            tokenUri: "https://something.com",
            itemId: 9999,
            level: 1,
            tier: LibItems.Tier.UNCOMMON
        });

        itemBound.addNewToken(_tokenId, _token);
        itemBound.updateTokenInfo(_tokenId, _updatedToken);

        assertEq(itemBound.getTokenInfo(_tokenId).tokenUri, "https://something.com");
    }

    function testUpdateTokenInfoCurrentMaxLevelShouldChange() public {
        uint256 _tokenId1 = generateTokenId(9999, 11, LibItems.Tier.UNCOMMON);
        uint256 _tokenId2 = generateTokenId(10000, 12, LibItems.Tier.UNCOMMON);

        LibItems.TokenInfo memory _token1 = LibItems.TokenInfo({
            exists: true,
            availableToMint: true,
            tokenUri: "",
            itemId: 9999,
            level: 11,
            tier: LibItems.Tier.UNCOMMON
        });

        LibItems.TokenInfo memory _token2 = LibItems.TokenInfo({
            exists: true,
            availableToMint: true,
            tokenUri: "",
            itemId: 10000,
            level: 12,
            tier: LibItems.Tier.UNCOMMON
        });

        assertEq(itemBound.currentMaxLevel(), 10);
        itemBound.addNewToken(_tokenId1, _token1);
        assertEq(itemBound.currentMaxLevel(), 11);
        itemBound.addNewToken(_tokenId2, _token2);
        assertEq(itemBound.currentMaxLevel(), 12);
    }

    // updateTokenInfo - fail because passing level more than max level

    // getTokenInfo if token not exist
    function testGetTokenInfoTokenNotExist() public {
        vm.expectRevert("TokenNotExist");
        vm.prank(playerWallet.addr);
        itemBound.getTokenInfo(123123123);
    }

    // checkTokenId
    function testCheckTokenIdTokenNotExist() public {
        uint256 _tokenId = generateTokenId(1000, 2, LibItems.Tier.RARE);

        vm.expectRevert("InvalidTokenId");
        vm.prank(playerWallet.addr);
        itemBound.checkTokenId(_tokenId, 1000, 3, LibItems.Tier.RARE);
    }

    function testCheckTokenId() public {
        uint256 _tokenId = generateTokenId(1000, 2, LibItems.Tier.RARE);

        vm.prank(playerWallet.addr);
        itemBound.checkTokenId(_tokenId, 1000, 2, LibItems.Tier.RARE);
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
        vm.expectRevert("InvalidSignature");
        itemBound.mint(tokenId, 1, true, nonce, signature2);
    }

    function testReuseSignatureMint() public {
        vm.prank(playerWallet.addr);
        itemBound.mint(tokenId, 1, true, nonce, signature);
        assertEq(itemBound.usedSignatures(signature), true);
        vm.prank(playerWallet.addr);
        vm.expectRevert("AlreadyUsedSignature");
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
        vm.expectRevert("ExceedMaxMint");
        vm.prank(playerWallet.addr);
        itemBound.mint(tokenId, 2, true, nonce, signature);
    }

    function testMintInvalidTokenId() public {
        (uint256 _nonce, bytes memory _signature) = generateSignature(playerWallet.addr, 30, minterLabel);

        vm.expectRevert("TokenNotExist");
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

    // user mintRandom()
    // fail -> invalid signature
    function testMintRandomFailInvalidSignature() public {
        vm.expectRevert("InvalidSignature");
        vm.prank(playerWallet.addr);
        itemBound.mintRandom(1, 1, false, nonce, signature2);
    }

    // pass
    function testMintRandomShouldPass() public {
        vm.prank(playerWallet.addr);
        (uint256 _nonce, bytes memory _signature) = generateSignature(playerWallet.addr, _seed, minterLabel);
        (uint256 _tokenId, uint256 _amount, bool _soulbound) = itemBound.mintRandom(_seed, 1, false, _nonce, _signature);

        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), _amount);
    }

    // user mintRandomAtLevel()
    // fail -> invalid signature
    function testMintRandomAtLevelFailInvalidSignature() public {
        vm.expectRevert("InvalidSignature");
        vm.prank(playerWallet.addr);
        itemBound.mintRandomAtLevel(1, 1, 1, true, nonce, signature2);
    }

    // pass
    function testMintRandomAtLevelShouldPass() public {
        vm.prank(playerWallet.addr);
        (uint256 _nonce, bytes memory _signature) = generateSignature(playerWallet.addr, _seed, minterLabel);
        (uint256 _tokenId, uint256 _amount, bool _soulbound) = itemBound.mintRandomAtLevel(_seed, 2, 1, false, _nonce, _signature);

        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), _amount);
        assertEq(itemBound.getTokenInfo(_tokenId).level, 2);
        assertEq(uint256(itemBound.getTokenInfo(_tokenId).tier), 1);
    }

    // admin adminMintRandom()
    // fail -> not minter role
    function testAdminMintRandomNotMinterRole() public {
        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"
        );
        vm.prank(playerWallet.addr);
        (address _to, uint256 _tokenId, uint256 _amount, bool _soulbound) = itemBound.adminMintRandom(address(mockERC1155Receiver), _seed, 1, true);
    }

    // pass
    function testAdminMintRandomShouldPass() public {
        (address _to, uint256 _tokenId, uint256 _amount, bool _soulbound) = itemBound.adminMintRandom(address(mockERC1155Receiver), _seed, 1, true);
        assertEq(itemBound.balanceOf(address(mockERC1155Receiver), _tokenId), 1);
        assertEq(itemBound.getTokenInfo(_tokenId).level, 7);
        assertEq(uint256(itemBound.getTokenInfo(_tokenId).tier), 1);
    }

    // admin adminMintRandomAtLevel()
    // fail
    function testAdminMintRandomAtLevelNotMinterRole() public {
        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"
        );
        vm.prank(playerWallet.addr);
        (address _to, uint256 _tokenId, uint256 _amount, bool _soulbound) = itemBound.adminMintRandomAtLevel(address(mockERC1155Receiver), _seed, 3, 1, true);
    }

    // pass
    function testAdminMintRandomAtLevelShouldPass() public {
        (address _to, uint256 _tokenId, uint256 _amount, bool _soulbound) = itemBound.adminMintRandomAtLevel(address(mockERC1155Receiver), _seed, 3, 1, false);
        assertEq(itemBound.balanceOf(address(mockERC1155Receiver), _tokenId), 1);
        assertEq(itemBound.getTokenInfo(_tokenId).level, 3);
        assertEq(uint256(itemBound.getTokenInfo(_tokenId).tier), 2);
    }

    // TODO * mintRandom and then calculate the rarity propability total run 100k times
    function testAdminMint100kTimes() public {
        // for (uint256 i = 0; i < 10; i++) {
        //     (address _to, uint256 _tokenId, uint256 _amount, bool _soulbound) = itemBound.adminMintRandom(address(mockERC1155Receiver), _seed, 1, true);
        //     skip(3600);
        // }
        // for (uint256 i = 0; i < 10; i++) {
        //     (address _to, uint256 _tokenId, uint256 _amount, bool _soulbound) = itemBound.adminMintRandom(address(mockERC1155Receiver), _seed, 1, true);
        //     skip(3600);
        // }
    }

    function testTokenURIIfTokenIdNotExist() public {
        vm.expectRevert("TokenNotExist");
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

    function testSetRandomItemContractNotManager() public {
        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08"
        );
        vm.prank(playerWallet.addr);
        itemBound.setRandomItemContract(playerWallet2.addr);
    }

    // setItemBoundContract fail when address is zero
    function testSetRandomItemContractAddressZero() public {
        vm.expectRevert("AddressIsZero");
        itemBound.setRandomItemContract(address(0));
    }

    function testSetRandomItemContract() public {
        itemBound.setRandomItemContract(playerWallet2.addr);
    }
}
