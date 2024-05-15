// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.11;

import {DirectListingsAddonStorage} from "../direct-listings-addon/DirectListingsAddonStorage.sol";
import {DirectListingsStorage} from "../direct-listings/DirectListingsStorage.sol";
import {OffersStorage} from "../offers/OffersStorage.sol";

/**
 * @author Daniel Lima <karacurt>(https://github.com/karacurt)
 */
library LibStorage {
    /// @dev Returns the Offers storage.
    function offersStorage() public pure returns (OffersStorage.Data storage data) {
        data = OffersStorage.data();
    }

    /// @dev Returns the Direct Listings Addon storage.
    function directListingsAddonStorage() public pure returns (DirectListingsAddonStorage.Data storage data) {
        data = DirectListingsAddonStorage.data();
    }

    /// @dev Returns the DirectListings storage.
    function directListingsStorage() public pure returns (DirectListingsStorage.Data storage data) {
        data = DirectListingsStorage.data();
    }
}