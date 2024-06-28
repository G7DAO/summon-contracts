// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "forge-std/StdCheats.sol";
import "forge-std/console.sol";

import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { IERC20Errors, IERC721Errors, IERC1155Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { ERC721Holder } from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

import { LootDrop } from "../../contracts/soulbounds/LootDrop.sol";
import { AdminERC1155Soulbound } from "../../contracts/soulbounds/AdminERC1155Soulbound.sol";
import { MockERC1155Receiver } from "../../contracts/mocks/MockERC1155Receiver.sol";
import { MockERC20 } from "../../contracts/mocks/MockErc20.sol";
import { MockERC721 } from "../../contracts/mocks/MockErc721.sol";
import { MockERC1155 } from "../../contracts/mocks/MockErc1155.sol";
import { LibItems, TestLibItems } from "../../contracts/libraries/LibItems.sol";

error AddressIsZero();
error InvalidTokenId();
error InvalidAmount();
error ExceedMaxSupply();
error InvalidLength();
error TokenNotExist();
error InvalidInput();
error InsufficientBalance();
error TransferFailed();
error MintPaused();
error ClaimRewardPaused();
error DupTokenId();

contract LootDropAddTokenTest is StdCheats, Test, MockERC1155Receiver, ERC721Holder {
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
            mockERC721.mint(address(this));
        }
        mockERC1155.mint(address(this), 456, 12, "");

        mockERC20.approve(address(lootDrop), type(uint256).max);
        mockERC721.setApprovalForAll(address(lootDrop), true);
        mockERC1155.setApprovalForAll(address(lootDrop), true);
        lootDrop.createMultipleTokensAndDepositRewards(_tokens);
    }

    function testTokenExists() public {
        uint256 _tokenId = generateRandomItemId();

        address[] memory _wallets = new address[](1);
        _wallets[0] = address(mockERC1155Receiver);

        uint256[] memory _amounts = new uint256[](1);
        _amounts[0] = 1;

        assertEq(lootDrop.isTokenExist(_tokenId), false);

        vm.expectRevert(TokenNotExist.selector);
        lootDrop.adminBatchMintById(_wallets, _tokenId, _amounts, true);

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

        lootDrop.createTokenAndDepositRewards(_token);

        assertEq(lootDrop.isTokenExist(_tokenId), true);

        lootDrop.adminBatchMintById(_wallets, _tokenId, _amounts, true);
    }

    function testGetTokenDetails() public {
        LibItems.RewardToken[] memory _tokens = new LibItems.RewardToken[](2);

        uint256[] memory _erc721TokenIds1 = new uint256[](3);
        _erc721TokenIds1[0] = 0;
        _erc721TokenIds1[1] = 1;
        _erc721TokenIds1[2] = 2;

        uint256[] memory _erc721TokenIds2 = new uint256[](3);
        _erc721TokenIds2[0] = 3;
        _erc721TokenIds2[1] = 4;
        _erc721TokenIds2[2] = 5;

        skip(36000);
        for (uint256 i = 0; i < 2; i++) {
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

            LibItems.Reward memory _erc721Reward = LibItems.Reward({
                rewardType: LibItems.RewardType.ERC721,
                rewardAmount: 1,
                rewardTokenAddress: erc721FakeRewardAddress,
                rewardTokenId: 0,
                rewardTokenIds: i == 0 ? _erc721TokenIds1 : _erc721TokenIds2
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
                maxSupply: 3
            });
            _tokens[i] = _token;
        }

        lootDrop.createMultipleTokensAndDepositRewards{ value: 600000000000000000 }(_tokens);

        uint256 _tokenId = _tokens[0].tokenId;
        assertEq(lootDrop.isTokenExist(_tokenId), true);

        (
            string memory tokenUri,
            uint256 maxSupply,
            LibItems.RewardType[] memory rewardTypes,
            uint256[] memory rewardAmounts,
            address[] memory rewardTokenAddresses,
            uint256[][] memory rewardTokenIds,
            uint256[] memory rewardTokenId
        ) = lootDrop.getTokenDetails(_tokenId);

        assertEq(tokenUri, string(abi.encodePacked("https://something.com", "/", _tokenId.toString())));
        assertEq(maxSupply, 3);

        for (uint256 i = 0; i < rewardTypes.length; i++) {
            if (i == 0) {
                // ETHER
                assertEq(uint256(rewardTypes[i]), uint256(LibItems.RewardType.ETHER));
                assertEq(rewardAmounts[i], 100000000000000000);
                assertEq(rewardTokenAddresses[i], address(0));
                assertEq(rewardTokenId[i], 0);
                assertEq(rewardTokenIds[i].length, 0);
            }

            if (i == 1) {
                // ERC20
                assertEq(uint256(rewardTypes[i]), uint256(LibItems.RewardType.ERC20));
                assertEq(rewardAmounts[i], 2000);
                assertEq(rewardTokenAddresses[i], erc20FakeRewardAddress);
                assertEq(rewardTokenId[i], 0);
                assertEq(rewardTokenIds[i].length, 0);
            }

            if (i == 2) {
                // ERC721
                assertEq(uint256(rewardTypes[i]), uint256(LibItems.RewardType.ERC721));
                assertEq(rewardAmounts[i], 1);
                assertEq(rewardTokenAddresses[i], erc721FakeRewardAddress);
                assertEq(rewardTokenId[i], 0);
                assertEq(rewardTokenIds[i].length, _erc721TokenIds1.length);

                for (uint256 j = 0; j < rewardTokenIds[i].length; j++) {
                    assertEq(rewardTokenIds[i][j], _erc721TokenIds1[j]);
                }
            }

            if (i == 3) {
                // ERC1155
                assertEq(uint256(rewardTypes[i]), uint256(LibItems.RewardType.ERC1155));
                assertEq(rewardAmounts[i], 2);
                assertEq(rewardTokenAddresses[i], erc1155FakeRewardAddress);
                assertEq(rewardTokenId[i], 456);
                assertEq(rewardTokenIds[i].length, 0);
            }
        }
    }

    function testAddNewTokensNotDEV_CONFIG_ROLEShouldFail() public {
        LibItems.RewardToken[] memory _tokens = new LibItems.RewardToken[](3);

        skip(36000);
        for (uint256 i = 0; i < 3; i++) {
            delete _rewards; // reset rewards
            LibItems.Reward memory _etherReward = LibItems.Reward({
                rewardType: LibItems.RewardType.ETHER,
                rewardAmount: 100000000000000000,
                rewardTokenAddress: address(0),
                rewardTokenId: 456,
                rewardTokenIds: new uint256[](0)
            });

            _rewards.push(_etherReward);

            uint256 _tokenId = generateRandomItemId(); // totally random
            LibItems.RewardToken memory _token = LibItems.RewardToken({
                tokenId: _tokenId,
                tokenUri: string(abi.encodePacked("https://something.com", "/", _tokenId.toString())),
                rewards: _rewards,
                maxSupply: 1
            });

            _tokens[i] = _token;
        }

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                playerWallet.addr,
                MANAGER_ROLE
            )
        );
        vm.prank(playerWallet.addr);
        lootDrop.createMultipleTokensAndDepositRewards(_tokens);
    }

    // should fail not enough ETH
    function testAddNewTokensNotEnoughETHShouldFail() public {
        LibItems.RewardToken[] memory _tokens = new LibItems.RewardToken[](3);

        skip(36000);
        for (uint256 i = 0; i < 3; i++) {
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

            uint256[] memory _erc721TokenIds = new uint256[](3);
            _erc721TokenIds[0] = _tokenIds[0];
            _erc721TokenIds[1] = _tokenIds[1];
            _erc721TokenIds[2] = _tokenIds[2];

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

            uint256 _tokenId = generateRandomItemId(); // totally random
            LibItems.RewardToken memory _token = LibItems.RewardToken({
                tokenId: _tokenId,
                tokenUri: string(abi.encodePacked("https://something.com", "/", _tokenId.toString())),
                rewards: _rewards,
                maxSupply: 1
            });

            _tokens[i] = _token;
        }

        vm.expectRevert(InsufficientBalance.selector);
        lootDrop.createMultipleTokensAndDepositRewards{ value: 299999999999999999 }(_tokens);
    }
    // should fail not enough ERC20
    function testAddNewTokensNotEnoughERC20ShouldFail() public {
        LibItems.RewardToken[] memory _tokens = new LibItems.RewardToken[](1);

        skip(36000);
        for (uint256 i = 0; i < 1; i++) {
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
                rewardAmount: 20000000000000000001,
                rewardTokenAddress: erc20FakeRewardAddress,
                rewardTokenId: 0,
                rewardTokenIds: new uint256[](0)
            });

            uint256[] memory _erc721TokenIds = new uint256[](1);
            _erc721TokenIds[0] = 0;

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
                maxSupply: 1
            });
            _tokens[i] = _token;
        }

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector,
                address(this),
                19999999999996000000,
                20000000000000000001
            )
        );

        lootDrop.createMultipleTokensAndDepositRewards{ value: 300000000000000000 }(_tokens);
        assertEq(mockERC20.balanceOf(address(lootDrop)), 4000000);
    }
    // should fail not enough ERC721
    function testAddNtestAddNewTokensNotEnoughERC721ShouldFail() public {
        LibItems.RewardToken[] memory _tokens = new LibItems.RewardToken[](1);

        skip(36000);
        for (uint256 i = 0; i < 1; i++) {
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

            uint256[] memory _erc721TokenIds = new uint256[](3);
            _erc721TokenIds[0] = 0;
            _erc721TokenIds[1] = 10;
            _erc721TokenIds[2] = 2;

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
                maxSupply: 3
            });
            _tokens[i] = _token;
        }

        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 10));
        lootDrop.createMultipleTokensAndDepositRewards{ value: 300000000000000000 }(_tokens);
    }

    // should fail not enough ERC1155
    function testAddNewTokensNotEnoughERC1155ShouldFail() public {
        LibItems.RewardToken[] memory _tokens = new LibItems.RewardToken[](1);

        skip(36000);
        for (uint256 i = 0; i < 1; i++) {
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

            uint256[] memory _erc721TokenIds = new uint256[](3);
            _erc721TokenIds[0] = 0;
            _erc721TokenIds[1] = 1;
            _erc721TokenIds[2] = 2;

            LibItems.Reward memory _erc721Reward = LibItems.Reward({
                rewardType: LibItems.RewardType.ERC721,
                rewardAmount: 1,
                rewardTokenAddress: erc721FakeRewardAddress,
                rewardTokenId: 0,
                rewardTokenIds: _erc721TokenIds
            });

            LibItems.Reward memory _erc1155Reward = LibItems.Reward({
                rewardType: LibItems.RewardType.ERC1155,
                rewardAmount: 11,
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
                maxSupply: 3
            });
            _tokens[i] = _token;
        }

        vm.expectRevert(
            abi.encodeWithSelector(IERC1155Errors.ERC1155InsufficientBalance.selector, address(this), 12, 33, 456)
        );

        lootDrop.createMultipleTokensAndDepositRewards{ value: 300000000000000000 }(_tokens);
    }

    function testAddNtestAddNewTokensDontOwnedERC1155ShouldFail() public {
        LibItems.RewardToken[] memory _tokens = new LibItems.RewardToken[](1);

        skip(36000);
        for (uint256 i = 0; i < 1; i++) {
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

            uint256[] memory _erc721TokenIds = new uint256[](3);
            _erc721TokenIds[0] = 0;
            _erc721TokenIds[1] = 1;
            _erc721TokenIds[2] = 2;

            LibItems.Reward memory _erc721Reward = LibItems.Reward({
                rewardType: LibItems.RewardType.ERC721,
                rewardAmount: 1,
                rewardTokenAddress: erc721FakeRewardAddress,
                rewardTokenId: 0,
                rewardTokenIds: _erc721TokenIds
            });

            LibItems.Reward memory _erc1155Reward = LibItems.Reward({
                rewardType: LibItems.RewardType.ERC1155,
                rewardAmount: 1,
                rewardTokenAddress: erc1155FakeRewardAddress,
                rewardTokenId: 555,
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
                maxSupply: 3
            });
            _tokens[i] = _token;
        }

        vm.expectRevert(
            abi.encodeWithSelector(IERC1155Errors.ERC1155InsufficientBalance.selector, address(this), 0, 3, 555)
        );
        lootDrop.createMultipleTokensAndDepositRewards{ value: 300000000000000000 }(_tokens);
    }

    function testAddNewTokensShouldPass() public {
        LibItems.RewardToken[] memory _tokens = new LibItems.RewardToken[](1);

        skip(36000);
        for (uint256 i = 0; i < 1; i++) {
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

            uint256[] memory _erc721TokenIds = new uint256[](3);
            _erc721TokenIds[0] = 0;
            _erc721TokenIds[1] = 1;
            _erc721TokenIds[2] = 2;

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
                maxSupply: 3
            });
            _tokens[i] = _token;
        }

        lootDrop.createMultipleTokensAndDepositRewards{ value: 300000000000000000 }(_tokens);

        assertEq(address(lootDrop).balance, 300000000000000000);
        assertEq(mockERC20.balanceOf(address(lootDrop)), 4006000);
        assertEq(mockERC721.balanceOf(address(lootDrop)), 3);
        assertEq(mockERC1155.balanceOf(address(lootDrop), 456), 6);
    }

    function testAddMultipleRewardTokensShouldPass() public {
        LibItems.RewardToken[] memory _tokens = new LibItems.RewardToken[](2);

        uint256[] memory _erc721TokenIds1 = new uint256[](3);
        _erc721TokenIds1[0] = 0;
        _erc721TokenIds1[1] = 1;
        _erc721TokenIds1[2] = 2;

        uint256[] memory _erc721TokenIds2 = new uint256[](3);
        _erc721TokenIds2[0] = 3;
        _erc721TokenIds2[1] = 4;
        _erc721TokenIds2[2] = 5;

        skip(36000);
        for (uint256 i = 0; i < 2; i++) {
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

            LibItems.Reward memory _erc721Reward = LibItems.Reward({
                rewardType: LibItems.RewardType.ERC721,
                rewardAmount: 1,
                rewardTokenAddress: erc721FakeRewardAddress,
                rewardTokenId: 0,
                rewardTokenIds: i == 0 ? _erc721TokenIds1 : _erc721TokenIds2
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
                maxSupply: 3
            });
            _tokens[i] = _token;
        }

        lootDrop.createMultipleTokensAndDepositRewards{ value: 600000000000000000 }(_tokens);

        assertEq(address(lootDrop).balance, 600000000000000000);
        assertEq(mockERC20.balanceOf(address(lootDrop)), 4012000);
        assertEq(mockERC721.balanceOf(address(lootDrop)), 6);
        assertEq(mockERC1155.balanceOf(address(lootDrop), 456), 12);

        for (uint256 i = 0; i < _tokens.length; i++) {
            assertEq(lootDrop.isTokenExist(_tokens[i].tokenId), true);
        }

        assertEq(lootDrop.isTokenExist(123), false);
    }
}
