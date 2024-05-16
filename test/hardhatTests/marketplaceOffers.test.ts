import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
    Marketplace,
    MockERC1155,
    MockERC20,
    MockERC721,
    MockRoyaltyEngineV1,
    OffersLogic,
    Permissions,
} from '../../typechain-types';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { deployMarketplaceContracts } from './fixture/marketplaceContractsFixture';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { toWei } from './helpers/misc';
import { Offer, OfferParams, Status, TokenType } from './helpers/types';
import { ONE_DAY } from './helpers/constants';
import { ASSET_ROLE } from './helpers/roles';
import { ZeroAddress } from 'ethers';

describe('Marketplace: Offers', function () {
    let offersLogic: OffersLogic;
    let marketplace: Marketplace;
    let permissions: Permissions;
    let mockRoyaltyEngineV1: MockRoyaltyEngineV1;
    let mockERC20: MockERC20;
    let mockERC721: MockERC721;
    let mockERC1155: MockERC1155;
    let deployer: SignerWithAddress;
    let seller: SignerWithAddress;
    let buyer: SignerWithAddress;
    let royaltyRecipient: SignerWithAddress;

    let mockERC721Address: string;
    let mockERC1155Address: string;
    let mockERC20Address: string;
    let marketplaceAddress: string;
    let blockTimestamp: number;

    const tokenId = 0;
    const buyerBalance = toWei('1000');
    const zeroBalance = BigInt(0);
    const sftBalance = toWei('1000');
    const totalPrice = toWei('10');
    const quantity = 1;
    const royaltyAmount = toWei('0.1');

    beforeEach(async function () {
        [deployer, buyer, seller, royaltyRecipient] = await ethers.getSigners();

        [marketplace, mockERC20, mockERC721, mockERC1155, mockRoyaltyEngineV1] = await loadFixture(
            deployMarketplaceContracts
        );

        marketplaceAddress = await marketplace.getAddress();
        mockERC20Address = await mockERC20.getAddress();
        mockERC721Address = await mockERC721.getAddress();
        mockERC1155Address = await mockERC1155.getAddress();
        blockTimestamp = await time.latest();

        await mockERC721.mint(seller.address);
        await mockERC721.connect(seller).setApprovalForAll(marketplaceAddress, true);

        await mockERC1155.mint(seller.address, tokenId, sftBalance, '0x');
        await mockERC1155.connect(seller).setApprovalForAll(marketplaceAddress, true);

        await mockERC20.mint(buyer.address, buyerBalance);
        await mockERC20.connect(buyer).approve(marketplaceAddress, buyerBalance);

        offersLogic = await ethers.getContractAt('OffersLogic', marketplaceAddress);
        permissions = await ethers.getContractAt('Permissions', marketplaceAddress);
    });

    describe('Offers', function () {
        describe('When Offers does not exist', function () {
            describe('Make Offer', function () {
                let offerParams: OfferParams;

                beforeEach(async function () {
                    offerParams = {
                        assetContract: mockERC721Address,
                        tokenId: tokenId,
                        quantity,
                        currency: mockERC20Address,
                        totalPrice,
                        expirationTimestamp: blockTimestamp + ONE_DAY,
                    };
                });

                it('Should makeOffer an offer for ERC721', async function () {
                    const offerId = await offersLogic.connect(buyer).makeOffer.staticCall(offerParams);
                    const offer: Offer = {
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
                    await expect(offersLogic.connect(buyer).makeOffer(offerParams))
                        .to.emit(offersLogic, 'NewOffer')
                        .withArgs(buyer.address, offerId, offerParams.assetContract, Object.values(offer));
                });
                it('Should makeOffer an offer for ERC1155', async function () {
                    offerParams.assetContract = mockERC1155Address;
                    offerParams.quantity = 2;
                    const offerId = await offersLogic.connect(buyer).makeOffer.staticCall(offerParams);
                    const offer: Offer = {
                        offerId: offerId,
                        tokenId: offerParams.tokenId,
                        quantity: offerParams.quantity,
                        totalPrice: offerParams.totalPrice,
                        expirationTimestamp: offerParams.expirationTimestamp,
                        offeror: buyer.address,
                        assetContract: offerParams.assetContract,
                        currency: offerParams.currency,
                        tokenType: TokenType.ERC1155,
                        status: Status.CREATED,
                    };
                    await expect(offersLogic.connect(buyer).makeOffer(offerParams))
                        .to.emit(offersLogic, 'NewOffer')
                        .withArgs(buyer.address, offerId, offerParams.assetContract, Object.values(offer));
                });
                it('Should revert if total price is 0', async function () {
                    offerParams.totalPrice = BigInt(0);
                    await expect(offersLogic.connect(buyer).makeOffer(offerParams)).to.be.revertedWith('zero price.');
                });
                it('Should revert if quantity is 0', async function () {
                    offerParams.quantity = 0;
                    await expect(offersLogic.connect(buyer).makeOffer(offerParams)).to.be.revertedWith(
                        'Marketplace: wanted zero tokens.'
                    );
                });
                it('Should revert if quantity is greater than 1 for ERC721', async function () {
                    offerParams.quantity = 2;
                    await expect(offersLogic.connect(buyer).makeOffer(offerParams)).to.be.revertedWith(
                        'Marketplace: wanted invalid quantity.'
                    );
                });
                it('Should revert if insufficient currency balance', async function () {
                    offerParams.totalPrice = buyerBalance + BigInt(1);
                    await expect(offersLogic.connect(buyer).makeOffer(offerParams)).to.be.revertedWith(
                        'Marketplace: insufficient currency balance.'
                    );
                });
                it(`Should revert if asset if assetContract does not have ASSET_ROLE(${ASSET_ROLE})`, async function () {
                    await permissions.revokeRole(ASSET_ROLE, ZeroAddress);
                    await expect(offersLogic.connect(buyer).makeOffer(offerParams)).to.be.revertedWith('!ASSET_ROLE');
                });
                it('Should revert if expiration timestamp is older than one hour', async function () {
                    offerParams.expirationTimestamp = blockTimestamp - ONE_DAY;
                    await expect(offersLogic.connect(buyer).makeOffer(offerParams)).to.be.revertedWith(
                        'Marketplace: invalid expiration timestamp.'
                    );
                });
                it('Should revert if token type is neither ERC1155 nor ERC721', async function () {
                    offerParams.assetContract = mockERC20Address;
                    await expect(offersLogic.connect(buyer).makeOffer(offerParams)).to.be.revertedWith(
                        'Marketplace: token must be ERC1155 or ERC721.'
                    );
                });
            });
        });
        describe('When Offers exists', function () {
            let offer: Offer;
            let offerParams: OfferParams;
            beforeEach(async function () {
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

            describe('Cancel Offer', function () {
                it('Should cancel an offer', async function () {
                    await expect(offersLogic.connect(buyer).cancelOffer(offer.offerId))
                        .to.emit(offersLogic, 'CancelledOffer')
                        .withArgs(buyer.address, offer.offerId);
                });
                it('Should revert if offer does not exist', async function () {
                    await expect(offersLogic.connect(buyer).cancelOffer(offer.offerId + BigInt(1))).to.be.revertedWith(
                        'Marketplace: invalid offer.'
                    );
                });
                it('Should revert if offeror is not the caller', async function () {
                    await expect(offersLogic.connect(seller).cancelOffer(offer.offerId)).to.be.revertedWith('!Offeror');
                });
            });

            describe('Accept Offer', function () {
                it('Should accept an offer for ERC721', async function () {
                    expect(await mockERC20.balanceOf(buyer.address)).to.equal(buyerBalance);
                    expect(await mockERC20.balanceOf(seller.address)).to.equal(zeroBalance);
                    expect(await mockERC721.ownerOf(tokenId)).to.equal(seller.address);

                    await expect(offersLogic.connect(seller).acceptOffer(offer.offerId))
                        .to.emit(offersLogic, 'AcceptedOffer')
                        .withArgs(
                            offer.offeror,
                            offer.offerId,
                            offer.assetContract,
                            offer.tokenId,
                            seller.address,
                            offer.quantity,
                            offer.totalPrice
                        );

                    expect(await mockERC20.balanceOf(buyer.address)).to.equal(buyerBalance - totalPrice);
                    expect(await mockERC20.balanceOf(seller.address)).to.equal(totalPrice);
                    expect(await mockERC721.ownerOf(tokenId)).to.equal(buyer.address);
                });
                it('Should accept an offer for ERC1155', async function () {
                    expect(await mockERC20.balanceOf(buyer.address)).to.equal(buyerBalance);
                    expect(await mockERC20.balanceOf(seller.address)).to.equal(zeroBalance);
                    expect(await mockERC1155.balanceOf(seller.address, tokenId)).to.equal(sftBalance);

                    offer.assetContract = mockERC1155Address;
                    offer.tokenType = TokenType.ERC1155;
                    offer.offerId = await offersLogic.connect(buyer).makeOffer.staticCall({
                        ...offerParams,
                        assetContract: mockERC1155Address,
                    });
                    await offersLogic.connect(buyer).makeOffer({ ...offerParams, assetContract: mockERC1155Address });
                    await expect(offersLogic.connect(seller).acceptOffer(offer.offerId))
                        .to.emit(offersLogic, 'AcceptedOffer')
                        .withArgs(
                            offer.offeror,
                            offer.offerId,
                            offer.assetContract,
                            offer.tokenId,
                            seller.address,
                            offer.quantity,
                            offer.totalPrice
                        );

                    expect(await mockERC20.balanceOf(buyer.address)).to.equal(buyerBalance - totalPrice);
                    expect(await mockERC20.balanceOf(seller.address)).to.equal(totalPrice);
                    expect(await mockERC1155.balanceOf(seller.address, tokenId)).to.equal(
                        sftBalance - BigInt(quantity)
                    );
                });
                it('Should accept an offer if royalty is set', async function () {
                    const recipients = [royaltyRecipient.address];
                    const amounts = [royaltyAmount];
                    await mockRoyaltyEngineV1.setRoyalty(recipients, amounts);

                    expect(await mockERC20.balanceOf(royaltyRecipient.address)).to.equal(zeroBalance);
                    expect(await mockERC20.balanceOf(buyer.address)).to.equal(buyerBalance);
                    expect(await mockERC20.balanceOf(seller.address)).to.equal(zeroBalance);
                    expect(await mockERC721.ownerOf(tokenId)).to.equal(seller.address);

                    await expect(offersLogic.connect(seller).acceptOffer(offer.offerId))
                        .to.emit(offersLogic, 'AcceptedOffer')
                        .withArgs(
                            offer.offeror,
                            offer.offerId,
                            offer.assetContract,
                            offer.tokenId,
                            seller.address,
                            offer.quantity,
                            offer.totalPrice
                        );

                    expect(await mockERC20.balanceOf(royaltyRecipient.address)).to.equal(royaltyAmount);
                    expect(await mockERC20.balanceOf(buyer.address)).to.equal(buyerBalance - totalPrice);
                    expect(await mockERC20.balanceOf(seller.address)).to.equal(totalPrice - royaltyAmount);
                    expect(await mockERC721.ownerOf(tokenId)).to.equal(buyer.address);
                });
                it('Should revert if royalty is set and royalty amount is greater than total price', async function () {
                    const recipients = [royaltyRecipient.address];
                    const amounts = [totalPrice + BigInt(1)];
                    await mockRoyaltyEngineV1.setRoyalty(recipients, amounts);

                    await expect(offersLogic.connect(seller).acceptOffer(offer.offerId)).to.be.revertedWith(
                        'fees exceed the price'
                    );
                });
                it('Should revert if offer does not exist', async function () {
                    await expect(offersLogic.connect(seller).acceptOffer(offer.offerId + BigInt(1))).to.be.revertedWith(
                        'Marketplace: invalid offer.'
                    );
                });
                it('Should revert if offer is expired', async function () {
                    await time.increase(offer.expirationTimestamp + 1);
                    await expect(offersLogic.connect(seller).acceptOffer(offer.offerId)).to.be.revertedWith('EXPIRED');
                });
                it('Should revert if offeror has insufficient currency balance', async function () {
                    await mockERC20.connect(buyer).transfer(seller.address, buyerBalance);
                    await expect(offersLogic.connect(seller).acceptOffer(offer.offerId)).to.be.revertedWith(
                        'Marketplace: insufficient currency balance.'
                    );
                });
                it('Should revert if marketplace is not approved to transfer asset', async function () {
                    await mockERC721.connect(seller).setApprovalForAll(marketplaceAddress, false);
                    await expect(offersLogic.connect(seller).acceptOffer(offer.offerId)).to.be.revertedWith(
                        'Marketplace: not owner or approved tokens.'
                    );
                });
                it('Should revert if seller does not have the asset', async function () {
                    await mockERC721.connect(seller).transferFrom(seller.address, buyer.address, tokenId);
                    await expect(offersLogic.connect(seller).acceptOffer(offer.offerId)).to.be.revertedWith(
                        'Marketplace: not owner or approved tokens.'
                    );
                });
            });

            describe('View Functions', async function () {
                describe('totalOffers', function () {
                    it('Should return total offers', async function () {
                        expect(await offersLogic.totalOffers()).to.be.equal(1);
                    });
                });
                describe('getOffer', function () {
                    it('Should return offer', async function () {
                        expect(await offersLogic.getOffer(offer.offerId)).to.be.deep.equal(Object.values(offer));
                    });
                });
                describe('getAllOffers', function () {
                    it('Should return all offers', async function () {
                        expect(await offersLogic.getAllOffers(1, 1)).to.be.deep.equal([Object.values(offer)]);
                    });
                    it('Should revert if start id is greater than total offers', async function () {
                        await expect(offersLogic.getAllOffers(1, 0)).to.be.revertedWith('invalid range');
                    });
                });
                describe('getAllValidOffers', function () {
                    it('Should return all valid offers', async function () {
                        expect(await offersLogic.getAllValidOffers(1, 1)).to.be.deep.equal([Object.values(offer)]);
                    });
                    it('Should revert if start id is greater than total offers', async function () {
                        await expect(offersLogic.getAllValidOffers(1, 0)).to.be.revertedWith('invalid range');
                    });
                });
            });
        });
    });
});
