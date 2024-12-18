// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "forge-std/StdCheats.sol";
import "forge-std/console.sol";

import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {
    MessageHashUtils
} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {
    IAccessControl
} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {
    ERC721Holder
} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

import { Rewards } from "../../contracts/soulbounds/Rewards.sol";
import { AccessToken } from "../../contracts/soulbounds/AccessToken.sol";
import {
    MockERC1155Receiver
} from "../../contracts/mocks/MockERC1155Receiver.sol";
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
error ExceedMaxSupply();

contract RewardsMintTest is StdCheats, Test, MockERC1155Receiver, ERC721Holder {
    using Strings for uint256;

    Rewards public rewards;
    AccessToken public itemBound;
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

    uint256 public chainId = 31337;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");

    function getWallet(
        string memory walletLabel
    ) public returns (Wallet memory) {
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

        uint256 _nonce = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    signerWallet.addr
                )
            )
        ) % 50;

        bytes32 message = keccak256(
            abi.encodePacked(wallet, encodedItems, _nonce)
        );
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(message);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            signerWallet.privateKey,
            hash
        );
        return (_nonce, abi.encodePacked(r, s, v));
    }

    function concatenateStrings(
        string memory a,
        string memory b
    ) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }

    function generateRandomItemId() internal returns (uint256) {
        _seed = uint256(
            keccak256(abi.encodePacked(blockhash(block.number - 1), _seed))
        );
        return _seed;
    }

    function encode(
        address contractAddress,
        uint256[] memory itemIds
    ) public view returns (bytes memory) {
        return (abi.encode(contractAddress, chainId, itemIds));
    }

    function setUp() public {
        playerWallet = getWallet(playerLabel);
        playerWallet2 = getWallet(player2Label);
        playerWallet3 = getWallet(player3Label);
        minterWallet = getWallet(minterLabel);

        itemBound = new AdminERC1155Soulbound(address(this));
        rewards = new Rewards(address(this));
        rewards.initialize(
            address(this),
            address(this),
            address(this),
            address(itemBound)
        );

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
                tokenUri: string(
                    abi.encodePacked(
                        "https://something.com",
                        "/",
                        _tokenId.toString()
                    )
                ),
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

        (nonce, signature) = generateSignature(
            playerWallet.addr,
            encodedItems1,
            minterLabel
        );
        (nonce2, signature2) = generateSignature(
            playerWallet2.addr,
            encodedItems2,
            minterLabel
        );

        mockERC20.mint(address(this), 20000000000000000000);
        for (uint256 i = 0; i < 10; i++) {
            mockERC721.mint(address(this));
        }
        mockERC1155.mint(address(this), 456, 10, "");

        mockERC20.approve(address(rewards), type(uint256).max);
        mockERC721.setApprovalForAll(address(rewards), true);
        mockERC1155.setApprovalForAll(address(rewards), true);
        rewards.createMultipleTokensAndDepositRewards(_tokens);
    }

    function testMintShouldPass() public {
        vm.prank(playerWallet.addr);
        rewards.mint(encodedItems1, true, nonce, signature, false);

        vm.expectRevert(
            "Achievo1155Soulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred"
        );
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(
            playerWallet.addr,
            minterWallet.addr,
            _tokenIds[0],
            1,
            ""
        );

        vm.expectRevert("Achievo1155Soulbound: can't be zero amount");
        vm.prank(playerWallet.addr);
        itemBound.safeTransferFrom(
            playerWallet.addr,
            minterWallet.addr,
            _tokenIds[0],
            0,
            ""
        );

        vm.prank(playerWallet2.addr);
        rewards.mint(encodedItems2, false, nonce2, signature2, false);

        vm.prank(playerWallet2.addr);
        itemBound.safeTransferFrom(
            playerWallet2.addr,
            minterWallet.addr,
            _tokenIds[3],
            1,
            ""
        );

        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[0]), 1);
        assertEq(itemBound.balanceOf(playerWallet2.addr, _tokenIds[3]), 0);
        assertEq(itemBound.balanceOf(minterWallet.addr, _tokenIds[3]), 1);
    }

    function testMintInvalidTokenId() public {
        uint256[] memory _itemIds3 = new uint256[](3);
        _itemIds3[0] = 1233;
        _itemIds3[1] = 3322;

        bytes memory encodedItems3 = encode(address(rewards), _itemIds3);

        (uint256 _nonce, bytes memory _signature) = generateSignature(
            playerWallet.addr,
            encodedItems3,
            minterLabel
        );

        vm.expectRevert(TokenNotExist.selector);
        vm.prank(playerWallet.addr);
        rewards.mint(encodedItems3, true, _nonce, _signature, false);
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
        rewards.adminMint(playerWallet.addr, encodedItems1, true, false);
    }

    function testadminMintByIdNotMinterRole() public {
        uint256 _tokenId = _tokenIds[0];
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                playerWallet.addr,
                MINTER_ROLE
            )
        );
        vm.prank(playerWallet.addr);
        rewards.adminMintById(playerWallet.addr, _tokenId, 1, true);
    }

    function testAdminMint() public {
        rewards.adminMint(playerWallet.addr, encodedItems1, true, false);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[0]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[1]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenIds[2]), 1);
    }

    function testAdminMintAndClaims() public {
        assertEq(mockERC20.balanceOf(playerWallet.addr), 0);
        rewards.adminMint(playerWallet.addr, encodedItems1, true, true);
        assertEq(mockERC20.balanceOf(playerWallet.addr), 60000); // 2000 * 10 * 3
    }

    function testadminMintById() public {
        uint256 _tokenId = _tokenIds[0];
        rewards.adminMintById(playerWallet.addr, _tokenId, 1, true);
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
        // uint256 _tokenId = generateRandomItemId(); // totally random
        uint256 _tokenId = 100; // totally random
        LibItems.RewardToken memory _token = LibItems.RewardToken({
            tokenId: _tokenId,
            tokenUri: string(
                abi.encodePacked(
                    "https://something.com",
                    "/",
                    _tokenId.toString()
                )
            ),
            rewards: _rewards,
            maxSupply: 2
        });
        _tokens[0] = _token;

        rewards.createMultipleTokensAndDepositRewards{
            value: 300000000000000000
        }(_tokens);

        uint256[] memory itemIds = new uint256[](1);
        itemIds[0] = 100;

        rewards.adminMint(
            playerWallet.addr,
            (encode(address(rewards), itemIds)),
            true,
            false
        );

        rewards.adminMintById(playerWallet.addr, _tokens[0].tokenId, 1, true);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokens[0].tokenId), 2);

        vm.expectRevert(ExceedMaxSupply.selector);
        rewards.adminMintById(playerWallet2.addr, _tokens[0].tokenId, 1, true);
    }

    function testAdminAndUserMintAndClaims() public {
        uint256 _tokenId = 100; // totally random
        LibItems.RewardToken[] memory _tokens = new LibItems.RewardToken[](1);

        skip(36000);
        delete _rewards; // reset rewards

        LibItems.Reward memory _erc20Reward = LibItems.Reward({
            rewardType: LibItems.RewardType.ERC20,
            rewardAmount: 100,
            rewardTokenAddress: erc20FakeRewardAddress,
            rewardTokenId: 0,
            rewardTokenIds: new uint256[](0)
        });

        _rewards.push(_erc20Reward);

        LibItems.RewardToken memory _token = LibItems.RewardToken({
            tokenId: _tokenId,
            tokenUri: string(
                abi.encodePacked(
                    "https://something.com",
                    "/",
                    _tokenId.toString()
                )
            ),
            rewards: _rewards,
            maxSupply: 15
        });
        _tokens[0] = _token;

        rewards.createMultipleTokensAndDepositRewards{
            value: 300000000000000000
        }(_tokens);

        assertEq(mockERC20.balanceOf(address(rewards)), 4001500);

        uint256[] memory itemIds = new uint256[](1);
        itemIds[0] = _tokenId;

        rewards.adminMint(
            playerWallet.addr,
            (encode(address(rewards), itemIds)),
            true,
            true
        );

        assertEq(mockERC20.balanceOf(playerWallet.addr), 100);
        assertEq(mockERC20.balanceOf(address(rewards)), 4001400);

        bytes memory encodedItems = encode(address(rewards), itemIds);
        (uint256 _nonce, bytes memory _signature) = generateSignature(
            playerWallet2.addr,
            encodedItems,
            minterLabel
        );

        vm.prank(playerWallet2.addr);
        rewards.mint(encodedItems, true, _nonce, _signature, true);

        assertEq(mockERC20.balanceOf(playerWallet2.addr), 100);

        skip(36000);
        (uint256 _nonce2, bytes memory _signature2) = generateSignature(
            playerWallet2.addr,
            encodedItems,
            minterLabel
        );

        vm.prank(playerWallet2.addr);
        rewards.mint(encodedItems, true, _nonce2, _signature2, true);
        assertEq(mockERC20.balanceOf(playerWallet2.addr), 200);

        // current supply is 3 out of 15
        assertEq(rewards.currentRewardSupply(_tokenId), 3);
        assertEq(mockERC20.balanceOf(address(rewards)), 4001200);
    }
}
