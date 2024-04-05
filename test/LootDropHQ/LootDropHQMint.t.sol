// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "forge-std/Test.sol";
import "forge-std/StdCheats.sol";
import "forge-std/console.sol";

import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ERC721Holder } from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

import { LootDrop } from "../../contracts/soulbounds/LootDrop.sol";
import { AdminERC1155Soulbound } from "../../contracts/soulbounds/AdminERC1155Soulbound.sol";
import { MockERC1155Receiver } from "../../contracts/mocks/MockERC1155Receiver.sol";
import { MockERC20 } from "../../contracts/mocks/MockERC20Token.sol";
import { MockERC721 } from "../../contracts/mocks/MockERC721Token.sol";
import { MockERC1155 } from "../../contracts/mocks/MockErc1155.sol";
import { LibItems, TestLibItems } from "../../contracts/libraries/LibItems.sol";

error AddressIsZero();
error InvalidTokenId();
error InvalidAmount();
error InvalidLength();
error TokenNotExist();
error InvalidInput();
error InsufficientBalance();
error TransferFailed();
error MintPaused();
error DupTokenId();
error ExceedMaxSupply();

contract LootDropMintTest is StdCheats, Test, MockERC1155Receiver, ERC721Holder {
    using Strings for uint256;

    LootDrop public lootDrop;
    AdminERC1155Soulbound public itemBound;
    MockERC1155Receiver public mockERC1155Receiver;
    MockERC20 public mockERC20;
    MockERC721 public mockERC721;
    MockERC1155 public mockERC1155;

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
    address public erc20FakeRewardAddress;
    address public erc721FakeRewardAddress;
    address public erc1155FakeRewardAddress;
    uint256 public defaultRewardId = 7;

    uint256 private _seed;
    LibItems.RewardToken[] public _tokens;
    LibItems.Reward[] public _rewards;
    uint256[] public _tokenIds;
    uint256[] public _amounts;

    address[] public wallets;
    uint256[] public amounts;

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

        uint256 _nonce = uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty, signerWallet.addr))) %
            50;

        bytes32 message = keccak256(abi.encodePacked(wallet, encodedItems, _nonce));
        bytes32 hash = ECDSA.toEthSignedMessageHash(message);

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

    function encode(uint256[] memory itemIds) public pure returns (bytes memory) {
        return (abi.encode(itemIds));
    }

    function setUp() public {
        playerWallet = getWallet(playerLabel);
        playerWallet2 = getWallet(player2Label);
        playerWallet3 = getWallet(player3Label);
        minterWallet = getWallet(minterLabel);

        itemBound = new AdminERC1155Soulbound(address(this));
        lootDrop = new LootDrop(address(this));
        lootDrop.initialize(address(this), address(itemBound));

        itemBound.initialize(
            "Test1155",
            "T1155",
            "MISSING_BASE_URL",
            "MISSING_CONTRACT_URL",
            address(this),
            address(lootDrop)
        );
        mockERC20 = new MockERC20("oUSDC", "oUSDC");
        mockERC721 = new MockERC721();
        mockERC1155 = new MockERC1155();

        lootDrop.addWhitelistSigner(minterWallet.addr);

        mockERC1155Receiver = new MockERC1155Receiver();

        erc20FakeRewardAddress = address(mockERC20);
        erc721FakeRewardAddress = address(mockERC721);
        erc1155FakeRewardAddress = address(mockERC1155);

        wallets = new address[](1);
        wallets[0] = playerWallet.addr;

        amounts = new uint256[](1);
        amounts[0] = 1;

        for (uint256 i = 0; i < 200; i++) {
            uint256 _tokenId = generateRandomItemId(); // totally random

            delete _rewards; // reset rewards
            for (uint256 j = 0; j < 10; j++) {
                LibItems.Reward memory _reward = LibItems.Reward({
                    rewardType: LibItems.RewardType.ERC20,
                    rewardAmount: 2000,
                    rewardTokenAddress: erc20FakeRewardAddress,
                    rewardTokenId: 0,
                    rewardTokenIds: new uint256[](0)
                });

                _rewards.push(_reward);
            }

            LibItems.RewardToken memory _token = LibItems.RewardToken({
                tokenId: _tokenId,
                tokenUri: string(abi.encodePacked("https://something.com", "/", _tokenId.toString())),
                rewards: _rewards,
                maxSupply: 1
            });

            _tokens.push(_token);
            _tokenIds.push(_tokenId);
        }

        uint256[] memory _itemIds1 = new uint256[](3);
        _itemIds1[0] = _tokenIds[0];
        _itemIds1[1] = _tokenIds[1];
        _itemIds1[2] = _tokenIds[2];

        encodedItems1 = encode(_itemIds1);

        uint256[] memory _itemIds2 = new uint256[](3);
        _itemIds2[0] = _tokenIds[3];
        _itemIds2[1] = _tokenIds[4];
        _itemIds2[2] = _tokenIds[5];

        encodedItems2 = encode(_itemIds2);

        (nonce, signature) = generateSignature(playerWallet.addr, encodedItems1, minterLabel);
        (nonce2, signature2) = generateSignature(playerWallet2.addr, encodedItems2, minterLabel);

        mockERC20.mint(address(this), 20000000000000000000);
        for (uint256 i = 0; i < 10; i++) {
            mockERC721.mint(address(this));
        }
        mockERC1155.mint(address(this), 456, 10, "");

        mockERC20.approve(address(lootDrop), type(uint256).max);
        mockERC721.setApprovalForAll(address(lootDrop), true);
        mockERC1155.setApprovalForAll(address(lootDrop), true);
        lootDrop.createMultipleTokensAndDepositRewards(_tokens);
    }

    function testMintShouldPass() public {
        vm.prank(playerWallet.addr);
        lootDrop.mint(encodedItems1, true, nonce, signature, false);

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[0], 1, "");

        vm.expectRevert("Achievo1155Soulbound: can't be zero amount");
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(playerWallet.addr, minterWallet.addr, _tokenIds[0], 0, "");

        vm.prank(playerWallet2.addr);
        lootDrop.mint(encodedItems2, false, nonce2, signature2, false);

        vm.prank(playerWallet2.addr);
        itemBound.safeTransferFrom(playerWallet2.addr, minterWallet.addr, _tokenIds[3], 1, "");

        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[0]), 1);
        assertEq(itemBound.balanceOf(playerWallet2.addr, _tokenIds[3]), 0);
        assertEq(itemBound.balanceOf(minterWallet.addr, _tokenIds[3]), 1);
    }

    function testMintInvalidTokenId() public {
        uint256[] memory _itemIds3 = new uint256[](3);
        _itemIds3[0] = 1233;
        _itemIds3[1] = 3322;

        bytes memory encodedItems3 = encode(_itemIds3);

        (uint256 _nonce, bytes memory _signature) = generateSignature(playerWallet.addr, encodedItems3, minterLabel);

        vm.expectRevert(TokenNotExist.selector);
        vm.prank(playerWallet.addr);
        lootDrop.mint(encodedItems3, true, _nonce, _signature, false);
    }

    function testAdminMintNotMinterRole() public {
        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"
        );
        vm.prank(playerWallet.addr);
        lootDrop.adminMint(playerWallet.addr, encodedItems1, true, false);
    }

    function testadminMintByIdNotMinterRole() public {
        uint256 _tokenId = _tokenIds[0];
        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"
        );
        vm.prank(playerWallet.addr);
        lootDrop.adminMintById(playerWallet.addr, _tokenId, 1, true);
    }

    function testAdminMint() public {
        lootDrop.adminMint(playerWallet.addr, encodedItems1, true, false);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[0]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[1]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[2]), 1);
    }

    function testadminMintById() public {
        uint256 _tokenId = _tokenIds[0];
        lootDrop.adminMintById(playerWallet.addr, _tokenId, 1, true);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[0]), 1);
    }

    function testMintExceedSupplyShouldFail() public {
        LibItems.RewardToken[] memory _tokens = new LibItems.RewardToken[](1);

        skip(36000);
        delete _rewards; // reset rewards

        LibItems.Reward memory _etherReward = LibItems.Reward({
            rewardType: LibItems.RewardType.ETHER,
            rewardAmount: 100000000000000000,
            rewardTokenAddress: address(0),
            rewardTokenId: 0,
            rewardTokenIds: new uint256[](0)
        });

        LibItems.Reward memory _erc20Reward = LibItems.Reward({
            rewardType: LibItems.RewardType.ERC20,
            rewardAmount: 2000,
            rewardTokenAddress: erc20FakeRewardAddress,
            rewardTokenId: 0,
            rewardTokenIds: new uint256[](0)
        });

        uint256[] memory _erc721TokenIds = new uint256[](2);
        _erc721TokenIds[0] = 0;
        _erc721TokenIds[1] = 1;

        LibItems.Reward memory _erc721Reward = LibItems.Reward({
            rewardType: LibItems.RewardType.ERC721,
            rewardAmount: 1,
            rewardTokenAddress: erc721FakeRewardAddress,
            rewardTokenId: 0,
            rewardTokenIds: _erc721TokenIds
        });

        LibItems.Reward memory _erc1155Reward = LibItems.Reward({
            rewardType: LibItems.RewardType.ERC1155,
            rewardAmount: 2,
            rewardTokenAddress: erc1155FakeRewardAddress,
            rewardTokenId: 456,
            rewardTokenIds: new uint256[](0)
        });

        _rewards.push(_etherReward);
        _rewards.push(_erc20Reward);
        _rewards.push(_erc721Reward);
        _rewards.push(_erc1155Reward);

        uint256 balance = mockERC1155.balanceOf(address(this), 456);
        uint256 _tokenId = generateRandomItemId(); // totally random
        LibItems.RewardToken memory _token = LibItems.RewardToken({
            tokenId: _tokenId,
            tokenUri: string(abi.encodePacked("https://something.com", "/", _tokenId.toString())),
            rewards: _rewards,
            maxSupply: 2
        });
        _tokens[0] = _token;

        console.log("reward.rewardTokenIds.length", _token.rewards[2].rewardTokenIds.length);
        console.log("reward.rewardAmount * _token.maxSupply", _token.rewards[2].rewardAmount * _token.maxSupply);

        lootDrop.createMultipleTokensAndDepositRewards{ value: 300000000000000000 }(_tokens);

        lootDrop.adminMintById(playerWallet.addr, _tokens[0].tokenId, 1, true);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokens[0].tokenId), 1);

        lootDrop.adminMintById(playerWallet2.addr, _tokens[0].tokenId, 1, true);

        vm.expectRevert(ExceedMaxSupply.selector);
        lootDrop.adminMintById(playerWallet3.addr, _tokens[0].tokenId, 1, true);
    }
}
