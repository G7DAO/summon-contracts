// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import "../src/AvatarBound.sol";
import "../contracts/mocks/MockERC721Receiver.sol";

contract AvatarBound is Test {
    AvatarBound avatarBound;
    MockERC721Receiver mockERC721Receiver;

    function setUp() public {
        avatarBound = new AvatarBound("Test", "T", "MISSING_BASE_URL", "MISSING_CONTRACT_URL");
        mockERC721Receiver = new MockERC721Receiver();
        avatarBound.grantRole(avatarBound.MINTER_ROLE(), address(this));
        avatarBound.grantRole(avatarBound.URI_SETTER_ROLE(), address(this));
    }

    function testMint() public {
        string memory tokenURI = "ipfs://testURI";
        avatarBound.mint(address(mockERC721Receiver), tokenURI);
        assertEq(avatarBound.ownerOf(0), address(mockERC721Receiver));
        assertEq(avatarBound.tokenURI(0), tokenURI);
    }

    function testFailUnauthorizedTransfer() public {
        vm.expectRevert("ERCSoulbound: This token is soulbounded");
        giftNFT.mint(address(mockERC721Receiver), "ipfs://testURI");
        giftNFT.transferFrom(address(mockERC721Receiver), address(this), 0);
    }

    function testFailUnauthorizedBurn() public {
        avatarBound.mint(address(mockERC721Receiver), tokenURI);
        vm.expectRevert("ERCSoulbound: Operation denied, soulbounded");
        giftNFT.burn(0);
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) public returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
