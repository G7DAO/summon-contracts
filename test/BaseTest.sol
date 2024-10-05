// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MockERC1155 } from "../../contracts/mocks/MockErc1155.sol";
import { MockERC20 } from "../../contracts/mocks/MockErc20.sol";
import { MockERC721 } from "../../contracts/mocks/MockErc721.sol";

contract BaseTest is Test {

    MockERC20 public erc20;
    MockERC20 public erc20Aux;
    MockERC721 public erc721;
    MockERC1155 public erc1155;
    address public constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    address public signer;

    function setUp() public virtual {
        console.log("Base Setup");
        signer = address(this);
        vm.startPrank(address(signer));
        erc20 = new MockERC20("TESToken", "TEST");
        erc20Aux = new MockERC20("TESToken2", "TEST2");
        erc721 = new MockERC721();
        erc1155 = new MockERC1155();
        vm.stopPrank();
    }

    function getActor(uint256 actorIndex) public pure returns (address) {
        return address(uint160(actorIndex));
    }

    function assertIsOwnerERC721(address _token, address _owner, uint256[] memory _tokenIds) internal {
        for (uint256 i = 0; i < _tokenIds.length; i += 1) {
            bool isOwnerOfToken = MockERC721(_token).ownerOf(_tokenIds[i]) == _owner;
            assertTrue(isOwnerOfToken);
        }
    }

    function assertIsNotOwnerERC721(address _token, address _owner, uint256[] memory _tokenIds) internal {
        for (uint256 i = 0; i < _tokenIds.length; i += 1) {
            bool isOwnerOfToken = MockERC721(_token).ownerOf(_tokenIds[i]) == _owner;
            assertTrue(!isOwnerOfToken);
        }
    }

    function assertBalERC20Eq(address token, address account, uint256 expectedBalance) internal {
        uint256 actualBalance = IERC20(token).balanceOf(account);
        assertEq(actualBalance, expectedBalance, "Unexpected ERC20 balance");
    }
}