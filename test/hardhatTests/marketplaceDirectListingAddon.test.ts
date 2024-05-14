import { ethers } from 'hardhat';
import {
    DirectListingsAddon,
    DirectListingsLogic,
    Marketplace,
    MockERC20,
    MockERC721,
    OffersLogic,
} from '../../typechain-types';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { deployMarketplaceContracts } from './fixture/marketplaceContractsFixture';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { toWei } from './helpers/misc';
import { Listing, ListingParameters, Offer, OfferParams, Status, TokenType } from './helpers/types';
import { ONE_DAY } from './helpers/constants';
import { expect } from 'chai';

describe('Marketplace: Direct Listing Addon', function () {
    let offersLogic: OffersLogic;
    let directListing: DirectListingsLogic;
    let directListingAddon: DirectListingsAddon;
    let marketplace: Marketplace;
    let mockERC20: MockERC20;
    let mockERC721: MockERC721;
    let deployer: SignerWithAddress;
    let seller: SignerWithAddress;
    let buyer: SignerWithAddress;

    let mockERC721Address: string;
    let mockERC20Address: string;
    let marketplaceAddress: string;
    let blockTimestamp: number;

    const tokenId = 0;
    const buyerBalance = toWei('1000');
    const totalPrice = toWei('10');
    const quantity = 1;

    beforeEach(async function () {
        [deployer, buyer, seller] = await ethers.getSigners();

        [marketplace, mockERC20, mockERC721] = await loadFixture(deployMarketplaceContracts);

        marketplaceAddress = await marketplace.getAddress();
        mockERC20Address = await mockERC20.getAddress();
        mockERC721Address = await mockERC721.getAddress();
        blockTimestamp = await time.latest();

        await mockERC721.mint(seller.address);
        await mockERC721.connect(seller).setApprovalForAll(marketplaceAddress, true);

        await mockERC20.mint(buyer.address, buyerBalance);
        await mockERC20.connect(buyer).approve(marketplaceAddress, buyerBalance);

        offersLogic = await ethers.getContractAt('OffersLogic', marketplaceAddress);
        directListing = await ethers.getContractAt('DirectListingsLogic', marketplaceAddress);
        directListingAddon = await ethers.getContractAt('DirectListingsAddon', marketplaceAddress);
    });

    describe('When Offer and Direct Listing exists', function () {
        let offer: Offer;
        let offerParams: OfferParams;
        let listingParams: ListingParameters;
        let listing: Listing;
        beforeEach(async function () {
            listingParams = {
                assetContract: mockERC721Address,
                tokenId: tokenId,
                quantity,
                currency: mockERC20Address,
                pricePerToken: totalPrice,
                startTimestamp: blockTimestamp,
                endTimestamp: blockTimestamp + 2 * ONE_DAY,
                reserved: true,
            };
            const listingId = await directListing.connect(seller).createListing.staticCall(listingParams);
            await directListing.connect(seller).createListing(listingParams);

            await directListing
                .connect(seller)
                .approveCurrencyForListing(listingId, mockERC20Address, listingParams.pricePerToken);

            listing = {
                listingId,
                tokenId: listingParams.tokenId,
                quantity: listingParams.quantity,
                pricePerToken: listingParams.pricePerToken,
                startTimestamp: listingParams.startTimestamp,
                endTimestamp: listingParams.endTimestamp,
                listingCreator: seller.address,
                assetContract: listingParams.assetContract,
                currency: listingParams.currency,
                tokenType: TokenType.ERC721,
                status: Status.CREATED,
                reserved: listingParams.reserved,
            };

            offerParams = {
                assetContract: mockERC721Address,
                tokenId: tokenId,
                quantity,
                currency: mockERC20Address,
                totalPrice,
                expirationTimestamp: blockTimestamp + ONE_DAY,
            };
            const offerId = await offersLogic.connect(buyer).makeOffer.staticCall(offerParams);
            await offersLogic.connect(buyer).makeOffer(offerParams);
            offer = {
                offerId: offerId,
                tokenId: offerParams.tokenId,
                quantity: offerParams.quantity,
                totalPrice: offerParams.totalPrice,
                expirationTimestamp: offerParams.expirationTimestamp,
                offeror: buyer.address,
                assetContract: offerParams.assetContract,
                currency: offerParams.currency,
                tokenType: TokenType.ERC721,
                status: Status.CREATED,
            };
        });

        it('Should buy asset in Direct Listing with Offer', async function () {
            await directListingAddon.connect(seller).approveOfferForListing(listing.listingId, offer.offerId, true);
            await expect(directListingAddon.connect(buyer).buyFromListingWithOffer(listing.listingId, offer.offerId))
                .to.emit(directListingAddon, 'NewSale')
                .withArgs(
                    listing.listingCreator,
                    listing.listingId,
                    listing.assetContract,
                    listing.tokenId,
                    offer.offeror,
                    offer.quantity,
                    offer.totalPrice
                );
        });
        it('Should revert if offer is not valid', async function () {
            await directListingAddon.connect(seller).approveOfferForListing(listing.listingId, offer.offerId, true);
            await expect(
                directListingAddon.connect(buyer).buyFromListingWithOffer(listing.listingId, offer.offerId + BigInt(1))
            ).to.be.revertedWith('Marketplace: invalid offer.');
        });
        it('Should revert if offer is not approved', async function () {
            await expect(
                directListingAddon.connect(buyer).buyFromListingWithOffer(listing.listingId, offer.offerId)
            ).to.be.revertedWith('offer not approved');
        });
    });
});
