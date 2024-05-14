// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.11;

import { OffersLogic } from "../upgradeables/marketplace/offers/OffersLogic.sol";

contract MockOffersLogicV2 is OffersLogic {
    function version() external pure returns (string memory) {
        return "upgraded to v2";
    }
}