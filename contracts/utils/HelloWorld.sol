// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

contract HelloWorld is Initializable, AccessControl {
    uint256 public randomNumber;

    constructor(address developerAdmin) {
        _setupRole(DEFAULT_ADMIN_ROLE, developerAdmin);
    }

    function initialize(uint256 _randomNumber) public initializer onlyRole(DEFAULT_ADMIN_ROLE) {
        randomNumber = _randomNumber;
    }

    function greeting() public pure returns (string memory) {
        return "Hello World!123";
    }
}
