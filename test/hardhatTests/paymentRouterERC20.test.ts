import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { generateRandomSeed } from '../../helpers/signature';

describe('PaymentRouterERC20', function () {
    const PAYMENT_ID = 1;
    const PAYMENT_AMOUNT = ethers.parseEther('100'); // 100 tokens
    const BOX_ID = 1231231;
    const PAYMENT_URI = 'ipfs://QmTest123';
    const NEW_URI = 'ipfs://QmNewTest456';
    const ZERO_ADDRESS = ethers.ZeroAddress;

    async function deployPaymentRouterFixture() {
        const [deployer, devWallet, adminWallet, managerWallet, multiSigWallet, user1, user2] =
            await ethers.getSigners();

        // Deploy mock ERC20 token
        const MockERC20Factory = await hre.ethers.getContractFactory('MockERC20');
        const mockToken = await MockERC20Factory.deploy('MockERC20', 'MockERC20');
        await mockToken.waitForDeployment();

        // Mint tokens to user1 for testing
        await mockToken.mint(user1.address, ethers.parseEther('10000'));

        const PaymentRouter = await ethers.getContractFactory('PaymentRouterERC20');
        const paymentRouter = await PaymentRouter.deploy(
            multiSigWallet.address,
            managerWallet.address,
            adminWallet.address
        );
        await paymentRouter.waitForDeployment();

        const chainId = (await ethers.provider.getNetwork()).chainId;

        const { seed, signature, nonce } = await generateRandomSeed({
            smartContractAddress: await paymentRouter.getAddress(),
            chainId: chainId,
            decode: true,
            address: user1.address,
            signer: deployer,
            rawData: { type: 'uint256[]', data: [BOX_ID] },
        });

        return {
            paymentRouter,
            mockToken,
            deployer,
            devWallet,
            adminWallet,
            managerWallet,
            multiSigWallet,
            user1,
            user2,
            nonceUser1: nonce,
            signatureUser1: signature,
            seedUser1: seed,
        };
    }

    describe('Deployment', function () {
        it('Should deploy successfully', async function () {
            const { paymentRouter } = await loadFixture(deployPaymentRouterFixture);
            expect(await paymentRouter.getAddress()).to.be.properAddress;
        });

        it('Should set the correct roles', async function () {
            const { paymentRouter, deployer, adminWallet, managerWallet } =
                await loadFixture(deployPaymentRouterFixture);

            const ADMIN_ROLE = await paymentRouter.ADMIN_ROLE();
            const DEV_CONFIG_ROLE = await paymentRouter.DEV_CONFIG_ROLE();
            const MANAGER_ROLE = await paymentRouter.MANAGER_ROLE();

            expect(await paymentRouter.hasRole(DEV_CONFIG_ROLE, deployer.address)).to.be.true;
            expect(await paymentRouter.hasRole(ADMIN_ROLE, adminWallet.address)).to.be.true;
            expect(await paymentRouter.hasRole(MANAGER_ROLE, managerWallet.address)).to.be.true;
        });

        it('Should revert when deploying with zero address multisig', async function () {
            const [_, , adminWallet, managerWallet] = await ethers.getSigners();
            const PaymentRouter = await ethers.getContractFactory('PaymentRouterERC20');

            await expect(
                PaymentRouter.deploy(ZERO_ADDRESS, managerWallet.address, adminWallet.address)
            ).to.be.revertedWithCustomError(PaymentRouter, 'InvalidMultiSigAddress');
        });
    });

    describe('Token Whitelist Management', function () {
        it('Should whitelist token correctly', async function () {
            const { paymentRouter, mockToken, managerWallet } = await loadFixture(deployPaymentRouterFixture);

            await expect(paymentRouter.connect(managerWallet).whitelistToken(await mockToken.getAddress()))
                .to.emit(paymentRouter, 'TokenWhitelisted')
                .withArgs(await mockToken.getAddress());

            expect(await paymentRouter.whitelistedTokens(await mockToken.getAddress())).to.be.true;
        });

        it('Should revert when non-manager tries to whitelist token', async function () {
            const { paymentRouter, mockToken, user1 } = await loadFixture(deployPaymentRouterFixture);

            await expect(paymentRouter.connect(user1).whitelistToken(await mockToken.getAddress()))
                .to.be.revertedWithCustomError(paymentRouter, 'AccessControlUnauthorizedAccount')
                .withArgs(user1.address, await paymentRouter.MANAGER_ROLE());
        });

        it('Should remove token from whitelist', async function () {
            const { paymentRouter, mockToken, managerWallet } = await loadFixture(deployPaymentRouterFixture);

            await paymentRouter.connect(managerWallet).whitelistToken(await mockToken.getAddress());

            await expect(paymentRouter.connect(managerWallet).removeTokenFromWhitelist(await mockToken.getAddress()))
                .to.emit(paymentRouter, 'TokenRemovedFromWhitelist')
                .withArgs(await mockToken.getAddress());

            expect(await paymentRouter.whitelistedTokens(await mockToken.getAddress())).to.be.false;
        });
    });

    describe('Payment Configuration', function () {
        it('Should set payment config correctly', async function () {
            const { paymentRouter, mockToken, deployer, managerWallet } = await loadFixture(deployPaymentRouterFixture);

            await paymentRouter.connect(managerWallet).whitelistToken(await mockToken.getAddress());

            await expect(
                paymentRouter
                    .connect(deployer)
                    .setPaymentConfig(PAYMENT_ID, PAYMENT_AMOUNT, PAYMENT_URI, await mockToken.getAddress())
            )
                .to.emit(paymentRouter, 'PriceUpdated')
                .withArgs(PAYMENT_ID, PAYMENT_AMOUNT)
                .to.emit(paymentRouter, 'UriUpdated')
                .withArgs(PAYMENT_ID, PAYMENT_URI);

            const config = await paymentRouter.getPaymentConfig(PAYMENT_ID);
            expect(config.price).to.equal(PAYMENT_AMOUNT);
            expect(config.isPaused).to.be.false;
            expect(config.token).to.equal(await mockToken.getAddress());
        });

        it('Should revert when setting config with non-whitelisted token', async function () {
            const { paymentRouter, mockToken, deployer } = await loadFixture(deployPaymentRouterFixture);

            await expect(
                paymentRouter
                    .connect(deployer)
                    .setPaymentConfig(PAYMENT_ID, PAYMENT_AMOUNT, PAYMENT_URI, await mockToken.getAddress())
            ).to.be.revertedWithCustomError(paymentRouter, 'TokenNotWhitelisted');
        });
    });

    describe('Payment Operations', function () {
        it('Should process payment correctly', async function () {
            const {
                paymentRouter,
                mockToken,
                deployer,
                managerWallet,
                multiSigWallet,
                user1,
                nonceUser1,
                seedUser1,
                signatureUser1,
            } = await loadFixture(deployPaymentRouterFixture);

            // Setup
            await paymentRouter.connect(managerWallet).whitelistToken(await mockToken.getAddress());
            await paymentRouter
                .connect(deployer)
                .setPaymentConfig(PAYMENT_ID, PAYMENT_AMOUNT, PAYMENT_URI, await mockToken.getAddress());

            // Approve tokens
            await mockToken.connect(user1).approve(await paymentRouter.getAddress(), PAYMENT_AMOUNT);

            const initialBalance = await mockToken.balanceOf(multiSigWallet.address);

            await expect(paymentRouter.connect(user1).pay(PAYMENT_ID, nonceUser1, seedUser1, signatureUser1))
                .to.emit(paymentRouter, 'PaymentReceived')
                .withArgs(PAYMENT_ID, user1.address, await mockToken.getAddress(), PAYMENT_AMOUNT, [BOX_ID]);

            expect(await mockToken.balanceOf(multiSigWallet.address)).to.equal(initialBalance + PAYMENT_AMOUNT);
        });

        it('Should revert payment when paused', async function () {
            const { paymentRouter, mockToken, deployer, managerWallet, user1, nonceUser1, seedUser1, signatureUser1 } =
                await loadFixture(deployPaymentRouterFixture);

            // Setup
            await paymentRouter.connect(managerWallet).whitelistToken(await mockToken.getAddress());
            await paymentRouter
                .connect(deployer)
                .setPaymentConfig(PAYMENT_ID, PAYMENT_AMOUNT, PAYMENT_URI, await mockToken.getAddress());
            await paymentRouter.connect(managerWallet).pauseId(PAYMENT_ID);

            await expect(
                paymentRouter.connect(user1).pay(PAYMENT_ID, nonceUser1, seedUser1, signatureUser1)
            ).to.be.revertedWithCustomError(paymentRouter, 'PaymentIdPaused');
        });
    });

    describe('Emergency Functions', function () {
        it('Should withdraw stuck tokens', async function () {
            const { paymentRouter, mockToken, adminWallet, multiSigWallet } =
                await loadFixture(deployPaymentRouterFixture);

            // Send tokens directly to contract
            await mockToken.mint(await paymentRouter.getAddress(), PAYMENT_AMOUNT);

            const initialBalance = await mockToken.balanceOf(multiSigWallet.address);

            await expect(paymentRouter.connect(adminWallet).withdrawStuckTokens(await mockToken.getAddress()))
                .to.emit(paymentRouter, 'EmergencyWithdrawal')
                .withArgs(await mockToken.getAddress(), multiSigWallet.address, PAYMENT_AMOUNT);

            expect(await mockToken.balanceOf(multiSigWallet.address)).to.equal(initialBalance + PAYMENT_AMOUNT);
        });

        it('Should revert withdrawal when no tokens available', async function () {
            const { paymentRouter, mockToken, adminWallet } = await loadFixture(deployPaymentRouterFixture);

            await expect(
                paymentRouter.connect(adminWallet).withdrawStuckTokens(await mockToken.getAddress())
            ).to.be.revertedWithCustomError(paymentRouter, 'NoFundsToWithdraw');
        });
    });
});
