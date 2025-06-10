import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { GUnits, MockERC20 } from 'typechain-types';

describe('GUnits - Withdraw to Different Address', function () {
    async function deployFixtures() {
        const [devWallet, manager, user1, user2, recipient, treasury, gameServer, liveOps, recipient2] =
            await ethers.getSigners();

        // Deploy mock token for testing
        const MockToken = await ethers.getContractFactory('MockERC20');
        const mockToken = await MockToken.deploy('Mock Token', 'MTK');
        await mockToken.waitForDeployment();

        // Deploy GUnits implementation
        const GUnitsFactory = await ethers.getContractFactory('GUnits');

        // Deploy as UUPS proxy with all required initialization parameters
        const chipsContract = await upgrades.deployProxy(
            GUnitsFactory,
            [
                await mockToken.getAddress(), // _token
                false, // _isPaused
                devWallet.address, // _devWallet
            ],
            {
                initializer: 'initialize',
            }
        );
        await chipsContract.waitForDeployment();
        const chips = await ethers.getContractAt('GUnits', await chipsContract.getAddress());

        // Grant roles
        await chips.connect(devWallet).grantRole(await chips.MANAGER_ROLE(), manager.address);
        await chips.connect(devWallet).grantRole(await chips.READABLE_ROLE(), manager.address);
        await chips.connect(devWallet).grantRole(await chips.GAME_SERVER_ROLE(), gameServer.address);
        await chips.connect(devWallet).grantRole(await chips.LIVE_OPS_ROLE(), liveOps.address);

        // Mint some tokens to users for testing
        await mockToken.mint(user1.address, ethers.parseUnits('1000', 6));
        await mockToken.mint(user2.address, ethers.parseUnits('1000', 6));
        await mockToken.mint(gameServer.address, ethers.parseUnits('1000', 6));
        await mockToken.mint(liveOps.address, ethers.parseUnits('1000', 6));
        await mockToken.mint(manager.address, ethers.parseUnits('1000', 6));
        await mockToken.mint(devWallet.address, ethers.parseUnits('1000', 6));

        // Grant roles
        await chips.connect(devWallet).grantRole(await chips.MANAGER_ROLE(), manager.address);
        await chips.connect(devWallet).grantRole(await chips.LIVE_OPS_ROLE(), liveOps.address);
        await chips.connect(devWallet).grantRole(await chips.GAME_SERVER_ROLE(), gameServer.address);

        return {
            chips,
            mockToken,
            manager,
            user1,
            user2,
            recipient,
            recipient2,
            gameServer,
            treasury,
            liveOps,
            devWallet,
        };
    }

    async function depositGUnits(
        chips: GUnits,
        token: MockERC20,
        signer: SignerWithAddress,
        user: SignerWithAddress,
        amount: bigint
    ) {
        const chainId = (await ethers.provider.getNetwork()).chainId;
        const contractAddress = await chips.getAddress();

        const data = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256', 'uint256', 'uint256'],
            [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600]
        );
        const nonce = Math.floor(Math.random() * 1000000); // Random nonce to avoid conflicts
        const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user.address, data, nonce]);
        const messageHash = ethers.keccak256(message);
        const signature = await signer.signMessage(ethers.getBytes(messageHash));

        await token.connect(user).approve(await chips.getAddress(), amount);
        await chips.connect(user).deposit(data, nonce, signature);
    }

    describe('withdrawTo', function () {
        it('Should allow user to withdraw to a different address', async function () {
            const { chips, mockToken, user1, recipient, devWallet } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const withdrawAmount = ethers.parseUnits('40', 6);

            // First deposit
            await depositGUnits(chips, mockToken, devWallet, user1, depositAmount);
            expect(await chips.balanceOf(user1.address)).to.equal(depositAmount);

            // Prepare withdraw data
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();
            const withdrawData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256'],
                [contractAddress, chainId, withdrawAmount, Math.floor(Date.now() / 1000) + 3600]
            );
            const withdrawNonce = 2;
            const withdrawMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, withdrawData, withdrawNonce]
            );
            const withdrawMessageHash = ethers.keccak256(withdrawMessage);
            const withdrawSignature = await devWallet.signMessage(ethers.getBytes(withdrawMessageHash));

            // Check initial balances
            const recipientBalanceBefore = await mockToken.balanceOf(recipient.address);
            expect(recipientBalanceBefore).to.equal(0);

            // Withdraw to recipient
            await expect(
                chips.connect(user1).withdrawTo(withdrawData, withdrawNonce, withdrawSignature, recipient.address)
            )
                .to.emit(chips, 'Withdraw')
                .withArgs(user1.address, withdrawAmount);

            // Check final balances
            expect(await chips.balanceOf(user1.address)).to.equal(depositAmount - withdrawAmount);
            expect(await mockToken.balanceOf(recipient.address)).to.equal(withdrawAmount);
        });

        it('Should allow user to withdraw all funds to a different address', async function () {
            const { chips, mockToken, user1, recipient, devWallet } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);

            // First deposit
            await depositGUnits(chips, mockToken, devWallet, user1, depositAmount);

            // Withdraw all to recipient
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();
            const withdrawData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256'],
                [contractAddress, chainId, depositAmount, Math.floor(Date.now() / 1000) + 3600]
            );
            const withdrawNonce = 2;
            const withdrawMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, withdrawData, withdrawNonce]
            );
            const withdrawMessageHash = ethers.keccak256(withdrawMessage);
            const withdrawSignature = await devWallet.signMessage(ethers.getBytes(withdrawMessageHash));

            await chips.connect(user1).withdrawTo(withdrawData, withdrawNonce, withdrawSignature, recipient.address);

            expect(await chips.balanceOf(user1.address)).to.equal(0);
            expect(await mockToken.balanceOf(recipient.address)).to.equal(depositAmount);
        });

        it('Should allow withdrawing to self', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const withdrawAmount = ethers.parseUnits('50', 6);

            await depositGUnits(chips, mockToken, devWallet, user1, depositAmount);

            const initialTokenBalance = await mockToken.balanceOf(user1.address);

            // Withdraw to self
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();
            const withdrawData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256'],
                [contractAddress, chainId, withdrawAmount, Math.floor(Date.now() / 1000) + 3600]
            );
            const withdrawNonce = 2;
            const withdrawMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, withdrawData, withdrawNonce]
            );
            const withdrawMessageHash = ethers.keccak256(withdrawMessage);
            const withdrawSignature = await devWallet.signMessage(ethers.getBytes(withdrawMessageHash));

            await chips.connect(user1).withdrawTo(withdrawData, withdrawNonce, withdrawSignature, user1.address);

            expect(await chips.balanceOf(user1.address)).to.equal(depositAmount - withdrawAmount);
            expect(await mockToken.balanceOf(user1.address)).to.equal(initialTokenBalance + withdrawAmount);
        });

        it('Should revert if trying to withdraw more than balance', async function () {
            const { chips, mockToken, user1, recipient, devWallet } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const withdrawAmount = ethers.parseUnits('150', 6); // More than deposited

            await depositGUnits(chips, mockToken, devWallet, user1, depositAmount);

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();
            const withdrawData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256'],
                [contractAddress, chainId, withdrawAmount, Math.floor(Date.now() / 1000) + 3600]
            );
            const withdrawNonce = 2;
            const withdrawMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, withdrawData, withdrawNonce]
            );
            const withdrawMessageHash = ethers.keccak256(withdrawMessage);
            const withdrawSignature = await devWallet.signMessage(ethers.getBytes(withdrawMessageHash));

            await expect(
                chips.connect(user1).withdrawTo(withdrawData, withdrawNonce, withdrawSignature, recipient.address)
            )
                .to.be.revertedWithCustomError(chips, 'InsufficientUnlockedBalance')
                .withArgs(user1.address, withdrawAmount, depositAmount);
        });

        it('Should revert if paused', async function () {
            const { chips, mockToken, user1, recipient, devWallet } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);

            await depositGUnits(chips, mockToken, devWallet, user1, depositAmount);
            await chips.connect(devWallet).pause();

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();
            const withdrawData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256'],
                [contractAddress, chainId, depositAmount, Math.floor(Date.now() / 1000) + 3600]
            );
            const withdrawNonce = 2;
            const withdrawMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, withdrawData, withdrawNonce]
            );
            const withdrawMessageHash = ethers.keccak256(withdrawMessage);
            const withdrawSignature = await devWallet.signMessage(ethers.getBytes(withdrawMessageHash));

            await expect(
                chips.connect(user1).withdrawTo(withdrawData, withdrawNonce, withdrawSignature, recipient.address)
            ).to.be.revertedWithCustomError(chips, 'EnforcedPause');
        });
    });

    describe('adminWithdrawTo', function () {
        it('Should allow MANAGER_ROLE to withdraw on behalf of users to different addresses', async function () {
            const { chips, mockToken, manager, user1, user2, recipient, recipient2, devWallet, gameServer } =
                await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const withdrawAmounts = [ethers.parseUnits('30', 6), ethers.parseUnits('50', 6)];

            // Admin deposit funds for users
            await mockToken.connect(gameServer).approve(await chips.getAddress(), depositAmount * 2n);
            await chips
                .connect(gameServer)
                .adminDeposit([user1.address, user2.address], [depositAmount, depositAmount]);

            // Manager withdraws on behalf of users
            await expect(
                chips
                    .connect(manager)
                    .adminWithdrawTo(
                        [user1.address, user2.address],
                        [recipient.address, recipient2.address],
                        withdrawAmounts
                    )
            )
                .to.emit(chips, 'Withdraw')
                .withArgs(user1.address, withdrawAmounts[0])
                .and.to.emit(chips, 'Withdraw')
                .withArgs(user2.address, withdrawAmounts[1]);

            // Check balances
            expect(await chips.balanceOf(user1.address)).to.equal(ethers.parseUnits('70', 6));
            expect(await chips.balanceOf(user2.address)).to.equal(ethers.parseUnits('50', 6));
            expect(await mockToken.balanceOf(recipient.address)).to.equal(withdrawAmounts[0]);
            expect(await mockToken.balanceOf(recipient2.address)).to.equal(withdrawAmounts[1]);
        });

        it('Should allow LIVE_OPS_ROLE to withdraw on behalf of users', async function () {
            const { chips, mockToken, liveOps, user1, recipient, devWallet } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const withdrawAmount = ethers.parseUnits('20', 6);

            // Admin deposit funds first
            await mockToken.connect(liveOps).approve(await chips.getAddress(), depositAmount);
            await chips.connect(liveOps).adminDeposit([user1.address], [depositAmount]);

            await chips.connect(liveOps).adminWithdrawTo([user1.address], [recipient.address], [withdrawAmount]);

            expect(await chips.balanceOf(user1.address)).to.equal(ethers.parseUnits('80', 6));
            expect(await mockToken.balanceOf(recipient.address)).to.equal(withdrawAmount);
        });

        it('Should allow GAME_SERVER_ROLE to withdraw on behalf of users', async function () {
            const { chips, mockToken, gameServer, user1, recipient, devWallet } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const withdrawAmount = ethers.parseUnits('25', 6);

            // Admin deposit funds first
            await mockToken.connect(gameServer).approve(await chips.getAddress(), depositAmount);
            await chips.connect(gameServer).adminDeposit([user1.address], [depositAmount]);

            await chips.connect(gameServer).adminWithdrawTo([user1.address], [recipient.address], [withdrawAmount]);

            expect(await chips.balanceOf(user1.address)).to.equal(ethers.parseUnits('75', 6));
            expect(await mockToken.balanceOf(recipient.address)).to.equal(withdrawAmount);
        });

        it('Should handle multiple withdrawals to same recipient', async function () {
            const { chips, mockToken, manager, user1, user2, recipient, devWallet, gameServer } =
                await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const withdrawAmounts = [ethers.parseUnits('30', 6), ethers.parseUnits('40', 6)];

            // Admin deposit funds first
            await mockToken.connect(gameServer).approve(await chips.getAddress(), depositAmount * 2n);
            await chips
                .connect(gameServer)
                .adminDeposit([user1.address, user2.address], [depositAmount, depositAmount]);

            await chips
                .connect(manager)
                .adminWithdrawTo(
                    [user1.address, user2.address],
                    [recipient.address, recipient.address],
                    withdrawAmounts
                );

            expect(await mockToken.balanceOf(recipient.address)).to.equal(withdrawAmounts[0] + withdrawAmounts[1]);
        });

        it('Should revert if array lengths mismatch', async function () {
            const { chips, manager, user1, user2, recipient } = await loadFixture(deployFixtures);

            await expect(
                chips.connect(manager).adminWithdrawTo(
                    [user1.address, user2.address],
                    [recipient.address], // Missing one recipient
                    [ethers.parseUnits('10', 6), ethers.parseUnits('20', 6)]
                )
            ).to.be.revertedWithCustomError(chips, 'ArrayLengthMismatch');

            await expect(
                chips.connect(manager).adminWithdrawTo(
                    [user1.address],
                    [recipient.address, recipient.address], // Too many recipients
                    [ethers.parseUnits('10', 6)]
                )
            ).to.be.revertedWithCustomError(chips, 'ArrayLengthMismatch');
        });

        it('Should revert if recipient is zero address', async function () {
            const { chips, manager, user1 } = await loadFixture(deployFixtures);

            await expect(
                chips
                    .connect(manager)
                    .adminWithdrawTo([user1.address], [ethers.ZeroAddress], [ethers.parseUnits('10', 6)])
            ).to.be.revertedWithCustomError(chips, 'AddressIsZero');
        });

        it('Should revert if not authorized', async function () {
            const { chips, user1, user2, recipient } = await loadFixture(deployFixtures);

            await expect(
                chips.connect(user1).adminWithdrawTo([user2.address], [recipient.address], [ethers.parseUnits('10', 6)])
            ).to.be.revertedWithCustomError(chips, 'NotAuthorized');
        });

        it('Should revert if withdrawing more than user balance', async function () {
            const { chips, mockToken, manager, user1, recipient, devWallet, gameServer } =
                await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const excessAmount = ethers.parseUnits('150', 6); // More than the 100 deposited

            // Admin deposit funds first
            await mockToken.connect(gameServer).approve(await chips.getAddress(), depositAmount);
            await chips.connect(gameServer).adminDeposit([user1.address], [depositAmount]);

            await expect(chips.connect(manager).adminWithdrawTo([user1.address], [recipient.address], [excessAmount]))
                .to.be.revertedWithCustomError(chips, 'InsufficientUnlockedBalance')
                .withArgs(user1.address, excessAmount, depositAmount);
        });
    });

    describe('adminWithdrawAllTo', function () {
        it('Should allow MANAGER_ROLE to withdraw all funds on behalf of users to different addresses', async function () {
            const { chips, mockToken, manager, user1, user2, recipient, recipient2, devWallet, gameServer } =
                await loadFixture(deployFixtures);

            // Admin deposit different amounts
            await mockToken.connect(gameServer).approve(await chips.getAddress(), ethers.parseUnits('200', 6));
            await chips
                .connect(gameServer)
                .adminDeposit(
                    [user1.address, user2.address],
                    [ethers.parseUnits('75', 6), ethers.parseUnits('125', 6)]
                );

            await expect(
                chips
                    .connect(manager)
                    .adminWithdrawAllTo([user1.address, user2.address], [recipient.address, recipient2.address])
            )
                .to.emit(chips, 'Withdraw')
                .withArgs(user1.address, ethers.parseUnits('75', 6))
                .and.to.emit(chips, 'Withdraw')
                .withArgs(user2.address, ethers.parseUnits('125', 6));

            // Check G-Units balances are zero
            expect(await chips.balanceOf(user1.address)).to.equal(0);
            expect(await chips.balanceOf(user2.address)).to.equal(0);

            // Check token balances
            expect(await mockToken.balanceOf(recipient.address)).to.equal(ethers.parseUnits('75', 6));
            expect(await mockToken.balanceOf(recipient2.address)).to.equal(ethers.parseUnits('125', 6));
        });

        it('Should allow LIVE_OPS_ROLE to withdraw all funds', async function () {
            const { chips, mockToken, liveOps, user1, recipient, devWallet } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);

            await mockToken.connect(liveOps).approve(await chips.getAddress(), depositAmount);
            await chips.connect(liveOps).adminDeposit([user1.address], [depositAmount]);

            await chips.connect(liveOps).adminWithdrawAllTo([user1.address], [recipient.address]);

            expect(await chips.balanceOf(user1.address)).to.equal(0);
            expect(await mockToken.balanceOf(recipient.address)).to.equal(depositAmount);
        });

        it('Should allow GAME_SERVER_ROLE to withdraw all funds', async function () {
            const { chips, mockToken, gameServer, user1, recipient, devWallet } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);

            await mockToken.connect(gameServer).approve(await chips.getAddress(), depositAmount);
            await chips.connect(gameServer).adminDeposit([user1.address], [depositAmount]);

            await chips.connect(gameServer).adminWithdrawAllTo([user1.address], [recipient.address]);

            expect(await chips.balanceOf(user1.address)).to.equal(0);
            expect(await mockToken.balanceOf(recipient.address)).to.equal(depositAmount);
        });

        it('Should handle users with zero balance', async function () {
            const { chips, mockToken, manager, user1, user2, recipient, devWallet, gameServer } =
                await loadFixture(deployFixtures);

            // Only deposit for user1
            await mockToken.connect(gameServer).approve(await chips.getAddress(), ethers.parseUnits('75', 6));
            await chips.connect(gameServer).adminDeposit([user1.address], [ethers.parseUnits('75', 6)]);
            // user2 has zero balance

            await chips
                .connect(manager)
                .adminWithdrawAllTo([user1.address, user2.address], [recipient.address, recipient.address]);

            expect(await chips.balanceOf(user1.address)).to.equal(0);
            expect(await chips.balanceOf(user2.address)).to.equal(0);
            expect(await mockToken.balanceOf(recipient.address)).to.equal(ethers.parseUnits('75', 6));
        });

        it('Should handle empty arrays', async function () {
            const { chips, manager } = await loadFixture(deployFixtures);

            // Should not revert with empty arrays
            await expect(chips.connect(manager).adminWithdrawAllTo([], [])).to.not.be.reverted;
        });

        it('Should revert if array lengths mismatch', async function () {
            const { chips, manager, user1, user2, recipient } = await loadFixture(deployFixtures);

            await expect(
                chips.connect(manager).adminWithdrawAllTo(
                    [user1.address, user2.address],
                    [recipient.address] // Missing one recipient
                )
            ).to.be.revertedWithCustomError(chips, 'ArrayLengthMismatch');
        });

        it('Should revert if recipient is zero address', async function () {
            const { chips, manager, user1 } = await loadFixture(deployFixtures);

            await expect(
                chips.connect(manager).adminWithdrawAllTo([user1.address], [ethers.ZeroAddress])
            ).to.be.revertedWithCustomError(chips, 'AddressIsZero');
        });

        it('Should revert if not authorized', async function () {
            const { chips, user1, user2, recipient } = await loadFixture(deployFixtures);

            await expect(
                chips.connect(user1).adminWithdrawAllTo([user2.address], [recipient.address])
            ).to.be.revertedWithCustomError(chips, 'NotAuthorized');
        });
    });

    describe('Integration with locked funds', function () {
        it('Should only withdraw unlocked funds with withdrawTo', async function () {
            const { chips, mockToken, gameServer, user1, recipient, devWallet } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount = ethers.parseUnits('60', 6);
            const availableAmount = depositAmount - lockAmount;

            // Deposit and lock funds
            await depositGUnits(chips, mockToken, devWallet, user1, depositAmount);
            await chips.connect(gameServer).lockFunds(user1.address, lockAmount);

            // Try to withdraw all (should only withdraw available)
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();
            const withdrawData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256'],
                [contractAddress, chainId, availableAmount, Math.floor(Date.now() / 1000) + 3600]
            );
            const withdrawNonce = 2;
            const withdrawMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, withdrawData, withdrawNonce]
            );
            const withdrawMessageHash = ethers.keccak256(withdrawMessage);
            const withdrawSignature = await devWallet.signMessage(ethers.getBytes(withdrawMessageHash));

            await chips.connect(user1).withdrawTo(withdrawData, withdrawNonce, withdrawSignature, recipient.address);

            expect(await chips.balanceOf(user1.address)).to.equal(0); // All available withdrawn
            expect(await chips.balanceOfLocked(user1.address)).to.equal(lockAmount); // Locked remains
            expect(await mockToken.balanceOf(recipient.address)).to.equal(availableAmount);
        });

        it('Should handle adminWithdrawTo with locked funds', async function () {
            const { chips, mockToken, gameServer, manager, user1, recipient, devWallet } =
                await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount = ethers.parseUnits('40', 6);

            // Deposit and lock funds
            await depositGUnits(chips, mockToken, devWallet, user1, depositAmount);
            await chips.connect(gameServer).lockFunds(user1.address, lockAmount);

            // Admin can only withdraw unlocked portion
            const withdrawAmount = ethers.parseUnits('30', 6); // Less than available (60)
            await chips.connect(manager).adminWithdrawTo([user1.address], [recipient.address], [withdrawAmount]);

            expect(await chips.balanceOf(user1.address)).to.equal(ethers.parseUnits('30', 6)); // 60 - 30
            expect(await chips.balanceOfLocked(user1.address)).to.equal(lockAmount);
            expect(await mockToken.balanceOf(recipient.address)).to.equal(withdrawAmount);
        });
    });

    describe('Exchange rate handling', function () {
        it('Should apply exchange rate correctly on withdrawTo', async function () {
            const { chips, mockToken, user1, recipient, devWallet } = await loadFixture(deployFixtures);

            // Set exchange rate 2:1 (2 GUnits = 1 Token)
            await chips.connect(devWallet).setExchangeRate(2, 1);

            const tokenAmount = ethers.parseUnits('100', 6);
            const expectedGUnits = tokenAmount * 2n; // 200 GUnits

            // Deposit
            await depositGUnits(chips, mockToken, devWallet, user1, tokenAmount);
            expect(await chips.balanceOf(user1.address)).to.equal(expectedGUnits);

            // Withdraw half the GUnits
            const withdrawGUnits = expectedGUnits / 2n; // 100 GUnits
            const expectedTokens = withdrawGUnits / 2n; // 50 Tokens

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();
            const withdrawData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256'],
                [contractAddress, chainId, withdrawGUnits, Math.floor(Date.now() / 1000) + 3600]
            );
            const withdrawNonce = 2;
            const withdrawMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, withdrawData, withdrawNonce]
            );
            const withdrawMessageHash = ethers.keccak256(withdrawMessage);
            const withdrawSignature = await devWallet.signMessage(ethers.getBytes(withdrawMessageHash));

            await chips.connect(user1).withdrawTo(withdrawData, withdrawNonce, withdrawSignature, recipient.address);

            expect(await chips.balanceOf(user1.address)).to.equal(withdrawGUnits); // 100 GUnits left
            expect(await mockToken.balanceOf(recipient.address)).to.equal(expectedTokens); // 50 Tokens received
        });
    });
});
