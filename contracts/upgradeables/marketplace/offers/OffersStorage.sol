// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.11;

/// @author omar@game7.io

import { IOffers } from "../../../interfaces/IMarketplace.sol";

/**
 * @author  omar@game7.io
 */
library OffersStorage {
    /// @custom:storage-location erc7201:offers.storage
    /// @dev keccak256(abi.encode(uint256(keccak256("offers.storage")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 public constant OFFERS_STORAGE_POSITION =
        0x8f8effea55e8d961f30e12024b944289ed8a7f60abcf4b3989df2dc98a914300;

    struct Data {
        uint256 totalOffers;
        mapping(uint256 => IOffers.Offer) offers;
    }

    function data() internal pure returns (Data storage data_) {
        bytes32 position = OFFERS_STORAGE_POSITION;
        assembly {
            data_.slot := position
        }
    }
}
