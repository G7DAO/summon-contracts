import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('PaymentRouterNative', function () {
    const PAYMENT_ID = 1;
    const PAYMENT_AMOUNT = ethers.parseEther('0.1');
    const PAYMENT_URI = 'ipfs://QmTest123';
    const NEW_URI = 'ipfs://QmNewTest456';
    const ZERO_ADDRESS = ethers.ZeroAddress;

    async function deployPaymentRouterFixture() {
        const [deployer, devWallet, adminWallet, managerWallet, multiSigWallet, user1, user2] =
            await ethers.getSigners();

        const PaymentRouter = await ethers.getContractFactory('PaymentRouterNative');
        const paymentRouter = await PaymentRouter.deploy(
            multiSigWallet.address,
            managerWallet.address,
            adminWallet.address
        );
        await paymentRouter.waitForDeployment();

        return {
            paymentRouter,
            deployer,
            devWallet,
            adminWallet,
            managerWallet,
            multiSigWallet,
            user1,
            user2,
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
            const [deployer, , adminWallet, managerWallet] = await ethers.getSigners();
            const PaymentRouter = await ethers.getContractFactory('PaymentRouterNative');

            await expect(
                PaymentRouter.deploy(ZERO_ADDRESS, managerWallet.address, adminWallet.address)
            ).to.be.revertedWithCustomError(PaymentRouter, 'InvalidMultiSigAddress');
        });
    });

    describe('Payment Configuration', function () {
        it('Should set payment config correctly', async function () {
            const { paymentRouter, deployer } = await loadFixture(deployPaymentRouterFixture);

            await expect(paymentRouter.connect(deployer).setPaymentConfig(PAYMENT_ID, PAYMENT_AMOUNT, PAYMENT_URI))
                .to.emit(paymentRouter, 'PriceUpdated')
                .withArgs(PAYMENT_ID, PAYMENT_AMOUNT)
                .to.emit(paymentRouter, 'UriUpdated')
                .withArgs(PAYMENT_ID, PAYMENT_URI);

            const config = await paymentRouter.getPaymentConfig(PAYMENT_ID);
            expect(config.price).to.equal(PAYMENT_AMOUNT);
            expect(config.isPaused).to.equal(false);
        });

        it('Should revert when setting zero price', async function () {
            const { paymentRouter, deployer } = await loadFixture(deployPaymentRouterFixture);

            await expect(
                paymentRouter.connect(deployer).setPaymentConfig(PAYMENT_ID, 0, PAYMENT_URI)
            ).to.be.revertedWithCustomError(paymentRouter, 'ZeroPrice');
        });
    });

    describe('URI Management', function () {
        it('Should update URI correctly', async function () {
            const { paymentRouter, deployer } = await loadFixture(deployPaymentRouterFixture);

            await paymentRouter.connect(deployer).setPaymentConfig(PAYMENT_ID, PAYMENT_AMOUNT, PAYMENT_URI);

            await expect(paymentRouter.connect(deployer).updateUri(PAYMENT_ID, NEW_URI))
                .to.emit(paymentRouter, 'UriUpdated')
                .withArgs(PAYMENT_ID, NEW_URI);

            expect(await paymentRouter.paymentURI(PAYMENT_ID)).to.equal(NEW_URI);
        });

        it('Should revert when updating URI for invalid payment ID', async function () {
            const { paymentRouter, deployer } = await loadFixture(deployPaymentRouterFixture);

            await expect(paymentRouter.connect(deployer).updateUri(999, NEW_URI)).to.be.revertedWithCustomError(
                paymentRouter,
                'InvalidPaymentId'
            );
        });
    });

    describe('Payment Operations', function () {
        it('Should accept and forward payment correctly', async function () {
            const { paymentRouter, deployer, multiSigWallet, user1 } = await loadFixture(deployPaymentRouterFixture);

            await paymentRouter.connect(deployer).setPaymentConfig(PAYMENT_ID, PAYMENT_AMOUNT, PAYMENT_URI);

            const initialBalance = await multiSigWallet.provider.getBalance(multiSigWallet.address);

            await expect(paymentRouter.connect(user1).pay(PAYMENT_ID, { value: PAYMENT_AMOUNT }))
                .to.emit(paymentRouter, 'PaymentReceived')
                .withArgs(PAYMENT_ID, user1.address, PAYMENT_AMOUNT);

            expect(await multiSigWallet.provider.getBalance(multiSigWallet.address)).to.equal(
                initialBalance + PAYMENT_AMOUNT
            );
        });

        it('Should revert payment when paused', async function () {
            const { paymentRouter, deployer, managerWallet, user1 } = await loadFixture(deployPaymentRouterFixture);

            await paymentRouter.connect(deployer).setPaymentConfig(PAYMENT_ID, PAYMENT_AMOUNT, PAYMENT_URI);
            await paymentRouter.connect(managerWallet).pauseId(PAYMENT_ID);

            await expect(
                paymentRouter.connect(user1).pay(PAYMENT_ID, { value: PAYMENT_AMOUNT })
            ).to.be.revertedWithCustomError(paymentRouter, 'PaymentIdPaused');
        });

        it('Should revert payment with incorrect amount', async function () {
            const { paymentRouter, deployer, user1 } = await loadFixture(deployPaymentRouterFixture);

            await paymentRouter.connect(deployer).setPaymentConfig(PAYMENT_ID, PAYMENT_AMOUNT, PAYMENT_URI);

            await expect(
                paymentRouter.connect(user1).pay(PAYMENT_ID, {
                    value: PAYMENT_AMOUNT + 1n,
                })
            ).to.be.revertedWithCustomError(paymentRouter, 'IncorrectPaymentAmount');
        });
    });

    describe('Admin Functions', function () {
        it('Should update multisig address', async function () {
            const { paymentRouter, adminWallet, user1 } = await loadFixture(deployPaymentRouterFixture);

            const oldMultiSig = await paymentRouter.multiSigWallet();

            await expect(paymentRouter.connect(adminWallet).updateMultiSig(user1.address))
                .to.emit(paymentRouter, 'MultiSigUpdated')
                .withArgs(oldMultiSig, user1.address);

            expect(await paymentRouter.multiSigWallet()).to.equal(user1.address);
        });

        it('Should withdraw stuck funds', async function () {
            const { paymentRouter, adminWallet, multiSigWallet } = await loadFixture(deployPaymentRouterFixture);

            // Get the paymentRouter contract address
            const paymentRouterAddress = await paymentRouter.getAddress();

            // Send ETH directly to the contract address
            await adminWallet.sendTransaction({
                to: paymentRouterAddress,
                value: ethers.parseEther('1.0'),
                // Note: for simple ETH transfers, we don't need to specify data
            });

            // Get initial balance of the multisig wallet
            const initialBalance = await ethers.provider.getBalance(multiSigWallet.address);

            // Perform the withdrawal
            await expect(paymentRouter.connect(adminWallet).withdrawStuckFunds())
                .to.emit(paymentRouter, 'EmergencyWithdrawal')
                .withArgs(multiSigWallet.address, ethers.parseEther('1.0'));

            // Get final balance and compare
            const finalBalance = await ethers.provider.getBalance(multiSigWallet.address);
            expect(finalBalance).to.equal(initialBalance + ethers.parseEther('1.0'));
        });
    });

    describe('Role-Based Access Control', function () {
        it('Should revert when non-admin tries to update multisig', async function () {
            const { paymentRouter, user1, user2 } = await loadFixture(deployPaymentRouterFixture);

            await expect(paymentRouter.connect(user1).updateMultiSig(user2.address))
                .to.be.revertedWithCustomError(paymentRouter, 'AccessControlUnauthorizedAccount')
                .withArgs(user1.address, await paymentRouter.ADMIN_ROLE());
        });

        it('Should revert when non-manager tries to pause', async function () {
            const { paymentRouter, deployer, user1 } = await loadFixture(deployPaymentRouterFixture);

            await paymentRouter.connect(deployer).setPaymentConfig(PAYMENT_ID, PAYMENT_AMOUNT, PAYMENT_URI);

            await expect(paymentRouter.connect(user1).pauseId(PAYMENT_ID))
                .to.be.revertedWithCustomError(paymentRouter, 'AccessControlUnauthorizedAccount')
                .withArgs(user1.address, await paymentRouter.MANAGER_ROLE());
        });

        it('Should revert when non-dev tries to set config', async function () {
            const { paymentRouter, user1 } = await loadFixture(deployPaymentRouterFixture);

            await expect(paymentRouter.connect(user1).setPaymentConfig(PAYMENT_ID, PAYMENT_AMOUNT, PAYMENT_URI))
                .to.be.revertedWithCustomError(paymentRouter, 'AccessControlUnauthorizedAccount')
                .withArgs(user1.address, await paymentRouter.DEV_CONFIG_ROLE());
        });
    });
});
