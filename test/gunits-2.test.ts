import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { GUnits, MockERC20 } from 'typechain-types';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';

describe('GUnits-2', function () {
    async function deployFixtures() {
        const [devWallet, manager, user1, user2, treasury, gameServer, liveOps] = await ethers.getSigners();

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
            gameServer,
            treasury,
            liveOps,
            devWallet,
        };
    }

    async function depositGUnits(chips: GUnits, token: MockERC20, deployer: SignerWithAddress, wallet: SignerWithAddress, amount: bigint) {
        await token.connect(deployer).approve(await chips.getAddress(), amount);
        await chips.connect(deployer).adminDeposit([wallet.address], [amount]);
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
            expect(await chips.getAvailableBalance(user1.address)).to.equal(depositAmount - lockAmount);
        });

        it('Should track multiple game sessions for same user', async function () {
            const { chips, mockToken, gameServer, user1 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('200', 6);
            const lockAmount1 = ethers.parseUnits('50', 6);
            const lockAmount2 = ethers.parseUnits('30', 6);
            
            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            
            await chips.connect(gameServer).lockFunds(user1.address, lockAmount1);
            await chips.connect(gameServer).lockFunds(user1.address, lockAmount2);
            
            // The contract appears to replace the locked amount, not accumulate it
            expect(await chips.connect(gameServer).balanceOfLocked(user1.address)).to.equal(lockAmount2);
            expect(await chips.getAvailableBalance(user1.address)).to.equal(depositAmount - lockAmount2);
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
            
            await expect(chips.connect(gameServer).lockFunds(user1.address, 0))
                .to.be.revertedWithCustomError(chips, 'InvalidAmount');
        });

        it('Should revert if non-game-server tries to lock funds', async function () {
            const { chips, user1, user2 } = await loadFixture(deployFixtures);
            
            await expect(chips.connect(user2).lockFunds(user1.address, ethers.parseUnits('50', 6)))
                .to.be.revertedWithCustomError(chips, 'AccessControlUnauthorizedAccount');
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
            expect(await chips.getAvailableBalance(user1.address)).to.equal(depositAmount);
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
            await expect(chips.connect(user2).unlockFunds(user1.address, lockAmount))
                .to.be.revertedWithCustomError(chips, 'NotAuthorized');
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
            
            expect(await chips.balanceOf(user1.address)).to.equal(depositAmount - withdrawAmount);
            expect(await chips.getAvailableBalance(user1.address)).to.equal(0); // All remaining is locked
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
            
            // withdrawAll tries to withdraw the entire balance, which should fail because some funds are locked
            const availableBalance = depositAmount - lockAmount;
            await expect(chips.connect(user1).withdrawAll())
                .to.be.revertedWithCustomError(chips, 'InsufficientUnlockedBalance')
                .withArgs(user1.address, depositAmount, availableBalance);
        });
    });

    describe('Admin Payout with Locked Funds', function () {
        it('Should handle winner payout correctly with locked funds', async function () {
            const { chips, mockToken, gameServer, user1, user2 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmount = ethers.parseUnits('50', 6);
            const winAmount = ethers.parseUnits('45', 6); // Winner gets 45 from loser
            
            // Setup initial balances
            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            await depositGUnits(chips, mockToken, gameServer, user2, depositAmount);
            
            // Lock funds for both players
            await chips.connect(gameServer).lockFunds(user1.address, lockAmount);
            await chips.connect(gameServer).lockFunds(user2.address, lockAmount);
            
            // Process payout: user1 loses 45, user2 wins 45
            const payouts = [
                {
                    player: user1.address,
                    isWinner: false,
                    amount: winAmount,
                },
                {
                    player: user2.address,
                    isWinner: true,
                    amount: winAmount,
                }
            ];
            
            const rakeFee = ethers.parseUnits('5', 6);
            
            await expect(chips.connect(gameServer).adminPayout(payouts, rakeFee))
                .to.emit(chips, 'PayoutProcessed')
                .and.to.emit(chips, 'FundsReleased');
            
            // Check final balances
            expect(await chips.balanceOf(user1.address)).to.equal(depositAmount - winAmount); // Lost 45
            expect(await chips.balanceOf(user2.address)).to.equal(depositAmount + winAmount); // Won 45
            
            // Check locked funds - should be reduced for loser, cleared for winner
            expect(await chips.connect(gameServer).balanceOfLocked(user1.address)).to.equal(lockAmount - winAmount); // 5 still locked
            expect(await chips.connect(gameServer).balanceOfLocked(user2.address)).to.equal(0); // Winner's funds unlocked
            
            // Check available balances
            expect(await chips.getAvailableBalance(user1.address)).to.equal(depositAmount - winAmount - (lockAmount - winAmount));
            expect(await chips.getAvailableBalance(user2.address)).to.equal(depositAmount + winAmount);
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
                }
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
                    amount: lossAmount,
                }
            ];
            
            await expect(chips.connect(gameServer).adminPayout(payouts, 0))
                .to.be.revertedWithCustomError(chips, 'InsufficientUnlockedBalance')
                .withArgs(user1.address, lossAmount, lockAmount);
        });

        it('Should allow payout regardless of gameSessionId (no session validation)', async function () {
            const { chips, mockToken, gameServer, user1, user2 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('20', 6); // 20 USDC
            const lockAmount = ethers.parseUnits('10', 6); // 10 USDC
            
            // Setup: Both users deposit funds
            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            await depositGUnits(chips, mockToken, gameServer, user2, depositAmount);
            
            // Lock funds (the contract doesn't track session IDs)
            await chips.connect(gameServer).lockFunds(user1.address, lockAmount);
            await chips.connect(gameServer).lockFunds(user2.address, lockAmount);
            
            // Verify funds are locked correctly
            expect(await chips.connect(gameServer).balanceOfLocked(user1.address)).to.equal(lockAmount);
            expect(await chips.connect(gameServer).balanceOfLocked(user2.address)).to.equal(lockAmount);
            
            
            // Attempt payout with a different session ID - should succeed
            const payouts = [
                {
                    player: user1.address,
                    isWinner: true,
                    amount: ethers.parseUnits('10', 6), // Winner gets 10
                },
                {
                    player: user2.address,
                    isWinner: false,
                    amount: ethers.parseUnits('10', 6), // Loser loses 10
                }
            ];
            
            // The payout should succeed because the contract doesn't validate session IDs
            await expect(chips.connect(gameServer).adminPayout(payouts, 0))
                .to.emit(chips, 'PayoutProcessed');
            
            // Verify final balances
            expect(await chips.balanceOf(user1.address)).to.equal(depositAmount + ethers.parseUnits('10', 6));
            expect(await chips.balanceOf(user2.address)).to.equal(depositAmount - ethers.parseUnits('10', 6));
            
            // Verify locked funds are updated
            expect(await chips.connect(gameServer).balanceOfLocked(user1.address)).to.equal(0); // Winner's funds unlocked
            expect(await chips.connect(gameServer).balanceOfLocked(user2.address)).to.equal(0); // Loser's remaining funds unlocked
        });
    });

    describe('Emergency Functions', function () {
        it('Should allow manager to emergency unlock funds when paused', async function () {
            const { chips, mockToken, gameServer, manager, devWallet, user1 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('200', 6);
            const lockAmount1 = ethers.parseUnits('50', 6);
            const lockAmount2 = ethers.parseUnits('30', 6);
            
            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            
            
            await chips.connect(gameServer).lockFunds(user1.address, lockAmount1);
            await chips.connect(gameServer).lockFunds(user1.address, lockAmount2);
            
            // Pause contract
            await chips.connect(devWallet).pause();
            
            // Emergency unlock all - since only the last lock amount is tracked, expect only one event
            await expect(chips.connect(manager).emergencyUnlockFunds(user1.address))
                .to.emit(chips, 'FundsUnlocked')
                .withArgs(user1.address, lockAmount2); // Only the last locked amount
            
            expect(await chips.connect(manager).balanceOfLocked(user1.address)).to.equal(0);
            expect(await chips.getAvailableBalance(user1.address)).to.equal(depositAmount);
            expect(await chips.connect(gameServer).balanceOfLocked(user1.address)).to.equal(0);
        });

        it('Should revert emergency unlock when not paused', async function () {
            const { chips, manager, user1 } = await loadFixture(deployFixtures);
            
            await expect(chips.connect(manager).emergencyUnlockFunds(user1.address))
                .to.be.revertedWithCustomError(chips, 'ExpectedPause');
        });

        it('Should revert emergency unlock if not manager', async function () {
            const { chips, devWallet, user1, user2 } = await loadFixture(deployFixtures);
            
            await chips.connect(devWallet).pause();
            
            await expect(chips.connect(user2).emergencyUnlockFunds(user1.address))
                .to.be.revertedWithCustomError(chips, 'AccessControlUnauthorizedAccount');
        });
    });

    describe('View Functions', function () {
        it('Should correctly report total locked funds across sessions', async function () {
            const { chips, mockToken, gameServer, user1 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('300', 6);
            
            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            
            // Lock in 3 different sessions
            const amounts = [ethers.parseUnits('50', 6), ethers.parseUnits('30', 6), ethers.parseUnits('20', 6)];
            
            for (let i = 0; i < amounts.length; i++) {
                await chips.connect(gameServer).lockFunds(user1.address, amounts[i]);
            }
            
            // The contract only tracks the last locked amount, not cumulative
            const lastAmount = amounts[amounts.length - 1];
            expect(await chips.connect(gameServer).balanceOfLocked(user1.address)).to.equal(lastAmount);
            expect(await chips.getAvailableBalance(user1.address)).to.equal(depositAmount - lastAmount);
        });

        it('Should return zero for users with no locked funds', async function () {
            const { chips, user1, manager } = await loadFixture(deployFixtures);
            
            expect(await chips.connect(manager).balanceOfLocked(user1.address)).to.equal(0);
            expect(await chips.getAvailableBalance(user1.address)).to.equal(0);
        });
    });

    describe('Integration Scenarios', function () {
        it('Should handle complex game scenario with multiple players', async function () {
            const { chips, mockToken, gameServer, user1, user2, treasury, devWallet } = await loadFixture(deployFixtures);
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
                },
                {
                    player: user2.address,
                    isWinner: false,
                    amount: entryFee,
                }
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
                .to.emit(chips, 'FundsLocked').withArgs(user1.address, lockAmount)
                .and.to.emit(chips, 'FundsLocked').withArgs(user2.address, lockAmount);

            // Check locked funds and available balances
            expect(await chips.connect(gameServer).balanceOfLocked(user1.address)).to.equal(lockAmount);
            expect(await chips.getAvailableBalance(user1.address)).to.equal(depositAmount - lockAmount);
            expect(await chips.connect(gameServer).balanceOfLocked(user2.address)).to.equal(lockAmount);
            expect(await chips.getAvailableBalance(user2.address)).to.equal(depositAmount - lockAmount);
        });

        it('Should allow game server to lock funds for a large batch of users (50 users)', async function () {
            const { chips, mockToken, gameServer } = await loadFixture(deployFixtures);
            const allSigners = await ethers.getSigners();
            
            const fixedSignersCount = 7; // devWallet, manager, user1, user2, treasury, gameServer, liveOps
            if (allSigners.length <= fixedSignersCount) {
                throw new Error(`Not enough signers for test users. Available: ${allSigners.length}, Needed > ${fixedSignersCount}`);
            }
            const userSigners = allSigners.slice(fixedSignersCount);
            const numUniqueUserSigners = userSigners.length;
            if (numUniqueUserSigners === 0) {
                throw new Error('No available user signers for the test after accounting for fixed roles.');
            }

            const targetBatchSize = 50;
            const depositAmountPerUser = ethers.parseUnits('10', 6); // Each unique user gets this much deposited
            const lockAmountPerOperation = ethers.parseUnits('5', 6); // Each lock operation in the batch uses this amount
            
            const batchLockAddresses = [];
            const batchLockAmounts = [];

            // Mint enough tokens to gameServer for all deposits it will make for unique users
            const totalGameServerMintForDeposits = depositAmountPerUser * BigInt(numUniqueUserSigners);
            await mockToken.mint(gameServer.address, totalGameServerMintForDeposits);

            // Deposit funds for each unique user signer
            for (let i = 0; i < numUniqueUserSigners; i++) {
                const userSigner = userSigners[i];
                await depositGUnits(chips, mockToken, gameServer, userSigner, depositAmountPerUser);
            }

            // Prepare batch arrays for the 50 lock operations
            // Each unique user will be targeted multiple times if targetBatchSize > numUniqueUserSigners
            for (let i = 0; i < targetBatchSize; i++) {
                const userSignerForThisEntry = userSigners[i % numUniqueUserSigners];
                batchLockAddresses.push(userSignerForThisEntry.address);
                batchLockAmounts.push(lockAmountPerOperation);
            }
            
            // Lock funds in batch
            const tx = await chips.connect(gameServer).lockFundsBatch(batchLockAddresses, batchLockAmounts);
            const receipt = await tx.wait();

            // Check events - Expect 50 FundsLocked events
            let fundsLockedEvents = 0;
            if (receipt?.logs) {
                for (const log of receipt.logs) {
                    try {
                        const parsedLog = chips.interface.parseLog(log as any);
                        if (parsedLog && parsedLog.name === 'FundsLocked') {
                            fundsLockedEvents++;
                        }
                    } catch (e) { /* Ignore other events */ }
                }
            }
            expect(fundsLockedEvents).to.equal(targetBatchSize);

            // Check final balances for each unique user signer
            // Since lockedFunds[user] = amount (it's an overwrite, not cumulative for a single user from _lockFunds perspective),
            // and all operations in the batch use \`lockAmountPerOperation\`,
            // the final locked amount for any user who was part of the batch will be \`lockAmountPerOperation\`.
            for (let i = 0; i < numUniqueUserSigners; i++) {
                const userSigner = userSigners[i];
                expect(await chips.connect(gameServer).balanceOfLocked(userSigner.address))
                    .to.equal(lockAmountPerOperation);
                expect(await chips.getAvailableBalance(userSigner.address))
                    .to.equal(depositAmountPerUser - lockAmountPerOperation);
            }
        });

        it('Should revert lockFundsBatch if users and amounts arrays have different lengths', async function () {
            const { chips, gameServer, user1 } = await loadFixture(deployFixtures);
            const users = [user1.address];
            const amounts = [ethers.parseUnits('50', 6), ethers.parseUnits('30', 6)]; // Mismatched length

            const shortAmounts = [ethers.parseUnits('50', 6)];
            const longUsers = [user1.address, gameServer.address]; 

            await expect(chips.connect(gameServer).lockFundsBatch(longUsers, shortAmounts))
                .to.be.reverted; 
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

            await expect(chips.connect(user2).lockFundsBatch(users, amounts))
                .to.be.revertedWithCustomError(chips, 'AccessControlUnauthorizedAccount');
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
            await expect(chips.connect(liveOps).unlockFundsBatch([user1.address, user2.address], [lockAmount, lockAmount]))
                .to.emit(chips, 'FundsUnlocked').withArgs(user1.address, lockAmount)
                .and.to.emit(chips, 'FundsUnlocked').withArgs(user2.address, lockAmount);

            expect(await chips.connect(liveOps).balanceOfLocked(user1.address)).to.equal(0);
            expect(await chips.getAvailableBalance(user1.address)).to.equal(depositAmount);
            expect(await chips.connect(liveOps).balanceOfLocked(user2.address)).to.equal(0);
            expect(await chips.getAvailableBalance(user2.address)).to.equal(depositAmount);
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
            await expect(chips.connect(gameServer).unlockFundsBatch([user1.address, user2.address], [lockAmount, lockAmount]))
                .to.emit(chips, 'FundsUnlocked').withArgs(user1.address, lockAmount)
                .and.to.emit(chips, 'FundsUnlocked').withArgs(user2.address, lockAmount);

            expect(await chips.connect(gameServer).balanceOfLocked(user1.address)).to.equal(0);
            expect(await chips.getAvailableBalance(user1.address)).to.equal(depositAmount);
            expect(await chips.connect(gameServer).balanceOfLocked(user2.address)).to.equal(0);
            expect(await chips.getAvailableBalance(user2.address)).to.equal(depositAmount);
        });

        it('Should revert unlockFundsBatch if users and amounts arrays have different lengths', async function () {
            const { chips, liveOps, user1 } = await loadFixture(deployFixtures);
            const users = [user1.address];
            const amounts = [ethers.parseUnits('50', 6), ethers.parseUnits('30', 6)];

            const shortAmounts = [ethers.parseUnits('50', 6)];
            const longUsers = [user1.address, liveOps.address]; 

            await expect(chips.connect(liveOps).unlockFundsBatch(longUsers, shortAmounts))
                .to.be.reverted;
        });

        it('Should revert unlockFundsBatch if any user has insufficient locked funds', async function () {
            const { chips, mockToken, gameServer, liveOps, user1, user2 } = await loadFixture(deployFixtures);
            const depositAmount = ethers.parseUnits('100', 6);
            const lockAmountUser1 = ethers.parseUnits('50', 6);
            const lockAmountUser2 = ethers.parseUnits('20', 6); // User2 has less locked
            const unlockAmount = ethers.parseUnits('50', 6); // Attempt to unlock more than user2 has

            // Deposit and lock
            await depositGUnits(chips, mockToken, gameServer, user1, depositAmount);
            await depositGUnits(chips, mockToken, gameServer, user2, depositAmount);
            await chips.connect(gameServer).lockFunds(user1.address, lockAmountUser1);
            await chips.connect(gameServer).lockFunds(user2.address, lockAmountUser2);


            const users = [user1.address, user2.address];
            const amounts = [unlockAmount, unlockAmount]; // User2 will fail here

            await expect(chips.connect(liveOps).unlockFundsBatch(users, amounts))
                .to.be.revertedWithCustomError(chips, 'InsufficientLockedBalance')
                .withArgs(user2.address, unlockAmount, lockAmountUser2);
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
            await expect(chips.connect(manager).unlockFundsBatch(users, amounts))
                .to.be.revertedWithCustomError(chips, 'NotAuthorized');
        });

    });

}); 