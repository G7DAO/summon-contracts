// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

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

    Wallet minterWallet;
    Wallet playerWallet;
    Wallet playerWallet2;

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

        uint256 _nonce = vm.getNonce(signerWallet.addr);

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
        minterWallet = getWallet(minterLabel);

        soulbound1155 = new Soulbound1155("Test1155", "T1155", "MISSING_BASE_URL", 1, false, minterWallet.addr, 10);

        soulbound1155.setSigner(minterWallet.addr);

        (nonce, signature) = generateSignature(playerWallet.addr, minterLabel);
        (nonce2, signature2) = generateSignature(playerWallet2.addr, minterLabel);

        mockERC1155Receiver = new MockERC1155Receiver();

        // Add necessary token IDs to the Soulbound1155 contract
        // for (uint256 i = 0; i <= 26; i++) {
        //     soulbound1155.addNewToken(i);
        // }
    }

    function testTokenExists() public {
        assertEq(soulbound1155.paused(), false);
        soulbound1155.pause();
        assertEq(soulbound1155.paused(), true);

        vm.expectRevert(TokenNotExist.selector);
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
        vm.expectRevert(InvalidSignature.selector);
        soulbound1155.mint(1, 1, true, nonce, signature2);
    }

    function testReuseSignatureMint() public {
        soulbound1155.addNewToken(1);
        vm.prank(playerWallet.addr);
        soulbound1155.mint(1, 1, true, nonce, signature);
        assertEq(soulbound1155.usedSignatures(signature), true);
        vm.prank(playerWallet.addr);
        vm.expectRevert(AlreadyUsedSignature.selector);
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
        tokenIds[0] = 1;
        tokenIds[1] = 1;
        tokenIds[2] = 1;

        vm.prank(playerWallet.addr);
        soulbound1155.mintBatch(tokenIds, amounts, true, nonce, signature);
        assertEq(soulbound1155.usedSignatures(signature), true);

        vm.prank(playerWallet.addr);
        vm.expectRevert(AlreadyUsedSignature.selector);
        soulbound1155.mintBatch(tokenIds, amounts, true, nonce, signature);
    }

    function testMintShouldPass() public {
        soulbound1155.addNewToken(1);
        // soulbound1155.addNewToken(2);
        // soulbound1155.addNewToken(3);

        // vm.prank(playerWallet.addr);
        // soulbound1155.mint(1, 1, true, nonce, signature);
        // vm.prank(playerWallet.addr);
        // soulbound1155.mint(2, 1, true, nonce, signature);
        // vm.prank(playerWallet.addr);
        // soulbound1155.mint(3, 1, true, nonce, signature);
    }

    function testBatchMint() public {}

    function testBurn() public {}

    function testTokenURI() public {}

    function testTokenTransfer() public {}

    function testTokenRoyalty() public {}
}
