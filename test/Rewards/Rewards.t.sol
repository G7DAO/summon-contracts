// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "forge-std/StdCheats.sol";
import "forge-std/console.sol";

import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Rewards} from "../../contracts/soulbounds/Rewards.sol";
import { AdminERC1155Soulbound } from "../../contracts/soulbounds/AdminERC1155Soulbound.sol";
import { MockERC1155Receiver } from "../../contracts/mocks/MockERC1155Receiver.sol";
import { MockERC20 } from "../../contracts/mocks/MockErc20.sol";
import { MockERC721 } from "../../contracts/mocks/MockErc721.sol";
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

contract RewardsTest is StdCheats, Test {
    using Strings for uint256;

    Rewards public rewards;
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
        rewards = new Rewards(address(this));
        rewards.initialize(address(this), address(this), address(this), address(itemBound));

        itemBound.initialize(
            "Test1155",
            "T1155",
            "MISSING_BASE_URL",
            "MISSING_CONTRACT_URL",
            address(this),
            address(rewards)
        );
        mockERC20 = new MockERC20("oUSDC", "oUSDC");
        mockERC721 = new MockERC721();
        mockERC1155 = new MockERC1155();

        rewards.addWhitelistSigner(minterWallet.addr);

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

        encodedItems1 = encode(address(rewards), _itemIds1);

        uint256[] memory _itemIds2 = new uint256[](3);
        _itemIds2[0] = _tokenIds[3];
        _itemIds2[1] = _tokenIds[4];
        _itemIds2[2] = _tokenIds[5];

        encodedItems2 = encode(address(rewards), _itemIds2);

        (nonce, signature) = generateSignature(playerWallet.addr, encodedItems1, minterLabel);
        (nonce2, signature2) = generateSignature(playerWallet2.addr, encodedItems2, minterLabel);

        mockERC20.mint(address(this), 20000000000000000000);
        for (uint256 i = 0; i < 10; i++) {
            mockERC721.mint(address(rewards));
        }
        mockERC1155.mint(address(rewards), 456, 10, "");

        mockERC20.approve(address(rewards), type(uint256).max);
        rewards.createMultipleTokensAndDepositRewards(_tokens);
    }

    function testInitializeTwiceShouldFail() public {
        vm.expectRevert(abi.encodeWithSelector(Initializable.InvalidInitialization.selector));

        rewards.initialize(address(this), address(this), address(this), address(itemBound));
    }

    function testPauseUnpause() public {
        uint256 _tokenId = _tokenIds[0];

        address[] memory _wallets = new address[](2);
        _wallets[0] = address(this);
        _wallets[1] = address(mockERC1155Receiver);

        uint256[] memory _amounts = new uint256[](2);
        _amounts[0] = 1;
        _amounts[1] = 2;

        rewards.pause();
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        rewards.adminBatchMintById(_wallets, _tokenId, _amounts, true);
        rewards.unpause();

        rewards.adminMintById(address(mockERC1155Receiver), _tokenId, 1, true);
        assertEq(itemBound.balanceOf(address(mockERC1155Receiver), _tokenId), 1);
    }

    function testPauseUnpauseSpecificToken() public {
        uint256 _tokenId = _tokenIds[0];

        rewards.updateTokenMintPaused(_tokenId, true);

        vm.expectRevert(MintPaused.selector);
        rewards.adminMintById(address(mockERC1155Receiver), _tokenId, 1, true);

        vm.expectRevert(MintPaused.selector);
        rewards.adminMint(address(mockERC1155Receiver), encodedItems1, true, false);

        vm.expectRevert(MintPaused.selector);
        vm.prank(playerWallet.addr);
        rewards.mint(encodedItems1, true, nonce, signature, false);

        rewards.updateTokenMintPaused(_tokenId, false);

        vm.prank(playerWallet.addr);
        rewards.mint(encodedItems1, true, nonce, signature, false);

        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 1);
    }

    function testDecodeDataShouldPass() public {
        bytes memory encodedItems = encode(address(rewards), _tokenIds);

        (address contractAddress, uint256 chainId, uint256[] memory ids) = rewards.decodeData(encodedItems);

        for (uint256 i = 0; i < ids.length; i++) {
            assertEq(ids[i], _tokenIds[i]);
        }
    }

    function testInvalidSignature() public {
        vm.prank(playerWallet.addr);
        vm.expectRevert("InvalidSignature");
        rewards.mint(encodedItems1, true, nonce, signature2, false);
    }

    function testReuseSignatureMint() public {
        vm.prank(playerWallet.addr);
        rewards.mint(encodedItems1, true, nonce, signature, false);
        vm.prank(playerWallet.addr);
        vm.expectRevert("AlreadyUsedSignature");
        rewards.mint(encodedItems1, true, nonce, signature, false);
    }

    function testUpdateRewardTokenContractAddressZeroShouldFail() public {
        vm.expectRevert(AddressIsZero.selector);
        rewards.updateRewardTokenContract(address(0));
    }

    function testUpdateRewardTokenContractNotAuthorizedShouldFail() public {
        address _newRewardTokenAddress = address(mockERC20);

        vm.prank(playerWallet.addr);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                playerWallet.addr,
                DEV_CONFIG_ROLE
            )
        );
        rewards.updateRewardTokenContract(_newRewardTokenAddress);
    }

    function testUpdateRewardTokenContractShouldPass() public {
        address _newRewardTokenAddress = address(mockERC20);
        rewards.updateRewardTokenContract(_newRewardTokenAddress);
    }
}
