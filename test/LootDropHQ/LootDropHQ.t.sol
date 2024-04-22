// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "forge-std/StdCheats.sol";
import "forge-std/console.sol";

import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { LootDrop } from "../../contracts/soulbounds/LootDrop.sol";
import { AdminERC1155Soulbound } from "../../contracts/soulbounds/AdminERC1155Soulbound.sol";
import { MockERC1155Receiver } from "../../contracts/mocks/MockERC1155Receiver.sol";
import {MockERC20} from "../../contracts/mocks/MockErc20.sol";
import {MockERC721} from "../../contracts/mocks/MockErc721.sol";
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

contract LootDropTest is StdCheats, Test {
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

    address[] public wallets;
    uint256[] public amounts;

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

    function encode(address contractAddress, uint256[] memory itemIds) public view returns (bytes memory) {
        return (abi.encode(contractAddress, chainId, itemIds));
    }

    function setUp() public {
        playerWallet = getWallet(playerLabel);
        playerWallet2 = getWallet(player2Label);
        playerWallet3 = getWallet(player3Label);
        minterWallet = getWallet(minterLabel);

        itemBound = new AdminERC1155Soulbound(address(this));
        lootDrop = new LootDrop(address(this));
        lootDrop.initialize(address(this), address(this), address(this), address(itemBound));

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

        encodedItems1 = encode(address(lootDrop), _itemIds1);

        uint256[] memory _itemIds2 = new uint256[](3);
        _itemIds2[0] = _tokenIds[3];
        _itemIds2[1] = _tokenIds[4];
        _itemIds2[2] = _tokenIds[5];

        encodedItems2 = encode(address(lootDrop), _itemIds2);

        (nonce, signature) = generateSignature(playerWallet.addr, encodedItems1, minterLabel);
        (nonce2, signature2) = generateSignature(playerWallet2.addr, encodedItems2, minterLabel);

        mockERC20.mint(address(this), 20000000000000000000);
        for (uint256 i = 0; i < 10; i++) {
            mockERC721.mint(address(lootDrop));
        }
        mockERC1155.mint(address(lootDrop), 456, 10, "");

        mockERC20.approve(address(lootDrop), type(uint256).max);
        lootDrop.createMultipleTokensAndDepositRewards(_tokens);
    }

    function testInitializeTwiceShouldFail() public {
        vm.expectRevert("Initializable: contract is already initialized");
        lootDrop.initialize(address(this), address(this), address(this), address(itemBound));
    }

    function testPauseUnpause() public {
        uint256 _tokenId = _tokenIds[0];

        address[] memory _wallets = new address[](2);
        _wallets[0] = address(this);
        _wallets[1] = address(mockERC1155Receiver);

        uint256[] memory _amounts = new uint256[](2);
        _amounts[0] = 1;
        _amounts[1] = 2;

        lootDrop.pause();
        vm.expectRevert("Pausable: paused");
        lootDrop.adminBatchMintById(_wallets, _tokenId, _amounts, true);
        lootDrop.unpause();

        lootDrop.adminMintById(address(mockERC1155Receiver), _tokenId, 1, true);
        assertEq(itemBound.balanceOf(address(mockERC1155Receiver), _tokenId), 1);
    }

    function testPauseUnpauseSpecificToken() public {
        uint256 _tokenId = _tokenIds[0];

        lootDrop.updateTokenMintPaused(_tokenId, true);

        vm.expectRevert(MintPaused.selector);
        lootDrop.adminMintById(address(mockERC1155Receiver), _tokenId, 1, true);

        vm.expectRevert(MintPaused.selector);
        lootDrop.adminMint(address(mockERC1155Receiver), encodedItems1, true, false);

        vm.expectRevert(MintPaused.selector);
        vm.prank(playerWallet.addr);
        lootDrop.mint(encodedItems1, true, nonce, signature, false);

        lootDrop.updateTokenMintPaused(_tokenId, false);

        vm.prank(playerWallet.addr);
        lootDrop.mint(encodedItems1, true, nonce, signature, false);

        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 1);
    }

    function testDecodeDataShouldPass() public {
        bytes memory encodedItems = encode(address(lootDrop), _tokenIds);

        (address contractAddress, uint256 chainId, uint256[] memory ids) = lootDrop.decodeData(encodedItems);

        for (uint256 i = 0; i < ids.length; i++) {
            assertEq(ids[i], _tokenIds[i]);
        }
    }

    function testInvalidSignature() public {
        vm.prank(playerWallet.addr);
        vm.expectRevert("InvalidSignature");
        lootDrop.mint(encodedItems1, true, nonce, signature2, false);
    }

    function testReuseSignatureMint() public {
        vm.prank(playerWallet.addr);
        lootDrop.mint(encodedItems1, true, nonce, signature, false);
        vm.prank(playerWallet.addr);
        vm.expectRevert("AlreadyUsedSignature");
        lootDrop.mint(encodedItems1, true, nonce, signature, false);
    }

    function testUpdateRewardTokenContractAddressZeroShouldFail() public {
        vm.expectRevert(AddressIsZero.selector);
        lootDrop.updateRewardTokenContract(address(0));
    }

    function testUpdateRewardTokenContractNotAuthorizedShouldFail() public {
        address _newRewardTokenAddress = address(mockERC20);

        vm.prank(playerWallet.addr);
        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x3b359cf0b4471a5de84269135285268e64ac56f52d3161392213003a780ad63b"
        );
        lootDrop.updateRewardTokenContract(_newRewardTokenAddress);
    }

    function testUpdateRewardTokenContractShouldPass() public {
        address _newRewardTokenAddress = address(mockERC20);
        lootDrop.updateRewardTokenContract(_newRewardTokenAddress);
    }
}
