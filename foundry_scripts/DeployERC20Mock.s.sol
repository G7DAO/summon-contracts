// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.13;

import {Script, console2} from "forge-std/Script.sol";
import { MockUSDC } from "../contracts/mocks/MockUSDC.sol";

contract DeployERC20MockScript is Script {
    function setUp() public {}

    function run() public {
        uint256 privateKey = uint256(bytes32(vm.envBytes("PRIVATE_KEY")));
        address account = vm.addr(privateKey);
        console.log("Account ", account);
        vm.startBroadcast(privateKey);
        // deploy
        MockUSDC mockUSDC = new MockUSDC("oUSDC", "oUSDC", 18);
        console.log("usdc mock address ", address(mockUSDC));
        vm.stopBroadcast();
    }
}
