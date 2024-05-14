// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.11;

import {DirectListingsLogic} from "../direct-listings/DirectListingsLogic.sol";
import {DirectListingsAddonStorage} from "./DirectListingsAddonStorage.sol";
import {OffersLogic} from "../offers/OffersLogic.sol";
import {OffersStorage} from "../offers/OffersStorage.sol";
import {IOffers, IDirectListings} from "../../../interfaces/IMarketplace.sol";
import {CurrencyTransferLib} from "../../../libraries/CurrencyTransferLib.sol";

/**
 * @title Direct Listings Addon
 * @dev Contains logic for direct listings with offers.
 * @author daniel.lima@game7.io
 */
contract DirectListingsAddon is DirectListingsLogic {
    /// @dev Checks whether an auction exists.
    modifier onlyExistingOffer(uint256 _offerId) {
        require(_offersStorage().offers[_offerId].status == IOffers.Status.CREATED, "Marketplace: invalid offer.");
        _;
    }

    constructor(address _nativeTokenWrapper, address devWallet) DirectListingsLogic(_nativeTokenWrapper, devWallet) {}

    // @notice Buy NFTs from a listing with an offer.
    function buyFromListingWithOffer(
        uint256 _listingId,
        uint256 _offerId
    ) external payable nonReentrant onlyExistingOffer(_offerId) onlyExistingListing(_listingId) {
        Listing memory listing = _directListingsStorage().listings[_listingId];
        IOffers.Offer memory offer = _offersStorage().offers[_offerId];

        require(
            !listing.reserved || _directListingsAddonStorage().isOfferApprovedForListing[_listingId][_offerId],
            "offer not approved"
        );
        require(
            _msgSender() == offer.offeror || _msgSender() == listing.listingCreator,
            "Marketplace: not offeror or listing creator."
        );
        address buyer = offer.offeror;

        require(
            block.timestamp < listing.endTimestamp && block.timestamp >= listing.startTimestamp,
            "not within sale window."
        );

        require(
            _validateOwnershipAndApproval(
                listing.listingCreator,
                listing.assetContract,
                listing.tokenId,
                offer.quantity,
                listing.tokenType
            ),
            "Marketplace: not owner or approved tokens."
        );

        uint256 targetTotalPrice;

        if (_directListingsStorage().currencyPriceForListing[_listingId][offer.currency] > 0) {
            targetTotalPrice =
                offer.quantity *
                _directListingsStorage().currencyPriceForListing[_listingId][offer.currency];
        } else {
            require(offer.currency == listing.currency, "Paying in invalid currency.");
        }

        require(offer.totalPrice == targetTotalPrice, "Unexpected total price");

        // Check: buyer owns and has approved sufficient currency for sale.
        if (offer.currency == CurrencyTransferLib.NATIVE_TOKEN) {
            require(msg.value == offer.totalPrice, "Marketplace: msg.value must exactly be the total price.");
        } else {
            require(msg.value == 0, "Marketplace: invalid native tokens sent.");
            _validateERC20BalAndAllowance(buyer, offer.currency, offer.totalPrice);
        }

        if (listing.quantity == offer.quantity) {
            _directListingsStorage().listings[_listingId].status = IDirectListings.Status.COMPLETED;
        }
        _directListingsStorage().listings[_listingId].quantity -= offer.quantity;

        _payout(buyer, listing.listingCreator, offer.currency, offer.totalPrice, listing);
        _transferListingTokens(listing.listingCreator, buyer, offer.quantity, listing);

        _offersStorage().offers[_offerId].status = IOffers.Status.COMPLETED;

        emit NewSale(
            listing.listingCreator,
            listing.listingId,
            listing.assetContract,
            listing.tokenId,
            buyer,
            offer.quantity,
            offer.totalPrice
        );
    }

    /// @notice Approve an offer to buy from a reserved listing.
    function approveOfferForListing(
        uint256 _listingId,
        uint256 _offerId,
        bool _toApprove
    ) external onlyExistingListing(_listingId) onlyListingCreator(_listingId) {
        require(_directListingsStorage().listings[_listingId].reserved, "Marketplace: listing not reserved.");

        _directListingsAddonStorage().isOfferApprovedForListing[_listingId][_offerId] = _toApprove;

        emit OfferApprovedForListing(_listingId, _offerId, _toApprove);
    }

    /// @dev Returns the Offers storage.
    function _offersStorage() internal pure returns (OffersStorage.Data storage data) {
        data = OffersStorage.data();
    }

    /// @dev Returns the Direct Listings Addon storage.
    function _directListingsAddonStorage() internal pure returns (DirectListingsAddonStorage.Data storage data) {
        data = DirectListingsAddonStorage.data();
    }
}
