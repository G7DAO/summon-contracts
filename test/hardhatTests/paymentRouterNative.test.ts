import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { generateRandomSeed } from '../../helpers/signature';
import { PaymentRouterNative as PaymentRouterNativeType } from '../../typechain-types';

describe('PaymentRouterNative', function () {
    const PAYMENT_ID = 1;
    const BOX_ID = '6737e2a71b4f47dc279ae62a';
    const PAYMENT_AMOUNT = ethers.parseEther('0.1');
    const PAYMENT_URI = 'ipfs://QmTest123';
    const NEW_URI = 'ipfs://QmNewTest456';
    const ZERO_ADDRESS = ethers.ZeroAddress;

    async function deployPaymentRouterFixture() {
        const [deployer, devWallet, adminWallet, managerWallet, multiSigWallet, user1, user2, recipient1] =
            await ethers.getSigners();

        const PaymentRouter = await ethers.getContractFactory('PaymentRouterNative');
        const paymentRouter = await PaymentRouter.deploy(
            managerWallet.address,
            adminWallet.address
        );
        await paymentRouter.waitForDeployment();

        const defaultMultisigFee = 7000;
        const recipient1Fee = 3000;

        // Setup fee recipients
        await paymentRouter.connect(managerWallet).setFeeRecipient(
            multiSigWallet.address, defaultMultisigFee
        );

        await paymentRouter.connect(managerWallet).setFeeRecipient(
            recipient1.address, recipient1Fee
        );

        const chainId = (await ethers.provider.getNetwork()).chainId;

        const { seed, signature, nonce } = await generateRandomSeed({
            smartContractAddress: await paymentRouter.getAddress(),
            chainId: chainId,
            decode: true,
            address: user1.address,
            signer: deployer,
            rawData: { type: 'string[]', data: [BOX_ID] },
        });

        return {
            paymentRouter: paymentRouter as PaymentRouterNativeType,
            deployer,
            devWallet,
            adminWallet,
            managerWallet,
            multiSigWallet,
            user1,
            user2,
            recipient1,
            defaultMultisigFee,
            recipient1Fee,
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

        it('Should revert when deploying with zero addresses', async function () {
            const [_, __, adminWallet, managerWallet] = await ethers.getSigners();
            const PaymentRouter = await ethers.getContractFactory('PaymentRouterNative');

            await expect(
                PaymentRouter.deploy(ZERO_ADDRESS, adminWallet.address)
            ).to.be.revertedWithCustomError(PaymentRouter, 'ZeroAddress');

            await expect(
                PaymentRouter.deploy(managerWallet.address, ZERO_ADDRESS)
            ).to.be.revertedWithCustomError(PaymentRouter, 'ZeroAddress');
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
        it('Should accept and forward payment correctly to recipes', async function () {
            const { paymentRouter, deployer, multiSigWallet, recipient1, user1, signatureUser1, nonceUser1, seedUser1 } =
                await loadFixture(deployPaymentRouterFixture);

            await paymentRouter.connect(deployer).setPaymentConfig(PAYMENT_ID, PAYMENT_AMOUNT, PAYMENT_URI);

            const initialBalanceMultisig = await ethers.provider.getBalance(multiSigWallet.address);
            const initialBalanceRecipient = await ethers.provider.getBalance(recipient1.address);

            await expect(
                paymentRouter
                    .connect(user1)
                    .pay(PAYMENT_ID, nonceUser1, seedUser1, signatureUser1, { value: PAYMENT_AMOUNT })
            )
                .to.emit(paymentRouter, 'PaymentReceived')
                .withArgs(PAYMENT_ID, user1.address, PAYMENT_AMOUNT, [BOX_ID]);

            // Check that recipients received their correct percentages
            const expectedAmountMultisig = (PAYMENT_AMOUNT * 7000n) / 10000n; // 70%
            const expectedAmountRecipient = (PAYMENT_AMOUNT * 3000n) / 10000n; // 30%

            expect(await ethers.provider.getBalance(multiSigWallet.address)).to.equal(
                initialBalanceMultisig + expectedAmountMultisig
            );
            expect(await ethers.provider.getBalance(recipient1.address)).to.equal(
                initialBalanceRecipient + expectedAmountRecipient
            );
        });

        it('Should revert payment when paused', async function () {
            const { paymentRouter, deployer, managerWallet, user1, nonceUser1, seedUser1, signatureUser1 } =
                await loadFixture(deployPaymentRouterFixture);

            await paymentRouter.connect(deployer).setPaymentConfig(PAYMENT_ID, PAYMENT_AMOUNT, PAYMENT_URI);
            await paymentRouter.connect(managerWallet).pauseId(PAYMENT_ID);

            await expect(
                paymentRouter
                    .connect(user1)
                    .pay(PAYMENT_ID, nonceUser1, seedUser1, signatureUser1, { value: PAYMENT_AMOUNT })
            ).to.be.revertedWithCustomError(paymentRouter, 'PaymentIdPaused');
        });

        it('Should revert payment with incorrect amount', async function () {
            const { paymentRouter, deployer, user1, nonceUser1, seedUser1, signatureUser1 } =
                await loadFixture(deployPaymentRouterFixture);

            await paymentRouter.connect(deployer).setPaymentConfig(PAYMENT_ID, PAYMENT_AMOUNT, PAYMENT_URI);

            await expect(
                paymentRouter.connect(user1).pay(PAYMENT_ID, nonceUser1, seedUser1, signatureUser1, {
                    value: PAYMENT_AMOUNT + 1n,
                })
            ).to.be.revertedWithCustomError(paymentRouter, 'IncorrectPaymentAmount');
        });
    });

    describe('Admin Functions', function () {
        it('Should withdraw stuck funds', async function () {
            const { paymentRouter, adminWallet, deployer } = await loadFixture(deployPaymentRouterFixture);
        
            // Send some ETH to the contract
            await deployer.sendTransaction({
                to: await paymentRouter.getAddress(),
                value: ethers.parseEther('1.0'),
            });
        
            const initialBalance = await ethers.provider.getBalance(adminWallet.address);
            const contractBalance = await ethers.provider.getBalance(await paymentRouter.getAddress());
        
            const tx = await paymentRouter.connect(adminWallet).withdrawStuckFunds();
            await tx.wait();
        
            // Check that admin received the funds
            expect(await ethers.provider.getBalance(await paymentRouter.getAddress())).to.equal(0);
            expect(await ethers.provider.getBalance(adminWallet.address)).to.be.greaterThan(initialBalance);
        
            await expect(tx)
                .to.emit(paymentRouter, 'EmergencyWithdrawal')
                .withArgs(adminWallet.address, contractBalance);
        });
    });

    describe('Role-Based Access Control', function () {
        it('Should revert when non-admin tries to withdraw', async function () {
            const { paymentRouter, user1 } = await loadFixture(deployPaymentRouterFixture);

            await expect(paymentRouter.connect(user1).withdrawStuckFunds())
                .to.be.revertedWithCustomError(paymentRouter, 'AccessControlUnauthorizedAccount')
                .withArgs(user1.address, await paymentRouter.ADMIN_ROLE());

        });
        
        it('Should revert when trying to withdraw with no funds', async function () {
            const { paymentRouter, adminWallet } = await loadFixture(deployPaymentRouterFixture);
        
            await expect(
                paymentRouter.connect(adminWallet).withdrawStuckFunds()
            ).to.be.revertedWithCustomError(paymentRouter, 'NoFundsToWithdraw');
        });

        it('Should revert when non-manager tries to pause', async function () {
            const { paymentRouter, deployer, managerWallet, user1 } = await loadFixture(deployPaymentRouterFixture);

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

    describe('Fee Recipient Management', function () {
        it('Should set and get fee recipient correctly', async function () {
            const { paymentRouter, managerWallet, recipient1 } = await loadFixture(deployPaymentRouterFixture);
            
            const percentage = 5000; // 50%
            await paymentRouter.connect(managerWallet).setFeeRecipient(recipient1.address, percentage);

            const [active, recipientPercentage] = await paymentRouter.getFeeRecipient(recipient1.address);
            expect(active).to.be.true;
            expect(recipientPercentage).to.equal(percentage);
        });

        it('Should update existing fee recipient percentage', async function () {
            const { paymentRouter, managerWallet, recipient1 } = await loadFixture(deployPaymentRouterFixture);
            
            await paymentRouter.connect(managerWallet).setFeeRecipient(recipient1.address, 3000);
            await paymentRouter.connect(managerWallet).setFeeRecipient(recipient1.address, 5000);

            const [active, percentage] = await paymentRouter.getFeeRecipient(recipient1.address);
            expect(active).to.be.true;
            expect(percentage).to.equal(5000);
        });

        it('Should remove fee recipient correctly', async function () {
            const { paymentRouter, managerWallet, multiSigWallet, recipient1 } = await loadFixture(deployPaymentRouterFixture);
            
            // First remove recipient1 (30%)
            await paymentRouter.connect(managerWallet).removeFeeRecipient(recipient1.address);

            const [active, percentage] = await paymentRouter.getFeeRecipient(recipient1.address);
            expect(active).to.be.false;
            expect(percentage).to.equal(0);

            // Verify only multisig remains with 70%
            const totalPercentage = await paymentRouter.getTotalFeePercentage();
            expect(totalPercentage).to.equal(7000);

            // Second remove multisig 70%
            await paymentRouter.connect(managerWallet).removeFeeRecipient(multiSigWallet.address);
            
            // Verify total percentage is 0
            const totalPercentageAfterRemoval = await paymentRouter.getTotalFeePercentage();
            expect(totalPercentageAfterRemoval).to.equal(0);
        });

        it('Should get all active fee recipients correctly', async function () {
            const { paymentRouter, managerWallet, multiSigWallet, recipient1 } = await loadFixture(deployPaymentRouterFixture);
            
            const [recipients, percentages] = await paymentRouter.getFeeRecipients();
            
            expect(recipients).to.have.lengthOf(2);
            expect(percentages).to.have.lengthOf(2);
            
            // Check multisig wallet (70%)
            expect(recipients[0]).to.equal(multiSigWallet.address);
            expect(percentages[0]).to.equal(7000);
            
            // Check recipient1 (30%)
            expect(recipients[1]).to.equal(recipient1.address);
            expect(percentages[1]).to.equal(3000);
        });

        describe('Error cases', function () {
            it('Should revert when setting zero address as recipient', async function () {
                const { paymentRouter, managerWallet } = await loadFixture(deployPaymentRouterFixture);
                
                await expect(
                    paymentRouter.connect(managerWallet).setFeeRecipient(ZERO_ADDRESS, 5000)
                ).to.be.revertedWithCustomError(paymentRouter, 'InvalidRecipientAddress');
            });

            it('Should revert when setting percentage over 100%', async function () {
                const { paymentRouter, managerWallet, recipient1 } = await loadFixture(deployPaymentRouterFixture);
                
                await expect(
                    paymentRouter.connect(managerWallet).setFeeRecipient(recipient1.address, 10001)
                ).to.be.revertedWithCustomError(paymentRouter, 'InvalidPercentage');
            });

            it('Should revert when removing non-existent recipient', async function () {
                const { paymentRouter, managerWallet } = await loadFixture(deployPaymentRouterFixture);
                const nonExistentRecipient = await ethers.Wallet.createRandom();
                
                await expect(
                    paymentRouter.connect(managerWallet).removeFeeRecipient(nonExistentRecipient.address)
                ).to.be.revertedWithCustomError(paymentRouter, 'FeeRecipientDoesNotExist');
            });
        });

        it('Should remove fee recipient from array and prevent duplicates when re-adding', async function () {
            const { paymentRouter, managerWallet, recipient1 } = await loadFixture(deployPaymentRouterFixture);
            
            // Get initial array length
            const [initialRecipients] = await paymentRouter.getFeeRecipients();
            const initialLength = initialRecipients.length;
            
            // Remove recipient1
            await paymentRouter.connect(managerWallet).removeFeeRecipient(recipient1.address);
            
            // Verify array length decreased
            const [afterRemovalRecipients] = await paymentRouter.getFeeRecipients();
            expect(afterRemovalRecipients.length).to.equal(initialLength - 1);
            expect(afterRemovalRecipients).to.not.include(recipient1.address);
            
            // Re-add the same recipient
            await paymentRouter.connect(managerWallet).setFeeRecipient(recipient1.address, 3000);
            
            // Verify array length increased by 1 and recipient is present
            const [finalRecipients] = await paymentRouter.getFeeRecipients();
            expect(finalRecipients.length).to.equal(initialLength);
            expect(finalRecipients).to.include(recipient1.address);
            
            // Verify only one instance exists
            const recipientCount = finalRecipients.filter(r => r === recipient1.address).length;
            expect(recipientCount).to.equal(1);
        });

        it('Should handle multiple recipient removals and additions correctly', async function () {
            const { paymentRouter, managerWallet, multiSigWallet, recipient1 } = await loadFixture(deployPaymentRouterFixture);
            
            // Remove both initial recipients
            await paymentRouter.connect(managerWallet).removeFeeRecipient(recipient1.address);
            await paymentRouter.connect(managerWallet).removeFeeRecipient(multiSigWallet.address);
            
            // Verify array is empty
            const [emptyRecipients] = await paymentRouter.getFeeRecipients();
            expect(emptyRecipients.length).to.equal(0);
            
            // Add three new recipients
            const newRecipients = await Promise.all([
                ethers.Wallet.createRandom(),
                ethers.Wallet.createRandom(),
                ethers.Wallet.createRandom()
            ]);
            
            for (let i = 0; i < newRecipients.length; i++) {
                await paymentRouter.connect(managerWallet).setFeeRecipient(
                    newRecipients[i].address,
                    3333 // ~33.33% each
                );
            }
            
            // Verify all new recipients are present
            const [finalRecipients, finalPercentages] = await paymentRouter.getFeeRecipients();
            expect(finalRecipients.length).to.equal(3);
            
            for (const recipient of newRecipients) {
                expect(finalRecipients).to.include(recipient.address);
            }
            
            // Remove middle recipient
            await paymentRouter.connect(managerWallet).removeFeeRecipient(newRecipients[1].address);
            
            // Verify array is updated correctly
            const [afterMiddleRemovalRecipients] = await paymentRouter.getFeeRecipients();
            expect(afterMiddleRemovalRecipients.length).to.equal(2);
            expect(afterMiddleRemovalRecipients).to.include(newRecipients[0].address);
            expect(afterMiddleRemovalRecipients).to.include(newRecipients[2].address);
            expect(afterMiddleRemovalRecipients).to.not.include(newRecipients[1].address);
        });

        it('Should prevent duplicate payments when adding same recipient multiple times', async function () {
            const { paymentRouter, managerWallet, deployer, user1, recipient1 } = await loadFixture(deployPaymentRouterFixture);
            
            // Setup a payment configuration
            const paymentAmount = ethers.parseEther('1.0');
            await paymentRouter.connect(deployer).setPaymentConfig(PAYMENT_ID, paymentAmount, PAYMENT_URI);
            
            // Remove all existing recipients
            const [initialRecipients] = await paymentRouter.getFeeRecipients();
            for (const recipient of initialRecipients) {
                await paymentRouter.connect(managerWallet).removeFeeRecipient(recipient);
            }
            
            // Add recipient1 twice with 100% fee
            await paymentRouter.connect(managerWallet).setFeeRecipient(recipient1.address, 10000); // First addition
            await paymentRouter.connect(managerWallet).setFeeRecipient(recipient1.address, 10000); // Second addition
            
            // Verify recipient appears only once in the array
            const [recipients] = await paymentRouter.getFeeRecipients();
            const recipientCount = recipients.filter(r => r === recipient1.address).length;
            expect(recipientCount).to.equal(1, 'Recipient address should appear exactly once in the array');
            
            // Get recipient's initial balance
            const initialBalance = await ethers.provider.getBalance(recipient1.address);
            
            // Generate signature for payment
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const { seed, signature, nonce } = await generateRandomSeed({
                smartContractAddress: await paymentRouter.getAddress(),
                chainId: chainId,
                decode: true,
                address: user1.address,
                signer: deployer,
                rawData: { type: 'string[]', data: [BOX_ID] },
            });
            
            // Make payment
            await paymentRouter.connect(user1).pay(PAYMENT_ID, nonce, seed, signature, { value: paymentAmount });
            
            // Check recipient received exactly the payment amount once
            const finalBalance = await ethers.provider.getBalance(recipient1.address);
            expect(finalBalance - initialBalance).to.equal(paymentAmount, 'Recipient should receive payment exactly once');
        });
    });
});
