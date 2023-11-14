// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console2} from "forge-std/Script.sol";
import { AvatarBound } from "../contracts/AvatarBound.sol";

contract DeployAvatarBoundScript is Script {
    function setUp() public {}

    function run() public {
        uint256 privateKey = uint256(bytes32(vm.envBytes("PRIVATE_KEY")));
        address account = vm.addr(privateKey);
        console.log("Account ", account);
        vm.startBroadcast(privateKey);
        // deploy
        AvatarBound avatarBound = new AvatarBound("Zeek Avatar", "Zeek", "MISSING_BASE_URL", "MISSING_CONTRACT_URL");
        console.log("Zeek address ", address(avatarBound));
        vm.stopBroadcast();
    }
}
