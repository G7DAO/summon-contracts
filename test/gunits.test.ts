import { PROXY_ADMIN_ABI_PATH } from '@constants/proxy-deployments';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { GUnits, MockERC20, MockUSDC } from 'typechain-types';
import fs from 'fs';
import path from 'path';

describe('GUnits', function () {
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

        // Verify initial role setup
        expect(await chips.hasRole(await chips.DEV_CONFIG_ROLE(), devWallet.address)).to.be.true;
        expect(await chips.hasRole(await chips.MANAGER_ROLE(), devWallet.address)).to.be.true;
        expect(await chips.hasRole(await chips.DEFAULT_ADMIN_ROLE(), devWallet.address)).to.be.true;
        expect(await chips.hasRole(await chips.LIVE_OPS_ROLE(), devWallet.address)).to.be.true;
        // Grant game role
        await chips.connect(devWallet).grantRole(await chips.MANAGER_ROLE(), manager.address);
        expect(await chips.hasRole(await chips.MANAGER_ROLE(), manager.address)).to.be.true;
        await chips.connect(devWallet).grantRole(await chips.READABLE_ROLE(), manager.address);
        expect(await chips.hasRole(await chips.READABLE_ROLE(), manager.address)).to.be.true;
        await chips.connect(devWallet).grantRole(await chips.GAME_SERVER_ROLE(), gameServer.address);
        expect(await chips.hasRole(await chips.GAME_SERVER_ROLE(), gameServer.address)).to.be.true;
        await chips.connect(devWallet).grantRole(await chips.LIVE_OPS_ROLE(), liveOps.address);
        expect(await chips.hasRole(await chips.LIVE_OPS_ROLE(), liveOps.address)).to.be.true;

        // Mint some tokens to users for testing
        await mockToken.mint(user1.address, ethers.parseEther('1000'));
        await mockToken.mint(user2.address, ethers.parseEther('1000'));
        await mockToken.mint(manager.address, ethers.parseEther('1000'));
        await mockToken.mint(gameServer.address, ethers.parseEther('1000'));
        await mockToken.mint(liveOps.address, ethers.parseEther('1000'));

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

    async function depositGUnits(chips: GUnits, token: MockERC20 | MockUSDC, deployer: SignerWithAddress, wallet: SignerWithAddress, amount: bigint) {
        const chainId = (await ethers.provider.getNetwork()).chainId;
        const contractAddress = await chips.getAddress();

        const data = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256', 'uint256', 'uint256', 'bool'],
            [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false]
        );
        const nonce = 1;
        const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [wallet.address, data, nonce]);
        const messageHash = ethers.keccak256(message);
        const signature = await deployer.signMessage(ethers.getBytes(messageHash));

        await token.connect(wallet).approve(await chips.getAddress(), amount);
        await chips.connect(wallet).deposit(data, nonce, signature);
    }

    describe('Initialization', function () {
        it('Should deploy successfully', async function () {
            const { chips } = await loadFixture(deployFixtures);
            expect(await chips.getAddress()).to.be.properAddress;
        });

        it('Should set the correct token address', async function () {
            const { chips, mockToken } = await loadFixture(deployFixtures);
            expect(await chips.token()).to.equal(await mockToken.getAddress());
        });

        it('Should set the correct roles', async function () {
            const { chips, manager, gameServer } = await loadFixture(deployFixtures);
            expect(await chips.hasRole(await chips.MANAGER_ROLE(), manager.address)).to.be.true;
            expect(await chips.hasRole(await chips.GAME_SERVER_ROLE(), gameServer.address)).to.be.true;
        });

        it('Should support required interfaces', async function () {
            const { chips } = await loadFixture(deployFixtures);
            // AccessControl interface ID
            const ACCESS_CONTROL_INTERFACE_ID = '0x7965db0b';
            expect(await chips.supportsInterface(ACCESS_CONTROL_INTERFACE_ID)).to.be.true;
        });

        it("Should NOT deploy with devWallet as zero address", async function () {
            const { chips,mockToken } = await loadFixture(deployFixtures);
            const GUnitsFactory = await ethers.getContractFactory('GUnits');
            await expect(upgrades.deployProxy(
                GUnitsFactory,
                [
                    await mockToken.getAddress(), // _token
                    false, // _isPaused
                    ethers.ZeroAddress, // _devWallet
                ]
            )).to.be.revertedWithCustomError(chips, 'AddressIsZero');
        });
        it("Should NOT initialize twice", async function () {
            const { chips,mockToken, manager } = await loadFixture(deployFixtures);
            await expect(chips.initialize(await mockToken.getAddress(), false, manager.address)).to.be.revertedWithCustomError(chips, 'InvalidInitialization');
        });
        it("Should initialize paused", async function () {
            const { mockToken, manager } = await loadFixture(deployFixtures);
            const GUnitsFactory = await ethers.getContractFactory('GUnits');
            const chipsContract = await upgrades.deployProxy(
                GUnitsFactory,
                [
                    await mockToken.getAddress(), // _token
                    true, // _isPaused
                    manager.address, // _devWallet
                ]
            )
            expect(await chipsContract.paused()).to.be.true;
        });
    });

    describe('Total Supply', function () {
        it('Should update total supply on deposit', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            expect(await chips.totalSupply()).to.equal(amount);
        });

        it('Should update total supply on withdrawal', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            // First deposit
            const depositData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const depositNonce = 1;
            const depositMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, depositData, depositNonce]
            );
            const depositMessageHash = ethers.keccak256(depositMessage);
            const depositSignature = await devWallet.signMessage(ethers.getBytes(depositMessageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(depositData, depositNonce, depositSignature);

            // Then withdraw
            const withdrawData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, true] // Add 1 hour to current timestamp
            );
            const withdrawNonce = 2;
            const withdrawMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, withdrawData, withdrawNonce]
            );
            const withdrawMessageHash = ethers.keccak256(withdrawMessage);
            const withdrawSignature = await devWallet.signMessage(ethers.getBytes(withdrawMessageHash));

            await chips.connect(user1).withdraw(withdrawData, withdrawNonce, withdrawSignature);

            expect(await chips.totalSupply()).to.equal(0);
        });

        it('Should update total supply on admin deposit', async function () {
            const { chips, mockToken, gameServer, user1, user2 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            await mockToken.connect(gameServer).approve(await chips.getAddress(), amount * 2n);
            await chips.connect(gameServer).adminDeposit([user1.address, user2.address], [amount, amount]);

            expect(await chips.totalSupply()).to.equal(amount * 2n);
        });

        it('Should update total supply on admin withdrawal', async function () {
            const { chips, mockToken, devWallet, gameServer, user1, user2 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            // First deposit
            await mockToken.connect(gameServer).approve(await chips.getAddress(), amount * 2n);
            await chips.connect(gameServer).adminDeposit([user1.address, user2.address], [amount, amount]);

            // Pause and withdraw
            await chips.connect(devWallet).pause();
            await chips.connect(devWallet).withdrawAllAdmin([user1.address, user2.address]);

            expect(await chips.totalSupply()).to.equal(0);
        });
    });

    describe('Deposit and Withdraw', function () {
        it('Should allow users to deposit chips', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            expect(await chips.balanceOf(user1.address)).to.equal(amount);
            expect(await mockToken.balanceOf(await chips.getAddress())).to.equal(amount);
        });

        it('Should allow users to withdraw chips', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            // First deposit
            const depositData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const depositNonce = 1;
            const depositMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, depositData, depositNonce]
            );
            const depositMessageHash = ethers.keccak256(depositMessage);
            const depositSignature = await devWallet.signMessage(ethers.getBytes(depositMessageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(depositData, depositNonce, depositSignature);

            // Then withdraw
            const withdrawData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, true] // Add 1 hour to current timestamp
            );
            const withdrawNonce = 2;
            const withdrawMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, withdrawData, withdrawNonce]
            );
            const withdrawMessageHash = ethers.keccak256(withdrawMessage);
            const withdrawSignature = await devWallet.signMessage(ethers.getBytes(withdrawMessageHash));

            await chips.connect(user1).withdraw(withdrawData, withdrawNonce, withdrawSignature);

            expect(await chips.balanceOf(user1.address)).to.equal(0);
            expect(await mockToken.balanceOf(user1.address)).to.equal(ethers.parseEther('1000'));
        });

        it('Should revert if user tries to withdraw more than balance', async function () {
            const { chips, user1, devWallet } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('1');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, true] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            await expect(chips.connect(user1).withdraw(data, nonce, signature)).to.be.revertedWithCustomError(
                chips,
                'InsufficientUnlockedBalance'
            );
        });

        it('Should revert if signature is invalid', async function () {
            const { chips, user1, user2, devWallet } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            // Sign with different user instead of devWallet
            const signature = await user2.signMessage(ethers.getBytes(messageHash));

            await expect(chips.connect(user1).deposit(data, nonce, signature)).to.be.reverted;
        });

        it('Should revert if chain ID is incorrect', async function () {
            const { chips, user1, devWallet } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const wrongChainId = 12345; // Wrong chain ID
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, wrongChainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            await expect(chips.connect(user1).deposit(data, nonce, signature)).to.be.revertedWithCustomError(
                chips,
                'InvalidSeed'
            );
        });
    });

    describe('Manager Operations', function () {
        it('Should allow manager to deposit to multiple users', async function () {
            const { chips, mockToken, gameServer, user1, user2 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            // Manager needs to approve the chips contract to spend tokens
            await mockToken.connect(gameServer).approve(await chips.getAddress(), amount * 2n);

            // Manager deposits to users
            await chips.connect(gameServer).adminDeposit([user1.address, user2.address], [amount, amount]);

            expect(await chips.balanceOf(user1.address)).to.equal(amount);
            expect(await chips.balanceOf(user2.address)).to.equal(amount);
            expect(await mockToken.balanceOf(await chips.getAddress())).to.equal(amount * 2n);
        });

        it('Should allow manager to withdraw all chips from users when paused', async function () {
            const { chips, mockToken, gameServer, devWallet, manager, user1, user2 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const initialBalance = await mockToken.balanceOf(user1.address);
            // First deposit to users
            await mockToken.connect(gameServer).approve(await chips.getAddress(), amount * 2n);
            await chips.connect(gameServer).adminDeposit([user1.address, user2.address], [amount, amount]);
            // Verify initial balances
            expect(await chips.balanceOf(user1.address)).to.equal(amount);
            expect(await chips.balanceOf(user2.address)).to.equal(amount);
            const deposits = await mockToken.balanceOf(await chips.getAddress());
            expect(deposits).to.equal(amount * 2n);
            // Pause the contract
            await chips.connect(devWallet).pause();
            expect(await chips.paused()).to.be.true;

            // Withdraw all chips from users
            await chips.connect(manager).withdrawAllAdmin([user1.address, user2.address]);

            // Verify final balances

            expect(await chips.balanceOf(user1.address)).to.equal(0);
            expect(await chips.balanceOf(user2.address)).to.equal(0);
            expect(await mockToken.balanceOf(await chips.getAddress())).to.equal(0);
            expect(await mockToken.balanceOf(user1.address)).to.equal(amount + initialBalance);
            expect(await mockToken.balanceOf(user2.address)).to.equal(amount + initialBalance);
        });

        it('Should revert if non-manager tries manager operations', async function () {
            const { chips, user1 } = await loadFixture(deployFixtures);
            await expect(
                chips.connect(user1).adminDeposit([user1.address], [ethers.parseEther('100')])
            ).to.be.revertedWithCustomError(chips, 'NotAuthorized');
        });
        it("Should allow live ops to adminDeposit", async function () {
            const { chips, mockToken, user1, user2, liveOps } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            await mockToken.connect(liveOps).approve(await chips.getAddress(), amount * 2n);
            await expect(chips.connect(liveOps).adminDeposit([user1.address, user2.address], [amount, amount])).to.not.be.reverted;
            expect(await chips.balanceOf(user1.address)).to.equal(amount);
            expect(await chips.balanceOf(user2.address)).to.equal(amount);
        })
        it("Should allow live ops to adminPayout", async function () {
            const { chips, mockToken, user1, user2, gameServer } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            await mockToken.connect(gameServer).approve(await chips.getAddress(), amount * 2n);
            await expect(chips.connect(gameServer).adminDeposit([user1.address, user2.address], [amount, amount])).to.not.be.reverted;
            expect(await chips.balanceOf(user1.address)).to.equal(amount);
            expect(await chips.balanceOf(user2.address)).to.equal(amount);
            await expect(chips.connect(gameServer).adminPayout([
                {player: user1.address, isWinner: false, amount: 0n}, 
                {player: user2.address, isWinner: true, amount: amount}
            ], 0n)).to.not.be.reverted;
            expect(await chips.balanceOf(user1.address)).to.equal(amount);
            expect(await chips.balanceOf(user2.address)).to.equal(amount * 2n);
        })
    });

    describe("Readable role", function () {
        it("Should allow readable role to read", async function () {
            const { chips, user1, user2, manager} = await loadFixture(deployFixtures);
            await chips.connect(manager).grantRole(await chips.READABLE_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.READABLE_ROLE(), user1.address)).to.be.true;
            await expect(chips.connect(user1).balanceOf(user2.address)).to.not.be.reverted;
        });
        it("Should NOT get exchange rate if not readable", async function () {
            const { chips, user1 } = await loadFixture(deployFixtures);
            await expect(chips.connect(user1).getExchangeRate()).to.be.revertedWithCustomError(chips, 'AccessControlUnauthorizedAccount');
        });
    });

    describe('Pausable', function () {
        it('Should allow manager to pause and unpause', async function () {
            const { chips, devWallet } = await loadFixture(deployFixtures);

            await chips.connect(devWallet).pause();
            expect(await chips.paused()).to.be.true;

            await chips.connect(devWallet).unpause();
            expect(await chips.paused()).to.be.false;
        });

        it('Should prevent deposits when paused', async function () {
            const { chips, mockToken, devWallet, user1 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            await chips.connect(devWallet).pause();
            await mockToken.connect(user1).approve(await chips.getAddress(), amount);

            await expect(chips.connect(user1).deposit(data, nonce, signature)).to.be.revertedWithCustomError(
                chips,
                'EnforcedPause'
            );
        });

        it('Should revert on unpause when not paused', async function () {
            const { chips, devWallet } = await loadFixture(deployFixtures);
            expect(await chips.paused()).to.be.false;
            await expect(chips.connect(devWallet).unpause()).to.be.revertedWithCustomError(chips, 'ExpectedPause');
        });

        it('Should revert on pause when already paused', async function () {
            const { chips, devWallet } = await loadFixture(deployFixtures);
            await chips.connect(devWallet).pause();
            expect(await chips.paused()).to.be.true;
            await expect(chips.connect(devWallet).pause()).to.be.revertedWithCustomError(chips, 'EnforcedPause');
        });
        it("Should NOT pause if not caller does not have dev config role", async function () {
            const { chips, user1 } = await loadFixture(deployFixtures);
            await expect(chips.connect(user1).pause()).to.be.revertedWithCustomError(chips, 'AccessControlUnauthorizedAccount');
        });
        it("Should NOT unpause if not caller does not have dev config role", async function () {
            const { chips, user1 } = await loadFixture(deployFixtures);
            await expect(chips.connect(user1).unpause()).to.be.revertedWithCustomError(chips, 'AccessControlUnauthorizedAccount');
        });
    });

    describe('Edge Cases', function () {
        it('Should allow zero amount deposit', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('0');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            // Approve zero amount
            await mockToken.connect(user1).approve(await chips.getAddress(), amount);

            // Should succeed with zero amount
            await chips.connect(user1).deposit(data, nonce, signature);

            // Balance should remain zero
            expect(await chips.balanceOf(user1.address)).to.equal(0);
            expect(await mockToken.balanceOf(await chips.getAddress())).to.equal(0);
        });

        it('Should allow zero amount withdrawal', async function () {
            const { chips, user1, devWallet } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('0');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, true] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            // Should succeed with zero amount
            await chips.connect(user1).withdraw(data, nonce, signature);

            // Balance should remain zero
            expect(await chips.balanceOf(user1.address)).to.equal(0);
        });

        it('Should revert on mismatched array lengths in adminDeposit', async function () {
            const { chips, gameServer, user1 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            await expect(
                chips.connect(gameServer).adminDeposit([user1.address], [amount, amount])
            ).to.be.revertedWithCustomError(chips, 'ArrayLengthMismatch');
        });

        it('Should revert on withdrawAllAdmin when not paused', async function () {
            const { chips, mockToken, gameServer, manager, user1, user2 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            // First deposit
            await mockToken.connect(gameServer).approve(await chips.getAddress(), amount * 2n);
            await chips.connect(gameServer).adminDeposit([user1.address, user2.address], [amount, amount]);

            await expect(
                chips.connect(manager).withdrawAllAdmin([user1.address, user2.address])
            ).to.be.revertedWithCustomError(chips, 'ExpectedPause');
        });

        it('Should handle maximum token amount deposits', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const amount = ethers.MaxUint256;
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await expect(chips.connect(user1).deposit(data, nonce, signature)).to.be.reverted; // Should revert due to overflow
        });
    });

    describe('Upgrade Authorization', function () {
        it('Should allow manager to upgrade contract', async function () {
            const { chips } = await loadFixture(deployFixtures);
            const GUnitsV2 = await ethers.getContractFactory('GUnits');
            await upgrades.upgradeProxy(chips, GUnitsV2);
        });

        it('Should revert if non-manager tries to upgrade', async function () {
            const { chips, user1 } = await loadFixture(deployFixtures);
            const GUnitsV2 = await ethers.getContractFactory('GUnits', user1);
            await expect(upgrades.upgradeProxy(chips, GUnitsV2)).to.be.reverted
        });
    });

    describe('Exchange Rate', function () {
        it('Should allow manager to set exchange rate', async function () {
            const { chips, manager, devWallet } = await loadFixture(deployFixtures);
            const numerator = 2;
            const denominator = 1;

            // Verify manager has required roles
            expect(await chips.hasRole(await chips.MANAGER_ROLE(), manager.address)).to.be.true;
            expect(await chips.hasRole(await chips.READABLE_ROLE(), manager.address)).to.be.true;

            await chips.connect(devWallet).setExchangeRate(numerator, denominator);

            const [actualNumerator, actualDenominator] = await chips.connect(manager).getExchangeRate();
            expect(actualNumerator).to.equal(numerator);
            expect(actualDenominator).to.equal(denominator);
        });

        it('Should revert if non-manager tries to set exchange rate', async function () {
            const { chips, user1 } = await loadFixture(deployFixtures);

            // Verify user1 doesn't have manager role
            expect(await chips.hasRole(await chips.MANAGER_ROLE(), user1.address)).to.be.false;

            await expect(chips.connect(user1).setExchangeRate(2, 1)).to.be.revertedWithCustomError(
                chips,
                'AccessControlUnauthorizedAccount'
            );
        });

        it('Should emit ExchangeRateSet event when rate is updated', async function () {
            const { chips, devWallet } = await loadFixture(deployFixtures);
            const numerator = 2;
            const denominator = 1;

            await expect(chips.connect(devWallet).setExchangeRate(numerator, denominator))
                .to.emit(chips, 'ExchangeRateSet')
                .withArgs(numerator, denominator);
        });

        it('Should revert if numerator is zero', async function () {
            const { chips, devWallet } = await loadFixture(deployFixtures);
            await expect(chips.connect(devWallet).setExchangeRate(0, 1)).to.be.revertedWithCustomError(
                chips,
                'ExchangeRateCannotBeZero'
            );
        });

        it('Should revert if denominator is zero', async function () {
            const { chips, devWallet } = await loadFixture(deployFixtures);
            await expect(chips.connect(devWallet).setExchangeRate(1, 0)).to.be.revertedWithCustomError(
                chips,
                'ExchangeRateCannotBeZero'
            );
        });

        it('Should apply exchange rate correctly on deposit', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const numerator = 2;
            const denominator = 1;
            await chips.connect(devWallet).setExchangeRate(numerator, denominator);

            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            // Should receive 2x the amount in chips due to exchange rate
            expect(await chips.balanceOf(user1.address)).to.equal(amount * 2n);
        });

        it('Should apply exchange rate correctly on withdrawal', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const numerator = 2;
            const denominator = 1;
            await chips.connect(devWallet).setExchangeRate(numerator, denominator);

            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            // First deposit
            const depositData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const depositNonce = 1;
            const depositMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, depositData, depositNonce]
            );
            const depositMessageHash = ethers.keccak256(depositMessage);
            const depositSignature = await devWallet.signMessage(ethers.getBytes(depositMessageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(depositData, depositNonce, depositSignature);

            // Then withdraw
            const withdrawAmount = await chips.balanceOf(user1.address);
            const withdrawData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, withdrawAmount, Math.floor(Date.now() / 1000) + 3600, true] // Add 1 hour to current timestamp
            );
            const withdrawNonce = 2;
            const withdrawMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, withdrawData, withdrawNonce]
            );
            const withdrawMessageHash = ethers.keccak256(withdrawMessage);
            const withdrawSignature = await devWallet.signMessage(ethers.getBytes(withdrawMessageHash));

            await chips.connect(user1).withdraw(withdrawData, withdrawNonce, withdrawSignature);

            // Should receive original amount back in tokens
            expect(await mockToken.balanceOf(user1.address)).to.equal(ethers.parseEther('1000'));
        });

        it('Should apply exchange rate correctly on admin deposit', async function () {
            const { chips, mockToken, devWallet, user1, user2, gameServer } = await loadFixture(deployFixtures);
            const numerator = 2;
            const denominator = 1;
            await chips.connect(devWallet).setExchangeRate(numerator, denominator);

            const amount = ethers.parseEther('100');

            await mockToken.connect(gameServer).approve(await chips.getAddress(), amount * 2n);
            await chips.connect(gameServer).adminDeposit([user1.address, user2.address], [amount, amount]);

            // Each user should receive 2x the amount in chips
            expect(await chips.balanceOf(user1.address)).to.equal(amount * 2n);
            expect(await chips.balanceOf(user2.address)).to.equal(amount * 2n);
        });

        it('Should apply exchange rate correctly on admin withdrawal', async function () {
            const { chips, mockToken, devWallet, user1, user2, gameServer } = await loadFixture(deployFixtures);
            const numerator = 2;
            const denominator = 1;
            await chips.connect(devWallet).setExchangeRate(numerator, denominator);

            const amount = ethers.parseEther('100');
            const initialBalance = await mockToken.balanceOf(user1.address);

            // First deposit
            await mockToken.connect(gameServer).approve(await chips.getAddress(), amount * 2n);
            await chips.connect(gameServer).adminDeposit([user1.address, user2.address], [amount, amount]);

            // Pause and withdraw
            await chips.connect(devWallet).pause();
            await chips.connect(devWallet).withdrawAllAdmin([user1.address, user2.address]);

            // Should receive original amount back in tokens
            expect(await mockToken.balanceOf(user1.address)).to.equal(amount + initialBalance);
            expect(await mockToken.balanceOf(user2.address)).to.equal(amount + initialBalance);
        });

        it('Should handle very large exchange rates', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const numerator = ethers.MaxUint256;
            const denominator = 1n;
            await chips.connect(devWallet).setExchangeRate(numerator, denominator);

            const amount = 1n; // Smallest possible amount
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            expect(await chips.balanceOf(user1.address)).to.equal(amount * numerator);
        });

        it('Should handle very small exchange rates', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const numerator = 1n;
            const denominator = 1000n;
            await chips.connect(devWallet).setExchangeRate(numerator, denominator);

            const amount = ethers.parseEther('1000');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            expect(await chips.balanceOf(user1.address)).to.equal(amount / denominator);
        });

        it('Should handle exchange rate changes between deposit and withdrawal', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);

            // Initial exchange rate 1:1
            await chips.connect(devWallet).setExchangeRate(1n, 1n);

            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            // Deposit
            const depositData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const depositNonce = 1;
            const depositMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, depositData, depositNonce]
            );
            const depositMessageHash = ethers.keccak256(depositMessage);
            const depositSignature = await devWallet.signMessage(ethers.getBytes(depositMessageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(depositData, depositNonce, depositSignature);
            expect(await chips.balanceOf(user1.address)).to.equal(amount);
            expect(await mockToken.balanceOf(user1.address)).to.equal(ethers.parseEther('900'));
            // Change exchange rate to 2:1
            await chips.connect(devWallet).setExchangeRate(2n, 1n);

            // Withdraw should use new exchange rate
            // At 2:1 rate, 100 chips = 50 tokens
            const withdrawAmount = await chips.balanceOf(user1.address);
            const withdrawData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, withdrawAmount, Math.floor(Date.now() / 1000) + 3600, true] // Add 1 hour to current timestamp
            );
            const withdrawNonce = 2;
            const withdrawMessage = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, withdrawData, withdrawNonce]
            );
            const withdrawMessageHash = ethers.keccak256(withdrawMessage);
            const withdrawSignature = await devWallet.signMessage(ethers.getBytes(withdrawMessageHash));

            await chips.connect(user1).withdraw(withdrawData, withdrawNonce, withdrawSignature);

            expect(await mockToken.balanceOf(user1.address)).to.equal(ethers.parseEther('950'));
        });
    });

    describe('Role Management', function () {
        it('Should allow manager to revoke roles', async function () {
            const { chips, devWallet, gameServer } = await loadFixture(deployFixtures);
            await chips.connect(devWallet).revokeRole(await chips.GAME_SERVER_ROLE(), gameServer.address);
            expect(await chips.hasRole(await chips.GAME_SERVER_ROLE(), gameServer.address)).to.be.false;
        });

        it('Should revert if non-manager tries to revoke roles', async function () {
            const { chips, user1, gameServer } = await loadFixture(deployFixtures);
            await expect(
                chips.connect(user1).revokeRole(await chips.GAME_SERVER_ROLE(), gameServer.address)
            ).to.be.revertedWithCustomError(chips, 'AccessControlUnauthorizedAccount');
        });

        it('Should handle role management correctly', async function () {
            const { chips, devWallet, user1 } = await loadFixture(deployFixtures);

            // Grant GAME_ROLE to user1
            await chips.connect(devWallet).grantRole(await chips.GAME_SERVER_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.GAME_SERVER_ROLE(), user1.address)).to.be.true;

            // Revoke GAME_ROLE from user1
            await chips.connect(devWallet).revokeRole(await chips.GAME_SERVER_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.GAME_SERVER_ROLE(), user1.address)).to.be.false;
        });

        it('Should allow manager to grant and revoke READABLE_ROLE', async function () {
            const { chips, devWallet, user1 } = await loadFixture(deployFixtures);

            // Grant READABLE_ROLE
            await chips.connect(devWallet).grantRole(await chips.READABLE_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.READABLE_ROLE(), user1.address)).to.be.true;

            // Revoke READABLE_ROLE
            await chips.connect(devWallet).revokeRole(await chips.READABLE_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.READABLE_ROLE(), user1.address)).to.be.false;
        });

        it('Should allow manager to grant and revoke DEV_CONFIG_ROLE', async function () {
            const { chips, devWallet, user1 } = await loadFixture(deployFixtures);

            // Grant DEV_CONFIG_ROLE
            await chips.connect(devWallet).grantRole(await chips.DEV_CONFIG_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.DEV_CONFIG_ROLE(), user1.address)).to.be.true;

            // Revoke DEV_CONFIG_ROLE
            await chips.connect(devWallet).revokeRole(await chips.DEV_CONFIG_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.DEV_CONFIG_ROLE(), user1.address)).to.be.false;
        });

        it('Should allow users to renounce their roles', async function () {
            const { chips, devWallet, user1 } = await loadFixture(deployFixtures);

            // Grant GAME_SERVER_ROLE to user1
            await chips.connect(devWallet).grantRole(await chips.GAME_SERVER_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.GAME_SERVER_ROLE(), user1.address)).to.be.true;

            // User1 renounces their role
            await chips.connect(user1).renounceRole(await chips.GAME_SERVER_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.GAME_SERVER_ROLE(), user1.address)).to.be.false;
        });
    });

    describe('Signature Verification', function () {
        it('Should prevent replay attacks', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);
            // Try to replay the same signature
            await expect(chips.connect(user1).deposit(data, nonce, signature)).to.be.revertedWith(
                'AlreadyUsedSignature'
            );
        });

        it('Should revert on signature with different chain ID', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const wrongChainId = 12345;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, wrongChainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await expect(chips.connect(user1).deposit(data, nonce, signature)).to.be.revertedWithCustomError(
                chips,
                'InvalidSeed'
            );
        });

        it('Should revert on signature with different contract address', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const wrongContractAddress = ethers.ZeroAddress;

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [wrongContractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await expect(chips.connect(user1).deposit(data, nonce, signature)).to.be.revertedWithCustomError(
                chips,
                'InvalidSeed'
            );
        });

        it('Should revert on expired signature', async () => {
            const { chips, user1, devWallet } = await loadFixture(deployFixtures);
            const amount = 100n;
            const contractAddress = await chips.getAddress();
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const timestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour in the past
            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, timestamp, false]
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));
            await expect(chips.connect(user1).deposit(data, nonce, signature)).to.be.revertedWithCustomError(
                chips,
                'InvalidTimestamp'
            );
        });

        it('Should prevent replay attacks', async () => {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const amount = 100n;
            const contractAddress = await chips.getAddress();
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const timestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour in the future
            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, timestamp, false]
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));
            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);
            await expect(chips.connect(user1).deposit(data, nonce, signature)).to.be.revertedWith(
                'AlreadyUsedSignature'
            );
        });
    });

    describe('Exchange Rate Edge Cases', function () {
        it('Should handle exchange rate overflow', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const numerator = ethers.MaxUint256;
            const denominator = 1n;
            await chips.connect(devWallet).setExchangeRate(numerator, denominator);

            const amount = 1n; // Smallest possible amount
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            expect(await chips.balanceOf(user1.address)).to.equal(amount * numerator);
        });

        it('Should handle exchange rate precision loss', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const numerator = 1n;
            const denominator = 3n;
            await chips.connect(devWallet).setExchangeRate(numerator, denominator);

            const amount = ethers.parseEther('3');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            expect(await chips.balanceOf(user1.address)).to.equal(amount / denominator);
        });
    });

    describe('Balance Access Control', function () {
        it('Should revert on unauthorized balance query', async function () {
            const { chips, user1, user2 } = await loadFixture(deployFixtures);
            await expect(chips.connect(user1).balanceOf(user2.address)).to.be.revertedWithCustomError(
                chips,
                'NotAuthorized'
            );
        });

        it('Should allow balance query with READABLE_ROLE', async function () {
            const { chips, manager, user1 } = await loadFixture(deployFixtures);
            expect(await chips.connect(manager).balanceOf(user1.address)).to.equal(0);
        });
    });

    describe('Contract Upgrade', function () {
        it('Should allow upgrade with DEV_CONFIG_ROLE', async function () {
            const { chips, devWallet } = await loadFixture(deployFixtures);
            const GUnitsV2 = await ethers.getContractFactory('GUnits', devWallet);
            await upgrades.upgradeProxy(chips, GUnitsV2);
        });

        it('Should preserve state after upgrade', async function () {
            const { chips, mockToken, user1, devWallet } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [user1.address, data, nonce]);
            const messageHash = ethers.keccak256(message);
            const signature = await devWallet.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            const GUnitsV2 = await ethers.getContractFactory('GUnits', devWallet);
            const upgraded = await upgrades.upgradeProxy(chips, GUnitsV2);

            expect(await upgraded.balanceOf(user1.address)).to.equal(amount);
        });
    });

    describe('Admin Operations', function () {
        it('Should handle adminDeposit with zero amounts', async function () {
            const { chips, mockToken, devWallet, user1, user2 } = await loadFixture(deployFixtures);

            await mockToken.connect(devWallet).approve(await chips.getAddress(), 0);
            await chips.connect(devWallet).adminDeposit([user1.address, user2.address], [0, 0]);

            expect(await chips.balanceOf(user1.address)).to.equal(0);
            expect(await chips.balanceOf(user2.address)).to.equal(0);
        });

        it('Should handle withdrawAllAdmin with empty arrays', async function () {
            const { chips, devWallet } = await loadFixture(deployFixtures);
            await chips.connect(devWallet).pause();
            await chips.connect(devWallet).withdrawAllAdmin([]);
        });

        it('Should handle withdrawAllAdmin with users having zero balance', async function () {
            const { chips, devWallet, user1, user2 } = await loadFixture(deployFixtures);
            await chips.connect(devWallet).pause();
            await chips.connect(devWallet).withdrawAllAdmin([user1.address, user2.address]);
        });
    });

    describe('Upgrade Tests', function () {
        it('Should handle upgrade with same implementation', async function () {
            const { chips, devWallet } = await loadFixture(deployFixtures);
            const GUnitsV2 = await ethers.getContractFactory('GUnits', devWallet);
            await upgrades.upgradeProxy(chips, GUnitsV2);
        });
    });

    describe('Payout', function () {
        let chips: GUnits;
        let token: MockERC20;
        let manager: SignerWithAddress;
        let user1: SignerWithAddress;
        let user2: SignerWithAddress;
        let gameServer: SignerWithAddress;
        let devWallet: SignerWithAddress;
        let rakeAmount: bigint;
        let treasury: SignerWithAddress;

        beforeEach(async function () {
            ({
                chips,
                mockToken: token,
                manager,
                user1,
                user2,
                gameServer,
                treasury,
                devWallet
            } = await loadFixture(deployFixtures));
            await depositGUnits(chips, token, devWallet, user1, 1000n);
            await depositGUnits(chips, token, devWallet, user2, 1000n);
            const players = [user1, user2];
            const winners = [user1, user2];
            const playCost = 1000n;
            const totalCost = BigInt(players.length) * playCost;
            const rakePercentage = ethers.parseEther('10');
            rakeAmount = (totalCost * rakePercentage) / ethers.parseEther('100');

            const winnerPrizeForFeeTest = totalCost - rakeAmount;
            const prizePerWinnerForFeeTest = winnerPrizeForFeeTest / BigInt(winners.length);

            const payoutsForFeeTest: { player: string; isWinner: boolean; amount: bigint }[] = [];
            for (const p of players) {
                const isWinner = winners.some(w => w.address === p.address);
                payoutsForFeeTest.push({
                    player: p.address,
                    isWinner: isWinner,
                    amount: isWinner ? prizePerWinnerForFeeTest : 0n
                });
            }
            await chips.connect(gameServer).adminPayout(payoutsForFeeTest, rakeAmount);
        });
        it('Should payout to users and emit an event', async function () {
            const playCost = 1000n;
            const players = [user1, user2];
            const winners = [user1];
            const totalCost = BigInt(players.length) * playCost;
            const rakePercentage = ethers.parseEther('10');
            const rakeAmount = (totalCost * rakePercentage) / ethers.parseEther('100');

            let winnerPrize = totalCost - rakeAmount;

            if (winners.length > 1) {
                winnerPrize = winnerPrize / BigInt(winners.length);
            }

            await token.connect(user1).approve(await chips.getAddress(), totalCost);
            await depositGUnits(chips, token, devWallet, user1, totalCost);
            await depositGUnits(chips, token, devWallet, user2, totalCost);

            const user1BalanceBefore = await chips.balanceOf(user1.address);
            const user2BalanceBefore = await chips.balanceOf(user2.address);
            
            // Lock funds for user2 (the loser) before payout
            await chips.connect(gameServer).lockFunds(user2.address, playCost);
            
            const payouts = [{
                player: user1.address,
                isWinner: true,
                amount: winnerPrize
            }, {
                player: user2.address,
                isWinner: false,
                amount: playCost // For non-winners, this is the amount (playCost) to be burned
            }];

            // Transform the payouts array to match the expected event emission structure (array of arrays)
            const expectedEventPayouts = payouts.map(p => [p.player, p.isWinner, p.amount]);

            await expect(chips.connect(gameServer).adminPayout(payouts, rakeAmount))
                .to.emit(chips, 'PayoutProcessed')
                .withArgs(expectedEventPayouts, rakeAmount);

            expect(await chips.balanceOf(user1.address)).to.equal(user1BalanceBefore + winnerPrize);
            expect(await chips.balanceOf(user2.address)).to.equal(user2BalanceBefore - playCost);
        });

        it('Should payout to multiple users', async function () {
            const playCost = 1000n;
            const players = [user1, user2];
            const winners = [user1, user2];
            const totalCost = BigInt(players.length) * playCost;
            const rakePercentage = ethers.parseEther('10');
            const rakeAmount = (totalCost * rakePercentage) / ethers.parseEther('100');
            let winnerPrize = totalCost - rakeAmount;

            if (winners.length > 1) {
                winnerPrize = winnerPrize / BigInt(winners.length);
            }

            await token.connect(user1).approve(await chips.getAddress(), totalCost);
            await depositGUnits(chips, token, devWallet, user1, totalCost);
            await depositGUnits(chips, token, devWallet, user2, totalCost);

            const user1BalanceBefore = await chips.balanceOf(user1.address);
            const user2BalanceBefore = await chips.balanceOf(user2.address);

            const payouts = [{
                // 1st winner
                player: user1.address,
                isWinner: true,
                amount: winnerPrize
            }, {
                // 2nd winner
                player: user2.address,
                isWinner: true,
                amount: winnerPrize / 2n
            }];

            // Transform the payouts array to match the expected event emission structure (array of arrays)
            const expectedEventPayouts = payouts.map(p => [p.player, p.isWinner, p.amount]);

            await expect(chips.connect(gameServer).adminPayout(payouts, rakeAmount))
                .to.emit(chips, 'PayoutProcessed')
                .withArgs(expectedEventPayouts, rakeAmount);

            expect(await chips.balanceOf(user1.address)).to.equal(user1BalanceBefore + winnerPrize);
            expect(await chips.balanceOf(user2.address)).to.equal(user2BalanceBefore + winnerPrize / 2n);
        });
        it("Should NOT payout if contract is paused", async function () {
            const playCost = 1000n;
            const players = [user1, user2];
            const winners = [user1];
            const rakePercentage = ethers.parseEther('10');

            await chips.connect(devWallet).pause();
            await expect(chips.connect(gameServer).adminPayout([], 0n)).to.be.revertedWithCustomError(chips, 'EnforcedPause');
        });
        it("Should NOT payout if caller is not game server", async function () {
            const playCost = 1000n;
            const players = [user1.address, user2.address];
            const winners = [user1.address];
            const rakePercentage = ethers.parseEther('10');
            await expect(chips.connect(manager).adminPayout([], 0n)).to.be.revertedWithCustomError(chips, 'AccessControlUnauthorizedAccount');
        });
        it("Should allow manager to withdraw fees", async function () {
            expect(await chips.getCollectedFees()).to.equal(rakeAmount);
            expect(await token.balanceOf(treasury.address)).to.equal(0);
            await chips.connect(devWallet).withdrawFees(treasury.address);
            expect(await token.balanceOf(treasury.address)).to.equal(rakeAmount);
            expect(await chips.getCollectedFees()).to.equal(0);
        });
    });

    describe('Proxy Admin', function () {
        it('Should handle proxy admin operations', async function () {
            const { chips, devWallet } = await loadFixture(deployFixtures);
            const chipsAddress = await chips.getAddress();
            const proxyAdmin = await upgrades.erc1967.getAdminAddress(chipsAddress);
            const proxyAdminAbiContent = fs.readFileSync(path.resolve(PROXY_ADMIN_ABI_PATH), 'utf8');
            const { abi: proxyAdminAbi } = JSON.parse(proxyAdminAbiContent);
            const proxyAdminContract = await ethers.getContractAt(proxyAdminAbi, proxyAdmin) as any;
            const proxyAdminOwner = await proxyAdminContract.owner();
            expect(proxyAdminOwner).to.equal(devWallet.address);
        });
    });

    describe("Decode data", function () {
        it("Should decode data", async function () {
            const { chips } = await loadFixture(deployFixtures);
            const contractAddress = await chips.getAddress();
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const amount = 1000n;
            const unixTimestamp = Math.floor(Date.now() / 1000);
            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256'],
                [contractAddress, chainId, amount, unixTimestamp]
            );
            const decodedData = await chips.decodeData(data);
            expect(decodedData).to.be.deep.equal([contractAddress, chainId, amount, unixTimestamp]);
        });
    });

    describe("Set Token", function () {
        let chips: GUnits;
        let token: MockERC20;
        let devWallet: SignerWithAddress;
        let user1: SignerWithAddress;
        let currentTokenAddress: string;
        beforeEach(async function () {
            ({ chips, mockToken: token, devWallet, user1 } = await loadFixture(deployFixtures));
            await chips.connect(devWallet).pause();
            currentTokenAddress = await token.getAddress();
        });
        it("Should set token", async function () {
            const newTokenFactory = await ethers.getContractFactory('MockERC20', devWallet);
            const newToken = await newTokenFactory.deploy('New Token', 'NT');
            const newTokenAddress = await newToken.getAddress();

            expect(await chips.token()).to.equal(currentTokenAddress);
            await expect(chips.connect(devWallet).setToken(newTokenAddress))
                .to.emit(chips, 'TokenSet')
                .withArgs(newTokenAddress);
            expect(await chips.token()).to.equal(newTokenAddress);
        });
        it("Should NOT set token to zero address", async function () {
            await expect(chips.connect(devWallet).setToken(ethers.ZeroAddress)).to.be.revertedWithCustomError(chips, 'AddressIsZero');
        });
        it("Should NOT set token if caller does not have DEV_CONFIG_ROLE", async function () {
            expect(await chips.hasRole(await chips.DEV_CONFIG_ROLE(), user1.address)).to.be.false;
            await expect(chips.connect(user1).setToken(ethers.ZeroAddress)).to.be.revertedWithCustomError(chips, 'AccessControlUnauthorizedAccount');
        });
        it("Should NOT set token if contract is not paused", async function () {
            expect(await chips.paused()).to.be.true;
            await chips.connect(devWallet).unpause();
            expect(await chips.paused()).to.be.false;
            await expect(chips.connect(devWallet).setToken(ethers.ZeroAddress)).to.be.revertedWithCustomError(chips, 'ExpectedPause');
        });
    });

    describe("Set Token with Decimals Migration", function () {
        let gUnits: GUnits;
        let devWallet: SignerWithAddress;
        let user1: SignerWithAddress;
        let token6Decimals: MockUSDC;
        let token18Decimals: MockUSDC;
        let token4Decimals: MockUSDC;
        const totalSupply = 1_000_000n;
    
        beforeEach(async function () {
            ({ devWallet, user1 } = await loadFixture(deployFixtures));

             // Deploy tokens with different decimals
             const Token4Decimals = await ethers.getContractFactory('MockUSDC', devWallet);
             token4Decimals = await Token4Decimals.deploy('Token4', 'T4', 4);
             const Token6Decimals = await ethers.getContractFactory('MockUSDC', devWallet);
             token6Decimals = await Token6Decimals.deploy('Token6', 'T6', 6);
             const Token18Decimals = await ethers.getContractFactory('MockUSDC', devWallet);
             token18Decimals = await Token18Decimals.deploy('Token18', 'T18', 18);

            // Deploy as UUPS proxy with all required initialization parameters
            const GUnitsFactory = await ethers.getContractFactory('GUnits', devWallet);
            const gUnitsDeployment = await upgrades.deployProxy(
                GUnitsFactory,
                [
                    await token6Decimals.getAddress(), // _token
                false, // _isPaused
                devWallet.address, // _devWallet
                ],
                {
                    initializer: 'initialize',
                }
            );
            await gUnitsDeployment.waitForDeployment();
            gUnits = await ethers.getContractAt('GUnits', await gUnitsDeployment.getAddress());
    
            // Mint and deposit some G-Units
            await token6Decimals.mint(user1.address, totalSupply);
            await token6Decimals.connect(user1).approve(gUnits.target, totalSupply);
            await depositGUnits(gUnits, token6Decimals, devWallet, user1, totalSupply);
            await gUnits.connect(devWallet).pause();
            expect(await gUnits.paused()).to.be.true;
        });
    
        it("Should migrate from 6 to 18 decimals and require correct deposit", async function () {
            const totalSupply = await gUnits.totalSupply();
            const required = totalSupply * (10n ** (18n - 6n));
            await token18Decimals.mint(devWallet.address, required);
            await token18Decimals.connect(devWallet).approve(gUnits.target, required);
    
            await expect(gUnits.connect(devWallet).setToken(token18Decimals.target))
                .to.emit(gUnits, 'TokenSet')
                .withArgs(token18Decimals.target)
                .to.emit(token18Decimals, 'Transfer')
                .withArgs(devWallet.address, gUnits.target, required);
    
            expect(await gUnits.token()).to.equal(token18Decimals.target);
            expect(await gUnits.decimals()).to.equal(18);
            expect(await token18Decimals.balanceOf(gUnits.target)).to.equal(required);
        });
    
        it("Should migrate from 18 to 6 decimals and require correct deposit", async function () {
            const NewToken6Decimals = await ethers.getContractFactory('MockUSDC', devWallet);
            const newToken6Decimals = await NewToken6Decimals.deploy('New Token6', 'NT6', 6);

            // First migrate to 18 decimals
            const totalSupply = await gUnits.totalSupply();
            const required18 = totalSupply * (10n ** (18n - 6n));
            await token18Decimals.mint(devWallet.address, required18);
            await token18Decimals.connect(devWallet).approve(gUnits.target, required18);
            await expect(gUnits.connect(devWallet).setToken(token18Decimals.target))
                .to.emit(gUnits, 'TokenSet')
                .withArgs(token18Decimals.target)
                .to.emit(token18Decimals, 'Transfer')
                .withArgs(devWallet.address, gUnits.target, required18);
    
            // Now migrate to 6 decimals
            const required6 = totalSupply / (10n ** (18n - 6n));
            await newToken6Decimals.mint(devWallet.address, required6);
            await newToken6Decimals.connect(devWallet).approve(gUnits.target, required6);
    
            await expect(gUnits.connect(devWallet).setToken(newToken6Decimals.target))
                .to.emit(gUnits, 'TokenSet')
                .withArgs(newToken6Decimals.target);
    
            expect(await gUnits.token()).to.equal(newToken6Decimals.target);
            expect(await gUnits.decimals()).to.equal(6);
            expect(await newToken6Decimals.balanceOf(gUnits.target)).to.equal(required6);
        });
    
        it("Should migrate from 6 to 4 decimals and require correct deposit", async function () {
            const totalSupply = await gUnits.totalSupply();
            const required = totalSupply / (10n ** (6n - 4n));
            await token4Decimals.mint(devWallet.address, required);
            await token4Decimals.connect(devWallet).approve(gUnits.target, required);
    
            await expect(gUnits.connect(devWallet).setToken(token4Decimals.target))
                .to.emit(gUnits, 'TokenSet')
                .withArgs(token4Decimals.target);
    
            expect(await gUnits.token()).to.equal(token4Decimals.target);
            expect(await gUnits.decimals()).to.equal(4);
            expect(await token4Decimals.balanceOf(gUnits.target)).to.equal(required);
        });
    
        it("Should revert if not enough new token is approved", async function () {
            const totalSupply = await gUnits.totalSupply();
            const required = totalSupply * (10n ** (18n - 6n));
            // Do not approve enough
            await token18Decimals.mint(devWallet.address, required - 1n);
            await token18Decimals.connect(devWallet).approve(gUnits.target, required - 1n);
    
            await expect(gUnits.connect(devWallet).setToken(token18Decimals.target))
                .to.be.reverted; // Should revert due to SafeERC20: transfer amount exceeds balance/allowance
        });
    });
});
