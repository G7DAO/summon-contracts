import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { GUnits, MockERC20 } from 'typechain-types';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';

describe('GUnits-2', function () {
    async function deployFixtures() {
        const [
            devWallet,
            manager,
            user1,
            user2,
            treasury,
            gameServer,
            liveOps,
            user3,
            user4,
            user5,
            user6,
            user7,
            user8,
            user9,
            user10,
        ] = await ethers.getSigners();

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
        await chips.connect(devWallet).grantRole(await chips.READABLE_ROLE(), gameServer.address);
        await chips.connect(devWallet).grantRole(await chips.READABLE_ROLE(), liveOps.address);

        // Mint some tokens to users for testing
        await mockToken.mint(user1.address, ethers.parseUnits('1000', 6));
        await mockToken.mint(user2.address, ethers.parseUnits('1000', 6));
        await mockToken.mint(gameServer.address, ethers.parseUnits('1000', 6));

        return {
            chips,
            mockToken,
            manager,
            user1,
            user2,
            user3,
            user4,
            user5,
            user6,
            user7,
            user8,
            user9,
            user10,
            gameServer,
            treasury,
            liveOps,
            devWallet,
        };
    }

    async function depositGUnits(
        chips: GUnits,
        token: MockERC20,
        deployer: SignerWithAddress,
        wallet: SignerWithAddress,
        amount: bigint
    ) {
        await token.connect(deployer).approve(await chips.getAddress(), amount);
        await chips.connect(deployer).adminDeposit([wallet.address], [amount]);
    }

    async function depositGUnitsBatch(
        chips: GUnits,
        token: MockERC20,
        deployer: SignerWithAddress,
        wallets: SignerWithAddress[],
        amounts: bigint[]
    ) {
        const totalAmount = amounts.reduce((sum, current) => sum + current, 0n);
        await token.connect(deployer).approve(await chips.getAddress(), totalAmount);

        await chips.connect(deployer).adminDeposit(
            wallets.map((w) => w.address),
            amounts
        );
    }

    describe('Lock Funds', function () {
        it('Should allow game server to lock funds', async function () {
            const { chips, mockToken, gameServer, user1 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount = ethers.parseUnits('50', 6);

            // First deposit some funds
            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);

            // Lock funds
            await expect(chips.connect(gameServer).lockFunds(user1.address, lockAmount))
                .to.emit(chips, 'FundsLocked')
                .withArgs(user1.address, lockAmount);

            // Check locked funds
            expect(await chips.connect(gameServer).balanceOfLocked(user1.address)).to.equal(lockAmount);
            expect(await chips.balanceOf(user1.address)).to.equal(depositAmount - lockAmount);
        });

        it('Should revert if trying to lock more than available balance', async function () {
            const { chips, mockToken, gameServer, user1 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount = ethers.parseUnits('150', 6);

            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);

            await expect(chips.connect(gameServer).lockFunds(user1.address, lockAmount))
                .to.be.revertedWithCustomError(chips, 'InsufficientUnlockedBalance')
                .withArgs(user1.address, lockAmount, depositAmount);
        });

        it('Should revert if trying to lock zero amount', async function () {
            const { chips, gameServer, user1 } = await loadFixture(deployFixtures);

            await expect(chips.connect(gameServer).lockFunds(user1.address, 0)).to.be.revertedWithCustomError(
                chips,
                'InvalidAmount'
            );
        });

        it('Should revert if non-game-server tries to lock funds', async function () {
            const { chips, user1, user2 } = await loadFixture(deployFixtures);

            await expect(
                chips.connect(user2).lockFunds(user1.address, ethers.parseUnits('50', 6))
            ).to.be.revertedWithCustomError(chips, 'AccessControlUnauthorizedAccount');
        });
    });

    describe('Unlock Funds', function () {
        it('Should allow live ops to unlock funds', async function () {
            const { chips, mockToken, gameServer, liveOps, user1 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount = ethers.parseUnits('50', 6);

            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);

            await chips.connect(gameServer).lockFunds(user1.address, lockAmount);

            // Unlock funds (now requires LIVE_OPS_ROLE)
            await expect(chips.connect(liveOps).unlockFunds(user1.address, lockAmount))
                .to.emit(chips, 'FundsUnlocked')
                .withArgs(user1.address, lockAmount);

            expect(await chips.connect(liveOps).balanceOfLocked(user1.address)).to.equal(0);
            expect(await chips.balanceOf(user1.address)).to.equal(depositAmount);
        });

        it('Should revert if no locked funds exist', async function () {
            const { chips, liveOps, user1 } = await loadFixture(deployFixtures);

            await expect(chips.connect(liveOps).unlockFunds(user1.address, ethers.parseUnits('1', 6)))
                .to.be.revertedWithCustomError(chips, 'NoLockedFunds')
                .withArgs(user1.address);
        });

        it('Should revert if non-live-ops or game-server tries to unlock funds', async function () {
            const { chips, mockToken, gameServer, user1, user2 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount = ethers.parseUnits('50', 6);

            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);

            await chips.connect(gameServer).lockFunds(user1.address, lockAmount);

            // Game server can no longer unlock funds
            await expect(chips.connect(user2).unlockFunds(user1.address, lockAmount)).to.be.revertedWithCustomError(
                chips,
                'NotAuthorized'
            );
        });
    });

    describe('Withdrawals with Locked Funds', function () {
        it('Should only allow withdrawal of unlocked funds', async function () {
            const { chips, mockToken, gameServer, user1, devWallet } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount = ethers.parseUnits('60', 6);
            const withdrawAmount = ethers.parseUnits('40', 6);

            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);

            await chips.connect(gameServer).lockFunds(user1.address, lockAmount);

            // Should be able to withdraw available balance
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();
            const withdrawData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256'],
                [contractAddress, chainId, withdrawAmount, Math.floor(Date.now() / 1000) + 3600]
            );
            const withdrawNonce = 1;
            const withdrawMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, withdrawData, withdrawNonce]
            );
            const withdrawMessageHash = ethers.keccak256(withdrawMessage);
            const withdrawSignature = await devWallet.signMessage(ethers.getBytes(withdrawMessageHash));

            await expect(chips.connect(user1).withdraw(withdrawData, withdrawNonce, withdrawSignature))
                .to.emit(chips, 'Withdraw')
                .withArgs(user1.address, withdrawAmount);

            expect(await chips.balanceOf(user1.address)).to.equal(0); // Liquid balance should be 0 after withdrawing all available
            expect(await chips.balanceOfLocked(user1.address)).to.equal(lockAmount);
        });

        it('Should revert withdrawal if amount exceeds available balance', async function () {
            const { chips, mockToken, gameServer, user1, devWallet } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount = ethers.parseUnits('60', 6);
            const withdrawAmount = ethers.parseUnits('50', 6); // More than available (40)

            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);

            await chips.connect(gameServer).lockFunds(user1.address, lockAmount);

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();
            const withdrawData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256'],
                [contractAddress, chainId, withdrawAmount, Math.floor(Date.now() / 1000) + 3600]
            );
            const withdrawNonce = 1;
            const withdrawMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, withdrawData, withdrawNonce]
            );
            const withdrawMessageHash = ethers.keccak256(withdrawMessage);
            const withdrawSignature = await devWallet.signMessage(ethers.getBytes(withdrawMessageHash));

            const availableBalance = depositAmount - lockAmount;
            await expect(chips.connect(user1).withdraw(withdrawData, withdrawNonce, withdrawSignature))
                .to.be.revertedWithCustomError(chips, 'InsufficientUnlockedBalance')
                .withArgs(user1.address, withdrawAmount, availableBalance);
        });

        it('Should allow withdrawAll only up to available balance', async function () {
            const { chips, mockToken, gameServer, user1 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount = ethers.parseUnits('60', 6);

            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);

            await chips.connect(gameServer).lockFunds(user1.address, lockAmount);

            const liquidBalanceToWithdraw = depositAmount - lockAmount; // This is 40

            await expect(chips.connect(user1).withdrawAll())
                .to.emit(chips, 'Withdraw')
                .withArgs(user1.address, liquidBalanceToWithdraw); // Should withdraw the liquid part

            expect(await chips.balanceOf(user1.address)).to.equal(0); // Liquid becomes 0
            expect(await chips.balanceOfLocked(user1.address)).to.equal(lockAmount); // Locked remains 60
        });
    });

    describe('Admin Payout with Locked Funds', function () {
        it('Should handle winner payout correctly with locked funds', async function () {
            const {
                chips,
                mockToken,
                gameServer,
                user1,
                user2,
                user3,
                user4,
                user5,
                user6,
                user7,
                user8,
                user9,
                user10,
            } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('20', 6);
            const lockAmount = ethers.parseUnits('10', 6);
            const firstPlaceAmount = ethers.parseUnits('43.2', 6);
            const secondPlaceAmount = ethers.parseUnits('21.6', 6);
            const thirdPlaceAmount = ethers.parseUnits('14.4', 6);
            const fourthPlaceAmount = ethers.parseUnits('10.80', 6);

            // Setup initial balances
            await depositGUnitsBatch(
                chips,
                mockToken,
                gameServer,
                [user1, user2, user3, user4, user5, user6, user7, user8, user9, user10],
                [
                    depositAmount,
                    depositAmount,
                    depositAmount,
                    depositAmount,
                    depositAmount,
                    depositAmount,
                    depositAmount,
                    depositAmount,
                    depositAmount,
                    depositAmount,
                ]
            );

            // Lock funds for both players
            await chips
                .connect(gameServer)
                .lockFundsBatch(
                    [user1, user2, user3, user4, user5, user6, user7, user8, user9, user10],
                    [
                        lockAmount,
                        lockAmount,
                        lockAmount,
                        lockAmount,
                        lockAmount,
                        lockAmount,
                        lockAmount,
                        lockAmount,
                        lockAmount,
                        lockAmount,
                    ]
                );

            // Process payout: user1 loses 50, user2 wins 50 - 5(rake) = 45
            const payouts = [
                {
                    player: user1.address,
                    isWinner: true,
                    amount: firstPlaceAmount,
                    buyInAmount: lockAmount,
                },
                {
                    player: user2.address,
                    isWinner: true,
                    amount: secondPlaceAmount,
                    buyInAmount: lockAmount,
                },
                {
                    player: user3.address,
                    isWinner: true,
                    amount: thirdPlaceAmount,
                    buyInAmount: lockAmount,
                },
                {
                    player: user4.address,
                    isWinner: true,
                    amount: fourthPlaceAmount,
                    buyInAmount: lockAmount,
                },
                {
                    player: user5.address,
                    isWinner: false,
                    amount: 0,
                    buyInAmount: lockAmount,
                },
                {
                    player: user6.address,
                    isWinner: false,
                    amount: 0,
                    buyInAmount: lockAmount,
                },
                {
                    player: user7.address,
                    isWinner: false,
                    amount: 0,
                    buyInAmount: lockAmount,
                },
                {
                    player: user8.address,
                    isWinner: false,
                    amount: 0,
                    buyInAmount: lockAmount,
                },
                {
                    player: user9.address,
                    isWinner: false,
                    amount: 0,
                    buyInAmount: lockAmount,
                },
                {
                    player: user10.address,
                    isWinner: false,
                    amount: 0,
                    buyInAmount: lockAmount,
                },
            ];

            const rakeFee = ethers.parseUnits('10', 6);

            await expect(chips.connect(gameServer).adminPayout(payouts, rakeFee))
                .to.emit(chips, 'PayoutProcessed')
                .and.to.emit(chips, 'FundsReleased');

            // Check locked funds
            expect(
                await chips
                    .connect(gameServer)
                    .balanceOfLockedBatch([
                        user1.address,
                        user2.address,
                        user3.address,
                        user4.address,
                        user5.address,
                        user6.address,
                        user7.address,
                        user8.address,
                        user9.address,
                        user10.address,
                    ])
            ).to.deep.equal([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

            // Check final balances
            expect(
                await chips
                    .connect(gameServer)
                    .balanceOfBatch([
                        user1.address,
                        user2.address,
                        user3.address,
                        user4.address,
                        user5.address,
                        user6.address,
                        user7.address,
                        user8.address,
                        user9.address,
                        user10.address,
                    ])
            ).to.deep.equal([
                depositAmount + firstPlaceAmount,
                depositAmount + secondPlaceAmount,
                depositAmount + thirdPlaceAmount,
                depositAmount + fourthPlaceAmount,
                depositAmount - lockAmount,
                depositAmount - lockAmount,
                depositAmount - lockAmount,
                depositAmount - lockAmount,
                depositAmount - lockAmount,
                depositAmount - lockAmount,
            ]);
        });

        it('Should handle complete loss of locked funds', async function () {
            const { chips, mockToken, gameServer, user1 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount = ethers.parseUnits('50', 6);

            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);

            await chips.connect(gameServer).lockFunds(user1.address, lockAmount);

            const payouts = [
                {
                    player: user1.address,
                    isWinner: false,
                    amount: lockAmount, // Lose entire locked amount
                    buyInAmount: lockAmount,
                },
            ];

            await chips.connect(gameServer).adminPayout(payouts, 0);

            expect(await chips.balanceOf(user1.address)).to.equal(depositAmount - lockAmount);
            expect(await chips.connect(gameServer).balanceOfLocked(user1.address)).to.equal(0);
        });

        it('Should revert if trying to deduct more than locked amount', async function () {
            const { chips, mockToken, gameServer, user1 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount = ethers.parseUnits('30', 6);
            const lossAmount = ethers.parseUnits('50', 6); // More than locked

            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);

            await chips.connect(gameServer).lockFunds(user1.address, lockAmount);

            const payouts = [
                {
                    player: user1.address,
                    isWinner: false,
                    amount: 0,
                    buyInAmount: lossAmount,
                },
            ];

            await expect(chips.connect(gameServer).adminPayout(payouts, 0))
                .to.be.revertedWithCustomError(chips, 'InsufficientUnlockedBalance')
                .withArgs(user1.address, lossAmount, lockAmount);
        });
    });

    describe('View Functions', function () {
        it('Should return zero for users with no locked funds', async function () {
            const { chips, user1, manager } = await loadFixture(deployFixtures);

            expect(await chips.connect(manager).balanceOfLocked(user1.address)).to.equal(0);
            expect(await chips.balanceOf(user1.address)).to.equal(0);
        });
    });

    describe('Integration Scenarios', function () {
        it('Should handle complex game scenario with multiple players', async function () {
            const { chips, mockToken, gameServer, user1, user2, treasury, devWallet } =
                await loadFixture(deployFixtures);
            const entryFee = ethers.parseUnits('50', 6);
            const depositAmount = ethers.parseUnits('200', 6);

            // Setup initial balances
            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            await depositGUnits(chips, mockToken, gameServer, user2, depositAmount);

            // Both players join the game
            await chips.connect(gameServer).lockFunds(user1.address, entryFee);
            await chips.connect(gameServer).lockFunds(user2.address, entryFee);

            // Game ends: user1 wins, gets 90 (100 - 10% rake), user2 loses 50
            const winAmount = ethers.parseUnits('90', 6);
            const rakeFee = ethers.parseUnits('10', 6);

            const payouts = [
                {
                    player: user1.address,
                    isWinner: true,
                    amount: winAmount,
                    buyInAmount: entryFee,
                },
                {
                    player: user2.address,
                    isWinner: false,
                    amount: entryFee,
                    buyInAmount: entryFee,
                },
            ];

            await chips.connect(gameServer).adminPayout(payouts, rakeFee);

            // Verify final state
            expect(await chips.balanceOf(user1.address)).to.equal(depositAmount + winAmount);
            expect(await chips.balanceOf(user2.address)).to.equal(depositAmount - entryFee);
            expect(await chips.getCollectedFees()).to.equal(rakeFee);

            // All funds should be unlocked
            expect(await chips.connect(gameServer).balanceOfLocked(user1.address)).to.equal(0);
            expect(await chips.connect(gameServer).balanceOfLocked(user2.address)).to.equal(0);

            // Withdraw fees
            const treasuryBalanceBefore = await mockToken.balanceOf(treasury.address);
            await chips.connect(devWallet).withdrawFees(treasury.address);
            expect(await mockToken.balanceOf(treasury.address)).to.equal(treasuryBalanceBefore + rakeFee);
        });
    });

    describe('Batch Lock and Unlock', function () {
        it('Should allow game server to lock funds for multiple users in a batch', async function () {
            const { chips, mockToken, gameServer, user1, user2 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount = ethers.parseUnits('50', 6);

            // Deposit funds for users
            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            await depositGUnits(chips, mockToken, gameServer, user2, depositAmount);

            const users = [user1.address, user2.address];
            const amounts = [lockAmount, lockAmount];

            // Lock funds in batch
            await expect(chips.connect(gameServer).lockFundsBatch(users, amounts))
                .to.emit(chips, 'FundsLocked')
                .withArgs(user1.address, lockAmount)
                .and.to.emit(chips, 'FundsLocked')
                .withArgs(user2.address, lockAmount);

            // Check locked funds and available balances
            expect(await chips.connect(gameServer).balanceOfLocked(user1.address)).to.equal(lockAmount);
            expect(await chips.balanceOf(user1.address)).to.equal(depositAmount - lockAmount);
            expect(await chips.connect(gameServer).balanceOfLocked(user2.address)).to.equal(lockAmount);
            expect(await chips.balanceOf(user2.address)).to.equal(depositAmount - lockAmount);
        });

        it('Should revert lockFundsBatch if users and amounts arrays have different lengths', async function () {
            const { chips, gameServer, user1 } = await loadFixture(deployFixtures);
            const shortAmounts = [ethers.parseUnits('50', 6)];
            const longUsers = [user1.address, gameServer.address];

            await expect(chips.connect(gameServer).lockFundsBatch(longUsers, shortAmounts)).to.be.reverted;
        });

        it('Should revert lockFundsBatch if any user has insufficient available balance', async function () {
            const { chips, mockToken, gameServer, user1, user2 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const insufficientDeposit = ethers.parseUnits('10', 6);
            const lockAmount = ethers.parseUnits('50', 6);

            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            await depositGUnits(chips, mockToken, gameServer, user2, insufficientDeposit);

            const users = [user1.address, user2.address];
            const amounts = [lockAmount, lockAmount];

            await expect(chips.connect(gameServer).lockFundsBatch(users, amounts))
                .to.be.revertedWithCustomError(chips, 'InsufficientUnlockedBalance')
                .withArgs(user2.address, lockAmount, insufficientDeposit);
        });

        it('Should revert lockFundsBatch if called by non-game-server', async function () {
            const { chips, user1, user2 } = await loadFixture(deployFixtures);
            const users = [user1.address];
            const amounts = [ethers.parseUnits('50', 6)];

            await expect(chips.connect(user2).lockFundsBatch(users, amounts)).to.be.revertedWithCustomError(
                chips,
                'AccessControlUnauthorizedAccount'
            );
        });

        // Tests for unlockFundsBatch
        it('Should allow live ops to unlock funds for multiple users in a batch', async function () {
            const { chips, mockToken, gameServer, liveOps, user1, user2 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount = ethers.parseUnits('50', 6);

            // Deposit and lock funds
            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            await depositGUnits(chips, mockToken, gameServer, user2, depositAmount);
            await chips.connect(gameServer).lockFundsBatch([user1.address, user2.address], [lockAmount, lockAmount]);

            // Unlock funds in batch by liveOps
            await expect(
                chips.connect(liveOps).unlockFundsBatch([user1.address, user2.address], [lockAmount, lockAmount])
            )
                .to.emit(chips, 'FundsUnlocked')
                .withArgs(user1.address, lockAmount)
                .and.to.emit(chips, 'FundsUnlocked')
                .withArgs(user2.address, lockAmount);

            expect(await chips.connect(liveOps).balanceOfLocked(user1.address)).to.equal(0);
            expect(await chips.balanceOf(user1.address)).to.equal(depositAmount);
            expect(await chips.connect(liveOps).balanceOfLocked(user2.address)).to.equal(0);
            expect(await chips.balanceOf(user2.address)).to.equal(depositAmount);
        });

        it('Should allow game server to unlock funds for multiple users in a batch', async function () {
            const { chips, mockToken, gameServer, user1, user2 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount = ethers.parseUnits('50', 6);

            // Deposit and lock funds
            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            await depositGUnits(chips, mockToken, gameServer, user2, depositAmount);
            await chips.connect(gameServer).lockFundsBatch([user1.address, user2.address], [lockAmount, lockAmount]);

            // Unlock funds in batch by gameServer
            await expect(
                chips.connect(gameServer).unlockFundsBatch([user1.address, user2.address], [lockAmount, lockAmount])
            )
                .to.emit(chips, 'FundsUnlocked')
                .withArgs(user1.address, lockAmount)
                .and.to.emit(chips, 'FundsUnlocked')
                .withArgs(user2.address, lockAmount);

            expect(await chips.connect(gameServer).balanceOfLocked(user1.address)).to.equal(0);
            expect(await chips.balanceOf(user1.address)).to.equal(depositAmount);
            expect(await chips.connect(gameServer).balanceOfLocked(user2.address)).to.equal(0);
            expect(await chips.balanceOf(user2.address)).to.equal(depositAmount);
        });

        it('Should revert unlockFundsBatch if users and amounts arrays have different lengths', async function () {
            const { chips, liveOps, user1 } = await loadFixture(deployFixtures);
            const users = [user1.address];
            const amounts = [ethers.parseUnits('50', 6), ethers.parseUnits('30', 6)];

            const shortAmounts = [ethers.parseUnits('50', 6)];
            const longUsers = [user1.address, liveOps.address];

            await expect(chips.connect(liveOps).unlockFundsBatch(longUsers, shortAmounts)).to.be.reverted;
        });

        it('Should revert unlockFundsBatch if any user has insufficient locked funds', async function () {
            const { chips, mockToken, gameServer, liveOps, user1, user2 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmountUser1 = ethers.parseUnits('50', 6);
            const lockAmountUser2 = ethers.parseUnits('20', 6); // User2 has less locked
            const unlockAmount = ethers.parseUnits('500', 6); // Attempt to unlock more than user2 has

            // Deposit and lock
            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            await depositGUnits(chips, mockToken, gameServer, user2, depositAmount);
            await chips.connect(gameServer).lockFunds(user1.address, lockAmountUser1);
            await chips.connect(gameServer).lockFunds(user2.address, lockAmountUser2);

            const users = [user1.address, user2.address];
            const amounts = [unlockAmount, unlockAmount]; // User2 will fail here

            await expect(chips.connect(liveOps).unlockFundsBatch(users, amounts))
                .to.be.revertedWithCustomError(chips, 'InsufficientUnlockedBalance')
                .withArgs(user1.address, unlockAmount, lockAmountUser1);
        });

        it('Should revert unlockFundsBatch if any user has no locked funds', async function () {
            const { chips, mockToken, gameServer, liveOps, user1, user2 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmountUser1 = ethers.parseUnits('50', 6);
            // User2 has no funds locked

            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            await depositGUnits(chips, mockToken, gameServer, user2, depositAmount); // User2 has balance but no lock
            await chips.connect(gameServer).lockFunds(user1.address, lockAmountUser1);

            const users = [user1.address, user2.address];
            const amounts = [lockAmountUser1, ethers.parseUnits('10', 6)]; // Try to unlock for user2

            await expect(chips.connect(liveOps).unlockFundsBatch(users, amounts))
                .to.be.revertedWithCustomError(chips, 'NoLockedFunds')
                .withArgs(user2.address);
        });

        it('Should revert unlockFundsBatch if called by non-authorized role (not liveOps or gameServer)', async function () {
            const { chips, user1, user2, manager } = await loadFixture(deployFixtures); // manager is not authorized
            const users = [user1.address];
            const amounts = [ethers.parseUnits('50', 6)];

            // manager is not LIVE_OPS_ROLE or GAME_SERVER_ROLE for unlockFundsBatch
            await expect(chips.connect(manager).unlockFundsBatch(users, amounts)).to.be.revertedWithCustomError(
                chips,
                'NotAuthorized'
            );
        });
    });

    describe('balanceOfLockedBatch(address[] users)', function () {
        it('Should return correct locked balances for a batch of users by authorized role', async function () {
            const { chips, mockToken, gameServer, user1, user2, liveOps } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount1 = ethers.parseUnits('30', 6);
            const lockAmount2 = ethers.parseUnits('40', 6);

            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            await depositGUnits(chips, mockToken, gameServer, user2, depositAmount);

            await chips.connect(gameServer).lockFunds(user1.address, lockAmount1);
            await chips.connect(gameServer).lockFunds(user2.address, lockAmount2);

            const lockedBalances = await chips.connect(liveOps).balanceOfLockedBatch([user1.address, user2.address]);
            expect(lockedBalances[0]).to.equal(lockAmount1);
            expect(lockedBalances[1]).to.equal(lockAmount2);
        });

        it('Should return correct locked balances including zero for users with no locked funds', async function () {
            const { chips, mockToken, gameServer, user1, user2, manager } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount1 = ethers.parseUnits('30', 6);
            // user2 will have balance but no locked funds

            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            await depositGUnits(chips, mockToken, gameServer, user2, depositAmount);

            await chips.connect(gameServer).lockFunds(user1.address, lockAmount1);

            const lockedBalances = await chips.connect(manager).balanceOfLockedBatch([user1.address, user2.address]);
            expect(lockedBalances[0]).to.equal(lockAmount1);
            expect(lockedBalances[1]).to.equal(0);
        });

        it('Should return empty array for empty input', async function () {
            const { chips, gameServer } = await loadFixture(deployFixtures);
            const lockedBalances = await chips.connect(gameServer).balanceOfLockedBatch([]);
            expect(lockedBalances).to.be.an('array').that.is.empty;
        });

        it('Should revert if unauthorized user tries to query balanceOfLockedBatch', async function () {
            const { chips, user1, user2 } = await loadFixture(deployFixtures); // user2 is unauthorized
            await expect(chips.connect(user2).balanceOfLockedBatch([user1.address]))
                .to.be.revertedWithCustomError(chips, 'NotAuthorized')
                .withArgs(user2.address);
        });
    });

    describe('totalBalanceOf(address user)', function () {
        it('Should return correct total balance (balance + locked) for a user by authorized role', async function () {
            const { chips, mockToken, gameServer, user1, liveOps } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount = ethers.parseUnits('40', 6);

            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            await chips.connect(gameServer).lockFunds(user1.address, lockAmount);

            // Total balance should be depositAmount, as (liquid_balance + locked_funds = total_deposit)
            // The code literally is: balances[user] + _getTotalLockedFunds(user)
            // balances[user1] = depositAmount - lockAmount. lockedFunds[user1] = lockAmount.
            // Expected: depositAmount
            expect(await chips.connect(liveOps).totalBalanceOf(user1.address)).to.equal(depositAmount);
        });

        it('Should allow a user to query their own total balance', async function () {
            const { chips, mockToken, gameServer, user1 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('70', 6);
            const lockAmount = ethers.parseUnits('20', 6);

            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            await chips.connect(gameServer).lockFunds(user1.address, lockAmount);
            // Expected: depositAmount
            expect(await chips.connect(user1).totalBalanceOf(user1.address)).to.equal(depositAmount);
        });

        it('Should return total balance (which is just balance) if no funds are locked', async function () {
            const { chips, mockToken, gameServer, user1, manager } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('50', 6);

            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            // No funds locked
            expect(await chips.connect(manager).totalBalanceOf(user1.address)).to.equal(depositAmount); // locked is 0
        });

        it('Should return 0 if user has no balance and no locked funds', async function () {
            const { chips, user1, gameServer } = await loadFixture(deployFixtures);
            expect(await chips.connect(gameServer).totalBalanceOf(user1.address)).to.equal(0);
        });

        it('Should revert if unauthorized user tries to query totalBalanceOf for another user', async function () {
            const { chips, user1, user2 } = await loadFixture(deployFixtures); // user2 is unauthorized
            await expect(chips.connect(user2).totalBalanceOf(user1.address))
                .to.be.revertedWithCustomError(chips, 'NotAuthorized')
                .withArgs(user2.address);
        });
    });

    describe('totalBalanceOfBatch(address[] users)', function () {
        it('Should return correct total balances for a batch of users by authorized role', async function () {
            const { chips, mockToken, gameServer, user1, user2, liveOps } = await loadFixture(deployFixtures);
            const deposit1 = ethers.parseUnits('100', 6);
            const lock1 = ethers.parseUnits('30', 6);
            const deposit2 = ethers.parseUnits('150', 6);
            const lock2 = ethers.parseUnits('50', 6);

            await depositGUnits(chips, mockToken, gameServer, user1, deposit1);
            await chips.connect(gameServer).lockFunds(user1.address, lock1);
            await depositGUnits(chips, mockToken, gameServer, user2, deposit2);
            await chips.connect(gameServer).lockFunds(user2.address, lock2);

            const totalBalances = await chips.connect(liveOps).totalBalanceOfBatch([user1.address, user2.address]);
            // According to current contract logic: balances[user] + lockedFunds[user]
            // User1: dep1=100, lock1=30. Liquid1=70, Locked1=30. Total=100. Expected: dep1
            // User2: dep2=150, lock2=50. Liquid2=100, Locked2=50. Total=150. Expected: dep2
            expect(totalBalances[0]).to.equal(deposit1);
            expect(totalBalances[1]).to.equal(deposit2);
        });

        it('Should include users with no locked funds (total = balance)', async function () {
            const { chips, mockToken, gameServer, user1, user2, manager } = await loadFixture(deployFixtures);
            const deposit1 = ethers.parseUnits('100', 6);
            const lock1 = ethers.parseUnits('30', 6);
            const deposit2 = ethers.parseUnits('150', 6);
            // user2 has deposit but no locked funds

            await depositGUnits(chips, mockToken, gameServer, user1, deposit1);
            await chips.connect(gameServer).lockFunds(user1.address, lock1);
            await depositGUnits(chips, mockToken, gameServer, user2, deposit2);

            const totalBalances = await chips.connect(manager).totalBalanceOfBatch([user1.address, user2.address]);
            // User1: dep1=100, lock1=30. Liquid1=70, Locked1=30. Total=100. Expected: dep1
            // User2: dep2=150, lock2=0. Liquid2=150, Locked2=0. Total=150. Expected: dep2
            expect(totalBalances[0]).to.equal(deposit1);
            expect(totalBalances[1]).to.equal(deposit2);
        });

        it('Should include users with zero balance and zero locked funds (total = 0)', async function () {
            const { chips, mockToken, gameServer, user1, user2, devWallet } = await loadFixture(deployFixtures);
            const deposit1 = ethers.parseUnits('100', 6);
            const lock1 = ethers.parseUnits('30', 6);
            // user2 has no deposit and no lock

            await depositGUnits(chips, mockToken, gameServer, user1, deposit1);
            await chips.connect(gameServer).lockFunds(user1.address, lock1);

            const totalBalances = await chips.connect(devWallet).totalBalanceOfBatch([user1.address, user2.address]);
            // User1: dep1=100, lock1=30. Liquid1=70, Locked1=30. Total=100. Expected: dep1
            // User2: dep2=0, lock2=0. Liquid2=0, Locked2=0. Total=0. Expected: 0
            expect(totalBalances[0]).to.equal(deposit1);
            expect(totalBalances[1]).to.equal(0);
        });

        it('Should return empty array for empty input', async function () {
            const { chips, gameServer } = await loadFixture(deployFixtures);
            const totalBalances = await chips.connect(gameServer).totalBalanceOfBatch([]);
            expect(totalBalances).to.be.an('array').that.is.empty;
        });

        it('Should revert if unauthorized user tries to query totalBalanceOfBatch', async function () {
            const { chips, user1, user2 } = await loadFixture(deployFixtures); // user2 is unauthorized
            await expect(chips.connect(user2).totalBalanceOfBatch([user1.address]))
                .to.be.revertedWithCustomError(chips, 'NotAuthorized')
                .withArgs(user2.address);
        });
    });

    // describe('getAvailableBalance(address user)', function () {
    //     // Tests for getAvailableBalance will go here
    //     // Note: getAvailableBalance is already used in other tests,
    //     // but dedicated tests can cover more specific scenarios or permissions.
    // });
});
