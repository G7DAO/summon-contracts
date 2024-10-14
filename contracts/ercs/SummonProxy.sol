// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/Proxy.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/StorageSlot.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SummonProxy is Proxy, Ownable {
    /**
     * @dev Storage slot with the address of the current implementation.
     * This is the keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1, and is
     * validated in the constructor.
     */
    bytes32 internal constant _IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    constructor(
        address _logic,
        bytes memory _data
    ) payable Ownable(_msgSender()) {
        assert(
            _IMPLEMENTATION_SLOT ==
                bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1)
        );
        StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = _logic;
        if (_data.length > 0) {
            Address.functionDelegateCall(_logic, _data);
        }
    }

    /**
     * @dev Returns the current implementation address.
     */
    function _implementation() internal view override returns (address impl) {
        return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
    }

    function implementation() public view returns (address impl) {
        return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
    }

    /**
     * @dev Upgrades the proxy to a new implementation.
     * @param _newImplementation Address of the new implementation.
     * @param _data Data to send as msg.data to the implementation to initialize the new implementation.
     */
    function updateImplementation(
        address _newImplementation,
        bytes memory _data
    ) public onlyOwner {
        StorageSlot
            .getAddressSlot(_IMPLEMENTATION_SLOT)
            .value = _newImplementation;
        if (_data.length > 0) {
            Address.functionDelegateCall(_newImplementation, _data);
        }
    }
}
