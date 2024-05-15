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

        directListing = await ethers.getContractAt('DirectListingsLogic', marketplaceAddress);
        directListingAddon = await ethers.getContractAt('DirectListingsAddon', marketplaceAddress);
    });

    describe('When Direct Listing exists', function () {
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
        });

        describe('When offer NOT exists', function () {
            let offerExpirationTimestamp: number;
            let offerTotalPrice: bigint;

            beforeEach(async function () {
                offerExpirationTimestamp = blockTimestamp + ONE_DAY;
                offerTotalPrice = toWei('9');
            });

            describe('Make Offer For Listing', function () {
                it('Should make a offer for a direct listing', async function () {
                    const offerId = await directListingAddon
                        .connect(buyer)
                        .makeOfferForListing.staticCall(listing.listingId, offerExpirationTimestamp, offerTotalPrice);
                    const offer = {
                        offerId: offerId,
                        tokenId: listing.tokenId,
                        quantity: listing.quantity,
                        totalPrice: offerTotalPrice,
                        expirationTimestamp: offerExpirationTimestamp,
                        offeror: buyer.address,
                        assetContract: listing.assetContract,
                        currency: listing.currency,
                        tokenType: TokenType.ERC721,
                        status: Status.CREATED,
                    };
                    expect(await mockERC20.balanceOf(buyer.address)).to.be.equal(buyerBalance);
                    expect(await mockERC20.balanceOf(marketplaceAddress)).to.be.equal(0);
                    expect(await mockERC721.ownerOf(listing.tokenId)).to.be.equal(seller.address);
                    await expect(
                        directListingAddon
                            .connect(buyer)
                            .makeOfferForListing(listing.listingId, offerExpirationTimestamp, offerTotalPrice)
                    )
                        .to.emit(directListingAddon, 'NewOffer')
                        .withArgs(buyer.address, offerId, listing.assetContract, Object.values(offer));
                    expect(await mockERC20.balanceOf(buyer.address)).to.be.equal(buyerBalance - offerTotalPrice);
                    expect(await mockERC20.balanceOf(marketplaceAddress)).to.be.equal(offerTotalPrice);
                    expect(await mockERC721.ownerOf(listing.tokenId)).to.be.equal(seller.address);
                });
                it('Should revert if offer is made for a listing that does not exist', async function () {
                    await expect(
                        directListingAddon
                            .connect(buyer)
                            .makeOfferForListing(999, offerExpirationTimestamp, offerTotalPrice)
                    ).to.be.revertedWith('Marketplace: invalid listing.');
                });
                it('Should revert if timestamp is older that one hour', async function () {
                    await expect(
                        directListingAddon
                            .connect(buyer)
                            .makeOfferForListing(listing.listingId, blockTimestamp - ONE_DAY, offerTotalPrice)
                    ).to.be.revertedWith('Marketplace: invalid expiration timestamp.');
                });
            });
        });

        describe('When offer exists', function () {
            let offer: Offer;
            beforeEach(async function () {
                const offerExpirationTimestamp = blockTimestamp + ONE_DAY;
                const offerTotalPrice = toWei('9');

                const offerId = await directListingAddon
                    .connect(buyer)
                    .makeOfferForListing.staticCall(listing.listingId, offerExpirationTimestamp, offerTotalPrice);
                await directListingAddon
                    .connect(buyer)
                    .makeOfferForListing(listing.listingId, offerExpirationTimestamp, offerTotalPrice);
                offer = {
                    offerId: offerId,
                    tokenId: listing.tokenId,
                    quantity: listing.quantity,
                    totalPrice: offerTotalPrice,
                    expirationTimestamp: offerExpirationTimestamp,
                    offeror: buyer.address,
                    assetContract: listing.assetContract,
                    currency: listing.currency,
                    tokenType: TokenType.ERC721,
                    status: Status.CREATED,
                };
            });
            describe('Cancel Offer For Listing', function () {
                it('Should cancel a offer made for a direct listing', async function () {
                    expect(await mockERC20.balanceOf(buyer.address)).to.be.equal(buyerBalance - offer.totalPrice);
                    expect(await mockERC20.balanceOf(marketplaceAddress)).to.be.equal(offer.totalPrice);
                    await expect(
                        directListingAddon.connect(buyer).cancelOfferForListing(offer.offerId)
                    ).to.emit(directListingAddon, 'CancelledOffer').withArgs(buyer.address, offer.offerId);
                    expect(await mockERC20.balanceOf(buyer.address)).to.be.equal(buyerBalance);
                    expect(await mockERC20.balanceOf(marketplaceAddress)).to.be.equal(0);
                });
                it('Should revert if try to cancel it twice', async function () {
                    await expect(directListingAddon.connect(buyer).cancelOfferForListing(offer.offerId)).to.emit(
                        directListingAddon,
                        'CancelledOffer'
                    );
                    await expect(
                        directListingAddon.connect(buyer).cancelOfferForListing(offer.offerId)
                    ).to.be.revertedWith('Marketplace: invalid offer.');
                });
            })
            describe('Accept Offer For Listing', function () {
                it('Should accept a offer made for a direct listing', async function () {
                    expect(await mockERC20.balanceOf(buyer.address)).to.be.equal(buyerBalance - offer.totalPrice);
                    expect(await mockERC20.balanceOf(seller.address)).to.be.equal(0);
                    expect(await mockERC20.balanceOf(marketplaceAddress)).to.be.equal(offer.totalPrice);
                    expect(await mockERC721.ownerOf(listing.tokenId)).to.be.equal(seller.address);

                    await expect(
                        directListingAddon.connect(seller).acceptOfferForListing(listing.listingId, offer.offerId)
                    )
                        .to.emit(directListingAddon, 'NewSale')
                        .withArgs(
                            listing.listingCreator,
                            listing.listingId,
                            listing.assetContract,
                            listing.tokenId,
                            offer.offeror,
                            offer.quantity,
                            offer.totalPrice
                        )
                        .to.emit(directListingAddon, 'AcceptedOffer')
                        .withArgs(
                            offer.offeror,
                            offer.offerId,
                            offer.assetContract,
                            offer.tokenId,
                            listing.listingCreator,
                            offer.quantity,
                            offer.totalPrice
                        );

                    expect(await mockERC20.balanceOf(buyer.address)).to.be.equal(buyerBalance - offer.totalPrice);
                    expect(await mockERC20.balanceOf(marketplaceAddress)).to.be.equal(0);
                    expect(await mockERC20.balanceOf(seller.address)).to.be.equal(offer.totalPrice);
                    expect(await mockERC721.ownerOf(listing.tokenId)).to.be.equal(buyer.address);
                });
                it('Should revert if there its invalid offer', async function () {
                    await expect(
                        directListingAddon.connect(seller).acceptOfferForListing(listing.listingId, 0)
                    ).to.be.revertedWith('Marketplace: invalid offer.');
                });
                it('Should revert if caller is not the listing creator', async function () {
                    await expect(
                        directListingAddon.connect(buyer).acceptOfferForListing(listing.listingId, offer.offerId)
                    ).to.be.revertedWith('Marketplace: not listing creator.');
                });
                it('Should revert if offer is not made for the listing', async function () {
                    await mockERC721.mint(seller.address);
                    await mockERC721.connect(seller).setApprovalForAll(marketplaceAddress, true);
                    const newListingParams = {...listingParams, tokenId: 1};
                    const newListingId = await directListing.connect(seller).createListing.staticCall(newListingParams);
                    await directListing.connect(seller).createListing(newListingParams);
                    await directListing
                        .connect(seller)
                        .approveCurrencyForListing(newListingId, mockERC20Address, newListingParams.pricePerToken);
                    await expect(
                        directListingAddon.connect(seller).acceptOfferForListing(newListingId, offer.offerId)
                    ).to.be.revertedWith('Marketplace: Offer not made for listing.');
                });
                it('Should revert if offer is cancelled', async function () {
                    await directListingAddon.connect(buyer).cancelOfferForListing(offer.offerId);
                    await expect(
                        directListingAddon.connect(seller).acceptOfferForListing(listing.listingId, offer.offerId)
                    ).to.be.revertedWith('Marketplace: invalid offer.');
                });
            });
        });
    });
});
