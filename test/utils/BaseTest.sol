// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { Test, console } from "forge-std/Test.sol";
import { MockERC1155 } from "../../contracts/mocks/MockERC1155.sol";
import { MockERC20 } from "../../contracts/mocks/MockERC20.sol";
import { MockERC721 } from "../../contracts/mocks/MockERC721.sol";


contract BaseTest is Test {

    MockERC20 public erc20;
    MockERC20 public erc20Aux;
    MockERC721 public erc721;
    MockERC1155 public erc1155;

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
}