import { ethers } from 'hardhat';
import { DirectListingsAddon, DirectListingsLogic, Marketplace, MockERC1155, MockERC20 } from '../typechain-types';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { deployMarketplaceContracts } from './fixture/marketplaceContractsFixture';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { toWei } from './helpers/misc';
import { Listing, ListingParameters, Offer, Status, TokenType } from './helpers/types';
import { ONE_DAY } from './helpers/constants';
import { expect } from 'chai';

describe('Marketplace: Direct Listing Addon', function () {
    let directListing: DirectListingsLogic;
    let directListingAddon: DirectListingsAddon;
    let marketplace: Marketplace;
    let mockERC20: MockERC20;
    let mockERC1155: MockERC1155;
    let deployer: SignerWithAddress;
    let seller: SignerWithAddress;
    let buyer: SignerWithAddress;

    let mockERC1155Address: string;
    let mockERC20Address: string;
    let marketplaceAddress: string;
    let blockTimestamp: number;

    const tokenId = 0;
    const buyerBalance = toWei('1000');
    const totalPrice = toWei('10');
    const quantity = 10;
    const sftBalance = 1000;

    beforeEach(async function () {
        [deployer, buyer, seller] = await ethers.getSigners();

        [marketplace, mockERC20, , mockERC1155] = await loadFixture(deployMarketplaceContracts);

        marketplaceAddress = await marketplace.getAddress();
        mockERC20Address = await mockERC20.getAddress();
        mockERC1155Address = await mockERC1155.getAddress();
        blockTimestamp = await time.latest();

        await mockERC20.mint(buyer.address, buyerBalance);
        await mockERC20.connect(buyer).approve(marketplaceAddress, buyerBalance);

        await mockERC1155.mint(seller.address, tokenId, sftBalance, '0x');
        await mockERC1155.connect(seller).setApprovalForAll(marketplaceAddress, true);

        directListing = await ethers.getContractAt('DirectListingsLogic', marketplaceAddress);
        directListingAddon = await ethers.getContractAt('DirectListingsAddon', marketplaceAddress);
    });

    describe('When Direct Listing exists', function () {
        let listingParams: ListingParameters;
        let listing: Listing;

        beforeEach(async function () {
            listingParams = {
                assetContract: mockERC1155Address,
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
                tokenType: TokenType.ERC1155,
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
                        .makeOfferForListing.staticCall(
                            listing.listingId,
                            offerExpirationTimestamp,
                            offerTotalPrice,
                            quantity
                        );
                    const offer = {
                        offerId: offerId,
                        tokenId: listing.tokenId,
                        quantity: listing.quantity,
                        totalPrice: offerTotalPrice,
                        expirationTimestamp: offerExpirationTimestamp,
                        offeror: buyer.address,
                        assetContract: listing.assetContract,
                        currency: listing.currency,
                        tokenType: TokenType.ERC1155,
                        status: Status.CREATED,
                    };
                    expect(await mockERC20.balanceOf(buyer.address)).to.be.equal(buyerBalance);
                    expect(await mockERC20.balanceOf(marketplaceAddress)).to.be.equal(0);
                    expect(await mockERC1155.balanceOf(seller.address, listing.tokenId)).to.be.equal(
                        sftBalance - quantity
                    );
                    await expect(
                        directListingAddon
                            .connect(buyer)
                            .makeOfferForListing(listing.listingId, offerExpirationTimestamp, offerTotalPrice, quantity)
                    )
                        .to.emit(directListingAddon, 'NewOffer')
                        .withArgs(buyer.address, offerId, listing.assetContract, Object.values(offer));
                    expect(await mockERC20.balanceOf(buyer.address)).to.be.equal(buyerBalance - offerTotalPrice);
                    expect(await mockERC20.balanceOf(marketplaceAddress)).to.be.equal(offerTotalPrice);
                    expect(await mockERC1155.balanceOf(seller.address, listing.tokenId)).to.be.equal(
                        sftBalance - quantity
                    );
                });
                it('Should revert if offer is made for a listing that does not exist', async function () {
                    await expect(
                        directListingAddon
                            .connect(buyer)
                            .makeOfferForListing(999, offerExpirationTimestamp, offerTotalPrice, quantity)
                    ).to.be.revertedWith('Marketplace: invalid listing.');
                });
                it('Should revert if timestamp is older that one hour', async function () {
                    await expect(
                        directListingAddon
                            .connect(buyer)
                            .makeOfferForListing(listing.listingId, blockTimestamp - ONE_DAY, offerTotalPrice, quantity)
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
                    .makeOfferForListing.staticCall(
                        listing.listingId,
                        offerExpirationTimestamp,
                        offerTotalPrice,
                        quantity
                    );
                await directListingAddon
                    .connect(buyer)
                    .makeOfferForListing(listing.listingId, offerExpirationTimestamp, offerTotalPrice, quantity);
                offer = {
                    offerId: offerId,
                    tokenId: listing.tokenId,
                    quantity: listing.quantity,
                    totalPrice: offerTotalPrice,
                    expirationTimestamp: offerExpirationTimestamp,
                    offeror: buyer.address,
                    assetContract: listing.assetContract,
                    currency: listing.currency,
                    tokenType: TokenType.ERC1155,
                    status: Status.CREATED,
                };
            });
            describe('Cancel Offer For Listing', function () {
                it('Should cancel a offer made for a direct listing', async function () {
                    expect(await mockERC20.balanceOf(buyer.address)).to.be.equal(buyerBalance - offer.totalPrice);
                    expect(await mockERC20.balanceOf(marketplaceAddress)).to.be.equal(offer.totalPrice);
                    await expect(directListingAddon.connect(buyer).cancelOfferForListing(offer.offerId))
                        .to.emit(directListingAddon, 'CancelledOffer')
                        .withArgs(buyer.address, offer.offerId);
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
            });
            describe('Accept Offer For Listing', function () {
                it('Should accept a offer made for a direct listing', async function () {
                    expect(await mockERC20.balanceOf(buyer.address)).to.be.equal(buyerBalance - offer.totalPrice);
                    expect(await mockERC20.balanceOf(seller.address)).to.be.equal(0);
                    expect(await mockERC20.balanceOf(marketplaceAddress)).to.be.equal(offer.totalPrice);
                    expect(await mockERC1155.balanceOf(seller.address, listing.tokenId)).to.be.equal(
                        sftBalance - quantity
                    );
                    expect(await mockERC1155.balanceOf(buyer.address, listing.tokenId)).to.be.equal(0);

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
                    expect(await mockERC1155.balanceOf(seller.address, listing.tokenId)).to.be.equal(
                        sftBalance - quantity
                    );
                    expect(await mockERC1155.balanceOf(buyer.address, listing.tokenId)).to.be.equal(quantity);
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
                    const newTokenId = 1;
                    await mockERC1155.mint(seller.address, newTokenId, quantity, '0x');
                    await mockERC1155.connect(seller).setApprovalForAll(marketplaceAddress, true);
                    const newListingParams = { ...listingParams, tokenId: newTokenId };
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
                describe('Partial Sale', function () {
                    let partialOffer: Offer;
                    let secondPartialOffer: Offer;
                    let initialBuyerBalance: bigint;
                    let initialMarketplaceBalance: bigint;
                    let initialSftBalance: bigint;
                    const initialSellerBalance = 0;

                    beforeEach(async function () {
                        const partialQuantity = quantity / 2;
                        const partialTotalPrice = toWei('4.5');
                        const partialOfferId = await directListingAddon
                            .connect(buyer)
                            .makeOfferForListing.staticCall(
                                listing.listingId,
                                blockTimestamp + ONE_DAY,
                                partialTotalPrice,
                                partialQuantity
                            );
                        await directListingAddon
                            .connect(buyer)
                            .makeOfferForListing(
                                listing.listingId,
                                blockTimestamp + ONE_DAY,
                                partialTotalPrice,
                                partialQuantity
                            );
                        partialOffer = {
                            offerId: partialOfferId,
                            tokenId: listing.tokenId,
                            quantity: partialQuantity,
                            totalPrice: partialTotalPrice,
                            expirationTimestamp: blockTimestamp + ONE_DAY,
                            offeror: buyer.address,
                            assetContract: listing.assetContract,
                            currency: listing.currency,
                            tokenType: TokenType.ERC1155,
                            status: Status.CREATED,
                        };

                        const secondPartialQuantity = quantity / 2;
                        const secondPartialTotalPrice = toWei('4.5');
                        const secondPartialOfferId = await directListingAddon
                            .connect(buyer)
                            .makeOfferForListing.staticCall(
                                listing.listingId,
                                blockTimestamp + ONE_DAY,
                                secondPartialTotalPrice,
                                secondPartialQuantity
                            );
                        await directListingAddon
                            .connect(buyer)
                            .makeOfferForListing(
                                listing.listingId,
                                blockTimestamp + ONE_DAY,
                                secondPartialTotalPrice,
                                secondPartialQuantity
                            );
                        secondPartialOffer = {
                            offerId: secondPartialOfferId,
                            tokenId: listing.tokenId,
                            quantity: secondPartialQuantity,
                            totalPrice: secondPartialTotalPrice,
                            expirationTimestamp: blockTimestamp + ONE_DAY,
                            offeror: buyer.address,
                            assetContract: listing.assetContract,
                            currency: listing.currency,
                            tokenType: TokenType.ERC1155,
                            status: Status.CREATED,
                        };

                        initialBuyerBalance =
                            buyerBalance - offer.totalPrice - partialOffer.totalPrice - secondPartialOffer.totalPrice;
                        initialMarketplaceBalance =
                            offer.totalPrice + partialOffer.totalPrice + secondPartialOffer.totalPrice;
                        initialSftBalance = BigInt(sftBalance - quantity);
                    });
                    it('Should accept a offer made for a direct listing with partial quantity', async function () {
                        expect(await mockERC20.balanceOf(buyer.address)).to.be.equal(initialBuyerBalance);
                        expect(await mockERC20.balanceOf(seller.address)).to.be.equal(initialSellerBalance);
                        expect(await mockERC20.balanceOf(marketplaceAddress)).to.be.equal(initialMarketplaceBalance);
                        expect(await mockERC1155.balanceOf(seller.address, listing.tokenId)).to.be.equal(
                            initialSftBalance
                        );
                        expect(await mockERC1155.balanceOf(buyer.address, listing.tokenId)).to.be.equal(0);

                        await expect(
                            directListingAddon
                                .connect(seller)
                                .acceptOfferForListing(listing.listingId, partialOffer.offerId)
                        )
                            .to.emit(directListingAddon, 'NewSale')
                            .withArgs(
                                listing.listingCreator,
                                listing.listingId,
                                listing.assetContract,
                                listing.tokenId,
                                partialOffer.offeror,
                                partialOffer.quantity,
                                partialOffer.totalPrice
                            )
                            .to.emit(directListingAddon, 'AcceptedOffer')
                            .withArgs(
                                partialOffer.offeror,
                                partialOffer.offerId,
                                partialOffer.assetContract,
                                partialOffer.tokenId,
                                listing.listingCreator,
                                partialOffer.quantity,
                                partialOffer.totalPrice
                            );

                        expect(await mockERC20.balanceOf(buyer.address)).to.be.equal(initialBuyerBalance);
                        expect(await mockERC20.balanceOf(marketplaceAddress)).to.be.equal(
                            initialMarketplaceBalance - partialOffer.totalPrice
                        );
                        expect(await mockERC20.balanceOf(seller.address)).to.be.equal(partialOffer.totalPrice);
                    });
                    it('Should accept two offers made for a direct listing with partial quantity', async function () {
                        expect(await mockERC20.balanceOf(buyer.address)).to.be.equal(initialBuyerBalance);
                        expect(await mockERC20.balanceOf(seller.address)).to.be.equal(initialSellerBalance);
                        expect(await mockERC20.balanceOf(marketplaceAddress)).to.be.equal(initialMarketplaceBalance);
                        expect(await mockERC1155.balanceOf(seller.address, listing.tokenId)).to.be.equal(
                            initialSftBalance
                        );
                        expect(await mockERC1155.balanceOf(buyer.address, listing.tokenId)).to.be.equal(0);

                        await expect(
                            directListingAddon
                                .connect(seller)
                                .acceptOfferForListing(listing.listingId, partialOffer.offerId)
                        )
                            .to.emit(directListingAddon, 'NewSale')
                            .withArgs(
                                listing.listingCreator,
                                listing.listingId,
                                listing.assetContract,
                                listing.tokenId,
                                partialOffer.offeror,
                                partialOffer.quantity,
                                partialOffer.totalPrice
                            )
                            .to.emit(directListingAddon, 'AcceptedOffer')
                            .withArgs(
                                partialOffer.offeror,
                                partialOffer.offerId,
                                partialOffer.assetContract,
                                partialOffer.tokenId,
                                listing.listingCreator,
                                partialOffer.quantity,
                                partialOffer.totalPrice
                            );

                        await expect(
                            directListingAddon
                                .connect(seller)
                                .acceptOfferForListing(listing.listingId, secondPartialOffer.offerId)
                        )
                            .to.emit(directListingAddon, 'NewSale')
                            .withArgs(
                                listing.listingCreator,
                                listing.listingId,
                                listing.assetContract,
                                listing.tokenId,
                                secondPartialOffer.offeror,
                                secondPartialOffer.quantity,
                                secondPartialOffer.totalPrice
                            )
                            .to.emit(directListingAddon, 'AcceptedOffer')
                            .withArgs(
                                secondPartialOffer.offeror,
                                secondPartialOffer.offerId,
                                secondPartialOffer.assetContract,
                                secondPartialOffer.tokenId,
                                listing.listingCreator,
                                secondPartialOffer.quantity,
                                secondPartialOffer.totalPrice
                            );
                    });
                    it('Should revert if a partial offer is accepted and the other quantity is higher than the remaining quantity', async function () {
                        expect(await mockERC20.balanceOf(buyer.address)).to.be.equal(initialBuyerBalance);
                        expect(await mockERC20.balanceOf(seller.address)).to.be.equal(0);
                        expect(await mockERC20.balanceOf(marketplaceAddress)).to.be.equal(initialMarketplaceBalance);
                        expect(await mockERC1155.balanceOf(seller.address, listing.tokenId)).to.be.equal(
                            initialSftBalance
                        );
                        expect(await mockERC1155.balanceOf(buyer.address, listing.tokenId)).to.be.equal(0);

                        await expect(
                            directListingAddon
                                .connect(seller)
                                .acceptOfferForListing(listing.listingId, partialOffer.offerId)
                        )
                            .to.emit(directListingAddon, 'NewSale')
                            .withArgs(
                                listing.listingCreator,
                                listing.listingId,
                                listing.assetContract,
                                listing.tokenId,
                                partialOffer.offeror,
                                partialOffer.quantity,
                                partialOffer.totalPrice
                            )
                            .to.emit(directListingAddon, 'AcceptedOffer')
                            .withArgs(
                                partialOffer.offeror,
                                partialOffer.offerId,
                                partialOffer.assetContract,
                                partialOffer.tokenId,
                                listing.listingCreator,
                                partialOffer.quantity,
                                partialOffer.totalPrice
                            );

                        await expect(
                            directListingAddon.connect(seller).acceptOfferForListing(listing.listingId, offer.offerId)
                        ).to.be.revertedWith('Marketplace: invalid quantity.');
                    });
                });
            });
        });
    });
});
