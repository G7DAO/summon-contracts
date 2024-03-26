// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract DeterministicDeployFactory {
    event Deployed(address addr);

    // TODO * Need to gate the access to this contract so only us can deploy the contract from this contract
    function deploy(bytes memory bytecode, uint _salt) external {
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
