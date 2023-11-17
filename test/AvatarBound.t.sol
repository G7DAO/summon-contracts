// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { Test, console2 } from "forge-std/Test.sol";
import "../contracts/AvatarBound.sol";
import "../contracts/Soulbound1155.sol";
import "../contracts/mocks/MockERC721Receiver.sol";
import "../contracts/mocks/MockERC1155Receiver.sol";
import "../contracts/mocks/MockERC721.sol";

contract AvatarBoundTest is Test {
    AvatarBound public avatarBound;
    MockERC721Receiver public mockERC721Receiver;
    MockERC1155Receiver public mockERC1155Receiver;
    Soulbound1155 public soulbound1155;
    Mock721ERC721 public mockERC721;
    address public signerAddress;

    function concatenateStrings(string memory a, string memory b) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }

    function setUp() public {
        mockERC721 = new Mock721ERC721();
        soulbound1155 = new Soulbound1155("Test1155", "T1155", "MISSING_BASE_URL", 1, false, address(this), 10);

        avatarBound = new AvatarBound(
            "Test",
            "T",
            "MISSING_BASE_URL",
            "MISSING_CONTRACT_URL",
            address(this),
            address(mockERC721),
            address(soulbound1155),
            true,
            true,
            true
        );

        signerAddress = address(1);
        avatarBound.setSigner(signerAddress);
        mockERC721Receiver = new MockERC721Receiver();
        mockERC1155Receiver = new MockERC1155Receiver();
        // Add necessary token IDs to the Soulbound1155 contract
        for (uint256 i = 0; i <= 26; i++) {
            soulbound1155.addNewToken(i);
        }
        soulbound1155.grantRole(keccak256("MINTER_ROLE"), address(avatarBound));
    }

    function testPauseUnpause() public {
        avatarBound.grantRole(avatarBound.PAUSER_ROLE(), address(this));
        avatarBound.grantRole(avatarBound.MINTER_ROLE(), address(this));
        avatarBound.setBaseSkin(1, "ipfs://{hash}/1.glb");
        avatarBound.pause();
        vm.expectRevert("Pausable: paused");
        avatarBound.adminMint(address(this), 1);

        avatarBound.unpause();
        avatarBound.adminMint(address(mockERC721Receiver), 1);
        assertEq(avatarBound.balanceOf(address(mockERC721Receiver)), 1);
    }

    function testSetBaseSkin() public {
        // Assuming that the contract allows setting base skin
        avatarBound.setBaseSkin(2, "ipfs://{hash}/baseSkin/2.glb");
        assertEq(avatarBound.baseSkins(2), "ipfs://{hash}/baseSkin/2.glb");
    }

    function testAdminMint() public {
        mockERC721.mint(address(this));
        avatarBound.setBaseSkin(2, "ipfs://{hash}/baseSkin/2.glb");
        avatarBound.grantRole(avatarBound.MINTER_ROLE(), address(this));
        avatarBound.adminMint(address(mockERC721Receiver), 2);
        assertEq(avatarBound.ownerOf(0), address(mockERC721Receiver));
    }

    function testFailUnauthorizedTransfer() public {
        avatarBound.setBaseSkin(1, "ipfs://{hash}/baseSkin/1.glb");
        avatarBound.adminMint(address(mockERC721Receiver), 1);
        vm.expectRevert("ERCSoulbound: Operation denied, soulbounded");
        avatarBound.transferFrom(address(this), address(mockERC721Receiver), 0);
    }

    function testSetContractURI() public {
        string memory newContractURI = "ipfs://newContractURI";
        avatarBound.setContractURI(newContractURI);
        assertEq(avatarBound.contractURI(), newContractURI);
    }

    function testSetTokenURI() public {
        avatarBound.setBaseSkin(1, "ipfs://{hash}/baseSkin/1.glb");
        avatarBound.grantRole(avatarBound.MINTER_ROLE(), address(this));
        avatarBound.adminMint(vm.addr(1), 1);

        avatarBound.grantRole(avatarBound.DEFAULT_ADMIN_ROLE(), address(this));

        uint256 tokenId = 0;
        string memory newURI = "/newURI1.glb";
        avatarBound.setTokenURI(tokenId, newURI);

        // Assuming concatenateStrings is a helper function that correctly concatenates strings
        assertEq(avatarBound.tokenURI(tokenId), concatenateStrings(avatarBound.baseTokenURI(), newURI));
    }

    function testSetBaseURI() public {
        string memory newBaseURI = "ipfs://newBaseURI/";
        avatarBound.setBaseURI(newBaseURI);
        assertEq(avatarBound.baseTokenURI(), newBaseURI);
    }

    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) public returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function onERC1155Received(address operator, address from, uint256 id, uint256 value, bytes calldata data) public returns (bytes4) {
        return this.onERC1155Received.selector;
    }
}
