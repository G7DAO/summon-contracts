// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

contract DeterministicDeployFactory is AccessControl {
    event Deployed(address addr);

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    constructor(address developerAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, developerAdmin);
        _grantRole(MANAGER_ROLE, developerAdmin);
    }

    function deploy(bytes memory bytecode, uint _salt) external onlyRole(MANAGER_ROLE) {
        address addr;
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), _salt)
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }

        emit Deployed(addr);
    }
}
