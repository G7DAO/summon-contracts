const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');

describe('AccessToken', function () {
    async function deployFixtures() {
        const [devWallet, minterWallet, user1, user2] = await ethers.getSigners();

        const AccessToken = await ethers.getContractFactory('AccessToken');
        const accessToken = await AccessToken.deploy(devWallet.address);
        await accessToken.waitForDeployment();

        await accessToken.initialize(
            'G7Reward',
            'G7R',
            'https://example.com/token/',
            'https://example.com/contract/',
            devWallet.address,
            minterWallet.address
        );

        return {
            accessToken,
            devWallet,
            minterWallet,
            user1,
            user2,
        };
    }

    describe('Initialization', function () {
        it('Should deploy successfully', async function () {
            const { accessToken } = await loadFixture(deployFixtures);
            expect(await accessToken.getAddress()).to.be.properAddress;
        });
        it('should set the correct name and symbol', async function () {
            const { accessToken } = await loadFixture(deployFixtures);
            expect(await accessToken.name()).to.equal('G7Reward');
            expect(await accessToken.symbol()).to.equal('G7R');
        });

        it('should set the correct default token URI', async function () {
            const { accessToken } = await loadFixture(deployFixtures);
            expect(await accessToken.defaultTokenURI()).to.equal('https://example.com/token/');
        });

        it('should set the correct contract URI', async function () {
            const { accessToken } = await loadFixture(deployFixtures);
            expect(await accessToken.contractURI()).to.equal('https://example.com/contract/');
        });
    });

    describe('Role management', function () {
        it('should grant the correct roles', async function () {
            const { accessToken, devWallet, minterWallet } = await loadFixture(deployFixtures);
            expect(await accessToken.hasRole(await accessToken.DEFAULT_ADMIN_ROLE(), devWallet.address)).to.be.true;
            expect(await accessToken.hasRole(await accessToken.MANAGER_ROLE(), devWallet.address)).to.be.true;
            expect(await accessToken.hasRole(await accessToken.DEV_CONFIG_ROLE(), devWallet.address)).to.be.true;
            expect(await accessToken.hasRole(await accessToken.DEV_CONFIG_ROLE(), minterWallet.address)).to.be.true;
            expect(await accessToken.hasRole(await accessToken.MINTER_ROLE(), minterWallet.address)).to.be.true;
        });
    });

    describe('Token management', function () {
        it('should add a new token', async function () {
            const { accessToken, devWallet } = await loadFixture(deployFixtures);
            await accessToken.connect(devWallet).addNewToken(1);
            expect(await accessToken.isTokenExist(1)).to.be.true;
        });

        it('should revert when querying a non-existent token', async function () {
            const { accessToken } = await loadFixture(deployFixtures);
            await expect(accessToken.isTokenExist(999)).to.be.revertedWith('TokenNotExist');
        });
    });

    describe('Minting', function () {
        it('should mint a token', async function () {
            const { accessToken, devWallet, minterWallet, user1 } = await loadFixture(deployFixtures);
            await accessToken.connect(devWallet).addNewToken(1);
            await accessToken.connect(minterWallet).adminMintId(user1.address, 1, 1, false);
            expect(await accessToken.balanceOf(user1.address, 1)).to.equal(1);
        });

        it('should mint a soulbound token', async function () {
            const { accessToken, devWallet, minterWallet, user1 } = await loadFixture(deployFixtures);
            await accessToken.connect(devWallet).addNewToken(1);
            await accessToken.connect(minterWallet).adminMintId(user1.address, 1, 1, true);
            expect(await accessToken.balanceOf(user1.address, 1)).to.equal(1);
            await expect(
                accessToken.connect(user1).safeTransferFrom(user1.address, devWallet.address, 1, 1, '0x')
            ).to.be.revertedWithCustomError(accessToken, 'SoulboundAmountError');
        });

        it('should batch mint tokens', async function () {
            const { accessToken, devWallet, minterWallet, user1, user2 } = await loadFixture(deployFixtures);
            await accessToken.connect(devWallet).addNewToken(1);
            await accessToken.connect(minterWallet).adminBatchMintId([user1.address, user2.address], 1, [1, 2], false);
            expect(await accessToken.balanceOf(user1.address, 1)).to.equal(1);
            expect(await accessToken.balanceOf(user2.address, 1)).to.equal(2);
        });
    });

    describe('Token transfers', function () {
        it('should allow transfer of non-soulbound tokens', async function () {
            const { accessToken, devWallet, minterWallet, user1, user2 } = await loadFixture(deployFixtures);
            await accessToken.connect(devWallet).addNewToken(1);
            await accessToken.connect(minterWallet).adminMintId(user1.address, 1, 20, false);
            await accessToken.connect(user1).safeTransferFrom(user1.address, user2.address, 1, 5, '0x');
            expect(await accessToken.balanceOf(user1.address, 1)).to.equal(15);
            expect(await accessToken.balanceOf(user2.address, 1)).to.equal(5);
        });

        it('should not allow transfer of soulbound tokens', async function () {
            const { accessToken, devWallet, minterWallet, user1, user2 } = await loadFixture(deployFixtures);
            await accessToken.connect(devWallet).addNewToken(1);
            await accessToken.connect(minterWallet).adminMintId(user1.address, 1, 1, true);
            await expect(
                accessToken.connect(user1).safeTransferFrom(user1.address, user2.address, 1, 1, '0x')
            ).to.be.revertedWithCustomError(accessToken, 'SoulboundAmountError');
        });
    });

    describe('Burning', function () {
        it('should allow burning of non-soulbound tokens', async function () {
            const { accessToken, devWallet, minterWallet, user1 } = await loadFixture(deployFixtures);
            await accessToken.connect(devWallet).addNewToken(1);
            await accessToken.connect(minterWallet).adminMintId(user1.address, 1, 2, false);
            await accessToken.connect(user1).burn(user1.address, 1, 1);
            expect(await accessToken.balanceOf(user1.address, 1)).to.equal(1);
        });

        it('should not allow burning of soulbound tokens without being in the burn whitelist', async function () {
            const { accessToken, devWallet, minterWallet, user1 } = await loadFixture(deployFixtures);
            await accessToken.connect(devWallet).addNewToken(1);
            await accessToken.connect(minterWallet).adminMintId(user1.address, 1, 1, true);
            await expect(accessToken.connect(user1).burn(user1.address, 1, 1)).to.be.revertedWithCustomError(
                accessToken,
                'SoulboundAmountError'
            );
        });

        it('should allow whitelisted address to burn tokens', async function () {
            const { accessToken, devWallet, minterWallet, user1 } = await loadFixture(deployFixtures);
            await accessToken.connect(devWallet).addNewToken(1);
            await accessToken.connect(minterWallet).adminMintId(user1.address, 1, 2, false);
            await accessToken.connect(devWallet).updateWhitelistAddress(devWallet.address, true);
            await accessToken.connect(devWallet).whitelistBurn(user1.address, 1, 1);
            expect(await accessToken.balanceOf(user1.address, 1)).to.equal(1);
        });
    });

    describe('URI management', function () {
        it('should return the correct token URI', async function () {
            const { accessToken, devWallet } = await loadFixture(deployFixtures);
            await accessToken.connect(devWallet).addNewToken(1);
            expect(await accessToken.uri(1)).to.equal('https://example.com/token/');
        });

        it('should update the default token URI', async function () {
            const { accessToken, devWallet } = await loadFixture(deployFixtures);
            await accessToken.connect(devWallet).updateDefaultTokenURI('https://newexample.com/token/');
            expect(await accessToken.defaultTokenURI()).to.equal('https://newexample.com/token/');
        });

        it('should update the contract URI', async function () {
            const { accessToken, devWallet } = await loadFixture(deployFixtures);
            await accessToken.connect(devWallet).setContractURI('https://newexample.com/contract');
            expect(await accessToken.contractURI()).to.equal('https://newexample.com/contract');
        });
    });

    describe('Royalty management', function () {
        it('should set default royalty info', async function () {
            const { accessToken, devWallet, user1 } = await loadFixture(deployFixtures);
            await accessToken.connect(devWallet).setRoyaltyInfo(user1.address, 500); // 5%
            const [receiver, royaltyAmount] = await accessToken.royaltyInfo(1, 10000);
            expect(receiver).to.equal(user1.address);
            expect(royaltyAmount).to.equal(500);
        });

        it('should set token-specific royalty', async function () {
            const { accessToken, devWallet, user2 } = await loadFixture(deployFixtures);
            await accessToken.connect(devWallet).addNewToken(1);
            await accessToken.connect(devWallet).setTokenRoyalty(1, user2.address, 1000); // 10%
            const [receiver, royaltyAmount] = await accessToken.royaltyInfo(1, 10000);
            expect(receiver).to.equal(user2.address);
            expect(royaltyAmount).to.equal(1000);
        });

        it('should reset token-specific royalty', async function () {
            const { accessToken, devWallet, user2 } = await loadFixture(deployFixtures);
            await accessToken.connect(devWallet).addNewToken(1);
            await accessToken.connect(devWallet).setTokenRoyalty(1, user2.address, 1000);
            await accessToken.connect(devWallet).resetTokenRoyalty(1);
            const [receiver, royaltyAmount] = await accessToken.royaltyInfo(1, 10000);
            expect(receiver).to.equal(ethers.ZeroAddress);
            expect(royaltyAmount).to.equal(0);
        });
    });
});
