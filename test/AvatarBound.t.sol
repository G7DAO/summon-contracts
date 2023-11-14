// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import "../contracts/AvatarBound.sol";
import "../contracts/mocks/MockERC721Receiver.sol";

contract AvatarBoundTest is Test {
    AvatarBound avatarBound;
    MockERC721Receiver mockERC721Receiver;

    function setUp() public {
        avatarBound = new AvatarBound("Test", "T", "MISSING_BASE_URL", "MISSING_CONTRACT_URL");
        mockERC721Receiver = new MockERC721Receiver();
        avatarBound.grantRole(avatarBound.MINTER_ROLE(), address(this));
        avatarBound.grantRole(avatarBound.URI_SETTER_ROLE(), address(this));
    }

    function concatenateStrings(string memory a, string memory b) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }

    function testMint() public {
        string memory tokenURI = "/ipfs/testURI.json";
        avatarBound.mint(address(mockERC721Receiver), tokenURI);
        assertEq(avatarBound.ownerOf(0), address(mockERC721Receiver));

        string memory expectedTokenURI = concatenateStrings(avatarBound.baseTokenURI(), tokenURI);
        assertEq(avatarBound.tokenURI(0), expectedTokenURI);
    }

    function testFailUnauthorizedTransfer() public {
        vm.expectRevert("ERCSoulbound: This token is soulbounded");
        avatarBound.mint(address(mockERC721Receiver), "ipfs://testURI");
        avatarBound.transferFrom(address(mockERC721Receiver), address(this), 0);
    }

    function testBatchSetTokenURI() public {
        string[] memory uris = new string[](2);
        uris[0] = "ipfs://testURI1";
        uris[1] = "ipfs://testURI2";

        uint256[] memory tokenIds = new uint256[](2);
        avatarBound.mint(address(this), uris[0]);
        tokenIds[0] = 0;
        avatarBound.mint(address(this), uris[1]);
        tokenIds[1] = 1;

        avatarBound.batchSetTokenURI(tokenIds, uris);

        for (uint256 i = 0; i < tokenIds.length; i++) {
            assertEq(avatarBound.tokenURI(tokenIds[i]), concatenateStrings(avatarBound.baseTokenURI(), uris[i]));
        }
    }

    function testSetContractURI() public {
        string memory newContractURI = "ipfs://newContractURI";
        avatarBound.setContractURI(newContractURI);
        assertEq(avatarBound.contractURI(), newContractURI);
    }

    function testSetTokenURI() public {
        uint256 tokenId = 0;
        avatarBound.mint(address(this), "ipfs://initialURI");
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
