import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
    EnglishAuctionsLogic,
    Marketplace,
    MockERC1155,
    MockERC20,
    MockERC721,
    MockRoyaltyEngineV1,
    Permissions,
} from '../../typechain-types';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { deployMarketplaceContracts } from './fixture/marketplaceContractsFixture';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Auction, AuctionParameters, Status, TokenType } from './helpers/types';
import { NATIVE_TOKEN, ONE_DAY, ONE_HOUR } from './helpers/constants';
import { ASSET_ROLE, LISTER_ROLE } from './helpers/roles';
import { ZeroAddress } from 'ethers';
import { toWei } from './helpers/misc';

describe('EnglishAuction', function () {
    let englishAuction: EnglishAuctionsLogic;
    let mockRoyaltyEngineV1: MockRoyaltyEngineV1;
    let permissions: Permissions;
    let marketplace: Marketplace;
    let mockERC20: MockERC20;
    let mockERC721: MockERC721;
    let mockERC1155: MockERC1155;
    let deployer: SignerWithAddress;
    let lister: SignerWithAddress;
    let bidder: SignerWithAddress;
    let royaltyRecipient: SignerWithAddress;

    const tokenId = 0;
    const bidderBalance = toWei('1000');
    const zeroBalance = BigInt(0);

    beforeEach(async function () {
        [deployer, lister, bidder, royaltyRecipient] = await ethers.getSigners();

        [marketplace, mockERC20, mockERC721, mockERC1155, mockRoyaltyEngineV1] = await loadFixture(
            deployMarketplaceContracts
        );
        const marketplaceAddress = await marketplace.getAddress();

        await mockERC721.mint(lister.address);
        await mockERC721.connect(lister).setApprovalForAll(marketplaceAddress, true);

        await mockERC1155.mint(lister.address, tokenId, 1000, '0x');
        await mockERC1155.connect(lister).setApprovalForAll(marketplaceAddress, true);

        await mockERC20.mint(bidder.address, bidderBalance);
        await mockERC20.connect(bidder).approve(marketplaceAddress, bidderBalance);

        englishAuction = await ethers.getContractAt('EnglishAuctionsLogic', marketplaceAddress);
        permissions = await ethers.getContractAt('Permissions', marketplaceAddress);
    });

    describe('Auctions', function () {
        describe('When Auction does not exist', function () {
            let auctionParameters: AuctionParameters;
            beforeEach(async function () {
                const blockTimestamp = await time.latest();
                auctionParameters = {
                    assetContract: await mockERC721.getAddress(),
                    tokenId,
                    quantity: 1,
                    currency: await mockERC20.getAddress(),
                    minimumBidAmount: toWei('1'),
                    buyoutBidAmount: toWei('10'),
                    timeBufferInSeconds: 60,
                    bidBufferBps: 1000,
                    startTimestamp: blockTimestamp,
                    endTimestamp: blockTimestamp + ONE_DAY,
                };
            });
            describe('Create Auction', function () {
                it('Should create an Auction with ERC721 token', async function () {
                    expect(await mockERC721.ownerOf(tokenId)).to.be.equal(lister.address);
                    await expect(englishAuction.connect(lister).createAuction(auctionParameters)).to.emit(
                        englishAuction,
                        'NewAuction'
                    );
                    expect(await mockERC721.ownerOf(tokenId)).to.be.equal(await englishAuction.getAddress());
                });
                it('Should create an Auction with ERC1155 token', async function () {
                    auctionParameters.assetContract = await mockERC1155.getAddress();
                    await expect(
                        englishAuction.connect(lister).createAuction({
                            ...auctionParameters,
                            quantity: 10,
                        })
                    ).to.emit(englishAuction, 'NewAuction');
                });
                it('Should create an Auction if buyoutBidAmount is 0', async function () {
                    auctionParameters.buyoutBidAmount = BigInt(0);
                    await expect(englishAuction.connect(lister).createAuction(auctionParameters)).to.emit(
                        englishAuction,
                        'NewAuction'
                    );
                });
                it('Should NOT create an Auction if token type is neither ERC1155 nor ERC721', async function () {
                    auctionParameters.assetContract = await mockERC20.getAddress();
                    await expect(englishAuction.connect(lister).createAuction(auctionParameters)).to.be.revertedWith(
                        'Marketplace: auctioned token must be ERC1155 or ERC721.'
                    );
                });
                it(`Should NOT create an Auction if caller does not have LISTER_ROLE(${LISTER_ROLE})`, async function () {
                    await permissions.revokeRole(LISTER_ROLE, ZeroAddress);
                    await expect(englishAuction.connect(lister).createAuction(auctionParameters)).to.be.revertedWith(
                        '!LISTER_ROLE'
                    );
                });
                it(`Should NOT create an Auction if assetContract does not have ASSET_ROLE(${ASSET_ROLE})`, async function () {
                    await permissions.revokeRole(ASSET_ROLE, ZeroAddress);
                    await expect(englishAuction.connect(lister).createAuction(auctionParameters)).to.be.revertedWith(
                        '!ASSET_ROLE'
                    );
                });
                it('Should NOT create an Auction if quantity is 0', async function () {
                    auctionParameters.quantity = 0;
                    await expect(englishAuction.connect(lister).createAuction(auctionParameters)).to.be.revertedWith(
                        'Marketplace: auctioning zero quantity.'
                    );
                });
                it('Should NOT create an Auction if quantity is greater than 1 and nft type is ERC721', async function () {
                    auctionParameters.quantity = 2;
                    await expect(englishAuction.connect(lister).createAuction(auctionParameters)).to.be.revertedWith(
                        'Marketplace: auctioning invalid quantity.'
                    );
                });
                it('Should NOT create an Auction if timeBufferInSeconds is 0', async function () {
                    auctionParameters.timeBufferInSeconds = 0;
                    await expect(englishAuction.connect(lister).createAuction(auctionParameters)).to.be.revertedWith(
                        'Marketplace: no time-buffer.'
                    );
                });
                it('Should NOT create an Auction if bidBufferBps is 0', async function () {
                    auctionParameters.bidBufferBps = 0;
                    await expect(englishAuction.connect(lister).createAuction(auctionParameters)).to.be.revertedWith(
                        'Marketplace: no bid-buffer.'
                    );
                });
                it('Should NOT create an Auction if startTimestamp is older than one hour', async function () {
                    auctionParameters.startTimestamp = (await time.latest()) - ONE_HOUR;
                    await expect(englishAuction.connect(lister).createAuction(auctionParameters)).to.be.revertedWith(
                        'Marketplace: invalid timestamps.'
                    );
                });
                it('Should NOT create an Auction if endTimestamp is higher than startTimestamp', async function () {
                    auctionParameters.endTimestamp = auctionParameters.startTimestamp - ONE_HOUR;
                    await expect(englishAuction.connect(lister).createAuction(auctionParameters)).to.be.revertedWith(
                        'Marketplace: invalid timestamps.'
                    );
                });
                it('Should NOT create an Auction if buyoutBidAmount is less than minimumBidAmount', async function () {
                    auctionParameters.buyoutBidAmount = toWei('0.5');
                    await expect(englishAuction.connect(lister).createAuction(auctionParameters)).to.be.revertedWith(
                        'Marketplace: invalid bid amounts.'
                    );
                });
            });
        });
        describe('When Auction exists', function () {
            let auction: Auction;
            let auctionParameters: AuctionParameters;
            beforeEach(async function () {
                const blockTimestamp = await time.latest();
                auctionParameters = {
                    assetContract: await mockERC721.getAddress(),
                    tokenId,
                    quantity: 1,
                    currency: await mockERC20.getAddress(),
                    minimumBidAmount: toWei('1'),
                    buyoutBidAmount: toWei('10'),
                    timeBufferInSeconds: 60,
                    bidBufferBps: 1000,
                    startTimestamp: blockTimestamp,
                    endTimestamp: blockTimestamp + ONE_DAY,
                };
                const auctionId = await englishAuction.connect(lister).createAuction.staticCall(auctionParameters);
                await englishAuction.connect(lister).createAuction(auctionParameters);

                auction = {
                    auctionId,
                    tokenId: auctionParameters.tokenId,
                    quantity: auctionParameters.quantity,
                    minimumBidAmount: auctionParameters.minimumBidAmount,
                    buyoutBidAmount: auctionParameters.buyoutBidAmount,
                    timeBufferInSeconds: auctionParameters.timeBufferInSeconds,
                    bidBufferBps: auctionParameters.bidBufferBps,
                    startTimestamp: auctionParameters.startTimestamp,
                    endTimestamp: auctionParameters.endTimestamp,
                    auctionCreator: lister.address,
                    assetContract: auctionParameters.assetContract,
                    currency: auctionParameters.currency,
                    tokenType: TokenType.ERC721,
                    status: Status.CREATED,
                };
            });

            describe('View Functions', function () {
                describe('getAuction', function () {
                    it('Should get Auction details', async function () {
                        expect(await englishAuction.getAuction(auction.auctionId)).to.be.deep.equal(
                            Object.values(auction)
                        );
                    });
                });
                describe('getAllAuctions', function () {
                    it('Should get all Auctions', async function () {
                        expect(await englishAuction.getAllAuctions(1, 1)).to.be.deep.equal([Object.values(auction)]);
                    });
                    it('Should NOT get all Auctions if start index is greater than end index', async function () {
                        await expect(englishAuction.getAllAuctions(1, 0)).to.be.revertedWith('invalid range');
                    });
                    it('Should NOT get all Auctions if start index is greater than total auctions', async function () {
                        await expect(englishAuction.getAllAuctions(0, 2)).to.be.revertedWith('invalid range');
                    });
                });
                describe('getAllValidAuctions', function () {
                    it('Should get all valid Auctions', async function () {
                        expect(await englishAuction.getAllValidAuctions(1, 1)).to.be.deep.equal([
                            Object.values(auction),
                        ]);
                    });
                    it('Should NOT get all valid Auctions if start index is greater than end index', async function () {
                        await expect(englishAuction.getAllValidAuctions(1, 0)).to.be.revertedWith('invalid range');
                    });
                    it('Should NOT get all valid Auctions if start index is greater than total auctions', async function () {
                        await expect(englishAuction.getAllValidAuctions(0, 2)).to.be.revertedWith('invalid range');
                    });
                    it('Should return empty array if no valid auctions', async function () {
                        const timeToIncrease = auction.endTimestamp - (await time.latest());
                        await time.increase(timeToIncrease);
                        expect(await englishAuction.getAllValidAuctions(0, 0)).to.be.deep.equal([]);
                    });
                });
                describe('isAuctionExpired', function () {
                    it('Should return true if Auction is expired', async function () {
                        const timeToIncrease = auction.endTimestamp - (await time.latest()) + 1;
                        await time.increase(timeToIncrease);
                        expect(await englishAuction.isAuctionExpired(auction.auctionId)).to.be.true;
                    });
                    it('Should return false if Auction is not expired', async function () {
                        expect(await englishAuction.isAuctionExpired(auction.auctionId)).to.be.false;
                    });
                    it('Should return false if Auction does not exist', async function () {
                        await expect(englishAuction.isAuctionExpired(10)).to.be.revertedWith(
                            'Marketplace: invalid auction.'
                        );
                    });
                });
                describe('totalAuctions', function () {
                    it('Should return total auctions', async function () {
                        expect(await englishAuction.totalAuctions()).to.be.equal(1);
                    });
                });
            });

            describe('Cancel Auction', function () {
                it('Should cancel an Auction', async function () {
                    expect(await mockERC721.ownerOf(tokenId)).to.be.equal(await englishAuction.getAddress());
                    await expect(englishAuction.connect(lister).cancelAuction(auction.auctionId))
                        .to.emit(englishAuction, 'CancelledAuction')
                        .withArgs(auction.auctionCreator, auction.auctionId);
                    expect(await mockERC721.ownerOf(tokenId)).to.be.equal(lister.address);
                });
                it('Should NOT cancel an Auction if Auction does not exist', async function () {
                    await expect(englishAuction.connect(lister).cancelAuction(10)).to.be.revertedWith(
                        'Marketplace: invalid auction.'
                    );
                    await expect(englishAuction.isNewWinningBid(10, toWei('1'))).to.be.revertedWith(
                        'Marketplace: invalid auction.'
                    );
                });
                it('Should NOT cancel an Auction if caller is not the auction creator', async function () {
                    await expect(englishAuction.connect(bidder).cancelAuction(auction.auctionId)).to.be.revertedWith(
                        'Marketplace: not auction creator.'
                    );
                });
                it('Should NOT cancel an Auction if bids have been placed', async function () {
                    await englishAuction.connect(bidder).bidInAuction(auction.auctionId, toWei('1'));
                    await expect(englishAuction.connect(lister).cancelAuction(auction.auctionId)).to.be.revertedWith(
                        'Marketplace: bids already made.'
                    );
                });
            });

            describe('Bid In Auction', function () {
                it('Should bid in an Auction', async function () {
                    const winningBid = toWei('1');
                    expect(await englishAuction.isNewWinningBid(auction.auctionId, winningBid)).to.be.true;
                    expect(await mockERC20.balanceOf(bidder.address)).to.be.equal(bidderBalance);
                    expect(await mockERC20.balanceOf(await englishAuction.getAddress())).to.be.equal(0);
                    await expect(englishAuction.connect(bidder).bidInAuction(auction.auctionId, winningBid)).to.emit(
                        englishAuction,
                        'NewBid'
                    );
                    expect(await mockERC20.balanceOf(bidder.address)).to.be.equal(bidderBalance - winningBid);
                    expect(await mockERC20.balanceOf(await englishAuction.getAddress())).to.be.equal(winningBid);
                    expect(await englishAuction.getWinningBid(auction.auctionId)).to.be.deep.equal([
                        bidder.address,
                        auction.currency,
                        winningBid,
                    ]);
                });
                it('Should bid in an Auction and update auction endTimestamp if blockTimestamp and endTimestamp difference is less than timeBufferInSeconds', async function () {
                    const winningBid = toWei('1');
                    const timeToIncrease = auction.endTimestamp - (await time.latest());
                    await time.increase(timeToIncrease - auction.timeBufferInSeconds);
                    await expect(englishAuction.connect(bidder).bidInAuction(auction.auctionId, winningBid)).to.emit(
                        englishAuction,
                        'NewBid'
                    );

                    const updatedAuction = {
                        ...auction,
                        endTimestamp: auction.endTimestamp + auction.timeBufferInSeconds,
                    };
                    expect(await englishAuction.getAuction(auction.auctionId)).to.be.deep.equal(
                        Object.values(updatedAuction)
                    );
                });
                it('Should bid in an Auction with NATIVE TOKEN', async function () {
                    auctionParameters.currency = NATIVE_TOKEN;
                    auctionParameters.assetContract = await mockERC1155.getAddress();
                    const newAuctionId = await englishAuction
                        .connect(lister)
                        .createAuction.staticCall(auctionParameters);
                    await englishAuction.connect(lister).createAuction(auctionParameters);
                    await expect(
                        englishAuction.connect(bidder).bidInAuction(newAuctionId, toWei('2'), { value: toWei('2') })
                    ).to.emit(englishAuction, 'NewBid');
                });
                it('Should bid in an Auction if buyoutBidAmount is 0', async function () {
                    auctionParameters.buyoutBidAmount = BigInt(0);
                    auctionParameters.assetContract = await mockERC1155.getAddress();
                    const newAuctionId = await englishAuction
                        .connect(lister)
                        .createAuction.staticCall(auctionParameters);
                    await englishAuction.connect(lister).createAuction(auctionParameters);
                    await expect(englishAuction.connect(bidder).bidInAuction(newAuctionId, toWei('2'))).to.emit(
                        englishAuction,
                        'NewBid'
                    );
                });
                it('Should NOT bid in an Auction with not NATIVE TOKEN and msg.value is different than 0', async function () {
                    auctionParameters.assetContract = await mockERC1155.getAddress();
                    const newAuctionId = await englishAuction
                        .connect(lister)
                        .createAuction.staticCall(auctionParameters);
                    await englishAuction.connect(lister).createAuction(auctionParameters);
                    await expect(
                        englishAuction.connect(bidder).bidInAuction(newAuctionId, toWei('2'), { value: toWei('2') })
                    ).to.be.revertedWith('Marketplace: invalid native tokens sent.');
                });
                it('Should NOT bid in an Auction if Auction does not exist', async function () {
                    await expect(englishAuction.connect(bidder).bidInAuction(10, toWei('1'))).to.be.revertedWith(
                        'Marketplace: invalid auction.'
                    );
                    await expect(englishAuction.isNewWinningBid(10, toWei('1'))).to.be.revertedWith(
                        'Marketplace: invalid auction.'
                    );
                });
                it('Should NOT bid in an Auction if endTimestamp is in the past', async function () {
                    await time.increase(ONE_DAY);
                    await expect(
                        englishAuction.connect(bidder).bidInAuction(auction.auctionId, toWei('1'))
                    ).to.be.revertedWith('Marketplace: inactive auction.');
                });
                it('Should NOT bid in an Auction if bid amount is 0', async function () {
                    await expect(
                        englishAuction.connect(bidder).bidInAuction(auction.auctionId, '0')
                    ).to.be.revertedWith('Marketplace: Bidding with zero amount.');
                });
                it('Should NOT bid in an Auction if bid amount is higher than buyoutBidAmount', async function () {
                    await expect(
                        englishAuction.connect(bidder).bidInAuction(auction.auctionId, toWei('11'))
                    ).to.be.revertedWith('Marketplace: Bidding above buyout price.');
                });
                it('Should NOT bid in an Auction if bid amount is not new winning bid', async function () {
                    await englishAuction.connect(bidder).bidInAuction(auction.auctionId, toWei('1'));
                    await expect(
                        englishAuction.connect(bidder).bidInAuction(auction.auctionId, toWei('1'))
                    ).to.be.revertedWith('Marketplace: not winning bid.');
                });
            });

            describe('Collect Auction Payout', function () {
                describe('When Auction has bids', function () {
                    let winningBid: bigint;
                    beforeEach(async function () {
                        winningBid = toWei('1');
                        await englishAuction.connect(bidder).bidInAuction(auction.auctionId, winningBid);
                    });
                    describe('When Auction is closed', function () {
                        beforeEach(async function () {
                            const timeToIncrease = auction.endTimestamp - (await time.latest());
                            await time.increase(timeToIncrease);
                        });
                        it('Should collect Auction payout', async function () {
                            expect(await mockERC20.balanceOf(lister.address)).to.be.equal(zeroBalance);
                            await expect(englishAuction.connect(lister).collectAuctionPayout(auction.auctionId))
                                .to.emit(englishAuction, 'AuctionClosed')
                                .withArgs(
                                    auction.auctionId,
                                    auction.assetContract,
                                    lister.address,
                                    auction.tokenId,
                                    auction.auctionCreator,
                                    bidder.address
                                );
                            expect(await mockERC20.balanceOf(lister.address)).to.be.equal(winningBid);
                        });
                        it('Should collect Auction payout after collecting Auction tokens', async function () {
                            await englishAuction.connect(lister).collectAuctionTokens(auction.auctionId);
                            await expect(englishAuction.connect(lister).collectAuctionPayout(auction.auctionId))
                                .to.emit(englishAuction, 'AuctionClosed')
                                .withArgs(
                                    auction.auctionId,
                                    auction.assetContract,
                                    lister.address,
                                    auction.tokenId,
                                    auction.auctionCreator,
                                    bidder.address
                                );
                        });
                        it('Should collect Auction payout if royalty is set', async function () {
                            const recipients = [royaltyRecipient.address];
                            const amounts = [toWei('0.1')];
                            await mockRoyaltyEngineV1.setRoyalty(recipients, amounts);
                            await expect(englishAuction.connect(lister).collectAuctionPayout(auction.auctionId))
                                .to.emit(englishAuction, 'AuctionClosed')
                                .withArgs(
                                    auction.auctionId,
                                    auction.assetContract,
                                    lister.address,
                                    auction.tokenId,
                                    auction.auctionCreator,
                                    bidder.address
                                );
                        });
                        it('Should NOT collect Auction payout if royalty is set and royalty amount is higher than payout', async function () {
                            const recipients = [royaltyRecipient.address];
                            const amounts = [toWei('1.1')];
                            await mockRoyaltyEngineV1.setRoyalty(recipients, amounts);
                            await expect(
                                englishAuction.connect(lister).collectAuctionPayout(auction.auctionId)
                            ).to.be.revertedWith('fees exceed the price');
                        });
                        it('Should NOT collect Auction payout twice', async function () {
                            await englishAuction.connect(lister).collectAuctionPayout(auction.auctionId);
                            await expect(
                                englishAuction.connect(lister).collectAuctionPayout(auction.auctionId)
                            ).to.be.revertedWith('Marketplace: payout already completed.');
                        });
                    });
                    describe('When Auction is not closed', function () {
                        it('Should collect Auction payout if Auction has buyoutBidAmount', async function () {
                            expect(await mockERC20.balanceOf(lister.address)).to.be.equal(zeroBalance);
                            expect(await mockERC20.balanceOf(bidder.address)).to.be.equal(bidderBalance - winningBid);
                            await englishAuction
                                .connect(bidder)
                                .bidInAuction(auction.auctionId, auction.buyoutBidAmount);
                            expect(await mockERC20.balanceOf(bidder.address)).to.be.equal(
                                bidderBalance - auction.buyoutBidAmount
                            ); // 1 wei from previous winning bid is refunded
                            expect(await mockERC20.balanceOf(await englishAuction.getAddress())).to.be.equal(
                                auction.buyoutBidAmount
                            );
                            await expect(englishAuction.connect(lister).collectAuctionPayout(auction.auctionId))
                                .to.emit(englishAuction, 'AuctionClosed')
                                .withArgs(
                                    auction.auctionId,
                                    auction.assetContract,
                                    lister.address,
                                    auction.tokenId,
                                    auction.auctionCreator,
                                    bidder.address
                                );
                            expect(await mockERC20.balanceOf(lister.address)).to.be.equal(auction.buyoutBidAmount);
                            expect(await mockERC20.balanceOf(bidder.address)).to.be.equal(
                                bidderBalance - auction.buyoutBidAmount
                            );
                            expect(await mockERC20.balanceOf(await englishAuction.getAddress())).to.be.equal(
                                zeroBalance
                            );
                        });
                    });
                });
                describe('When Auction has no bids', function () {
                    describe('When Auction is not closed', function () {
                        it('Should NOT collect Auction payout', async function () {
                            const timeToIncrease = auction.endTimestamp - (await time.latest());
                            await time.increase(timeToIncrease);
                            await expect(
                                englishAuction.connect(bidder).collectAuctionPayout(auction.auctionId)
                            ).to.be.revertedWith('Marketplace: no bids were made.');
                        });

                        it('Should NOT collect Auction payout', async function () {
                            await expect(
                                englishAuction.connect(bidder).collectAuctionPayout(auction.auctionId)
                            ).to.be.revertedWith('Marketplace: auction still active.');
                        });

                        it('Should NOT collect Auction payout if Auction is cancelled', async function () {
                            await englishAuction.connect(lister).cancelAuction(auction.auctionId);
                            await expect(
                                englishAuction.connect(bidder).collectAuctionPayout(auction.auctionId)
                            ).to.be.revertedWith('Marketplace: invalid auction.');
                        });
                    });
                });
            });

            describe('Collect Auction Tokens', function () {
                describe('When Auction is closed', function () {
                    beforeEach(async function () {
                        await englishAuction.connect(bidder).bidInAuction(auction.auctionId, toWei('1'));
                        const timeToIncrease = auction.endTimestamp - (await time.latest());
                        await time.increase(timeToIncrease);
                    });
                    it('Should collect Auction tokens', async function () {
                        expect(await mockERC721.ownerOf(tokenId)).to.be.equal(await englishAuction.getAddress());
                        await expect(englishAuction.connect(bidder).collectAuctionTokens(auction.auctionId))
                            .to.emit(englishAuction, 'AuctionClosed')
                            .withArgs(
                                auction.auctionId,
                                auction.assetContract,
                                bidder.address,
                                auction.tokenId,
                                auction.auctionCreator,
                                bidder.address
                            );
                        expect(await mockERC721.ownerOf(tokenId)).to.be.equal(bidder.address);
                    });
                    it('Should collect Auction tokens after collecting Auction payout', async function () {
                        await englishAuction.connect(bidder).collectAuctionPayout(auction.auctionId);
                        await expect(englishAuction.connect(bidder).collectAuctionTokens(auction.auctionId))
                            .to.emit(englishAuction, 'AuctionClosed')
                            .withArgs(
                                auction.auctionId,
                                auction.assetContract,
                                bidder.address,
                                auction.tokenId,
                                auction.auctionCreator,
                                bidder.address
                            );
                    });
                    it('Should NOT collect Auction tokens twice', async function () {
                        await englishAuction.connect(bidder).collectAuctionTokens(auction.auctionId);
                        await expect(
                            englishAuction.connect(bidder).collectAuctionTokens(auction.auctionId)
                        ).to.be.revertedWith('Marketplace: payout already completed.');
                    });
                });
                describe('When Auction is not closed', function () {
                    it('Should NOT collect Auction tokens if Auction is cancelled', async function () {
                        await englishAuction.connect(lister).cancelAuction(auction.auctionId);
                        await expect(
                            englishAuction.connect(bidder).collectAuctionTokens(auction.auctionId)
                        ).to.be.revertedWith('Marketplace: invalid auction.');
                    });
                    it('Should NOT collect Auction tokens if Auction is active', async function () {
                        await expect(
                            englishAuction.connect(bidder).collectAuctionTokens(auction.auctionId)
                        ).to.be.revertedWith('Marketplace: auction still active.');
                    });
                    it('Should NOT collect Auction tokens if Auction has no bids', async function () {
                        await time.increase(ONE_DAY);
                        await expect(
                            englishAuction.connect(bidder).collectAuctionTokens(auction.auctionId)
                        ).to.be.revertedWith('Marketplace: no bids were made.');
                    });
                });
            });
        });
    });
});
