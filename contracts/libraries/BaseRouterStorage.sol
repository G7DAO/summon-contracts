// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title BaseRouterStorage
/// @notice Defined storage for base router

library BaseRouterStorage {

    /// @custom:storage-location erc7201:base.router.storage
    bytes32 public constant BASE_ROUTER_STORAGE_POSITION = keccak256(abi.encode(uint256(keccak256("base.router.storage")) - 1));

    struct Data {
        /// @dev Mapping used only for checking default extension validity in constructor.
        mapping(bytes4 => bool) functionMap;
        /// @dev Mapping used only for checking default extension validity in constructor.
        mapping(string => bool) extensionMap;
    }

    /// @dev Returns access to base router storage.
    function data() internal pure returns (Data storage data_) {
        bytes32 position = BASE_ROUTER_STORAGE_POSITION;
        assembly {
            data_.slot := position
        }
    }
}