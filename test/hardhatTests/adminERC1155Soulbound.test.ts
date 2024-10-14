const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');

describe('AdminERC1155Soulbound', function () {
    async function deployFixtures() {
        const [devWallet, minterWallet, user1, user2] = await ethers.getSigners();

        const AdminERC1155Soulbound = await ethers.getContractFactory('AdminERC1155Soulbound');
        const adminERC1155Soulbound = await AdminERC1155Soulbound.deploy(devWallet.address);
        await adminERC1155Soulbound.waitForDeployment();

        await adminERC1155Soulbound.initialize(
            'G7Reward',
            'G7R',
            'https://example.com/token/',
            'https://example.com/contract/',
            devWallet.address,
            minterWallet.address
        );

        return {
            adminERC1155Soulbound,
            devWallet,
            minterWallet,
            user1,
            user2,
        };
    }

    describe('Initialization', function () {
        it('Should deploy successfully', async function () {
            const { adminERC1155Soulbound } = await loadFixture(deployFixtures);
            expect(await adminERC1155Soulbound.getAddress()).to.be.properAddress;
        });
        it('should set the correct name and symbol', async function () {
            const { adminERC1155Soulbound } = await loadFixture(deployFixtures);
            expect(await adminERC1155Soulbound.name()).to.equal('G7Reward');
            expect(await adminERC1155Soulbound.symbol()).to.equal('G7R');
        });

        it('should set the correct default token URI', async function () {
            const { adminERC1155Soulbound } = await loadFixture(deployFixtures);
            expect(await adminERC1155Soulbound.defaultTokenURI()).to.equal('https://example.com/token/');
        });

        it('should set the correct contract URI', async function () {
            const { adminERC1155Soulbound } = await loadFixture(deployFixtures);
            expect(await adminERC1155Soulbound.contractURI()).to.equal('https://example.com/contract/');
        });
    });

    describe('Role management', function () {
        it('should grant the correct roles', async function () {
            const { adminERC1155Soulbound, devWallet, minterWallet } = await loadFixture(deployFixtures);
            expect(
                await adminERC1155Soulbound.hasRole(await adminERC1155Soulbound.DEFAULT_ADMIN_ROLE(), devWallet.address)
            ).to.be.true;
            expect(await adminERC1155Soulbound.hasRole(await adminERC1155Soulbound.MANAGER_ROLE(), devWallet.address))
                .to.be.true;
            expect(
                await adminERC1155Soulbound.hasRole(await adminERC1155Soulbound.DEV_CONFIG_ROLE(), devWallet.address)
            ).to.be.true;
            expect(
                await adminERC1155Soulbound.hasRole(await adminERC1155Soulbound.DEV_CONFIG_ROLE(), minterWallet.address)
            ).to.be.true;
            expect(await adminERC1155Soulbound.hasRole(await adminERC1155Soulbound.MINTER_ROLE(), minterWallet.address))
                .to.be.true;
        });
    });

    describe('Token management', function () {
        it('should add a new token', async function () {
            const { adminERC1155Soulbound, devWallet } = await loadFixture(deployFixtures);
            await adminERC1155Soulbound.connect(devWallet).addNewToken(1);
            expect(await adminERC1155Soulbound.isTokenExist(1)).to.be.true;
        });

        it('should revert when querying a non-existent token', async function () {
            const { adminERC1155Soulbound } = await loadFixture(deployFixtures);
            await expect(adminERC1155Soulbound.isTokenExist(999)).to.be.revertedWith('TokenNotExist');
        });
    });

    describe('Minting', function () {
        it('should mint a token', async function () {
            const { adminERC1155Soulbound, devWallet, minterWallet, user1 } = await loadFixture(deployFixtures);
            await adminERC1155Soulbound.connect(devWallet).addNewToken(1);
            await adminERC1155Soulbound.connect(minterWallet).adminMintId(user1.address, 1, 1, false);
            expect(await adminERC1155Soulbound.balanceOf(user1.address, 1)).to.equal(1);
        });

        it('should mint a soulbound token', async function () {
            const { adminERC1155Soulbound, devWallet, minterWallet, user1 } = await loadFixture(deployFixtures);
            await adminERC1155Soulbound.connect(devWallet).addNewToken(1);
            await adminERC1155Soulbound.connect(minterWallet).adminMintId(user1.address, 1, 1, true);
            expect(await adminERC1155Soulbound.balanceOf(user1.address, 1)).to.equal(1);
            await expect(
                adminERC1155Soulbound.connect(user1).safeTransferFrom(user1.address, devWallet.address, 1, 1, '0x')
            ).to.be.revertedWithCustomError(adminERC1155Soulbound, 'SoulboundAmountError');
        });

        it('should batch mint tokens', async function () {
            const { adminERC1155Soulbound, devWallet, minterWallet, user1, user2 } = await loadFixture(deployFixtures);
            await adminERC1155Soulbound.connect(devWallet).addNewToken(1);
            await adminERC1155Soulbound
                .connect(minterWallet)
                .adminBatchMintId([user1.address, user2.address], 1, [1, 2], false);
            expect(await adminERC1155Soulbound.balanceOf(user1.address, 1)).to.equal(1);
            expect(await adminERC1155Soulbound.balanceOf(user2.address, 1)).to.equal(2);
        });
    });

    describe('Token transfers', function () {
        it('should allow transfer of non-soulbound tokens', async function () {
            const { adminERC1155Soulbound, devWallet, minterWallet, user1, user2 } = await loadFixture(deployFixtures);
            await adminERC1155Soulbound.connect(devWallet).addNewToken(1);
            await adminERC1155Soulbound.connect(minterWallet).adminMintId(user1.address, 1, 20, false);
            await adminERC1155Soulbound.connect(user1).safeTransferFrom(user1.address, user2.address, 1, 5, '0x');
            expect(await adminERC1155Soulbound.balanceOf(user1.address, 1)).to.equal(15);
            expect(await adminERC1155Soulbound.balanceOf(user2.address, 1)).to.equal(5);
        });

        it('should not allow transfer of soulbound tokens', async function () {
            const { adminERC1155Soulbound, devWallet, minterWallet, user1, user2 } = await loadFixture(deployFixtures);
            await adminERC1155Soulbound.connect(devWallet).addNewToken(1);
            await adminERC1155Soulbound.connect(minterWallet).adminMintId(user1.address, 1, 1, true);
            await expect(
                adminERC1155Soulbound.connect(user1).safeTransferFrom(user1.address, user2.address, 1, 1, '0x')
            ).to.be.revertedWithCustomError(adminERC1155Soulbound, 'SoulboundAmountError');
        });
    });

    describe('Burning', function () {
        it('should allow burning of non-soulbound tokens', async function () {
            const { adminERC1155Soulbound, devWallet, minterWallet, user1 } = await loadFixture(deployFixtures);
            await adminERC1155Soulbound.connect(devWallet).addNewToken(1);
            await adminERC1155Soulbound.connect(minterWallet).adminMintId(user1.address, 1, 2, false);
            await adminERC1155Soulbound.connect(user1).burn(user1.address, 1, 1);
            expect(await adminERC1155Soulbound.balanceOf(user1.address, 1)).to.equal(1);
        });

        it('should not allow burning of soulbound tokens without being in the burn whitelist', async function () {
            const { adminERC1155Soulbound, devWallet, minterWallet, user1 } = await loadFixture(deployFixtures);
            await adminERC1155Soulbound.connect(devWallet).addNewToken(1);
            await adminERC1155Soulbound.connect(minterWallet).adminMintId(user1.address, 1, 1, true);
            await expect(adminERC1155Soulbound.connect(user1).burn(user1.address, 1, 1)).to.be.revertedWithCustomError(
                adminERC1155Soulbound,
                'SoulboundAmountError'
            );
        });

        it('should allow whitelisted address to burn tokens', async function () {
            const { adminERC1155Soulbound, devWallet, minterWallet, user1 } = await loadFixture(deployFixtures);
            await adminERC1155Soulbound.connect(devWallet).addNewToken(1);
            await adminERC1155Soulbound.connect(minterWallet).adminMintId(user1.address, 1, 2, false);
            await adminERC1155Soulbound.connect(devWallet).updateWhitelistAddress(devWallet.address, true);
            await adminERC1155Soulbound.connect(devWallet).whitelistBurn(user1.address, 1, 1);
            expect(await adminERC1155Soulbound.balanceOf(user1.address, 1)).to.equal(1);
        });
    });

    describe('URI management', function () {
        it('should return the correct token URI', async function () {
            const { adminERC1155Soulbound, devWallet } = await loadFixture(deployFixtures);
            await adminERC1155Soulbound.connect(devWallet).addNewToken(1);
            expect(await adminERC1155Soulbound.uri(1)).to.equal('https://example.com/token/');
        });

        it('should update the default token URI', async function () {
            const { adminERC1155Soulbound, devWallet } = await loadFixture(deployFixtures);
            await adminERC1155Soulbound.connect(devWallet).updateDefaultTokenURI('https://newexample.com/token/');
            expect(await adminERC1155Soulbound.defaultTokenURI()).to.equal('https://newexample.com/token/');
        });

        it('should update the contract URI', async function () {
            const { adminERC1155Soulbound, devWallet } = await loadFixture(deployFixtures);
            await adminERC1155Soulbound.connect(devWallet).setContractURI('https://newexample.com/contract');
            expect(await adminERC1155Soulbound.contractURI()).to.equal('https://newexample.com/contract');
        });
    });

    describe('Royalty management', function () {
        it('should set default royalty info', async function () {
            const { adminERC1155Soulbound, devWallet, user1 } = await loadFixture(deployFixtures);
            await adminERC1155Soulbound.connect(devWallet).setRoyaltyInfo(user1.address, 500); // 5%
            const [receiver, royaltyAmount] = await adminERC1155Soulbound.royaltyInfo(1, 10000);
            expect(receiver).to.equal(user1.address);
            expect(royaltyAmount).to.equal(500);
        });

        it('should set token-specific royalty', async function () {
            const { adminERC1155Soulbound, devWallet, user2 } = await loadFixture(deployFixtures);
            await adminERC1155Soulbound.connect(devWallet).addNewToken(1);
            await adminERC1155Soulbound.connect(devWallet).setTokenRoyalty(1, user2.address, 1000); // 10%
            const [receiver, royaltyAmount] = await adminERC1155Soulbound.royaltyInfo(1, 10000);
            expect(receiver).to.equal(user2.address);
            expect(royaltyAmount).to.equal(1000);
        });

        it('should reset token-specific royalty', async function () {
            const { adminERC1155Soulbound, devWallet, user2 } = await loadFixture(deployFixtures);
            await adminERC1155Soulbound.connect(devWallet).addNewToken(1);
            await adminERC1155Soulbound.connect(devWallet).setTokenRoyalty(1, user2.address, 1000);
            await adminERC1155Soulbound.connect(devWallet).resetTokenRoyalty(1);
            const [receiver, royaltyAmount] = await adminERC1155Soulbound.royaltyInfo(1, 10000);
            expect(receiver).to.equal(ethers.ZeroAddress);
            expect(royaltyAmount).to.equal(0);
        });
    });
});
