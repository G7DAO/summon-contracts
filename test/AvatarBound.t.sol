// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import { Test, console } from "forge-std/Test.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { AvatarBound } from "../contracts/AvatarBound.sol";
import { ItemBound } from "../contracts/ItemBound.sol";
import { MockERC721Receiver } from "../contracts/mocks/MockERC721Receiver.sol";
import { MockERC1155Receiver } from "../contracts/mocks/MockERC1155Receiver.sol";
import { OpenMint } from "../contracts/OpenMint.sol";
import { LibItems } from "../contracts/libraries/LibItems.sol";

contract AvatarBoundTest is Test {
    using Strings for uint256;
    AvatarBound public avatarBound;
    MockERC721Receiver public mockERC721Receiver;
    MockERC1155Receiver public mockERC1155Receiver;
    ItemBound public itemBound;
    OpenMint public capsuleNft;

    uint256 public defaultBaseSkinId = 1;
    uint256 public defaultCapsuleNftId = 0;
    uint256 public specialItemId = 777888;
    uint256 public defaultItemId = 100001;

    struct Wallet {
        address addr;
        uint256 privateKey;
    }

    bytes public signature;
    bytes public encodedItems;
    uint256 public nonce;

    string public minterLabel = "minter";
    string public playerLabel = "player";

    Wallet public minterWallet;
    Wallet public playerWallet;

    uint256 private _seed;
    uint256[] public _tokenItemsIds;
    LibItems.TokenCreate[] public _tokens;

    function getWallet(string memory walletLabel) public returns (Wallet memory) {
        (address addr, uint256 privateKey) = makeAddrAndKey(walletLabel);
        Wallet memory wallet = Wallet(addr, privateKey);
        return wallet;
    }

    function concatenateStrings(string memory a, string memory b) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }

    function generateRandomItemId() internal returns (uint256) {
        _seed = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), _seed)));
        return _seed;
    }

    function generateRandomLevel() internal returns (uint256) {
        _seed = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), _seed)));
        return (_seed % 10) + 1; // 1 - 10
    }

    function generateRandomTier() internal returns (uint256) {
        _seed = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), _seed)));
        uint256 random = _seed % 5; // 0 - 4

        return random;
    }

    function encode(uint256[] memory itemIds) public pure returns (bytes memory) {
        return (abi.encode(itemIds));
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

    function setupItems() internal returns (bytes memory) {
        for (uint256 i = 0; i < 10; i++) {
            uint256 _tokenId = generateRandomItemId(); // totally random
            uint256 _level = generateRandomLevel(); // level 1-10
            uint256 _tier = generateRandomTier(); // tier 0-4

            LibItems.TokenCreate memory _token = LibItems.TokenCreate({
                tokenId: _tokenId,
                tokenUri: string(abi.encodePacked("https://something.com", "/", _tokenId.toString())),
                receiver: minterWallet.addr,
                feeBasisPoints: 250
            });

            _tokens.push(_token);

            _tokenItemsIds.push(_tokenId);
        }

        LibItems.TokenCreate memory defaultItem = LibItems.TokenCreate({
            tokenId: defaultItemId,
            tokenUri: "",
            receiver: minterWallet.addr,
            feeBasisPoints: 250
        });

        _tokens.push(defaultItem);

        LibItems.TokenCreate memory specialItem = LibItems.TokenCreate({
            tokenId: specialItemId,
            tokenUri: "",
            receiver: minterWallet.addr,
            feeBasisPoints: 250
        });

        _tokens.push(specialItem);

        itemBound.addNewTokens(_tokens);

        encodedItems = encode(_tokenItemsIds);
        return encodedItems;
    }

    function setUp() public {
        playerWallet = getWallet(playerLabel);
        minterWallet = getWallet(minterLabel);
        itemBound = new ItemBound(
            "Test1155",
            "T1155",
            "MISSING_BASE_URL",
            "MISSING_CONTRACT_URL",
            1,
            false,
            minterWallet.addr,
            250
        );
        capsuleNft = new OpenMint("https://summon.mypinata.cloud/ipfs/");

        encodedItems = setupItems();

        avatarBound = new AvatarBound(
            "Test",
            "T",
            "MISSING_BASE_URL",
            "MISSING_CONTRACT_URL",
            "MISSING_REVEAL_CAPSULE_URL",
            address(minterWallet.addr),
            address(capsuleNft),
            address(itemBound),
            true,
            true,
            true,
            true
        );

        capsuleNft.grantRole(capsuleNft.MINTER_ROLE(), address(avatarBound));
        capsuleNft.grantRole(capsuleNft.MINTER_ROLE(), address(minterWallet.addr));

        vm.startPrank(minterWallet.addr);
        capsuleNft.safeMint(playerWallet.addr);
        avatarBound.setBaseSkin(defaultBaseSkinId, "ipfs://{hash}/baseSkin/1.glb");
        avatarBound.setSpecialItemId(specialItemId);
        avatarBound.setDefaultItemId(defaultItemId);
        vm.stopPrank();

        itemBound.grantRole(itemBound.MINTER_ROLE(), address(avatarBound));
    }

    function testMintAvatarNftGating() public {
        vm.startPrank(playerWallet.addr);
        (nonce, signature) = generateSignature(playerWallet.addr, encodedItems, minterLabel);

        avatarBound.mintAvatarNftGating(defaultCapsuleNftId, defaultBaseSkinId, nonce, encodedItems, signature);

        // missing assert to check the random items
        assertEq(avatarBound.balanceOf(playerWallet.addr), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[0]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[1]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[2]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[3]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[4]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[5]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[6]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[7]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[8]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[9]), 1);
        // check the default item Id
        assertEq(itemBound.balanceOf(playerWallet.addr, defaultItemId), 0);
        // check the special item Id
        assertEq(itemBound.balanceOf(playerWallet.addr, specialItemId), 1);
        // test that the capsule now has the new uri(revealed uri)
        assertEq(
            capsuleNft.tokenURI(defaultCapsuleNftId),
            "https://summon.mypinata.cloud/ipfs/MISSING_REVEAL_CAPSULE_URL"
        );
        vm.stopPrank();
    }

    function testMintAvatarWithoutNftGating() public {
        vm.startPrank(playerWallet.addr);
        (nonce, signature) = generateSignature(playerWallet.addr, encodedItems, minterLabel);

        avatarBound.mintAvatar(defaultBaseSkinId, nonce, encodedItems, signature);

        // missing assert to check the random items
        assertEq(avatarBound.balanceOf(playerWallet.addr), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[0]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[1]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[2]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[3]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[4]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[5]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[6]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[7]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[8]), 1);
        assertEq(itemBound.balanceOf(playerWallet.addr, _tokenItemsIds[9]), 1);

        // check the default item Id
        assertEq(itemBound.balanceOf(playerWallet.addr, defaultItemId), 1);

        // check the special item Id
        assertEq(itemBound.balanceOf(playerWallet.addr, specialItemId), 0);
        vm.stopPrank();
    }

    function testgetAllItems() public {
        vm.startPrank(minterWallet.addr);
        avatarBound.setBaseSkin(2, "ipfs://{hash}/baseSkin/2.glb");
        avatarBound.setBaseSkin(3, "ipfs://{hash}/baseSkin/3.glb");
        vm.stopPrank();
        vm.startPrank(playerWallet.addr);
        AvatarBound.BaseSkinResponse[] memory allBaseSkins = avatarBound.getAllBaseSkins();
        assertEq(allBaseSkins.length, 3);
        vm.stopPrank();
    }

    function testAdminMint() public {
        vm.startPrank(minterWallet.addr);
        avatarBound.adminMint(address(playerWallet.addr), 1);
        assertEq(avatarBound.ownerOf(0), address(playerWallet.addr));
    }

    function testPauseUnpause() public {
        vm.startPrank(minterWallet.addr);
        avatarBound.grantRole(avatarBound.PAUSER_ROLE(), address(this));
        avatarBound.grantRole(avatarBound.MINTER_ROLE(), address(this));
        avatarBound.setBaseSkin(1, "ipfs://{hash}/1.glb");
        avatarBound.pause();
        vm.expectRevert("Pausable: paused");
        avatarBound.adminMint(address(this), 1);
        vm.stopPrank();
    }

    function testSetBaseSkin() public {
        vm.startPrank(minterWallet.addr);
        avatarBound.setBaseSkin(2, "ipfs://{hash}/baseSkin/2.glb");
        assertEq(avatarBound.baseSkins(2), "ipfs://{hash}/baseSkin/2.glb");
        vm.stopPrank();
    }

    function testFailUnauthorizedTransfer() public {
        // vm.prank(minterWallet.addr);
        avatarBound.adminMint(address(playerWallet.addr), 1);

        vm.startPrank(playerWallet.addr);
        vm.expectRevert("ERC721Soulbound: Operation denied, soulbounded");
        avatarBound.transferFrom(address(playerWallet.addr), address(this), 0);
        vm.stopPrank();
    }

    function testSetContractURI() public {
        string memory newContractURI = "ipfs://newContractURI";
        vm.startPrank(minterWallet.addr);
        avatarBound.setContractURI(newContractURI);
        assertEq(avatarBound.contractURI(), newContractURI);
        vm.stopPrank();
    }

    function testSetTokenURI() public {
        vm.startPrank(minterWallet.addr);
        avatarBound.adminMint(playerWallet.addr, 1);
        uint256 tokenId = 0;
        string memory newURI = "/newURI1.glb";
        avatarBound.setTokenURI(tokenId, newURI);
        // Assuming concatenateStrings is a helper function that correctly concatenates strings
        assertEq(avatarBound.tokenURI(tokenId), concatenateStrings(avatarBound.baseTokenURI(), newURI));
        vm.stopPrank();
    }

    function testSetBaseURI() public {
        string memory newBaseURI = "ipfs://newBaseURI/";
        vm.startPrank(minterWallet.addr);
        avatarBound.setBaseURI(newBaseURI);
        assertEq(avatarBound.baseTokenURI(), newBaseURI);
        vm.stopPrank();
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) public returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) public returns (bytes4) {
        return this.onERC1155Received.selector;
    }
}
