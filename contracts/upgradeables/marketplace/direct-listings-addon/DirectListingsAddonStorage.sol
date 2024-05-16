// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.11;

import {IDirectListings} from "../../../interfaces/IMarketplace.sol";

/**
 * @author daniel.lima@game7.io
 */
library DirectListingsAddonStorage {
    /// @custom:storage-location erc7201:direct.listings.addon.storage
    /// @dev keccak256(abi.encode(uint256(keccak256("direct.listings.addon.storage")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 public constant DIRECT_LISTINGS_ADDON_STORAGE_POSITION = 0x8984390c87977efd15cb6ead730dea1f6773451de71b8bfc8cd6133e3a40bc00;

    struct Data {
        mapping(uint256 => mapping(uint256 => bool)) isOfferMadeForListing;
    }

    function data() internal pure returns (Data storage data_) {
        bytes32 position = DIRECT_LISTINGS_ADDON_STORAGE_POSITION;
        assembly {
            data_.slot := position
        }
    }
}
