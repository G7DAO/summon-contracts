// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.11;

import {LibStorage} from "./LibStorage.sol";
import {IOffers} from "../../../interfaces/IMarketplace.sol";

/**
 * @author Daniel Lima <karacurt>(https://github.com/karacurt)
 */
library LibOffers {

    /// @dev Returns the next offer Id.
    function getNextOfferId() internal returns (uint256 id) {
        id = ++LibStorage.offersStorage().totalOffers;
    }
}