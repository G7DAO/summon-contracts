// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test, console2} from "forge-std/Test.sol";
import "../contracts/AvatarBound.sol";
import "../contracts/SoulBound1155.sol";
import "../contracts/mocks/MockERC721Receiver.sol";
import "../contracts/mocks/Mock721SoulBound.sol";

contract AvatarBoundTest is Test {
    AvatarBound avatarBound;
    MockERC721Receiver mockERC721Receiver;
    SoulBound1155 soulBound1155;
    Mock721SoulBound mockERC721SoulBound;


    function setUp() public {
        mockERC721SoulBound = new Mock721SoulBound();
        soulBound1155 = new SoulBound1155(
            "Test1155",
            "T1155",
            "MISSING_BASE_URL",
            1,
            false,
            address(this),
            10
        );

        avatarBound = new AvatarBound(
            "Test",
            "T",
            "MISSING_BASE_URL",
            "MISSING_CONTRACT_URL",
            address(mockERC721SoulBound),
            address(soulBound1155),
            true,
            true
        );

        mockERC721Receiver = new MockERC721Receiver();
        avatarBound.grantRole(avatarBound.MINTER_ROLE(), address(this));
        avatarBound.grantRole(avatarBound.URI_SETTER_ROLE(), address(this));
        avatarBound.setBaseSkin(1, "ipfs://{hash}/baseSkin/1.png");
    }

    function concatenateStrings(string memory a, string memory b) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }

    function testMint() public {
        avatarBound.adminMint(address(mockERC721Receiver), 1);
        assertEq(avatarBound.ownerOf(0), address(mockERC721Receiver));
    }

    function testFailUnauthorizedTransfer() public {
        vm.expectRevert("ERCSoulbound: This token is soulbounded");
        avatarBound.adminMint(address(mockERC721Receiver), 1);
        avatarBound.transferFrom(address(mockERC721Receiver), address(this), 0);
    }

    function testSetContractURI() public {
        string memory newContractURI = "ipfs://newContractURI";
        avatarBound.setContractURI(newContractURI);
        assertEq(avatarBound.contractURI(), newContractURI);
    }

    function testSetTokenURI() public {
        uint256 tokenId = 0;
        avatarBound.adminMint(address(this), 1);
        string memory newURI = "ipfs://newURI";
        avatarBound.setTokenURI(tokenId, newURI);

        assertEq(avatarBound.tokenURI(tokenId), concatenateStrings(avatarBound.baseTokenURI(), newURI));
    }

    function testSetBaseURI() public {
        string memory newBaseURI = "ipfs://newBaseURI/";
        avatarBound.setBaseURI(newBaseURI);

        assertEq(avatarBound.baseTokenURI(), newBaseURI);
    }

    function testSupportsInterface() public {
        bytes4 interfaceIdERC721 = 0x80ac58cd; // ERC721 interface ID
        assert(avatarBound.supportsInterface(interfaceIdERC721));

        bytes4 interfaceIdERC721Metadata = 0x5b5e139f; // ERC721Metadata interface ID
        assert(avatarBound.supportsInterface(interfaceIdERC721Metadata));

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
