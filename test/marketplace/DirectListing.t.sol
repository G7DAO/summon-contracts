// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { console } from "forge-std/Test.sol";
import { BaseTest } from "../utils/BaseTest.sol";

import { RoyaltyPaymentsLogic } from "@thirdweb-dev/contracts/extension/plugin/RoyaltyPayments.sol";
import { MarketplaceV3, IPlatformFee } from "@thirdweb-dev/contracts/prebuilts/marketplace/entrypoint/MarketplaceV3.sol";
import { DirectListingsLogic } from "@thirdweb-dev/contracts/prebuilts/marketplace/direct-listings/DirectListingsLogic.sol";
import { TWProxy } from "@thirdweb-dev/contracts/infra/TWProxy.sol";
import { ERC721Base } from "@thirdweb-dev/contracts/base/ERC721Base.sol";
import { Permissions } from "@thirdweb-dev/contracts/extension/Permissions.sol";
import "@thirdweb-dev/dynamic-contracts/src/interface/IExtension.sol";
import { IDirectListings } from "@thirdweb-dev/contracts/prebuilts/marketplace/IMarketplace.sol";
import { Marketplace } from "../../contracts/upgradeables/marketplace/Marketplace.sol";

import { AchievoProxy } from "../../contracts/ercs/AchievoProxy.sol";


contract MarketplaceDirectListingsTest is BaseTest, IExtension {
    address public marketplace;

    address public marketplaceDeployer;
    address public seller;
    address public buyer;

    function setUp() public override {
        super.setUp();
        marketplaceDeployer = getActor(1);
        seller = getActor(2);
        buyer = getActor(3);
        Extension[] memory extensions = _setupExtensions();

        address implementation = address(
            new Marketplace(MarketplaceV3.MarketplaceConstructorParams(extensions, address(0), address(erc20)))
        );

        vm.prank(marketplaceDeployer);
        marketplace = address(
            new AchievoProxy(
                implementation,
                abi.encodeCall(
                    MarketplaceV3.initialize,
                    (marketplaceDeployer, "", new address[](0), marketplaceDeployer, 0)
                )
            )
        );

        // Setup roles for seller and assets
        vm.startPrank(marketplaceDeployer);
        Permissions(marketplace).revokeRole(keccak256("ASSET_ROLE"), address(0));
        Permissions(marketplace).revokeRole(keccak256("LISTER_ROLE"), address(0));
        Permissions(marketplace).grantRole(keccak256("LISTER_ROLE"), seller);
        Permissions(marketplace).grantRole(keccak256("ASSET_ROLE"), address(erc721));
        Permissions(marketplace).grantRole(keccak256("ASSET_ROLE"), address(erc1155));

        vm.stopPrank();

        vm.label(implementation, "MarketplaceV3_Impl");
        vm.label(marketplace, "Marketplace");
        vm.label(seller, "Seller");
        vm.label(buyer, "Buyer");
        vm.label(address(erc721), "ERC721_Token");
        vm.label(address(erc1155), "ERC1155_Token");
    }

    function _setupExtensions() private returns (Extension[] memory extensions) {
        extensions = new Extension[](1);
        address directListings = address(new DirectListingsLogic(address(erc20)));

        // Extension: DirectListingsLogic
        Extension memory extension_directListings;

        extension_directListings.metadata = ExtensionMetadata({
            name: "DirectListingsLogic",
            metadataURI: "ipfs://{hash}",
            implementation: directListings
        });

        extension_directListings.functions = new ExtensionFunction[](13);
        extension_directListings.functions[0] = ExtensionFunction(
            DirectListingsLogic.totalListings.selector,
            "totalListings()"
        );
        extension_directListings.functions[1] = ExtensionFunction(
            DirectListingsLogic.isBuyerApprovedForListing.selector,
            "isBuyerApprovedForListing(uint256,address)"
        );
        extension_directListings.functions[2] = ExtensionFunction(
            DirectListingsLogic.isCurrencyApprovedForListing.selector,
            "isCurrencyApprovedForListing(uint256,address)"
        );
        extension_directListings.functions[3] = ExtensionFunction(
            DirectListingsLogic.currencyPriceForListing.selector,
            "currencyPriceForListing(uint256,address)"
        );
        extension_directListings.functions[4] = ExtensionFunction(
            DirectListingsLogic.createListing.selector,
            "createListing((address,uint256,uint256,address,uint256,uint128,uint128,bool))"
        );
        extension_directListings.functions[5] = ExtensionFunction(
            DirectListingsLogic.updateListing.selector,
            "updateListing(uint256,(address,uint256,uint256,address,uint256,uint128,uint128,bool))"
        );
        extension_directListings.functions[6] = ExtensionFunction(
            DirectListingsLogic.cancelListing.selector,
            "cancelListing(uint256)"
        );
        extension_directListings.functions[7] = ExtensionFunction(
            DirectListingsLogic.approveBuyerForListing.selector,
            "approveBuyerForListing(uint256,address,bool)"
        );
        extension_directListings.functions[8] = ExtensionFunction(
            DirectListingsLogic.approveCurrencyForListing.selector,
            "approveCurrencyForListing(uint256,address,uint256)"
        );
        extension_directListings.functions[9] = ExtensionFunction(
            DirectListingsLogic.buyFromListing.selector,
            "buyFromListing(uint256,address,uint256,address,uint256)"
        );
        extension_directListings.functions[10] = ExtensionFunction(
            DirectListingsLogic.getAllListings.selector,
            "getAllListings(uint256,uint256)"
        );
        extension_directListings.functions[11] = ExtensionFunction(
            DirectListingsLogic.getAllValidListings.selector,
            "getAllValidListings(uint256,uint256)"
        );
        extension_directListings.functions[12] = ExtensionFunction(
            DirectListingsLogic.getListing.selector,
            "getListing(uint256)"
        );

        extensions[0] = extension_directListings;

        return extensions;
    }
}