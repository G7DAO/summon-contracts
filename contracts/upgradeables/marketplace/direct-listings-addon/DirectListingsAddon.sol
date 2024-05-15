// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.11;

import {IOffers, IDirectListings, IOffers, IDirectListingsAddon} from "../../../interfaces/IMarketplace.sol";
import {CurrencyTransferLib} from "../../../libraries/CurrencyTransferLib.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import {ERC2771ContextConsumer} from "../../../ercs/extensions/ERC2771ContextConsumer.sol";


import {LibStorage} from "../libraries/LibStorage.sol";
import {LibOffers} from "../libraries/LibOffers.sol";
import {LibDirectListings} from "../libraries/LibDirectListings.sol";

/**
 * @title Direct Listings Addon
 * @dev Contains logic for direct listings with offers.
 * @author Daniel Lima <karacurt>(https://github.com/karacurt)
 */
contract DirectListingsAddon is IDirectListingsAddon, ReentrancyGuard, ERC2771ContextConsumer {
    /// @dev The address of the native token wrapper contract.
    address private immutable nativeTokenWrapper;

    /// @dev Checks whether an auction exists.
    modifier onlyExistingOffer(uint256 _offerId) {
        require(LibStorage.offersStorage().offers[_offerId].status == IOffers.Status.CREATED, "Marketplace: invalid offer.");
        _;
    }

    /// @dev Checks whether a listing exists.
    modifier onlyExistingListing(uint256 _listingId) {
        require(
            LibStorage.directListingsStorage().listings[_listingId].status == IDirectListings.Status.CREATED,
            "Marketplace: invalid listing."
        );
        _;
    }

    /// @dev Checks whether caller is a listing creator.
    modifier onlyListingCreator(uint256 _listingId) {
        require(
            LibStorage.directListingsStorage().listings[_listingId].listingCreator == _msgSender(),
            "Marketplace: not listing creator."
        );
        _;
    }

    /// @dev Checks whether caller is a offer creator.
    modifier onlyOfferor(uint256 _offerId) {
        require(LibStorage.offersStorage().offers[_offerId].offeror == _msgSender(), "!Offeror");
        _;
    }

    /*///////////////////////////////////////////////////////////////
                            Constructor logic
    //////////////////////////////////////////////////////////////*/

    constructor(address _nativeTokenWrapper) {
        nativeTokenWrapper = _nativeTokenWrapper;
    }

    /*///////////////////////////////////////////////////////////////
                            External functions
    //////////////////////////////////////////////////////////////*/

    // @notice Create a new listing with offers.
    function makeOfferForListing(
        uint256 _listingId,
        uint256 _expirationTimestamp,
        uint256 _totalPrice
    ) external onlyExistingListing(_listingId) returns (uint256 _offerId) {
        IDirectListings.Listing memory listing = LibStorage.directListingsStorage().listings[_listingId];
        _offerId = LibOffers.getNextOfferId();
        address _offeror = _msgSender();

        require(_expirationTimestamp + 60 minutes > block.timestamp, "Marketplace: invalid expiration timestamp.");

        IOffers.Offer memory _offer = IOffers.Offer({
            offerId: _offerId,
            offeror: _offeror,
            assetContract: listing.assetContract,
            tokenId: listing.tokenId,
            tokenType: IOffers.TokenType(uint(listing.tokenType)),
            quantity: listing.quantity,
            currency: listing.currency,
            totalPrice: _totalPrice,
            expirationTimestamp: _expirationTimestamp,
            status: IOffers.Status.CREATED
        });

        LibStorage.offersStorage().offers[_offerId] = _offer;
        LibStorage.directListingsAddonStorage().isOfferMadeForListing[_listingId][_offerId] = true;

        // Transfer currency to marketplace
        CurrencyTransferLib.transferCurrencyWithWrapper(
            _offer.currency,
            _offeror,
            address(this),
            _offer.totalPrice,
            nativeTokenWrapper
        );

        emit NewOffer(_offeror, _offerId, listing.assetContract, _offer);
    }

    // @notice Cancel an offer for a listing.
    function cancelOfferForListing(uint256 _offerId) external onlyExistingOffer(_offerId) onlyOfferor(_offerId) {
        require(LibStorage.offersStorage().offers[_offerId].status == IOffers.Status.CREATED, "Marketplace: invalid offer.");

        IOffers.Offer storage _offer = LibStorage.offersStorage().offers[_offerId];
        _offer.status = IOffers.Status.CANCELLED;

        // Refund currency to offeror
        CurrencyTransferLib.transferCurrencyWithWrapper(
            _offer.currency,
            address(this),
            _offer.offeror,
            _offer.totalPrice,
            nativeTokenWrapper
        );

        emit CancelledOffer(_msgSender(), _offerId);
    }

    // @notice Buy NFTs from a listing with an offer.
    function acceptOfferForListing(
        uint256 _listingId,
        uint256 _offerId
    ) external payable nonReentrant onlyExistingOffer(_offerId) onlyExistingListing(_listingId) {
        IDirectListings.Listing memory listing = LibStorage.directListingsStorage().listings[_listingId];
        IOffers.Offer memory offer = LibStorage.offersStorage().offers[_offerId];

        require(_msgSender() == listing.listingCreator, "Marketplace: not listing creator.");
        require(LibStorage.directListingsAddonStorage().isOfferMadeForListing[_listingId][_offerId], "Marketplace: Offer not made for listing.");
        address buyer = offer.offeror;

        require(
            block.timestamp < listing.endTimestamp && block.timestamp >= listing.startTimestamp,
            "Marketplace: not within sale window."
        );

        require(
            LibDirectListings.validateOwnershipAndApproval(
                listing.listingCreator,
                listing.assetContract,
                listing.tokenId,
                offer.quantity,
                listing.tokenType
            ),
            "Marketplace: not owner or approved tokens."
        );

        uint256 targetTotalPrice;

        if (LibStorage.directListingsStorage().currencyPriceForListing[_listingId][offer.currency] > 0) {
            targetTotalPrice =
                offer.quantity *
                LibStorage.directListingsStorage().currencyPriceForListing[_listingId][offer.currency];
        } else {
            require(offer.currency == listing.currency, "Marketplace: Paying in invalid currency.");
        }

        require(offer.totalPrice == targetTotalPrice, "Marketplace: Unexpected total price");

        // Check: buyer owns and has approved sufficient currency for sale.
        if (offer.currency == CurrencyTransferLib.NATIVE_TOKEN) {
            require(msg.value == offer.totalPrice, "Marketplace: msg.value must exactly be the total price.");
        } else {
            require(msg.value == 0, "Marketplace: invalid native tokens sent.");
            LibDirectListings.validateERC20BalAndAllowance(buyer, offer.currency, offer.totalPrice);
        }

        if (listing.quantity == offer.quantity) {
            LibStorage.directListingsStorage().listings[_listingId].status = IDirectListings.Status.COMPLETED;
        }
        LibStorage.directListingsStorage().listings[_listingId].quantity -= offer.quantity;
        LibStorage.offersStorage().offers[_offerId].status = IOffers.Status.COMPLETED;

        LibDirectListings.payout(address(this), listing.listingCreator, offer.currency, offer.totalPrice, listing, nativeTokenWrapper);
        LibDirectListings.transferListingTokens(listing.listingCreator, buyer, offer.quantity, listing);

        emit NewSale(
            listing.listingCreator,
            listing.listingId,
            listing.assetContract,
            listing.tokenId,
            buyer,
            offer.quantity,
            offer.totalPrice
        );

        emit AcceptedOffer(
            offer.offeror,
            offer.offerId,
            offer.assetContract,
            offer.tokenId,
            listing.listingCreator,
            offer.quantity,
            offer.totalPrice
        );
    }
}
