import { ZeroAddress } from 'ethers';
import { ERC1155RoyaltiesSoulboundV2 } from '../../typechain-types';

const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');

describe('ERC1155RoyaltiesSoulboundV2', function () {
    async function deployFixtures() {
        const [devWallet, user1, user2] = await ethers.getSigners();

        const ERC1155RoyaltiesSoulboundV2Factory = await ethers.getContractFactory('ERC1155RoyaltiesSoulboundV2');
        const erc1155RoyaltiesSoulbound = (await upgrades.deployProxy(
            ERC1155RoyaltiesSoulboundV2Factory,
            [
                'G7Reward',
                'G7R',
                'https://example.com/token/',
                'https://example.com/contract/',
                1,
                false,
                devWallet.address,
            ],
            {
                initializer: 'initialize',
            }
        )) as ERC1155RoyaltiesSoulboundV2;

        return {
            erc1155RoyaltiesSoulbound,
            devWallet,
            user1,
            user2,
        };
    }

    describe('Initialization', function () {
        it('Should deploy successfully', async function () {
            const { erc1155RoyaltiesSoulbound } = await loadFixture(deployFixtures);
            expect(await erc1155RoyaltiesSoulbound.getAddress()).to.be.properAddress;
        });
        it('should set the correct name and symbol', async function () {
            const { erc1155RoyaltiesSoulbound } = await loadFixture(deployFixtures);
            expect(await erc1155RoyaltiesSoulbound.name()).to.equal('G7Reward');
            expect(await erc1155RoyaltiesSoulbound.symbol()).to.equal('G7R');
        });

        it('should set the correct contract URI', async function () {
            const { erc1155RoyaltiesSoulbound } = await loadFixture(deployFixtures);
            expect(await erc1155RoyaltiesSoulbound.contractURI()).to.equal('https://example.com/contract/');
        });
    });

    describe('Role management', function () {
        it('should grant the correct roles', async function () {
            const { erc1155RoyaltiesSoulbound, devWallet } = await loadFixture(deployFixtures);
            expect(
                await erc1155RoyaltiesSoulbound.hasRole(
                    await erc1155RoyaltiesSoulbound.DEFAULT_ADMIN_ROLE(),
                    devWallet.address
                )
            ).to.be.true;
            expect(
                await erc1155RoyaltiesSoulbound.hasRole(
                    await erc1155RoyaltiesSoulbound.MANAGER_ROLE(),
                    devWallet.address
                )
            ).to.be.true;
            expect(
                await erc1155RoyaltiesSoulbound.hasRole(
                    await erc1155RoyaltiesSoulbound.DEV_CONFIG_ROLE(),
                    devWallet.address
                )
            ).to.be.true;
            expect(
                await erc1155RoyaltiesSoulbound.hasRole(
                    await erc1155RoyaltiesSoulbound.MINTER_ROLE(),
                    devWallet.address
                )
            ).to.be.true;
        });
    });

    describe('Token management', function () {
        it('should add a new token', async function () {
            const { erc1155RoyaltiesSoulbound, devWallet } = await loadFixture(deployFixtures);
            await erc1155RoyaltiesSoulbound.connect(devWallet).addNewToken({
                tokenId: '1',
                tokenUri: 'https://example.com/contract/1',
                receiver: ZeroAddress,
                feeBasisPoints: 0,
            });
            expect(await erc1155RoyaltiesSoulbound.isTokenExist(1)).to.be.true;
        });

        it('should revert when querying a non-existent token', async function () {
            const { erc1155RoyaltiesSoulbound } = await loadFixture(deployFixtures);
            await expect(erc1155RoyaltiesSoulbound.isTokenExist(999)).to.be.revertedWithCustomError(
                erc1155RoyaltiesSoulbound,
                'TokenNotExist'
            );
        });
    });

    describe('Minting', function () {
        it('should mint a token', async function () {
            const { erc1155RoyaltiesSoulbound, devWallet, user1 } = await loadFixture(deployFixtures);
            await erc1155RoyaltiesSoulbound.connect(devWallet).addNewToken({
                tokenId: '1',
                tokenUri: 'https://example.com/contract/1',
                receiver: ZeroAddress,
                feeBasisPoints: 0,
            });
            await erc1155RoyaltiesSoulbound.connect(devWallet).adminMintId(user1.address, 1, 1, false);
            expect(await erc1155RoyaltiesSoulbound.balanceOf(user1.address, 1)).to.equal(1);
        });

        it('should mint a soulbound token', async function () {
            const { erc1155RoyaltiesSoulbound, devWallet, user1 } = await loadFixture(deployFixtures);
            await erc1155RoyaltiesSoulbound.connect(devWallet).addNewToken({
                tokenId: '1',
                tokenUri: 'https://example.com/contract/1',
                receiver: ZeroAddress,
                feeBasisPoints: 0,
            });
            await erc1155RoyaltiesSoulbound.connect(devWallet).adminMintId(user1.address, 1, 1, true);
            expect(await erc1155RoyaltiesSoulbound.balanceOf(user1.address, 1)).to.equal(1);

            await expect(
                erc1155RoyaltiesSoulbound.connect(user1).safeTransferFrom(user1.address, devWallet.address, 1, 1, '0x')
            ).to.be.revertedWith(
                'Achievo1155SoulboundUpgradeable: The amount of soulbounded tokens is more than the amount of tokens to be transferred'
            );
        });

        it('should batch mint tokens', async function () {
            const { erc1155RoyaltiesSoulbound, devWallet, user1 } = await loadFixture(deployFixtures);
            await erc1155RoyaltiesSoulbound.connect(devWallet).addNewToken({
                tokenId: '1',
                tokenUri: 'https://example.com/contract/1',
                receiver: ZeroAddress,
                feeBasisPoints: 0,
            });
            await erc1155RoyaltiesSoulbound.connect(devWallet).addNewToken({
                tokenId: '2',
                tokenUri: 'https://example.com/contract/1',
                receiver: ZeroAddress,
                feeBasisPoints: 0,
            });
            await erc1155RoyaltiesSoulbound
                .connect(devWallet)
                .adminBatchMintByIds(user1.address, [1, 2], [1, 2], false);
            expect(await erc1155RoyaltiesSoulbound.balanceOf(user1.address, 1)).to.equal(1);
            expect(await erc1155RoyaltiesSoulbound.balanceOf(user1.address, 2)).to.equal(2);
        });
    });

    describe('Token transfers', function () {
        it('should allow transfer of non-soulbound tokens', async function () {
            const { erc1155RoyaltiesSoulbound, devWallet, user1, user2 } = await loadFixture(deployFixtures);
            await erc1155RoyaltiesSoulbound.connect(devWallet).addNewToken({
                tokenId: '1',
                tokenUri: 'https://example.com/contract/1',
                receiver: ZeroAddress,
                feeBasisPoints: 0,
            });
            await erc1155RoyaltiesSoulbound.connect(devWallet).adminMintId(user1.address, 1, 20, false);
            await erc1155RoyaltiesSoulbound.connect(user1).safeTransferFrom(user1.address, user2.address, 1, 5, '0x');
            expect(await erc1155RoyaltiesSoulbound.balanceOf(user1.address, 1)).to.equal(15);
            expect(await erc1155RoyaltiesSoulbound.balanceOf(user2.address, 1)).to.equal(5);
        });

        it('should not allow transfer of soulbound tokens', async function () {
            const { erc1155RoyaltiesSoulbound, devWallet, user1, user2 } = await loadFixture(deployFixtures);
            await erc1155RoyaltiesSoulbound.connect(devWallet).addNewToken({
                tokenId: '1',
                tokenUri: 'https://example.com/contract/1',
                receiver: ZeroAddress,
                feeBasisPoints: 0,
            });
            await erc1155RoyaltiesSoulbound.connect(devWallet).adminMintId(user1.address, 1, 1, true);
            await expect(
                erc1155RoyaltiesSoulbound.connect(user1).safeTransferFrom(user1.address, user2.address, 1, 1, '0x')
            ).to.be.revertedWith(
                'Achievo1155SoulboundUpgradeable: The amount of soulbounded tokens is more than the amount of tokens to be transferred'
            );
        });
    });

    describe('Burning', function () {
        it('should allow burning of non-soulbound tokens', async function () {
            const { erc1155RoyaltiesSoulbound, devWallet, user1 } = await loadFixture(deployFixtures);
            await erc1155RoyaltiesSoulbound.connect(devWallet).addNewToken({
                tokenId: '1',
                tokenUri: 'https://example.com/contract/1',
                receiver: ZeroAddress,
                feeBasisPoints: 0,
            });
            await erc1155RoyaltiesSoulbound.connect(devWallet).adminMintId(user1.address, 1, 2, false);
            await erc1155RoyaltiesSoulbound.connect(user1).burn(user1.address, 1, 1);
            expect(await erc1155RoyaltiesSoulbound.balanceOf(user1.address, 1)).to.equal(1);
        });

        it('should not allow burning of soulbound tokens without being in the burn whitelist', async function () {
            const { erc1155RoyaltiesSoulbound, devWallet, user1 } = await loadFixture(deployFixtures);
            await erc1155RoyaltiesSoulbound.connect(devWallet).addNewToken({
                tokenId: '1',
                tokenUri: 'https://example.com/contract/1',
                receiver: ZeroAddress,
                feeBasisPoints: 0,
            });
            await erc1155RoyaltiesSoulbound.connect(devWallet).adminMintId(user1.address, 1, 1, true);
            await expect(erc1155RoyaltiesSoulbound.connect(user1).burn(user1.address, 1, 1)).to.be.revertedWith(
                'Achievo1155SoulboundUpgradeable: The amount of soulbounded tokens is more than the amount of tokens to be transferred'
            );
        });
    });

    describe('URI management', function () {
        it('should return the correct token URI', async function () {
            const { erc1155RoyaltiesSoulbound, devWallet } = await loadFixture(deployFixtures);
            await erc1155RoyaltiesSoulbound.connect(devWallet).addNewToken({
                tokenId: '1',
                tokenUri: 'https://example.com/contract/1',
                receiver: ZeroAddress,
                feeBasisPoints: 0,
            });
            expect(await erc1155RoyaltiesSoulbound.uri(1)).to.equal('https://example.com/contract/1');
        });

        it('should update the contract URI', async function () {
            const { erc1155RoyaltiesSoulbound, devWallet } = await loadFixture(deployFixtures);
            await erc1155RoyaltiesSoulbound.connect(devWallet).setContractURI('https://newexample.com/contract');
            expect(await erc1155RoyaltiesSoulbound.contractURI()).to.equal('https://newexample.com/contract');
        });
    });

    describe('Royalty management', function () {
        it('should set default royalty info', async function () {
            const { erc1155RoyaltiesSoulbound, devWallet, user1 } = await loadFixture(deployFixtures);
            await erc1155RoyaltiesSoulbound.connect(devWallet).setRoyaltyInfo(user1.address, 500); // 5%
            const [receiver, royaltyAmount] = await erc1155RoyaltiesSoulbound.royaltyInfo(1, 10000);
            expect(receiver).to.equal(user1.address);
            expect(royaltyAmount).to.equal(500);
        });

        it('should set token-specific royalty', async function () {
            const { erc1155RoyaltiesSoulbound, devWallet, user2 } = await loadFixture(deployFixtures);
            await erc1155RoyaltiesSoulbound.connect(devWallet).addNewToken({
                tokenId: '1',
                tokenUri: 'https://example.com/contract/1',
                receiver: ZeroAddress,
                feeBasisPoints: 0,
            });
            await erc1155RoyaltiesSoulbound.connect(devWallet).setTokenRoyalty(1, user2.address, 1000); // 10%
            const [receiver, royaltyAmount] = await erc1155RoyaltiesSoulbound.royaltyInfo(1, 10000);
            expect(receiver).to.equal(user2.address);
            expect(royaltyAmount).to.equal(1000);
        });

        it('should reset token-specific royalty', async function () {
            const { erc1155RoyaltiesSoulbound, devWallet, user2 } = await loadFixture(deployFixtures);
            await erc1155RoyaltiesSoulbound.connect(devWallet).addNewToken({
                tokenId: '1',
                tokenUri: 'https://example.com/contract/1',
                receiver: ZeroAddress,
                feeBasisPoints: 0,
            });
            await erc1155RoyaltiesSoulbound.connect(devWallet).setTokenRoyalty(1, user2.address, 1000);
            await erc1155RoyaltiesSoulbound.connect(devWallet).resetTokenRoyalty(1);
            const [receiver, royaltyAmount] = await erc1155RoyaltiesSoulbound.royaltyInfo(1, 10000);
            expect(receiver).to.equal(ethers.ZeroAddress);
            expect(royaltyAmount).to.equal(0);
        });
    });
});
