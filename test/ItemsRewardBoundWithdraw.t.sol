// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "forge-std/Test.sol";
import "forge-std/StdCheats.sol";
import "forge-std/console.sol";

import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { ERC1155RewardSoulbound } from "../contracts/soulbounds/ERC1155RewardSoulbound.sol";
import { MockERC1155Receiver } from "../contracts/mocks/MockERC1155Receiver.sol";
import { MockERC20 } from "../contracts/mocks/MockERC20.sol";
import { MockERC721 } from "../contracts/mocks/MockErc721.sol";
import { MockERC1155 } from "../contracts/mocks/MockErc1155.sol";
import { LibItems, TestLibItems } from "../contracts/libraries/LibItems.sol";

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

contract ItemsRewardBoundWithdrawTest is StdCheats, Test {
    using Strings for uint256;

    ERC1155RewardSoulbound public itemBound;
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

    function getWallet(string memory walletLabel) public returns (Wallet memory) {
        (address addr, uint256 privateKey) = makeAddrAndKey(walletLabel);
        Wallet memory wallet = Wallet(addr, privateKey);
        return wallet;
    }

    function setUp() public {
        playerWallet = getWallet(playerLabel);
        playerWallet2 = getWallet(player2Label);
        playerWallet3 = getWallet(player3Label);
        minterWallet = getWallet(minterLabel);

        itemBound = new ERC1155RewardSoulbound(address(this));
        itemBound.initialize(address(this));

        mockERC20 = new MockERC20("oUSDC", "oUSDC");
        mockERC721 = new MockERC721();
        mockERC1155 = new MockERC1155();

        mockERC1155Receiver = new MockERC1155Receiver();

        erc20FakeRewardAddress = address(mockERC20);
        erc721FakeRewardAddress = address(mockERC721);
        erc1155FakeRewardAddress = address(mockERC1155);

        (bool success, ) = payable(address(itemBound)).call{ value: 2000000000000000000 }("");

        mockERC20.mint(address(itemBound), 20000000000000000000);
        for (uint256 i = 0; i < 10; i++) {
            mockERC721.mint(address(itemBound));
        }
        mockERC1155.mint(address(itemBound), 123, 10, "");
        mockERC1155.mint(address(itemBound), 456, 10, "");
        mockERC1155.mint(address(itemBound), 789, 10, "");
    }

    // withdrawAssets
    function testWithdrawNotManagerRoleShouldFail() public {
        uint256 ethBalance = address(itemBound).balance;
        assertEq(ethBalance, 2000000000000000000);

        uint256[] memory _tokenIds1 = new uint256[](1);
        _tokenIds1[0] = 0;

        uint256[] memory _amount1 = new uint256[](1);
        _amount1[0] = 1000000000000000000;

        vm.expectRevert(
            "AccessControl: account 0x44e97af4418b7a17aabd8090bea0a471a366305c is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08"
        );
        vm.prank(playerWallet.addr);
        itemBound.withdrawAssets(LibItems.RewardType.ETHER, address(0), address(0), _tokenIds1, _amount1);
    }

    function testWithdrawAddressZeroShouldFail() public {
        uint256 ethBalance = address(itemBound).balance;
        assertEq(ethBalance, 2000000000000000000);

        uint256[] memory _tokenIds1 = new uint256[](1);
        _tokenIds1[0] = 0;

        uint256[] memory _amount1 = new uint256[](1);
        _amount1[0] = 1000000000000000000;

        vm.expectRevert(AddressIsZero.selector);
        itemBound.withdrawAssets(LibItems.RewardType.ETHER, address(0), address(0), _tokenIds1, _amount1);
    }

    // withdraw ETH - fail
    function testWithdrawETHTooMuchShouldFail() public {
        uint256 ethBalance = address(itemBound).balance;
        assertEq(ethBalance, 2000000000000000000);

        uint256[] memory _tokenIds1 = new uint256[](1);
        _tokenIds1[0] = 0;

        uint256[] memory _amount1 = new uint256[](1);
        _amount1[0] = 2000000000000000001;

        vm.expectRevert(InsufficientBalance.selector);
        itemBound.withdrawAssets(LibItems.RewardType.ETHER, playerWallet2.addr, address(0), _tokenIds1, _amount1);

        assertEq(address(itemBound).balance, 2000000000000000000);
    }

    // withdraw ETH - pass
    function testWithdrawETHShouldPass() public {
        uint256 ethBalance = address(itemBound).balance;
        assertEq(ethBalance, 2000000000000000000);

        uint256[] memory _tokenIds1 = new uint256[](1);
        _tokenIds1[0] = 0;

        uint256[] memory _amount1 = new uint256[](1);
        _amount1[0] = 1000000000000000000;

        itemBound.withdrawAssets(LibItems.RewardType.ETHER, playerWallet2.addr, address(0), _tokenIds1, _amount1);

        assertEq(address(itemBound).balance, 1000000000000000000);
    }

    // withdraw ERC20 - fail
    function testWithdrawERC20TooMuchShouldFail() public {
        uint256 erc20Balance = mockERC20.balanceOf(address(itemBound));
        assertEq(erc20Balance, 20000000000000000000);

        uint256[] memory _tokenIds1 = new uint256[](1);
        _tokenIds1[0] = 0;

        uint256[] memory _amount1 = new uint256[](1);
        _amount1[0] = 20000000000000000001;

        vm.expectRevert(InsufficientBalance.selector);
        itemBound.withdrawAssets(
            LibItems.RewardType.ERC20,
            playerWallet2.addr,
            address(mockERC20),
            _tokenIds1,
            _amount1
        );
    }

    // withdraw ERC20 - pass
    function testWithdrawERC20ShouldPass() public {
        uint256 erc20Balance = mockERC20.balanceOf(address(itemBound));
        assertEq(erc20Balance, 20000000000000000000);

        uint256[] memory _tokenIds1 = new uint256[](1);
        _tokenIds1[0] = 0;

        uint256[] memory _amount1 = new uint256[](1);
        _amount1[0] = 1000000000000000000;

        itemBound.withdrawAssets(
            LibItems.RewardType.ERC20,
            playerWallet2.addr,
            address(mockERC20),
            _tokenIds1,
            _amount1
        );

        assertEq(mockERC20.balanceOf(address(itemBound)), 19000000000000000000);
    }

    // withdraw ERC721 - fail
    function testWithdrawERC721NotOwnedShouldFail() public {
        mockERC721.mint(playerWallet3.addr);

        address ownerAddress = mockERC721.ownerOf(10);
        assertEq(ownerAddress, playerWallet3.addr);

        uint256[] memory _tokenIds1 = new uint256[](1);
        _tokenIds1[0] = 10; // tokenId 10

        uint256[] memory _amount1 = new uint256[](1);
        _amount1[0] = 0; // ignore amount

        vm.expectRevert("ERC721: caller is not token owner or approved");
        itemBound.withdrawAssets(
            LibItems.RewardType.ERC721,
            playerWallet2.addr,
            address(mockERC721),
            _tokenIds1,
            _amount1
        );
    }

    function testWithdrawERC721InvalidTokenIdShouldFail() public {
        vm.expectRevert("ERC721: invalid token ID");
        address ownerAddress = mockERC721.ownerOf(20);

        uint256[] memory _tokenIds1 = new uint256[](1);
        _tokenIds1[0] = 20; // tokenId 20

        uint256[] memory _amount1 = new uint256[](1);
        _amount1[0] = 0; // ignore amount

        vm.expectRevert("ERC721: invalid token ID");
        itemBound.withdrawAssets(
            LibItems.RewardType.ERC721,
            playerWallet2.addr,
            address(mockERC721),
            _tokenIds1,
            _amount1
        );
    }

    // withdraw ERC721 - pass
    function testWithdrawERC721ShouldPass() public {
        address ownerAddress = mockERC721.ownerOf(0);
        assertEq(ownerAddress, address(itemBound));

        uint256[] memory _tokenIds1 = new uint256[](1);
        _tokenIds1[0] = 0; // tokenId 0

        uint256[] memory _amount1 = new uint256[](1);
        _amount1[0] = 0; // ignore amount

        itemBound.withdrawAssets(
            LibItems.RewardType.ERC721,
            playerWallet2.addr,
            address(mockERC721),
            _tokenIds1,
            _amount1
        );

        assertEq(mockERC721.ownerOf(0), playerWallet2.addr);
    }

    // withdraw ERC1155 - fail
    // own but amount is 0
    function testWithdrawERC1155TooMuchShouldFail() public {
        address[] memory _accounts = new address[](3);
        _accounts[0] = address(itemBound);
        _accounts[1] = address(itemBound);
        _accounts[2] = address(itemBound);

        uint256[] memory _tokenIds = new uint256[](3);
        _tokenIds[0] = 123;
        _tokenIds[1] = 456;
        _tokenIds[2] = 789;

        uint256[] memory _amounts = new uint256[](3);
        _amounts[0] = 2;
        _amounts[1] = 11;
        _amounts[2] = 4;

        uint256[] memory balances = mockERC1155.balanceOfBatch(_accounts, _tokenIds);

        for (uint256 i = 0; i < balances.length; i++) {
            assertEq(balances[i], 10);
        }

        vm.expectRevert("ERC1155: insufficient balance for transfer");
        itemBound.withdrawAssets(
            LibItems.RewardType.ERC1155,
            playerWallet2.addr,
            address(mockERC1155),
            _tokenIds,
            _amounts
        );

        uint256[] memory balancesAfter = mockERC1155.balanceOfBatch(_accounts, _tokenIds);

        for (uint256 i = 0; i < balancesAfter.length; i++) {
            assertEq(balancesAfter[i], balances[i]);
        }
    }

    // token not owned
    function testWithdrawERC1155NotOwnedShouldFail() public {
        address[] memory _accounts = new address[](1);
        _accounts[0] = address(itemBound);

        uint256[] memory _tokenIds = new uint256[](1);
        _tokenIds[0] = 888;

        uint256[] memory _amounts = new uint256[](1);
        _amounts[0] = 2;

        uint256[] memory balances = mockERC1155.balanceOfBatch(_accounts, _tokenIds);

        for (uint256 i = 0; i < balances.length; i++) {
            assertEq(balances[i], 0);
        }

        vm.expectRevert("ERC1155: insufficient balance for transfer");
        itemBound.withdrawAssets(
            LibItems.RewardType.ERC1155,
            playerWallet2.addr,
            address(mockERC1155),
            _tokenIds,
            _amounts
        );
    }

    // withdraw ERC1155 - pass
    function testWithdrawERC1155ShouldPass() public {
        address[] memory _accounts = new address[](3);
        _accounts[0] = address(itemBound);
        _accounts[1] = address(itemBound);
        _accounts[2] = address(itemBound);

        uint256[] memory _tokenIds = new uint256[](3);
        _tokenIds[0] = 123;
        _tokenIds[1] = 456;
        _tokenIds[2] = 789;

        uint256[] memory _amounts = new uint256[](3);
        _amounts[0] = 1;
        _amounts[1] = 2;
        _amounts[2] = 3;

        uint256[] memory balances = mockERC1155.balanceOfBatch(_accounts, _tokenIds);

        for (uint256 i = 0; i < balances.length; i++) {
            assertEq(balances[i], 10);
        }

        itemBound.withdrawAssets(
            LibItems.RewardType.ERC1155,
            playerWallet2.addr,
            address(mockERC1155),
            _tokenIds,
            _amounts
        );

        uint256[] memory balancesAfter = mockERC1155.balanceOfBatch(_accounts, _tokenIds);

        for (uint256 i = 0; i < balancesAfter.length; i++) {
            assertEq(balancesAfter[i], 10 - _amounts[i]);
        }
    }
}
