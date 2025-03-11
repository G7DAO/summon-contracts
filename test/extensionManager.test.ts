import hre from 'hardhat';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
    ExtensionManager,
    Marketplace,
    MockERC20,
    MockERC721,
    MockOffersLogicV2,
    OffersLogic,
} from '../typechain-types';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { deployMarketplaceContracts } from './fixture/marketplaceContractsFixture';
import { ExtensionAction } from '../helpers/extensions';
import { deployExtension, upgradeManagerExtensions } from '../deploy/upgrade-proxy';
import { TENANT } from '@constants/tenant';
import { CONTRACT_NAME } from '@constants/contract';
import { CONTRACTS } from '../constants/proxy-deployments';
import { Offer, OfferParams, Status, TokenType } from './helpers/types';
import { toWei } from './helpers/misc';
import { ONE_DAY } from './helpers/constants';

describe('ExtensionManager', function () {
    let marketplace: Marketplace;
    let extensionManager: ExtensionManager;
    let offersLogic: OffersLogic;
    let mockOffersLogicV2: MockOffersLogicV2;
    let mockERC20: MockERC20;
    let mockERC721: MockERC721;
    let deployer: SignerWithAddress;
    let seller: SignerWithAddress;
    let buyer: SignerWithAddress;

    let marketplaceAddress: string;
    let mockERC721Address: string;
    let mockERC20Address: string;
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

        extensionManager = await ethers.getContractAt('ExtensionManager', marketplaceAddress);
        mockOffersLogicV2 = await ethers.getContractAt('MockOffersLogicV2', marketplaceAddress);
        offersLogic = await ethers.getContractAt('OffersLogic', marketplaceAddress);
    });

    describe('Upgrades', function () {
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

        it('Should be able to replace extension and not change storage', async function () {
            expect(await offersLogic.totalOffers()).to.be.equal(1);
            expect(await offersLogic.getOffer(offer.offerId)).to.be.deep.equal(Object.values(offer));

            const proxyDeployment = CONTRACTS.find((d) => d.name === CONTRACT_NAME.Marketplace);
            const extension = proxyDeployment?.extensions.find((e) => e.name === CONTRACT_NAME.OffersExtension)!;
            extension.contractFileName = 'MockOffersLogicV2';
            extension.functionsToInclude = [...extension.functionsToInclude, 'version()'];
            extension.verify = false;
            const deployedExtension = await deployExtension(hre, extension, TENANT.Game7);
            await upgradeManagerExtensions(hre, marketplaceAddress, [deployedExtension], [ExtensionAction.REPLACE]);

            expect(await mockOffersLogicV2.version()).to.be.equal('upgraded to v2');
            expect(await offersLogic.totalOffers()).to.be.equal(1);
            expect(await offersLogic.getOffer(offer.offerId)).to.be.deep.equal(Object.values(offer));
        });
    });
});
