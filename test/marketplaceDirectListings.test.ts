import { expect } from 'chai';
import { ethers } from 'hardhat';
import { DirectListingsLogic, Marketplace, MockERC1155, MockERC20 } from '../typechain-types';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { deployMarketplaceContracts } from './fixture/marketplaceContractsFixture';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { toWei } from './helpers/misc';
import { Listing, ListingParameters, Status, TokenType } from './helpers/types';
import { ONE_DAY } from './helpers/constants';

describe('Marketplace: Direct Listings', function () {
    let directListingsExtension: DirectListingsLogic;
    let marketplace: Marketplace;
    let mockERC20: MockERC20;
    let mockERC1155: MockERC1155;
    let deployer: SignerWithAddress;
    let seller: SignerWithAddress;

    let mockERC1155Address: string;
    let mockERC20Address: string;
    let marketplaceAddress: string;
    let blockTimestamp: number;

    const tokenId = 0;
    const sftBalance = toWei('1000');
    const totalPrice = toWei('10');
    const quantity = 1;

    beforeEach(async function () {
        [deployer, seller] = await ethers.getSigners();

        [marketplace, mockERC20, , mockERC1155] = await loadFixture(deployMarketplaceContracts);

        marketplaceAddress = await marketplace.getAddress();
        mockERC20Address = await mockERC20.getAddress();
        mockERC1155Address = await mockERC1155.getAddress();
        blockTimestamp = await time.latest();

        await mockERC1155.mint(seller.address, tokenId, sftBalance, '0x');
        await mockERC1155.connect(seller).setApprovalForAll(marketplaceAddress, true);

        directListingsExtension = await ethers.getContractAt('DirectListingsLogic', marketplaceAddress);
    });

    describe('Direct Listings', function () {
        describe('When Direct Listing exists', function () {
            let listing: Listing;
            let listingParams: ListingParameters;
            beforeEach(async function () {
                listingParams = {
                    assetContract: mockERC1155Address,
                    tokenId: tokenId,
                    quantity,
                    currency: mockERC20Address,
                    pricePerToken: totalPrice,
                    startTimestamp: blockTimestamp,
                    endTimestamp: blockTimestamp + ONE_DAY,
                    reserved: true,
                };
                const listingId = await directListingsExtension.connect(seller).createListing.staticCall(listingParams);
                const tx = await directListingsExtension.connect(seller).createListing(listingParams);
                const block = await tx.getBlock();
                const startTime = block.timestamp;
                listingParams.endTimestamp = startTime + (listingParams.endTimestamp - listingParams.startTimestamp);
                listingParams.startTimestamp = startTime;

                await directListingsExtension
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

            describe('View Functions', async function () {
                describe('getAllValidOffers', function () {
                    it('Should return all valid listings', async function () {
                        expect(await directListingsExtension.getAllValidListings(1, 1)).to.be.deep.equal([
                            Object.values(listing),
                        ]);
                    });
                });
            });
        });
    });
});
