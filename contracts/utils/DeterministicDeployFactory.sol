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

// This contract can be deployed on multiple EVM Chains.  However, it MUST be deployed using the same nonce; the nonce will impact the address at which this contract will get deployed.  The address of this factory contract will impact the address of any other contract that this factory contract deploys using the "deployUsingCreate2"
