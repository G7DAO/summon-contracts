// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "forge-std/Test.sol";
import "../contracts/Soulbound1155.sol";
import "../contracts/mocks/MockERC1155Receiver.sol";

contract Soulbound1155Test is Test {
    Soulbound1155 public soulbound1155;
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

    uint256 nonce;
    bytes signature;
    uint256 nonce2;
    bytes signature2;

    function getWallet(string memory walletLabel) public returns (Wallet memory) {
        (address addr, uint256 privateKey) = makeAddrAndKey(walletLabel);
        Wallet memory wallet = Wallet(addr, privateKey);
        return wallet;
    }

    function generateSignature(address wallet, string memory signerLabel) public returns (uint256, bytes memory) {
        Wallet memory signerWallet = getWallet(signerLabel);

        uint256 _nonce = uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty, signerWallet.addr))) % 50;

        bytes32 message = keccak256(abi.encodePacked(wallet, _nonce));
        bytes32 hash = ECDSA.toEthSignedMessageHash(message);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerWallet.privateKey, hash);
        return (_nonce, abi.encodePacked(r, s, v));
    }

    function concatenateStrings(string memory a, string memory b) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }

    function setUp() public {
        playerWallet = getWallet(playerLabel);
        playerWallet2 = getWallet(player2Label);
        playerWallet3 = getWallet(player3Label);
        minterWallet = getWallet(minterLabel);

        soulbound1155 = new Soulbound1155("Test1155", "T1155", "MISSING_BASE_URL", 1, false, minterWallet.addr, 250);

        soulbound1155.setSigner(minterWallet.addr);

        (nonce, signature) = generateSignature(playerWallet.addr, minterLabel);
        (nonce2, signature2) = generateSignature(playerWallet2.addr, minterLabel);

        mockERC1155Receiver = new MockERC1155Receiver();
    }

    function testTokenExists() public {
        assertEq(soulbound1155.paused(), false);
        soulbound1155.pause();
        assertEq(soulbound1155.paused(), true);

        vm.expectRevert("Token not exist");
        vm.prank(playerWallet.addr);
        soulbound1155.mint(1, 1, true, nonce, signature);

        soulbound1155.unpause();
        soulbound1155.addNewToken(1);
        assertEq(soulbound1155.paused(), false);

        vm.prank(playerWallet.addr);
        soulbound1155.mint(1, 1, true, nonce, signature);
    }

    function testPauseUnpause() public {
        soulbound1155.addNewToken(1);
        soulbound1155.pause();
        vm.expectRevert("Pausable: paused");
        soulbound1155.adminMint(address(this), 1, 1, true);
        soulbound1155.unpause();

        soulbound1155.adminMint(address(mockERC1155Receiver), 1, 1, true);
        assertEq(soulbound1155.balanceOf(address(mockERC1155Receiver), 1), 1);
    }

    // testVerifySignature
    function testInvalidSignature() public {
        vm.prank(playerWallet.addr);
        vm.expectRevert("Invalid signature");
        soulbound1155.mint(1, 1, true, nonce, signature2);
    }

    function testReuseSignatureMint() public {
        soulbound1155.addNewToken(1);
        vm.prank(playerWallet.addr);
        soulbound1155.mint(1, 1, true, nonce, signature);
        assertEq(soulbound1155.usedSignatures(signature), true);
        vm.prank(playerWallet.addr);
        vm.expectRevert("Signature already used");
        soulbound1155.mint(1, 1, true, nonce, signature);
    }

    function testReuseSignatureMintBatch() public {
        soulbound1155.addNewToken(1);
        soulbound1155.addNewToken(2);
        soulbound1155.addNewToken(3);

        uint256[] memory tokenIds = new uint256[](3);
        tokenIds[0] = 1;
        tokenIds[1] = 2;
        tokenIds[2] = 3;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1;
        amounts[1] = 1;
        amounts[2] = 1;

        vm.prank(playerWallet.addr);
        soulbound1155.mintBatch(tokenIds, amounts, true, nonce, signature);
        assertEq(soulbound1155.usedSignatures(signature), true);

        vm.prank(playerWallet.addr);
        vm.expectRevert("Signature already used");
        soulbound1155.mintBatch(tokenIds, amounts, true, nonce, signature);
    }

    function testMintShouldPass() public {
        soulbound1155.addNewToken(1);

        vm.prank(playerWallet.addr);
        soulbound1155.mint(1, 1, true, nonce, signature);

        vm.expectRevert("ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred");
        vm.prank(playerWallet.addr);
        soulbound1155.safeTransferFrom(playerWallet.addr, minterWallet.addr, 1, 1, "");

        vm.expectRevert("ERCSoulbound: can't be zero amount");
        vm.prank(playerWallet.addr);
        soulbound1155.safeTransferFrom(playerWallet.addr, minterWallet.addr, 1, 0, "");

        vm.prank(playerWallet2.addr);
        soulbound1155.mint(1, 1, false, nonce2, signature2);

        vm.prank(playerWallet2.addr);
        soulbound1155.safeTransferFrom(playerWallet2.addr, minterWallet.addr, 1, 1, "");

        assertEq(soulbound1155.balanceOf(playerWallet.addr, 1), 1);
        assertEq(soulbound1155.balanceOf(playerWallet2.addr, 1), 0);
        assertEq(soulbound1155.balanceOf(minterWallet.addr, 1), 1);
    }

    function testMintMoreThanLimit() public {
        soulbound1155.addNewToken(1);
        vm.expectRevert("Exceed max mint");
        vm.prank(playerWallet.addr);
        soulbound1155.mint(1, 2, true, nonce, signature);
    }

    function testMintAlreadyMinted() public {
        soulbound1155.addNewToken(1);
        vm.prank(playerWallet.addr);
        soulbound1155.mint(1, 1, true, nonce, signature);

        skip(3600); // so nonce is different
        (uint256 newNonce, bytes memory newSignature) = generateSignature(playerWallet.addr, minterLabel);

        vm.expectRevert("Already minted");
        vm.prank(playerWallet.addr);
        soulbound1155.mint(1, 1, true, newNonce, newSignature);
    }

    function testMintInvalidTokenId() public {
        vm.expectRevert("Token not exist");
        vm.prank(playerWallet.addr);
        soulbound1155.mint(30, 1, true, nonce, signature);
    }

    function testAdminMintNotMinterRole() public {
        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"
        );
        vm.prank(playerWallet.addr);
        soulbound1155.adminMint(playerWallet.addr, 1, 1, true);
    }

    function testAdminMint() public {
        soulbound1155.addNewToken(1);
        soulbound1155.adminMint(playerWallet.addr, 1, 1, true);
    }

    function testMintBatchShouldPass() public {
        soulbound1155.addNewToken(1);
        soulbound1155.addNewToken(2);
        soulbound1155.addNewToken(3);

        uint256[] memory tokenIds = new uint256[](3);
        tokenIds[0] = 1;
        tokenIds[1] = 2;
        tokenIds[2] = 3;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1;
        amounts[1] = 1;
        amounts[2] = 1;

        vm.prank(playerWallet.addr);
        soulbound1155.mintBatch(tokenIds, amounts, false, nonce, signature);

        assertEq(soulbound1155.balanceOf(playerWallet.addr, 1), 1);
        assertEq(soulbound1155.balanceOf(playerWallet.addr, 2), 1);
        assertEq(soulbound1155.balanceOf(playerWallet.addr, 3), 1);

        vm.prank(playerWallet.addr);
        soulbound1155.safeBatchTransferFrom(playerWallet.addr, minterWallet.addr, tokenIds, amounts, "");

        vm.prank(playerWallet2.addr);
        soulbound1155.mintBatch(tokenIds, amounts, true, nonce2, signature2);

        vm.expectRevert("ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred");
        vm.prank(playerWallet2.addr);
        soulbound1155.safeBatchTransferFrom(playerWallet2.addr, minterWallet.addr, tokenIds, amounts, "");
    }

    function testMintBatchMoreThanLimit() public {
        soulbound1155.addNewToken(1);
        soulbound1155.addNewToken(2);
        soulbound1155.addNewToken(3);

        uint256[] memory tokenIds = new uint256[](3);
        tokenIds[0] = 1;
        tokenIds[1] = 2;
        tokenIds[2] = 3;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 2;
        amounts[1] = 2;
        amounts[2] = 2;

        vm.expectRevert("Exceed max mint");
        vm.prank(playerWallet.addr);
        soulbound1155.mintBatch(tokenIds, amounts, true, nonce, signature);
    }

    function testMintBatchAlreadyMinted() public {
        soulbound1155.addNewToken(1);
        soulbound1155.addNewToken(2);
        soulbound1155.addNewToken(3);

        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = 1;
        tokenIds[1] = 2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;

        vm.prank(playerWallet.addr);
        soulbound1155.mintBatch(tokenIds, amounts, true, nonce, signature);

        skip(3600); // so nonce is different
        (uint256 newNonce, bytes memory newSignature) = generateSignature(playerWallet.addr, minterLabel);

        uint256[] memory tokenIds2 = new uint256[](3);
        tokenIds2[0] = 1;
        tokenIds2[1] = 2;
        tokenIds2[2] = 3;

        uint256[] memory amounts2 = new uint256[](3);
        amounts2[0] = 1;
        amounts2[1] = 1;
        amounts2[2] = 1;

        vm.expectRevert("Already minted");
        vm.prank(playerWallet.addr);
        soulbound1155.mintBatch(tokenIds2, amounts2, true, newNonce, newSignature);
    }

    function testMintBatchInvalidTokenId() public {
        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = 111;
        tokenIds[1] = 222;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;

        vm.expectRevert("Token not exist");
        vm.prank(playerWallet.addr);
        soulbound1155.mintBatch(tokenIds, amounts, true, nonce, signature);
    }

    function testAdminMintBatchNotMinterRole() public {
        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = 111;
        tokenIds[1] = 222;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;

        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"
        );
        vm.prank(playerWallet.addr);
        soulbound1155.adminMintBatch(playerWallet.addr, tokenIds, amounts, true);
    }

    function testAdminMintBatch() public {
        soulbound1155.addNewToken(111);
        soulbound1155.addNewToken(222);
        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = 111;
        tokenIds[1] = 222;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;

        soulbound1155.adminMintBatch(playerWallet.addr, tokenIds, amounts, true);
    }

    function testBurn() public {
        soulbound1155.addNewToken(1);

        vm.prank(playerWallet.addr);
        soulbound1155.mint(1, 1, true, nonce, signature);
        assertEq(soulbound1155.balanceOf(playerWallet.addr, 1), 1);

        vm.expectRevert("ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred");
        vm.prank(playerWallet.addr);
        soulbound1155.safeTransferFrom(playerWallet.addr, minterWallet.addr, 1, 1, "");

        vm.prank(playerWallet.addr);
        soulbound1155.burn(playerWallet.addr, 1, 1);

        assertEq(soulbound1155.balanceOf(playerWallet.addr, 1), 0);

        vm.prank(playerWallet2.addr);
        soulbound1155.mint(1, 1, false, nonce2, signature2);

        vm.prank(playerWallet2.addr);
        soulbound1155.safeTransferFrom(playerWallet2.addr, playerWallet3.addr, 1, 1, "");

        assertEq(soulbound1155.balanceOf(playerWallet2.addr, 1), 0);
        assertEq(soulbound1155.balanceOf(playerWallet3.addr, 1), 1);

        vm.prank(playerWallet3.addr);
        soulbound1155.burn(playerWallet3.addr, 1, 1);

        assertEq(soulbound1155.balanceOf(playerWallet3.addr, 1), 0);
    }

    function testTokenURIIfTokenIdNotExist() public {
        vm.expectRevert("Token not exist");
        soulbound1155.uri(1);
    }

    function testTokenURIIfTokenIdExist() public {
        soulbound1155.addNewToken(1);

        assertEq(soulbound1155.uri(1), "MISSING_BASE_URL1");
    }

    function testUpdateTokenURIFailNotManagerRole() public {
        string memory newBaseURI = "https://something-new.com/";

        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08"
        );
        vm.prank(playerWallet.addr);
        soulbound1155.updateBaseUri(newBaseURI);
    }

    function testUpdateTokenURIPass() public {
        string memory newBaseURI = "https://something-new.com/";

        soulbound1155.addNewToken(1);

        assertEq(soulbound1155.uri(1), "MISSING_BASE_URL1");
        soulbound1155.updateBaseUri(newBaseURI);
        assertEq(soulbound1155.uri(1), "https://something-new.com/1");
    }

    function testNonSoulboundTokenTransfer() public {
        soulbound1155.addNewToken(1);

        vm.prank(playerWallet.addr);
        soulbound1155.mint(1, 1, false, nonce, signature);

        vm.prank(playerWallet.addr);
        soulbound1155.safeTransferFrom(playerWallet.addr, minterWallet.addr, 1, 1, "");

        assertEq(soulbound1155.balanceOf(playerWallet.addr, 1), 0);
        assertEq(soulbound1155.balanceOf(minterWallet.addr, 1), 1);
    }

    function testSoulboundTokenNotTransfer() public {
        soulbound1155.addNewToken(1);

        vm.prank(playerWallet.addr);
        soulbound1155.mint(1, 1, true, nonce, signature);

        vm.expectRevert("ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred");
        vm.prank(playerWallet.addr);
        soulbound1155.safeTransferFrom(playerWallet.addr, minterWallet.addr, 1, 1, "");

        vm.expectRevert("ERCSoulbound: can't be zero amount");
        vm.prank(playerWallet.addr);
        soulbound1155.safeTransferFrom(playerWallet.addr, minterWallet.addr, 1, 0, "");
    }

    function testSoulboundTokenTransferOnlyWhitelistAddresses() public {
        soulbound1155.addNewToken(1);

        vm.prank(playerWallet.addr);
        soulbound1155.mint(1, 1, true, nonce, signature);

        vm.expectRevert("ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred");
        vm.prank(playerWallet.addr);
        soulbound1155.safeTransferFrom(playerWallet.addr, minterWallet.addr, 1, 1, "");

        soulbound1155.updateWhitelistAddress(playerWallet3.addr, true);

        vm.prank(playerWallet.addr);
        soulbound1155.safeTransferFrom(playerWallet.addr, playerWallet3.addr, 1, 1, "");

        vm.prank(playerWallet3.addr);
        soulbound1155.safeTransferFrom(playerWallet3.addr, playerWallet.addr, 1, 1, "");

        soulbound1155.updateWhitelistAddress(playerWallet3.addr, false);

        vm.expectRevert("ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred");
        vm.prank(playerWallet.addr);
        soulbound1155.safeTransferFrom(playerWallet.addr, playerWallet3.addr, 1, 1, "");
    }

    function testTokenRoyaltyDefault() public {
        uint256 mintPrice = 1 ether;
        uint256 expectedRoyalty = (mintPrice * 250) / 10000;

        (address receiver, uint256 royaltyAmount) = soulbound1155.royaltyInfo(1, mintPrice);

        assertEq(receiver, minterWallet.addr);
        assertEq(royaltyAmount, expectedRoyalty);
    }

    function testUpdateTokenRoyalty() public {
        uint256 mintPrice = 1 ether;
        uint256 expectedRoyalty = (mintPrice * 250) / 10000;

        (address receiver, uint256 royaltyAmount) = soulbound1155.royaltyInfo(1, mintPrice);

        assertEq(receiver, minterWallet.addr);
        assertEq(royaltyAmount, expectedRoyalty);

        uint256 expectedRoyaltyAfter = (mintPrice * 300) / 10000;
        soulbound1155.setRoyaltyInfo(playerWallet.addr, 300);

        (address receiverAfter, uint256 royaltyAmountAfter) = soulbound1155.royaltyInfo(1, mintPrice);

        assertEq(receiverAfter, playerWallet.addr);
        assertEq(royaltyAmountAfter, expectedRoyaltyAfter);
    }
}
