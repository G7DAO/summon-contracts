// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

contract HelloWorld is Initializable, AccessControl {
    uint256 public randomNumber;

    constructor(address developerAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, developerAdmin);
    }

    function initialize(uint256 _randomNumber) public initializer onlyRole(DEFAULT_ADMIN_ROLE) {
        randomNumber = _randomNumber;
    }

    function greeting() public pure returns (string memory) {
        return "Hello World!123";
    }

    function getChainID() external view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }
}
