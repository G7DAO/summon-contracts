// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "forge-std/StdCheats.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

import { GameSummary } from "../../contracts/games/GameSummary.sol";
import { MockERC1155Receiver } from "../../contracts/mocks/MockERC1155Receiver.sol";
import { LibGameSummary } from "../../contracts/libraries/LibGameSummary.sol";

contract GameSummaryBoundTest is StdCheats, Test {
    using Strings for uint256;

    GameSummary public gameSummary;
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
    LibGameSummary.GameSummaryCreate[] public _tokens;
    uint256[] public _tokenIds;
    uint256[] public _storeIds;
    uint256[] public _playerIds;
    uint256[] public _gameIds;

    uint256 public chainId = 31337;

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
        bytes32 hash = ECDSA.toEthSignedMessageHash(message);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerWallet.privateKey, hash);
        return (_nonce, abi.encodePacked(r, s, v));
    }

    function concatenateStrings(string memory a, string memory b) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }

    function generateRandomStoreId() internal returns (uint256) {
        _seed = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), _seed)));
        return _seed;
    }

    function generateRandomPlayerId() internal returns (uint256) {
        uint256 _seed = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), _seed)));
        return _seed % 1000000;
    }

    function generateRandomGameId() internal returns (uint256) {
        uint256 _seed = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), _seed)));
        return _seed % 10000000;
    }

    function generateTokenId(uint256 storeId, uint256 playerId, uint256 gameId) internal returns (uint256) {
        uint256 tokenId = uint256(keccak256(abi.encode(storeId, playerId, gameId)));
        return tokenId;
    }

    function encode(
        address contractAddress,
        uint256[] memory storeIds,
        uint256[] memory playerIds,
        uint256[] memory gameIds
    ) public view returns (bytes memory) {
        return (abi.encode(contractAddress, chainId, _storeIds, _playerIds, _gameIds));
    }

    function toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = bytes1(uint8(value & 0xf));
            value >>= 4;
            if (i % 2 == 0) {
                buffer[i] = bytes1(uint8(buffer[i]) + (bytes1(uint8(buffer[i])) < bytes1(uint8(0xa)) ? 48 : 87));
            }
        }
        return string(buffer);
    }
    function setUp() public {
        playerWallet = getWallet(playerLabel);
        playerWallet2 = getWallet(player2Label);
        playerWallet3 = getWallet(player3Label);
        minterWallet = getWallet(minterLabel);

        gameSummary = new GameSummary(address(this));

        gameSummary.initialize(
            "Test1155",
            "T1155",
            "MISSING_BASE_URL",
            "MISSING_CONTRACT_URL",
            "https://example.api.com",
            1,
            false,
            address(this)
        );

        gameSummary.addWhitelistSigner(minterWallet.addr);

        mockERC1155Receiver = new MockERC1155Receiver();

        for (uint256 i = 0; i < 1300; i++) {
            uint256 _storeId = generateRandomStoreId();
            uint256 _playerId = generateRandomPlayerId();
            uint256 _gameId = generateRandomGameId();
            uint256 _tokenId = generateTokenId(_storeId, _playerId, _gameId);

            _storeIds.push(_storeId);
            _playerIds.push(_playerId);
            _gameIds.push(_gameId);
            _tokenIds.push(_tokenId);
        }

        uint256[] memory _storeIds1 = new uint256[](3);
        _storeIds1[0] = _storeIds[0];
        _storeIds1[1] = _storeIds[1];
        _storeIds1[2] = _storeIds[2];

        uint256[] memory _playerIds1 = new uint256[](3);
        _playerIds1[0] = _playerIds[0];
        _playerIds1[1] = _playerIds[1];
        _playerIds1[2] = _playerIds[2];

        uint256[] memory _gameIds1 = new uint256[](3);
        _gameIds1[0] = _gameIds[0];
        _gameIds1[1] = _gameIds[1];
        _gameIds1[2] = _gameIds[2];

        encodedItems1 = encode(address(gameSummary), _storeIds1, _playerIds1, _gameIds1);

        uint256[] memory _storeIds2 = new uint256[](3);
        _storeIds2[0] = _storeIds[3];
        _storeIds2[1] = _storeIds[4];
        _storeIds2[2] = _storeIds[5];

        uint256[] memory _playerIds2 = new uint256[](3);
        _playerIds2[0] = _playerIds[3];
        _playerIds2[1] = _playerIds[4];
        _playerIds2[2] = _playerIds[5];

        uint256[] memory _gameIds2 = new uint256[](3);
        _gameIds2[0] = _gameIds[3];
        _gameIds2[1] = _gameIds[4];
        _gameIds2[2] = _gameIds[5];

        encodedItems2 = encode(address(gameSummary), _storeIds2, _playerIds2, _gameIds2);

        (nonce, signature) = generateSignature(playerWallet.addr, encodedItems1, minterLabel);
        (nonce2, signature2) = generateSignature(playerWallet2.addr, encodedItems2, minterLabel);
    }

    function testTokenExists() public {
        uint256 _storeId = generateRandomStoreId();
        uint256 _playerId = generateRandomPlayerId();
        uint256 _gameId = generateRandomGameId();
        uint256 _tokenId = generateTokenId(_storeId, _playerId, _gameId);

        assertEq(gameSummary.isTokenExist(_tokenId), false);

        gameSummary.adminMintId(playerWallet.addr, _storeId, _playerId, _gameId, 1, true);
        assertEq(gameSummary.isTokenExist(_tokenId), true);
    }

    function testPauseUnpause() public {
        uint256 _storeId = _storeIds[0];
        uint256 _playerId = _playerIds[0];
        uint256 _gameId = _gameIds[0];
        uint256 _tokenId = gameSummary.getTokenId(_storeId, _playerId, _gameId);

        gameSummary.pause();
        vm.expectRevert("Pausable: paused");
        gameSummary.adminMintId(address(this), _storeId, _playerId, _gameId, 1, true);
        gameSummary.unpause();

        gameSummary.adminMintId(address(mockERC1155Receiver), _storeId, _playerId, _gameId, 1, true);
        assertEq(gameSummary.balanceOf(address(mockERC1155Receiver), _tokenId), 1);
    }

    function testPauseUnpauseSpecificToken() public {
        uint256 _storeId = _storeIds[0];
        uint256 _playerId = _playerIds[0];
        uint256 _gameId = _gameIds[0];
        uint256 _tokenId = gameSummary.getTokenId(_storeId, _playerId, _gameId);

        gameSummary.updateTokenMintPaused(_tokenId, true);

        vm.expectRevert("TokenMintPaused");
        gameSummary.adminMintId(address(mockERC1155Receiver), _storeId, _playerId, _gameId, 1, true);

        vm.expectRevert("TokenMintPaused");
        gameSummary.adminMint(address(mockERC1155Receiver), encodedItems1, true);

        vm.expectRevert("TokenMintPaused");
        vm.prank(playerWallet.addr);
        gameSummary.mint(encodedItems1, 1, true, nonce, signature);

        gameSummary.updateTokenMintPaused(_tokenId, false);

        vm.prank(playerWallet.addr);
        gameSummary.mint(encodedItems1, 1, true, nonce, signature);

        assertEq(gameSummary.balanceOf(playerWallet.addr, _tokenId), 1);
    }

    // testVerifySignature
    function testInvalidSignature() public {
        vm.prank(playerWallet.addr);
        vm.expectRevert("InvalidSignature");
        gameSummary.mint(encodedItems1, 1, true, nonce, signature2);
    }

    function testReuseSignatureMint() public {
        vm.prank(playerWallet.addr);
        gameSummary.mint(encodedItems1, 1, true, nonce, signature);
        vm.prank(playerWallet.addr);
        vm.expectRevert("AlreadyUsedSignature");
        gameSummary.mint(encodedItems1, 1, true, nonce, signature);
    }

    function testMintShouldPass() public {
        vm.prank(playerWallet.addr);
        gameSummary.mint(encodedItems1, 1, true, nonce, signature);

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        gameSummary.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[0], 1, "");

        vm.expectRevert("Achievo1155Soulbound: can't be zero amount");
        vm.prank(playerWallet.addr);
        gameSummary.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[0], 0, "");

        vm.prank(playerWallet2.addr);
        gameSummary.mint(encodedItems2, 1, false, nonce2, signature2);

        vm.prank(playerWallet2.addr);
        gameSummary.safeTransferFrom(playerWallet2.addr, minterWallet.addr, _tokenIds[3], 1, "");

        assertEq(gameSummary.balanceOf(playerWallet.addr, _tokenIds[0]), 1);
        assertEq(gameSummary.balanceOf(playerWallet2.addr, _tokenIds[3]), 0);
        assertEq(gameSummary.balanceOf(minterWallet.addr, _tokenIds[3]), 1);
    }

    function testMintMoreThanOneTokenPerWallet() public {
        uint256 _storeId = _storeIds[0];
        uint256 _playerId = _playerIds[0];
        uint256 _gameId = _gameIds[0];
        uint256 _tokenId = gameSummary.getTokenId(_storeId, _playerId, _gameId);

        gameSummary.adminMintId(address(mockERC1155Receiver), _storeId, _playerId, _gameId, 1, true);
        assertEq(gameSummary.balanceOf(address(mockERC1155Receiver), _tokenId), 1);

        vm.expectRevert("AlreadyMinted");
        gameSummary.adminMintId(address(mockERC1155Receiver), _storeId, _playerId, _gameId, 1, true);
    }

    function testMintMoreThanLimit() public {
        vm.expectRevert("ExceedMaxMint");
        vm.prank(playerWallet.addr);
        gameSummary.mint(encodedItems1, 2, true, nonce, signature);
    }

    function testAdminMintNotMinterRole() public {
        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"
        );
        vm.prank(playerWallet.addr);
        gameSummary.adminMint(playerWallet.addr, encodedItems1, true);
    }

    function testAdminMint() public {
        gameSummary.adminMint(address(mockERC1155Receiver), encodedItems1, true);
        assertEq(gameSummary.balanceOf(address(mockERC1155Receiver), _tokenIds[0]), 1);
        assertEq(gameSummary.balanceOf(address(mockERC1155Receiver), _tokenIds[1]), 1);
        assertEq(gameSummary.balanceOf(address(mockERC1155Receiver), _tokenIds[2]), 1);
    }

    function testAdminMintIdNotMinterRole() public {
        uint256 _storeId = _storeIds[0];
        uint256 _playerId = _playerIds[0];
        uint256 _gameId = _gameIds[0];
        uint256 _tokenId = gameSummary.getTokenId(_storeId, _playerId, _gameId);

        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"
        );
        vm.prank(playerWallet.addr);
        gameSummary.adminMintId(playerWallet.addr, _storeId, _playerId, _gameId, 1, true);
    }

    function testAdminMintId() public {
        uint256 _storeId = _storeIds[0];
        uint256 _playerId = _playerIds[0];
        uint256 _gameId = _gameIds[0];
        uint256 _tokenId = gameSummary.getTokenId(_storeId, _playerId, _gameId);

        gameSummary.adminMintId(playerWallet.addr, _storeId, _playerId, _gameId, 1, true);
        assertEq(gameSummary.balanceOf(playerWallet.addr, _tokenIds[0]), 1);
    }

    function testBurnNotOwnerShouldFail() public {
        vm.prank(playerWallet.addr);
        gameSummary.mint(encodedItems1, 1, false, nonce, signature);
        assertEq(gameSummary.balanceOf(playerWallet.addr, _tokenIds[0]), 1);

        vm.expectRevert("ERC1155: caller is not token owner or approved");
        vm.prank(playerWallet2.addr);
        gameSummary.burn(playerWallet.addr, _tokenIds[0], 1);
    }

    function testBurn() public {
        vm.prank(playerWallet.addr);
        gameSummary.mint(encodedItems1, 1, true, nonce, signature);
        assertEq(gameSummary.balanceOf(playerWallet.addr, _tokenIds[0]), 1);

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        gameSummary.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[0], 1, "");

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        gameSummary.burn(playerWallet.addr, _tokenIds[0], 1);

        vm.prank(playerWallet2.addr);
        gameSummary.mint(encodedItems2, 1, false, nonce2, signature2);

        vm.prank(playerWallet2.addr);
        gameSummary.safeTransferFrom(playerWallet2.addr, playerWallet3.addr, _tokenIds[3], 1, "");

        assertEq(gameSummary.balanceOf(playerWallet2.addr, _tokenIds[3]), 0);
        assertEq(gameSummary.balanceOf(playerWallet3.addr, _tokenIds[3]), 1);

        vm.prank(playerWallet3.addr);
        gameSummary.burn(playerWallet3.addr, _tokenIds[3], 1);

        assertEq(gameSummary.balanceOf(playerWallet3.addr, _tokenIds[3]), 0);
    }

    function testBurnIfHoldBothNonSoulboundAndSouldbound() public {
        vm.prank(playerWallet.addr);
        gameSummary.mint(encodedItems1, 1, true, nonce, signature);

        gameSummary.adminMint(playerWallet2.addr, encodedItems1, false);

        vm.prank(playerWallet2.addr);
        gameSummary.safeTransferFrom(playerWallet2.addr, playerWallet.addr, _tokenIds[0], 1, "");

        assertEq(gameSummary.balanceOf(playerWallet.addr, _tokenIds[0]), 2);

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        gameSummary.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[0], 2, "");

        vm.prank(playerWallet.addr);
        gameSummary.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[0], 1, "");
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
        gameSummary.mint(encodedItems1, 1, false, nonce, signature);
        assertEq(gameSummary.balanceOf(playerWallet.addr, _tokenIds[0]), 1);

        vm.expectRevert("ERC1155: caller is not token owner or approved");
        vm.prank(playerWallet2.addr);
        gameSummary.burnBatch(playerWallet.addr, _itemIds1, _amount1);
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
        gameSummary.mint(encodedItems1, 1, true, nonce, signature);
        assertEq(gameSummary.balanceOf(playerWallet.addr, _tokenIds[0]), 1);

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        gameSummary.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[0], 1, "");

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        gameSummary.burnBatch(playerWallet.addr, _itemIds1, _amount1);

        vm.prank(playerWallet2.addr);
        gameSummary.mint(encodedItems2, 1, false, nonce2, signature2);

        vm.prank(playerWallet2.addr);
        gameSummary.safeTransferFrom(playerWallet2.addr, playerWallet3.addr, _tokenIds[3], 1, "");
        vm.prank(playerWallet2.addr);
        gameSummary.safeTransferFrom(playerWallet2.addr, playerWallet3.addr, _tokenIds[4], 1, "");
        vm.prank(playerWallet2.addr);
        gameSummary.safeTransferFrom(playerWallet2.addr, playerWallet3.addr, _tokenIds[5], 1, "");

        assertEq(gameSummary.balanceOf(playerWallet2.addr, _tokenIds[3]), 0);
        assertEq(gameSummary.balanceOf(playerWallet3.addr, _tokenIds[3]), 1);

        vm.prank(playerWallet3.addr);
        gameSummary.burnBatch(playerWallet3.addr, _itemIds2, _amount1);

        assertEq(gameSummary.balanceOf(playerWallet3.addr, _tokenIds[3]), 0);
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
        gameSummary.mint(encodedItems1, 1, true, nonce, signature);
        assertEq(gameSummary.balanceOf(playerWallet.addr, _tokenIds[0]), 1);

        gameSummary.adminMint(playerWallet2.addr, encodedItems1, false);

        vm.prank(playerWallet2.addr);
        gameSummary.safeTransferFrom(playerWallet2.addr, playerWallet.addr, _tokenIds[0], 1, "");

        assertEq(gameSummary.balanceOf(playerWallet.addr, _tokenIds[0]), 2);

        uint256[] memory _itemIds3 = new uint256[](2);
        _itemIds3[0] = _tokenIds[0];
        _itemIds3[1] = _tokenIds[0];

        uint256[] memory _amount3 = new uint256[](2);
        _amount3[0] = 1;
        _amount3[1] = 1;

        vm.expectRevert("ERC1155: duplicate ID");
        vm.prank(playerWallet.addr);
        gameSummary.safeBatchTransferFrom(playerWallet.addr, minterWallet.addr, _itemIds3, _amount3, "");

        assertEq(gameSummary.balanceOf(minterWallet.addr, _tokenIds[0]), 0);

        vm.prank(playerWallet.addr);
        gameSummary.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[0], 1, "");
        assertEq(gameSummary.balanceOf(minterWallet.addr, _tokenIds[0]), 1);
    }

    function testTokenURIIfTokenIdNotExist() public {
        vm.expectRevert("TokenNotExist");
        gameSummary.uri(1);
    }

    function testTokenURIIfTokenIdExistNOSpeficTokenURIFallbackToBaseURI() public {
        uint256 _storeId = generateRandomStoreId();
        uint256 _playerId = generateRandomPlayerId();
        uint256 _gameId = generateRandomGameId();
        uint256 _tokenId = generateTokenId(_storeId, _playerId, _gameId);

        gameSummary.adminMintId(playerWallet.addr, _storeId, _playerId, _gameId, 1, false);
        gameSummary.setCompoundURIEnabled(false);
        assertEq(gameSummary.uri(_tokenId), string(abi.encodePacked("MISSING_BASE_URL", "/", _tokenId.toString())));
    }

    function testUpdateTokenBaseURIFailNotDevConfigRole() public {
        string memory newBaseURI = "https://something-new.com";

        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x3b359cf0b4471a5de84269135285268e64ac56f52d3161392213003a780ad63b"
        );
        vm.prank(playerWallet.addr);
        gameSummary.setBaseUri(newBaseURI);
    }

    function testUpdateTokenBaseURIPass() public {
        uint256 _storeId = generateRandomStoreId();
        uint256 _playerId = generateRandomPlayerId();
        uint256 _gameId = generateRandomGameId();
        uint256 _tokenId = generateTokenId(_storeId, _playerId, _gameId);

        gameSummary.adminMintId(playerWallet.addr, _storeId, _playerId, _gameId, 1, false);
        gameSummary.setCompoundURIEnabled(false);

        string memory newBaseURI = "https://something-new.com";

        assertEq(gameSummary.uri(_tokenId), string(abi.encodePacked("MISSING_BASE_URL", "/", _tokenId.toString())));
        gameSummary.setBaseUri(newBaseURI);
        assertEq(
            gameSummary.uri(_tokenId),
            string(abi.encodePacked("https://something-new.com", "/", _tokenId.toString()))
        );
    }

    function testUpdateCompountURIPass() public {
        uint256 _storeId = generateRandomStoreId();
        uint256 _playerId = generateRandomPlayerId();
        uint256 _gameId = generateRandomGameId();
        uint256 _tokenId = generateTokenId(_storeId, _playerId, _gameId);

        gameSummary.adminMintId(playerWallet.addr, _storeId, _playerId, _gameId, 1, false);

        string memory newCompoundUri = "https://something-new.com/232";

        assertEq(
            gameSummary.uri(_tokenId),
            string(
                abi.encodePacked(
                    "https://example.api.com/",
                    Strings.toHexString(uint160(address(gameSummary)), 20),
                    "/",
                    Strings.toString(_storeId),
                    "-",
                    Strings.toString(_playerId),
                    "-",
                    Strings.toString(_gameId)
                )
            )
        );

        gameSummary.setCompoundURI(newCompoundUri);

        assertEq(
            gameSummary.uri(_tokenId),
            string(
                abi.encodePacked(
                    "https://something-new.com/232/",
                    Strings.toHexString(uint160(address(gameSummary)), 20),
                    "/",
                    Strings.toString(_storeId),
                    "-",
                    Strings.toString(_playerId),
                    "-",
                    Strings.toString(_gameId)
                )
            )
        );
    }

    function testNonSoulboundTokenTransfer() public {
        uint256 _storeId = _storeIds[0];
        uint256 _playerId = _playerIds[0];
        uint256 _gameId = _gameIds[0];
        uint256 _tokenId = gameSummary.getTokenId(_storeId, _playerId, _gameId);
        gameSummary.adminMintId(playerWallet.addr, _storeId, _playerId, _gameId, 1, false);

        vm.prank(playerWallet.addr);
        gameSummary.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenId, 1, "");

        assertEq(gameSummary.balanceOf(playerWallet.addr, _tokenId), 0);
        assertEq(gameSummary.balanceOf(minterWallet.addr, _tokenId), 1);
    }

    function testSoulboundTokenNotTransfer() public {
        uint256 _storeId = _storeIds[0];
        uint256 _playerId = _playerIds[0];
        uint256 _gameId = _gameIds[0];
        uint256 _tokenId = gameSummary.getTokenId(_storeId, _playerId, _gameId);
        gameSummary.adminMintId(playerWallet.addr, _storeId, _playerId, _gameId, 1, true);

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        gameSummary.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenId, 1, "");

        vm.expectRevert("Achievo1155Soulbound: can't be zero amount");
        vm.prank(playerWallet.addr);
        gameSummary.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenId, 0, "");
    }

    function testSoulboundTokenTransferOnlyWhitelistAddresses() public {
        uint256 _storeId = _storeIds[0];
        uint256 _playerId = _playerIds[0];
        uint256 _gameId = _gameIds[0];
        uint256 _tokenId = gameSummary.getTokenId(_storeId, _playerId, _gameId);
        gameSummary.adminMintId(playerWallet.addr, _storeId, _playerId, _gameId, 1, true);

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        gameSummary.safeTransferFrom(playerWallet.addr, playerWallet3.addr, _tokenId, 1, "");

        gameSummary.updateWhitelistAddress(playerWallet3.addr, true);

        vm.prank(playerWallet.addr);
        gameSummary.safeTransferFrom(playerWallet.addr, playerWallet3.addr, _tokenId, 1, "");

        vm.prank(playerWallet3.addr);
        gameSummary.safeTransferFrom(playerWallet3.addr, playerWallet.addr, _tokenId, 1, "");

        gameSummary.updateWhitelistAddress(playerWallet3.addr, false);

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        gameSummary.safeTransferFrom(playerWallet.addr, playerWallet3.addr, _tokenId, 1, "");
    }

    function testgetAllItems() public {
        gameSummary.setCompoundURIEnabled(false);
        bytes memory encodedItemsAll = encode(address(gameSummary), _storeIds, _playerIds, _gameIds);
        gameSummary.adminMint(playerWallet.addr, encodedItemsAll, false);

        vm.prank(playerWallet.addr);
        LibGameSummary.GameSummaryReturn[] memory allTokensInfo = gameSummary.getAllItems();
        assertEq(allTokensInfo.length, 1300);

        vm.prank(playerWallet.addr);
        gameSummary.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[14], 1, "");

        vm.prank(playerWallet.addr);
        LibGameSummary.GameSummaryReturn[] memory allTokensInfo2 = gameSummary.getAllItems();
        assertEq(allTokensInfo2.length, 1299);

        for (uint256 i = 0; i < allTokensInfo.length; i++) {
            assertEq(allTokensInfo[i].tokenId, _tokenIds[i]);

            assertEq(allTokensInfo[i].amount, 1);
            assertEq(allTokensInfo[i].tokenUri, string(abi.encodePacked("MISSING_BASE_URL/", _tokenIds[i].toString())));
        }

        gameSummary.setCompoundURIEnabled(true);

        LibGameSummary.GameSummaryReturn[] memory allTokensInfoAfter = gameSummary.getAllItemsAdmin(playerWallet.addr);
        for (uint256 i = 0; i < allTokensInfoAfter.length; i++) {
            assertEq(allTokensInfoAfter[i].tokenId, _tokenIds[i]);
            if (i != 14) {
                assertEq(allTokensInfoAfter[i].amount, 1);
            }
            assertEq(
                allTokensInfoAfter[i].tokenUri,
                string(
                    abi.encodePacked(
                        "https://example.api.com/",
                        Strings.toHexString(uint160(address(gameSummary)), 20),
                        "/",
                        Strings.toString(_storeIds[i]),
                        "-",
                        Strings.toString(_playerIds[i]),
                        "-",
                        Strings.toString(_gameIds[i])
                    )
                )
            );
        }

        vm.prank(minterWallet.addr);
        LibGameSummary.GameSummaryReturn[] memory allTokensInfo3 = gameSummary.getAllItems();
        assertEq(allTokensInfo3.length, 1);
    }

    function testgetAllItemsAdmin() public {
        gameSummary.setCompoundURIEnabled(false);
        bytes memory encodedItemsAll = encode(address(gameSummary), _storeIds, _playerIds, _gameIds);
        gameSummary.adminMint(playerWallet.addr, encodedItemsAll, false);

        LibGameSummary.GameSummaryReturn[] memory allTokensInfo = gameSummary.getAllItemsAdmin(playerWallet.addr);
        assertEq(allTokensInfo.length, 1300);

        vm.prank(playerWallet.addr);
        gameSummary.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[14], 1, "");

        for (uint256 i = 0; i < allTokensInfo.length; i++) {
            assertEq(allTokensInfo[i].tokenId, _tokenIds[i]);

            assertEq(allTokensInfo[i].amount, 1);
            assertEq(allTokensInfo[i].tokenUri, string(abi.encodePacked("MISSING_BASE_URL/", _tokenIds[i].toString())));
        }

        gameSummary.setCompoundURIEnabled(true);

        LibGameSummary.GameSummaryReturn[] memory allTokensInfoAfter = gameSummary.getAllItemsAdmin(playerWallet.addr);
        for (uint256 i = 0; i < allTokensInfoAfter.length; i++) {
            assertEq(allTokensInfoAfter[i].tokenId, _tokenIds[i]);
            if (i != 14) {
                assertEq(allTokensInfoAfter[i].amount, 1);
            }
            assertEq(
                allTokensInfoAfter[i].tokenUri,
                string(
                    abi.encodePacked(
                        "https://example.api.com/",
                        Strings.toHexString(uint160(address(gameSummary)), 20),
                        "/",
                        Strings.toString(_storeIds[i]),
                        "-",
                        Strings.toString(_playerIds[i]),
                        "-",
                        Strings.toString(_gameIds[i])
                    )
                )
            );
        }
    }
}
