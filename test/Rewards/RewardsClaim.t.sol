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
    IERC721Errors
} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
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
error ClaimRewardPaused();
error DupTokenId();

contract RewardsClaimTest is
    StdCheats,
    Test,
    MockERC1155Receiver,
    ERC721Holder
{
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

        mockERC1155Receiver = new MockERC1155Receiver();

        erc20FakeRewardAddress = address(mockERC20);
        erc721FakeRewardAddress = address(mockERC721);
        erc1155FakeRewardAddress = address(mockERC1155);

        rewards.addWhitelistSigner(minterWallet.addr);

        _tokens = new LibItems.RewardToken[](1);

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

            uint256 _tokenId = 888;
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
            _tokens[i] = _token;
        }

        mockERC20.mint(address(this), 20000000000000000000);
        for (uint256 i = 0; i < 10; i++) {
            mockERC721.mint(address(this));
        }
        mockERC1155.mint(address(this), 456, 10, "");

        mockERC20.approve(address(rewards), type(uint256).max);
        mockERC721.setApprovalForAll(address(rewards), true);
        mockERC1155.setApprovalForAll(address(rewards), true);

        rewards.createMultipleTokensAndDepositRewards{
            value: 300000000000000000
        }(_tokens);
    }

    // Test cases
    function testClaimRewardShouldPass() public {
        // mint
        uint256 _tokenId = 888;
        rewards.adminMintById(playerWallet.addr, _tokenId, 1, true);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 1);

        // Claim
        vm.prank(playerWallet.addr);
        rewards.claimReward(_tokenId);

        // Check if the reward token is burned
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 0);
        // Check if the rewards are distributed correctly
        assertEq(playerWallet.addr.balance, 0.1 ether);
        assertEq(mockERC20.balanceOf(playerWallet.addr), 2000);
        assertEq(mockERC721.ownerOf(0), playerWallet.addr);
        assertEq(mockERC1155.balanceOf(playerWallet.addr, 456), 2);
    }

    function testUserClaimMultipleRewardsShouldPass() public {
        // mint
        uint256 _tokenId = 888;
        rewards.adminMintById(playerWallet.addr, _tokenId, 2, true);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 2);

        uint256[] memory _tokenIds = new uint256[](2);
        _tokenIds[0] = _tokenId;
        _tokenIds[1] = _tokenId;

        // Claim
        vm.prank(playerWallet.addr);
        rewards.claimRewards(_tokenIds);

        // Check if the reward token is burned
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 0);
        // Check if the rewards are distributed correctly
        assertEq(playerWallet.addr.balance, 0.2 ether);
        assertEq(mockERC20.balanceOf(playerWallet.addr), 4000);
        assertEq(mockERC721.ownerOf(0), playerWallet.addr);
        assertEq(mockERC721.ownerOf(1), playerWallet.addr);
        assertEq(mockERC1155.balanceOf(playerWallet.addr, 456), 4);
    }

    function testUserClaimMultipleRewardsERC721AllGoneShouldFail() public {
        // mint
        uint256 _tokenId = 888;
        rewards.adminMintById(playerWallet.addr, _tokenId, 2, true);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 2);

        uint256[] memory _tokenIds = new uint256[](2);
        _tokenIds[0] = _tokenId;
        _tokenIds[1] = _tokenId;

        address ownerAddress = mockERC721.ownerOf(0);
        assertEq(ownerAddress, address(rewards));

        // Transfer all 1 ERC721 out
        uint256[] memory _tokenIds1 = new uint256[](1);
        _tokenIds1[0] = 1; // tokenId 0

        uint256[] memory _amount1 = new uint256[](1);
        _amount1[0] = 0; // ignore amount

        rewards.withdrawAssets(
            LibItems.RewardType.ERC721,
            playerWallet2.addr,
            address(mockERC721),
            _tokenIds1,
            _amount1
        );

        // Claim
        vm.prank(playerWallet.addr);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721InsufficientApproval.selector,
                address(rewards),
                1
            )
        );
        rewards.claimRewards(_tokenIds);
    }

    function testAdminClaimRewardShouldPass() public {
        // mint
        uint256 _tokenId = 888;
        rewards.adminMintById(playerWallet.addr, _tokenId, 1, true);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 1);

        uint256[] memory _tokenIds = new uint256[](1);
        _tokenIds[0] = _tokenId;

        // Claim
        rewards.adminClaimReward(playerWallet.addr, _tokenIds);

        // Check if the reward token is burned
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 0);
        // Check if the rewards are distributed correctly
        assertEq(playerWallet.addr.balance, 0.1 ether);
        assertEq(mockERC20.balanceOf(playerWallet.addr), 2000);
        assertEq(mockERC721.ownerOf(0), playerWallet.addr);
        assertEq(mockERC1155.balanceOf(playerWallet.addr, 456), 2);
    }

    // claim pause
    function testAdminClaimRewardClaimPausedShouldFail() public {
        // mint
        uint256 _tokenId = 888;
        rewards.adminMintById(playerWallet.addr, _tokenId, 1, true);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 1);

        uint256[] memory _tokenIds = new uint256[](1);
        _tokenIds[0] = _tokenId;

        rewards.updateClaimRewardPaused(_tokenId, true);
        // Claim
        vm.expectRevert(ClaimRewardPaused.selector);
        rewards.adminClaimReward(playerWallet.addr, _tokenIds);

        rewards.updateClaimRewardPaused(_tokenId, false);

        rewards.adminClaimReward(playerWallet.addr, _tokenIds);

        // Check if the reward token is burned
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 0);
        // Check if the rewards are distributed correctly
        assertEq(playerWallet.addr.balance, 0.1 ether);
        assertEq(mockERC20.balanceOf(playerWallet.addr), 2000);
        assertEq(mockERC721.ownerOf(0), playerWallet.addr);
        assertEq(mockERC1155.balanceOf(playerWallet.addr, 456), 2);
    }

    // mint and claim in same tx
    function testAdminMintAndClaimShouldPass() public {
        uint256 _tokenId = 888;
        uint256[] memory _itemIds1 = new uint256[](1);
        _itemIds1[0] = _tokenId;

        encodedItems1 = encode(address(rewards), _itemIds1);
        (nonce, signature) = generateSignature(
            playerWallet.addr,
            encodedItems1,
            minterLabel
        );
        vm.prank(playerWallet.addr);
        rewards.mint(encodedItems1, true, nonce, signature, true);

        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 0);

        // Check if the rewards are distributed correctly
        assertEq(playerWallet.addr.balance, 0.1 ether);
        assertEq(mockERC20.balanceOf(playerWallet.addr), 2000);
        assertEq(mockERC721.ownerOf(0), playerWallet.addr);
        assertEq(mockERC1155.balanceOf(playerWallet.addr, 456), 2);
    }

    // ETH - fail
    function testAdminMintAndClaimNotEnoughETHShouldFail() public {
        uint256 ethBalance = address(rewards).balance;
        assertEq(ethBalance, 300000000000000000);

        uint256[] memory _tokenIds1 = new uint256[](1);
        _tokenIds1[0] = 0;

        uint256[] memory _amount1 = new uint256[](1);
        _amount1[0] = 200000000000000001;

        rewards.withdrawAssets(
            LibItems.RewardType.ETHER,
            playerWallet2.addr,
            address(0),
            _tokenIds1,
            _amount1
        );

        uint256 _tokenId = 888;
        rewards.adminMintById(playerWallet.addr, _tokenId, 1, true);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 1);

        uint256[] memory _tokenIds = new uint256[](1);
        _tokenIds[0] = _tokenId;

        // Claim
        vm.expectRevert(InsufficientBalance.selector);
        rewards.adminClaimReward(playerWallet.addr, _tokenIds);

        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 1);
    }

    // mint and claim in same tx multiple ERC721 should pass
    function testAdminMintAndClaimMultipleERC721ShouldPass() public {
        uint256 _tokenId = 777;
        _tokens = new LibItems.RewardToken[](1);

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

            uint256[] memory _erc721TokenIds = new uint256[](4);
            _erc721TokenIds[0] = 3;
            _erc721TokenIds[1] = 4;
            _erc721TokenIds[2] = 5;
            _erc721TokenIds[3] = 6;

            LibItems.Reward memory _erc721Reward = LibItems.Reward({
                rewardType: LibItems.RewardType.ERC721,
                rewardAmount: 2,
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
            _tokens[i] = _token;
        }

        rewards.createMultipleTokensAndDepositRewards{
            value: 200000000000000000
        }(_tokens);

        uint256[] memory _itemIds1 = new uint256[](1);
        _itemIds1[0] = _tokenId;

        bytes memory encodedItems4 = encode(address(rewards), _itemIds1);
        (nonce, signature) = generateSignature(
            playerWallet.addr,
            encodedItems4,
            minterLabel
        );
        vm.prank(playerWallet.addr);
        rewards.mint(encodedItems4, true, nonce, signature, true);

        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenId), 0);

        // Check if the rewards are distributed correctly
        assertEq(playerWallet.addr.balance, 0.1 ether);
        assertEq(mockERC20.balanceOf(playerWallet.addr), 2000);
        assertEq(mockERC721.ownerOf(3), playerWallet.addr);
        assertEq(mockERC721.ownerOf(4), playerWallet.addr);
        assertEq(mockERC1155.balanceOf(playerWallet.addr, 456), 2);

        (nonce2, signature2) = generateSignature(
            playerWallet2.addr,
            encodedItems4,
            minterLabel
        );

        vm.prank(playerWallet2.addr);
        rewards.mint(encodedItems4, true, nonce2, signature2, true);

        assertEq(playerWallet2.addr.balance, 0.1 ether);
        assertEq(mockERC20.balanceOf(playerWallet2.addr), 2000);
        assertEq(mockERC721.ownerOf(5), playerWallet2.addr);
        assertEq(mockERC721.ownerOf(6), playerWallet2.addr);
        assertEq(mockERC1155.balanceOf(playerWallet2.addr, 456), 2);
    }
}
