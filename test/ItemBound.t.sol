// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "forge-std/StdCheats.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { IERC1155Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ERC1155RoyaltiesSoulbound } from "../contracts/soulbounds/ERC1155RoyaltiesSoulbound.sol";
import { MockERC1155Receiver } from "../contracts/mocks/MockERC1155Receiver.sol";
import { LibItems, TestLibItems } from "../contracts/libraries/LibItems.sol";

contract ItemBoundTest is StdCheats, Test {
    using Strings for uint256;

    ERC1155RoyaltiesSoulbound public itemBound;
    MockERC1155Receiver public mockERC1155Receiver;

    struct Wallet {
        address addr;
        uint256 privateKey;
    }

    string public minterLabel = "minter";
    string public playerLabel = "player";
    string public player2Label = "player2";
    string public player3Label = "player3";

    Wallet public minterWallet;
    Wallet public playerWallet;
    Wallet public playerWallet2;
    Wallet public playerWallet3;

    uint256 public seed1 = 1234;
    uint256 public seed2 = 4321;
    uint256 public nonce;
    bytes public signature;
    bytes public encodedItems1;
    uint256 public nonce2;
    bytes public signature2;
    bytes public encodedItems2;

    uint256 private _seed;
    LibItems.TokenCreate[] public _tokens;
    uint256[] public _tokenIds;

    uint256 public chainId = 31337;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");

    function getWallet(string memory walletLabel) public returns (Wallet memory) {
        (address addr, uint256 privateKey) = makeAddrAndKey(walletLabel);
        Wallet memory wallet = Wallet(addr, privateKey);
        return wallet;
    }

    function generateSignature(
        address wallet,
        bytes memory encodedItems,
        string memory signerLabel
    ) public returns (uint256, bytes memory) {
        Wallet memory signerWallet = getWallet(signerLabel);

        uint256 _nonce = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, signerWallet.addr))) %
            50;

        bytes32 message = keccak256(abi.encodePacked(wallet, encodedItems, _nonce));
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(message);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerWallet.privateKey, hash);
        return (_nonce, abi.encodePacked(r, s, v));
    }

    function concatenateStrings(string memory a, string memory b) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }

    function generateRandomItemId() internal returns (uint256) {
        _seed = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), _seed)));
        return _seed;
    }

    function generateRandomLevel() internal returns (uint256) {
        uint256 _seed = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), _seed)));
        return (_seed % 10) + 1; // 1 - 10
    }

    function generateRandomTier() internal returns (TestLibItems.Tier) {
        uint256 _seed = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), _seed)));
        uint256 random = _seed % 5; // 0 - 4

        if (random == 0) {
            return TestLibItems.Tier.COMMON;
        } else if (random == 1) {
            return TestLibItems.Tier.UNCOMMON;
        } else if (random == 2) {
            return TestLibItems.Tier.RARE;
        } else if (random == 3) {
            return TestLibItems.Tier.LEGENDARY;
        } else if (random == 4) {
            return TestLibItems.Tier.MYTHICAL;
        } else {
            return TestLibItems.Tier.COMMON;
        }
    }

    function encode(address contractAddress, uint256[] memory itemIds) public view returns (bytes memory) {
        return (abi.encode(contractAddress, chainId, itemIds));
    }

    function setUp() public {
        playerWallet = getWallet(playerLabel);
        playerWallet2 = getWallet(player2Label);
        playerWallet3 = getWallet(player3Label);
        minterWallet = getWallet(minterLabel);

        itemBound = new ERC1155RoyaltiesSoulbound(
            "Test1155",
            "T1155",
            "MISSING_BASE_URL",
            "MISSING_CONTRACT_URL",
            1,
            false,
            address(this)
        );

        itemBound.addWhitelistSigner(minterWallet.addr);

        mockERC1155Receiver = new MockERC1155Receiver();

        for (uint256 i = 0; i < 1300; i++) {
            uint256 _tokenId = generateRandomItemId(); // totally random
            uint256 _level = generateRandomLevel(); // level 1-10
            TestLibItems.Tier _tier = generateRandomTier(); // tier 0-4

            LibItems.TokenCreate memory _token = LibItems.TokenCreate({
                tokenId: _tokenId,
                tokenUri: string(abi.encodePacked("https://something.com", "/", _tokenId.toString())),
                receiver: address(0),
                feeBasisPoints: 0
            });

            _tokens.push(_token);
            _tokenIds.push(_tokenId);
        }

        itemBound.addNewTokens(_tokens);

        uint256[] memory _itemIds1 = new uint256[](3);
        _itemIds1[0] = _tokenIds[0];
        _itemIds1[1] = _tokenIds[1];
        _itemIds1[2] = _tokenIds[2];

        encodedItems1 = encode(address(itemBound), _itemIds1);

        uint256[] memory _itemIds2 = new uint256[](3);
        _itemIds2[0] = _tokenIds[3];
        _itemIds2[1] = _tokenIds[4];
        _itemIds2[2] = _tokenIds[5];

        encodedItems2 = encode(address(itemBound), _itemIds2);

        (nonce, signature) = generateSignature(playerWallet.addr, encodedItems1, minterLabel);
        (nonce2, signature2) = generateSignature(playerWallet2.addr, encodedItems2, minterLabel);
    }

    function testTokenExists() public {
        uint256 _tokenId = generateRandomItemId();

        vm.expectRevert("TokenNotExist");
        itemBound.isTokenExist(_tokenId);

        vm.expectRevert("TokenNotExist");
        itemBound.adminMintId(playerWallet.addr, _tokenId, 1, true);

        LibItems.TokenCreate memory _token = LibItems.TokenCreate({
            tokenId: _tokenId,
            tokenUri: string(abi.encodePacked("https://something222.com", "/", _tokenId.toString())),
            receiver: address(0),
            feeBasisPoints: 0
        });

        itemBound.addNewToken(_token);
        itemBound.isTokenExist(_tokenId);
        itemBound.adminMintId(playerWallet.addr, _tokenId, 1, true);
    }

    function testAddNewTokens() public {
        LibItems.TokenCreate[] memory _tokens = new LibItems.TokenCreate[](3);

        skip(36000);
        for (uint256 i = 0; i < 3; i++) {
            uint256 _tokenId = generateRandomItemId(); // totally random
            uint256 _level = generateRandomLevel(); // level 1-10
            TestLibItems.Tier _tier = generateRandomTier(); // tier 0-4

            LibItems.TokenCreate memory _token = LibItems.TokenCreate({
                tokenId: _tokenId,
                tokenUri: string(abi.encodePacked("https://something.com", "/", _tokenId.toString())),
                receiver: address(0),
                feeBasisPoints: 0
            });

            _tokens[i] = _token;
        }

        itemBound.addNewTokens(_tokens);
    }

    function testPauseUnpause() public {
        uint256 _tokenId = _tokenIds[0];

        itemBound.pause();
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        itemBound.adminMintId(address(this), _tokenId, 1, true);
        itemBound.unpause();

        itemBound.adminMintId(address(mockERC1155Receiver), _tokenId, 1, true);
        assertEq(itemBound.balanceOf(address(mockERC1155Receiver), _tokenId), 1);
    }

    function testPauseUnpauseSpecificToken() public {
        uint256 _tokenId = _tokenIds[0];

        itemBound.updateTokenMintPaused(_tokenId, true);

        vm.expectRevert("TokenMintPaused");
        itemBound.adminMintId(address(mockERC1155Receiver), _tokenId, 1, true);

        vm.expectRevert("TokenMintPaused");
        itemBound.adminMint(address(mockERC1155Receiver), encodedItems1, true);

        vm.expectRevert("TokenMintPaused");
        vm.prank(playerWallet.addr);
        itemBound.mint(encodedItems1, 1, true, nonce, signature);

        itemBound.updateTokenMintPaused(_tokenId, false);

        vm.prank(playerWallet.addr);
        itemBound.mint(encodedItems1, 1, true, nonce, signature);

        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 1);
    }

    // testVerifySignature
    function testInvalidSignature() public {
        vm.prank(playerWallet.addr);
        vm.expectRevert("InvalidSignature");
        itemBound.mint(encodedItems1, 1, true, nonce, signature2);
    }

    function testReuseSignatureMint() public {
        vm.prank(playerWallet.addr);
        itemBound.mint(encodedItems1, 1, true, nonce, signature);
        vm.prank(playerWallet.addr);
        vm.expectRevert("AlreadyUsedSignature");
        itemBound.mint(encodedItems1, 1, true, nonce, signature);
    }

    function testMintShouldPass() public {
        vm.prank(playerWallet.addr);
        itemBound.mint(encodedItems1, 1, true, nonce, signature);

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[0], 1, "");

        vm.expectRevert("Achievo1155Soulbound: can't be zero amount");
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[0], 0, "");

        vm.prank(playerWallet2.addr);
        itemBound.mint(encodedItems2, 1, false, nonce2, signature2);

        vm.prank(playerWallet2.addr);
        itemBound.safeTransferFrom(playerWallet2.addr, minterWallet.addr, _tokenIds[3], 1, "");

        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[0]), 1);
        assertEq(itemBound.balanceOf(playerWallet2.addr, _tokenIds[3]), 0);
        assertEq(itemBound.balanceOf(minterWallet.addr, _tokenIds[3]), 1);
    }

    function testMintMoreThanLimit() public {
        vm.expectRevert("ExceedMaxMint");
        vm.prank(playerWallet.addr);
        itemBound.mint(encodedItems1, 2, true, nonce, signature);
    }

    function testMintInvalidTokenId() public {
        uint256[] memory _itemIds3 = new uint256[](3);
        _itemIds3[0] = 1233;
        _itemIds3[1] = 3322;

        bytes memory encodedItems3 = encode(address(itemBound), _itemIds3);

        (uint256 _nonce, bytes memory _signature) = generateSignature(playerWallet.addr, encodedItems3, minterLabel);

        vm.expectRevert("TokenNotExist");
        vm.prank(playerWallet.addr);
        itemBound.mint(encodedItems3, 1, true, _nonce, _signature);
    }

    function testAdminMintNotMinterRole() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                playerWallet.addr,
                MINTER_ROLE
            )
        );
        vm.prank(playerWallet.addr);
        itemBound.adminMint(playerWallet.addr, encodedItems1, true);
    }

    function testAdminMint() public {
        itemBound.adminMint(address(mockERC1155Receiver), encodedItems1, true);
        assertEq(itemBound.balanceOf(address(mockERC1155Receiver), _tokenIds[0]), 1);
        assertEq(itemBound.balanceOf(address(mockERC1155Receiver), _tokenIds[1]), 1);
        assertEq(itemBound.balanceOf(address(mockERC1155Receiver), _tokenIds[2]), 1);
    }

    function testAdminMintIdNotMinterRole() public {
        uint256 _tokenId = _tokenIds[0];
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                playerWallet.addr,
                MINTER_ROLE
            )
        );
        vm.prank(playerWallet.addr);
        itemBound.adminMintId(playerWallet.addr, _tokenId, 1, true);
    }

    function testAdminMintId() public {
        uint256 _tokenId = _tokenIds[0];
        itemBound.adminMintId(playerWallet.addr, _tokenId, 1, true);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[0]), 1);
    }

    function testBurnNotOwnerShouldFail() public {
        vm.prank(playerWallet.addr);
        itemBound.mint(encodedItems1, 1, false, nonce, signature);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[0]), 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC1155Errors.ERC1155MissingApprovalForAll.selector,
                playerWallet2.addr,
                playerWallet.addr
            )
        );

        vm.prank(playerWallet2.addr);
        itemBound.burn(playerWallet.addr, _tokenIds[0], 1);
    }

    function testBurn() public {
        vm.prank(playerWallet.addr);
        itemBound.mint(encodedItems1, 1, true, nonce, signature);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[0]), 1);

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[0], 1, "");

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        itemBound.burn(playerWallet.addr, _tokenIds[0], 1);

        vm.prank(playerWallet2.addr);
        itemBound.mint(encodedItems2, 1, false, nonce2, signature2);

        vm.prank(playerWallet2.addr);
        itemBound.safeTransferFrom(playerWallet2.addr, playerWallet3.addr, _tokenIds[3], 1, "");

        assertEq(itemBound.balanceOf(playerWallet2.addr, _tokenIds[3]), 0);
        assertEq(itemBound.balanceOf(playerWallet3.addr, _tokenIds[3]), 1);

        vm.prank(playerWallet3.addr);
        itemBound.burn(playerWallet3.addr, _tokenIds[3], 1);

        assertEq(itemBound.balanceOf(playerWallet3.addr, _tokenIds[3]), 0);
    }

    function testBurnIfHoldBothNonSoulboundAndSouldbound() public {
        vm.prank(playerWallet.addr);
        itemBound.mint(encodedItems1, 1, true, nonce, signature);

        itemBound.adminMint(playerWallet2.addr, encodedItems1, false);

        vm.prank(playerWallet2.addr);
        itemBound.safeTransferFrom(playerWallet2.addr, playerWallet.addr, _tokenIds[0], 1, "");

        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[0]), 2);

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[0], 2, "");

        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[0], 1, "");
    }

    function testBurnBatchNotOwnerShouldFail() public {
        uint256[] memory _itemIds1 = new uint256[](3);
        _itemIds1[0] = _tokenIds[0];
        _itemIds1[1] = _tokenIds[1];
        _itemIds1[2] = _tokenIds[2];

        uint256[] memory _amount1 = new uint256[](3);
        _amount1[0] = 1;
        _amount1[1] = 1;
        _amount1[2] = 1;

        vm.prank(playerWallet.addr);
        itemBound.mint(encodedItems1, 1, false, nonce, signature);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[0]), 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC1155Errors.ERC1155MissingApprovalForAll.selector,
                playerWallet2.addr,
                playerWallet.addr
            )
        );

        vm.prank(playerWallet2.addr);
        itemBound.burnBatch(playerWallet.addr, _itemIds1, _amount1);
    }

    function testBurnBatch() public {
        uint256[] memory _itemIds1 = new uint256[](3);
        _itemIds1[0] = _tokenIds[0];
        _itemIds1[1] = _tokenIds[1];
        _itemIds1[2] = _tokenIds[2];

        uint256[] memory _itemIds2 = new uint256[](3);
        _itemIds2[0] = _tokenIds[3];
        _itemIds2[1] = _tokenIds[4];
        _itemIds2[2] = _tokenIds[5];

        uint256[] memory _amount1 = new uint256[](3);
        _amount1[0] = 1;
        _amount1[1] = 1;
        _amount1[2] = 1;

        vm.prank(playerWallet.addr);
        itemBound.mint(encodedItems1, 1, true, nonce, signature);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[0]), 1);

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[0], 1, "");

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        itemBound.burnBatch(playerWallet.addr, _itemIds1, _amount1);

        vm.prank(playerWallet2.addr);
        itemBound.mint(encodedItems2, 1, false, nonce2, signature2);

        vm.prank(playerWallet2.addr);
        itemBound.safeTransferFrom(playerWallet2.addr, playerWallet3.addr, _tokenIds[3], 1, "");
        vm.prank(playerWallet2.addr);
        itemBound.safeTransferFrom(playerWallet2.addr, playerWallet3.addr, _tokenIds[4], 1, "");
        vm.prank(playerWallet2.addr);
        itemBound.safeTransferFrom(playerWallet2.addr, playerWallet3.addr, _tokenIds[5], 1, "");

        assertEq(itemBound.balanceOf(playerWallet2.addr, _tokenIds[3]), 0);
        assertEq(itemBound.balanceOf(playerWallet3.addr, _tokenIds[3]), 1);

        vm.prank(playerWallet3.addr);
        itemBound.burnBatch(playerWallet3.addr, _itemIds2, _amount1);

        assertEq(itemBound.balanceOf(playerWallet3.addr, _tokenIds[3]), 0);
    }

    function testBatchTransferFrom() public {
        uint256[] memory _itemIds1 = new uint256[](3);
        _itemIds1[0] = _tokenIds[0];
        _itemIds1[1] = _tokenIds[1];
        _itemIds1[2] = _tokenIds[2];

        uint256[] memory _itemIds2 = new uint256[](3);
        _itemIds2[0] = _tokenIds[3];
        _itemIds2[1] = _tokenIds[4];
        _itemIds2[2] = _tokenIds[5];

        uint256[] memory _amount1 = new uint256[](3);
        _amount1[0] = 1;
        _amount1[1] = 1;
        _amount1[2] = 1;

        vm.prank(playerWallet.addr);
        itemBound.mint(encodedItems1, 1, true, nonce, signature);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[0]), 1);

        itemBound.adminMint(playerWallet2.addr, encodedItems1, false);

        vm.prank(playerWallet2.addr);
        itemBound.safeTransferFrom(playerWallet2.addr, playerWallet.addr, _tokenIds[0], 1, "");

        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[0]), 2);

        uint256[] memory _itemIds3 = new uint256[](2);
        _itemIds3[0] = _tokenIds[0];
        _itemIds3[1] = _tokenIds[0];

        uint256[] memory _amount3 = new uint256[](2);
        _amount3[0] = 1;
        _amount3[1] = 1;

        vm.expectRevert("ERC1155: duplicate ID");
        vm.prank(playerWallet.addr);
        itemBound.safeBatchTransferFrom(playerWallet.addr, minterWallet.addr, _itemIds3, _amount3, "");

        assertEq(itemBound.balanceOf(minterWallet.addr, _tokenIds[0]), 0);

        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[0], 1, "");
        assertEq(itemBound.balanceOf(minterWallet.addr, _tokenIds[0]), 1);
    }

    function testTokenURIIfTokenIdNotExist() public {
        vm.expectRevert("TokenNotExist");
        itemBound.uri(1);
    }

    function testTokenURIIfTokenIdExistNOSpeficTokenURIFallbackToBaseURI() public {
        uint256 _tokenId = generateRandomItemId(); // totally random
        uint256 _level = generateRandomLevel(); // level 1-10
        TestLibItems.Tier _tier = generateRandomTier(); // tier 0-4

        LibItems.TokenCreate memory _token = LibItems.TokenCreate({
            tokenId: _tokenId,
            tokenUri: "",
            receiver: address(0),
            feeBasisPoints: 0
        });

        itemBound.addNewToken(_token);

        assertEq(itemBound.uri(_tokenId), string(abi.encodePacked("MISSING_BASE_URL", "/", _tokenId.toString())));
    }

    function testTokenURIIfTokenIdExistWithSpeficTokenURI() public {
        uint256 _tokenId = generateRandomItemId(); // totally random
        uint256 _level = generateRandomLevel(); // level 1-10
        TestLibItems.Tier _tier = generateRandomTier(); // tier 0-4

        LibItems.TokenCreate memory _token = LibItems.TokenCreate({
            tokenId: _tokenId,
            tokenUri: "ipfs://specific-token-uri.com",
            receiver: address(0),
            feeBasisPoints: 0
        });

        itemBound.addNewToken(_token);

        assertEq(itemBound.uri(_tokenId), "ipfs://specific-token-uri.com");
    }

    function testUpdateTokenBaseURIFailNotDevConfigRole() public {
        string memory newBaseURI = "https://something-new.com";

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                playerWallet.addr,
                DEV_CONFIG_ROLE
            )
        );
        vm.prank(playerWallet.addr);
        itemBound.updateBaseUri(newBaseURI);
    }

    function testUpdateTokenBaseURIPass() public {
        uint256 _tokenId = generateRandomItemId(); // totally random
        uint256 _level = generateRandomLevel(); // level 1-10
        TestLibItems.Tier _tier = generateRandomTier(); // tier 0-4

        LibItems.TokenCreate memory _token = LibItems.TokenCreate({
            tokenId: _tokenId,
            tokenUri: "",
            receiver: address(0),
            feeBasisPoints: 0
        });

        itemBound.addNewToken(_token);

        string memory newBaseURI = "https://something-new.com";

        assertEq(itemBound.uri(_tokenId), string(abi.encodePacked("MISSING_BASE_URL", "/", _tokenId.toString())));
        itemBound.updateBaseUri(newBaseURI);
        assertEq(
            itemBound.uri(_tokenId),
            string(abi.encodePacked("https://something-new.com", "/", _tokenId.toString()))
        );
    }

    function testUpdateTokenURIFailNoDevConfigRole() public {
        string memory newTokenUri = "https://something-new.com/232";

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                playerWallet.addr,
                DEV_CONFIG_ROLE
            )
        );
        vm.prank(playerWallet.addr);
        itemBound.updateTokenUri(0, newTokenUri);
    }

    function testUpdateTokenURIPass() public {
        uint256 _tokenId = generateRandomItemId(); // totally random
        uint256 _level = generateRandomLevel(); // level 1-10
        TestLibItems.Tier _tier = generateRandomTier(); // tier 0-4

        LibItems.TokenCreate memory _token = LibItems.TokenCreate({
            tokenId: _tokenId,
            tokenUri: "",
            receiver: address(0),
            feeBasisPoints: 0
        });

        itemBound.addNewToken(_token);

        string memory newTokenUri = "https://something-new.com/232";

        assertEq(itemBound.uri(_tokenId), string(abi.encodePacked("MISSING_BASE_URL", "/", _tokenId.toString())));
        itemBound.updateTokenUri(_tokenId, newTokenUri);
        assertEq(itemBound.uri(_tokenId), "https://something-new.com/232");
    }

    function testNonSoulboundTokenTransfer() public {
        uint256 _tokenId = _tokenIds[0];
        itemBound.adminMintId(playerWallet.addr, _tokenId, 1, false);

        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenId, 1, "");

        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 0);
        assertEq(itemBound.balanceOf(minterWallet.addr, _tokenId), 1);
    }

    function testSoulboundTokenNotTransfer() public {
        uint256 _tokenId = _tokenIds[0];
        itemBound.adminMintId(playerWallet.addr, _tokenId, 1, true);

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenId, 1, "");

        vm.expectRevert("Achievo1155Soulbound: can't be zero amount");
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenId, 0, "");
    }

    function testSoulboundTokenTransferOnlyWhitelistAddresses() public {
        uint256 _tokenId = _tokenIds[0];
        itemBound.adminMintId(playerWallet.addr, _tokenId, 1, true);

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, playerWallet3.addr, _tokenId, 1, "");

        itemBound.updateWhitelistAddress(playerWallet3.addr, true);

        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, playerWallet3.addr, _tokenId, 1, "");

        vm.prank(playerWallet3.addr);
        itemBound.safeTransferFrom(playerWallet3.addr, playerWallet.addr, _tokenId, 1, "");

        itemBound.updateWhitelistAddress(playerWallet3.addr, false);

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, playerWallet3.addr, _tokenId, 1, "");
    }

    function testTokenRoyaltyDefault() public {
        uint256 mintPrice = 1 ether;
        uint256 expectedRoyalty = (mintPrice * 250) / 10000;

        (address receiver, uint256 royaltyAmount) = itemBound.royaltyInfo(1, mintPrice);

        assertEq(receiver, address(0));
        assertEq(royaltyAmount, 0);
    }

    function testSetTokenRoyaltyAndReset() public {
        uint256 mintPrice = 1 ether;
        uint256 tokenId = 1;

        (address receiver, uint256 royaltyAmount) = itemBound.royaltyInfo(tokenId, mintPrice);

        assertEq(receiver, address(0));
        assertEq(royaltyAmount, 0);

        uint256 expectedRoyaltyAfter = (mintPrice * 300) / 10000;
        itemBound.setTokenRoyalty(tokenId, playerWallet.addr, 300);

        (address receiverAfter, uint256 royaltyAmountAfter) = itemBound.royaltyInfo(tokenId, mintPrice);

        assertEq(receiverAfter, playerWallet.addr);
        assertEq(royaltyAmountAfter, expectedRoyaltyAfter);

        itemBound.resetTokenRoyalty(tokenId);

        (address receiverAfterReset, uint256 royaltyAmountAfterReset) = itemBound.royaltyInfo(tokenId, mintPrice);
        assertEq(receiverAfterReset, address(0));
        assertEq(royaltyAmountAfterReset, 0);
    }

    function testSetTokenRoyaltyShouldFailNotManagerRole() public {
        uint256 tokenId = 1;

        vm.prank(minterWallet.addr);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                minterWallet.addr,
                MANAGER_ROLE
            )
        );
        itemBound.setTokenRoyalty(tokenId, minterWallet.addr, 300);

        vm.prank(playerWallet.addr);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                playerWallet.addr,
                MANAGER_ROLE
            )
        );
        itemBound.setTokenRoyalty(tokenId, playerWallet.addr, 300);

        itemBound.grantRole(itemBound.MANAGER_ROLE(), playerWallet.addr);

        vm.prank(playerWallet.addr);
        itemBound.setTokenRoyalty(tokenId, playerWallet.addr, 300);

        uint256 mintPrice = 1 ether;
        uint256 expectedRoyaltyAfter = (mintPrice * 300) / 10000;

        (address receiverAfter, uint256 royaltyAmountAfter) = itemBound.royaltyInfo(tokenId, mintPrice);

        assertEq(receiverAfter, playerWallet.addr);
        assertEq(royaltyAmountAfter, expectedRoyaltyAfter);
    }

    function testgetAllItems() public {
        bytes memory encodedItemsAll = encode(address(itemBound), _tokenIds);
        itemBound.adminMint(playerWallet.addr, encodedItemsAll, false);

        string memory newTokenUri = "https://something-new.com/232";
        itemBound.updateTokenUri(_tokenIds[23], newTokenUri);
        assertEq(itemBound.uri(_tokenIds[23]), "https://something-new.com/232");

        vm.prank(playerWallet.addr);
        LibItems.TokenReturn[] memory allTokensInfo = itemBound.getAllItems(playerWallet.addr);
        assertEq(allTokensInfo.length, 1300);

        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[24], 1, "");

        vm.prank(playerWallet.addr);
        LibItems.TokenReturn[] memory allTokensInfo2 = itemBound.getAllItems(playerWallet.addr);
        assertEq(allTokensInfo2.length, 1299);

        for (uint256 i = 0; i < allTokensInfo.length; i++) {
            assertEq(allTokensInfo[i].tokenId, _tokenIds[i]);

            if (i == 23) {
                assertEq(allTokensInfo[i].tokenUri, newTokenUri);
                assertEq(allTokensInfo[i].amount, 1);
            } else {
                assertEq(allTokensInfo[i].amount, 1);
                assertEq(
                    allTokensInfo[i].tokenUri,
                    string(abi.encodePacked("https://something.com", "/", _tokenIds[i].toString()))
                );
            }
        }

        vm.prank(minterWallet.addr);
        LibItems.TokenReturn[] memory allTokensInfo3 = itemBound.getAllItems(minterWallet.addr);
        assertEq(allTokensInfo3.length, 1);
    }

    function testgetAllItemsAdmin() public {
        bytes memory encodedItemsAll = encode(address(itemBound), _tokenIds);
        itemBound.adminMint(playerWallet.addr, encodedItemsAll, false);

        string memory newTokenUri = "https://something-new.com/232";
        itemBound.updateTokenUri(_tokenIds[23], newTokenUri);
        assertEq(itemBound.uri(_tokenIds[23]), "https://something-new.com/232");

        LibItems.TokenReturn[] memory allTokensInfo = itemBound.getAllItems(playerWallet.addr);
        assertEq(allTokensInfo.length, 1300);

        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[24], 1, "");

        LibItems.TokenReturn[] memory allTokensInfo2 = itemBound.getAllItems(playerWallet.addr);
        assertEq(allTokensInfo2.length, 1300);

        for (uint256 i = 0; i < allTokensInfo.length; i++) {
            assertEq(allTokensInfo[i].tokenId, _tokenIds[i]);

            if (i == 23) {
                assertEq(allTokensInfo[i].tokenUri, newTokenUri);
                assertEq(allTokensInfo[i].amount, 1);
            } else {
                assertEq(allTokensInfo[i].amount, 1);
                assertEq(
                    allTokensInfo[i].tokenUri,
                    string(abi.encodePacked("https://something.com", "/", _tokenIds[i].toString()))
                );
            }
        }

        LibItems.TokenReturn[] memory allTokensInfo3 = itemBound.getAllItems(minterWallet.addr);
        assertEq(allTokensInfo3.length, 1300);
    }
}
