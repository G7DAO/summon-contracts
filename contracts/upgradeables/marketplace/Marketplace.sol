// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {MarketplaceV3} from "@thirdweb-dev/contracts/prebuilts/marketplace/entrypoint/MarketplaceV3.sol";

contract Marketplace is MarketplaceV3 {

    constructor(MarketplaceV3.MarketplaceConstructorParams memory _marketplaceV3Params)
    MarketplaceV3(_marketplaceV3Params)
    {}
}