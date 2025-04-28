import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { upgrades } from 'hardhat';

describe('Chips', function () {
    async function deployFixtures() {
        const [manager, game, user1, user2] = await ethers.getSigners();

        // Deploy mock token for testing
        const MockToken = await ethers.getContractFactory('MockERC20');
        const mockToken = await MockToken.deploy('Mock Token', 'MTK');
        await mockToken.waitForDeployment();

        // Deploy Chips implementation
        const Chips = await ethers.getContractFactory('Chips');

        // Deploy as UUPS proxy with all required initialization parameters
        const chips = await upgrades.deployProxy(Chips, [
            await mockToken.getAddress(), // _token
            false,                        // _isPaused
            manager.address               // _devWallet
        ], {
            initializer: 'initialize',
            kind: 'uups'
        });
        await chips.waitForDeployment();

        // Verify initial role setup
        expect(await chips.hasRole(await chips.DEV_CONFIG_ROLE(), manager.address)).to.be.true;
        expect(await chips.hasRole(await chips.MANAGER_ROLE(), manager.address)).to.be.true;
        expect(await chips.hasRole(await chips.DEFAULT_ADMIN_ROLE(), manager.address)).to.be.true;


        // Grant game role
        await chips.connect(manager).grantRole(await chips.GAME_ROLE(), game.address);
        expect(await chips.hasRole(await chips.GAME_ROLE(), game.address)).to.be.true;
        await chips.connect(manager).grantRole(await chips.READABLE_ROLE(), manager.address);
        expect(await chips.hasRole(await chips.READABLE_ROLE(), manager.address)).to.be.true;

        // Mint some tokens to users for testing
        await mockToken.mint(user1.address, ethers.parseEther('1000'));
        await mockToken.mint(user2.address, ethers.parseEther('1000'));
        await mockToken.mint(manager.address, ethers.parseEther('1000'));
        await mockToken.mint(game.address, ethers.parseEther('1000'));

        return {
            chips,
            mockToken,
            manager,
            game,
            user1,
            user2,
        };
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
            const { chips, manager, game } = await loadFixture(deployFixtures);
            expect(await chips.hasRole(await chips.MANAGER_ROLE(), manager.address)).to.be.true;
            expect(await chips.hasRole(await chips.GAME_ROLE(), game.address)).to.be.true;
        });

        it('Should set the correct decimals', async function () {
            const { chips, mockToken } = await loadFixture(deployFixtures);
            expect(await chips.decimals()).to.equal(await mockToken.decimals());
        });

        it('Should support required interfaces', async function () {
            const { chips } = await loadFixture(deployFixtures);
            // AccessControl interface ID
            const ACCESS_CONTROL_INTERFACE_ID = '0x7965db0b';
            expect(await chips.supportsInterface(ACCESS_CONTROL_INTERFACE_ID)).to.be.true;
        });
    });

    describe('Total Supply', function () {
        it('Should update total supply on deposit', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            expect(await chips.totalSupply()).to.equal(amount);
        });

        it('Should update total supply on withdrawal', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
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
            const depositSignature = await manager.signMessage(ethers.getBytes(depositMessageHash));

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
            const withdrawSignature = await manager.signMessage(ethers.getBytes(withdrawMessageHash));

            await chips.connect(user1).withdraw(withdrawData, withdrawNonce, withdrawSignature);

            expect(await chips.totalSupply()).to.equal(0);
        });

        it('Should update total supply on admin deposit', async function () {
            const { chips, mockToken, manager, user1, user2 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            await mockToken.connect(manager).approve(await chips.getAddress(), amount * 2n);
            await chips.connect(manager).adminDeposit(
                [user1.address, user2.address],
                [amount, amount]
            );

            expect(await chips.totalSupply()).to.equal(amount * 2n);
        });

        it('Should update total supply on admin withdrawal', async function () {
            const { chips, mockToken, manager, user1, user2 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            // First deposit
            await mockToken.connect(manager).approve(await chips.getAddress(), amount * 2n);
            await chips.connect(manager).adminDeposit(
                [user1.address, user2.address],
                [amount, amount]
            );

            // Pause and withdraw
            await chips.connect(manager).pause();
            await chips.connect(manager).withdrawAllAdmin([user1.address, user2.address]);

            expect(await chips.totalSupply()).to.equal(0);
        });
    });

    describe('Deposit and Withdraw', function () {
        it('Should allow users to deposit chips', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            expect(await chips.balanceOf(user1.address)).to.equal(amount);
            expect(await mockToken.balanceOf(await chips.getAddress())).to.equal(amount);
        });

        it('Should allow users to withdraw chips', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
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
            const depositSignature = await manager.signMessage(ethers.getBytes(depositMessageHash));

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
            const withdrawSignature = await manager.signMessage(ethers.getBytes(withdrawMessageHash));

            await chips.connect(user1).withdraw(withdrawData, withdrawNonce, withdrawSignature);

            expect(await chips.balanceOf(user1.address)).to.equal(0);
            expect(await mockToken.balanceOf(user1.address)).to.equal(ethers.parseEther('1000'));
        });

        it('Should revert if user tries to withdraw more than balance', async function () {
            const { chips, user1, manager } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('1');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, true] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await expect(chips.connect(user1).withdraw(data, nonce, signature))
                .to.be.revertedWithCustomError(chips, 'ChipInsufficientBalance');
        });

        it('Should revert if signature is invalid', async function () {
            const { chips, user1, user2, manager } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            // Sign with different user instead of devWallet
            const signature = await user2.signMessage(ethers.getBytes(messageHash));

            await expect(chips.connect(user1).deposit(data, nonce, signature))
                .to.be.reverted;
        });

        it('Should revert if chain ID is incorrect', async function () {
            const { chips, user1, manager } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const wrongChainId = 12345; // Wrong chain ID
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, wrongChainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await expect(chips.connect(user1).deposit(data, nonce, signature))
                .to.be.revertedWithCustomError(chips, 'InvalidSeed');
        });
    });

    describe('Manager Operations', function () {
        it('Should allow manager to deposit to multiple users', async function () {
            const { chips, mockToken, manager, user1, user2 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            // Manager needs to approve the chips contract to spend tokens
            await mockToken.connect(manager).approve(await chips.getAddress(), amount * 2n);

            // Manager deposits to users
            await chips.connect(manager).adminDeposit(
                [user1.address, user2.address],
                [amount, amount]
            );

            expect(await chips.balanceOf(user1.address)).to.equal(amount);
            expect(await chips.balanceOf(user2.address)).to.equal(amount);
            expect(await mockToken.balanceOf(await chips.getAddress())).to.equal(amount * 2n);
        });

        it('Should allow manager to withdraw all chips from users when paused', async function () {
            const { chips, mockToken, manager, user1, user2 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const initialBalance = await mockToken.balanceOf(user1.address)
            // First deposit to users
            await mockToken.connect(manager).approve(await chips.getAddress(), amount * 2n);
            await chips.connect(manager).adminDeposit(
                [user1.address, user2.address],
                [amount, amount]
            );
            // Verify initial balances
            expect(await chips.balanceOf(user1.address)).to.equal(amount);
            expect(await chips.balanceOf(user2.address)).to.equal(amount);
            const deposits = await mockToken.balanceOf(await chips.getAddress())
            expect(deposits).to.equal(amount * 2n);
            // Pause the contract
            await chips.connect(manager).pause();
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
            await expect(chips.connect(user1).adminDeposit([user1.address], [ethers.parseEther('100')]))
                .to.be.revertedWithCustomError(chips, 'AccessControlUnauthorizedAccount');
        });
    });

    describe('Game Operations', function () {
        it('Should allow game to retrieve buy-in', async function () {
            const { chips, mockToken, game, user1, manager } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            // First deposit
            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            // Then retrieve buy-in
            await chips.connect(game).retrieveBuyIn(user1.address, amount);

            expect(await chips.balanceOf(user1.address)).to.equal(0);
        });

        it('Should allow game to distribute chips', async function () {
            const { chips, mockToken, game, user1, user2, manager } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            // First deposit to game
            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount * 2n, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [game.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(game).approve(await chips.getAddress(), amount * 2n);
            await chips.connect(game).deposit(data, nonce, signature);

            // Then distribute
            await chips.connect(game).distributeChips(
                [user1.address, user2.address],
                [amount, amount]
            );

            expect(await chips.balanceOf(user1.address)).to.equal(amount);
            expect(await chips.balanceOf(user2.address)).to.equal(amount);
        });

        it('Should revert if non-game tries game operations', async function () {
            const { chips, user1 } = await loadFixture(deployFixtures);
            await expect(chips.connect(user1).retrieveBuyIn(user1.address, ethers.parseEther('100')))
                .to.be.revertedWithCustomError(chips, 'AccessControlUnauthorizedAccount');
        });

        it('Should revert on retrieveBuyIn with insufficient balance', async function () {
            const { chips, game, user1 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            await expect(chips.connect(game).retrieveBuyIn(user1.address, amount))
                .to.be.revertedWithCustomError(chips, 'ChipInsufficientBalance');
        });

        it('Should handle distributeChips with zero amounts', async function () {
            const { chips, mockToken, game, user1, user2, manager } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            // First deposit to game
            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [game.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(game).approve(await chips.getAddress(), amount);
            await chips.connect(game).deposit(data, nonce, signature);

            // Distribute zero amounts
            await chips.connect(game).distributeChips(
                [user1.address, user2.address],
                [0, 0]
            );

            expect(await chips.balanceOf(user1.address)).to.equal(0);
            expect(await chips.balanceOf(user2.address)).to.equal(0);
        });

        it('Should revert on distributeChips with mismatched array lengths', async function () {
            const { chips, game, user1 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            await expect(chips.connect(game).distributeChips(
                [user1.address],
                [amount, amount]
            )).to.be.revertedWithCustomError(chips, 'ArrayLengthMismatch');
        });
    });

    describe('Pausable', function () {
        it('Should allow manager to pause and unpause', async function () {
            const { chips, manager } = await loadFixture(deployFixtures);

            await chips.connect(manager).pause();
            expect(await chips.paused()).to.be.true;

            await chips.connect(manager).unpause();
            expect(await chips.paused()).to.be.false;
        });

        it('Should prevent deposits when paused', async function () {
            const { chips, mockToken, manager, user1 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await chips.connect(manager).pause();
            await mockToken.connect(user1).approve(await chips.getAddress(), amount);

            await expect(chips.connect(user1).deposit(data, nonce, signature))
                .to.be.revertedWithCustomError(chips, 'EnforcedPause');
        });

        it('Should revert on unpause when not paused', async function () {
            const { chips, manager } = await loadFixture(deployFixtures);
            expect(await chips.paused()).to.be.false;
            await expect(chips.connect(manager).unpause())
                .to.be.revertedWithCustomError(chips, 'ExpectedPause');
        });

        it('Should revert on pause when already paused', async function () {
            const { chips, manager } = await loadFixture(deployFixtures);
            await chips.connect(manager).pause();
            expect(await chips.paused()).to.be.true;
            await expect(chips.connect(manager).pause())
                .to.be.revertedWithCustomError(chips, 'EnforcedPause');
        });
    });

    describe('Edge Cases', function () {
        it('Should allow zero amount deposit', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('0');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            // Approve zero amount
            await mockToken.connect(user1).approve(await chips.getAddress(), amount);

            // Should succeed with zero amount
            await chips.connect(user1).deposit(data, nonce, signature);

            // Balance should remain zero
            expect(await chips.balanceOf(user1.address)).to.equal(0);
            expect(await mockToken.balanceOf(await chips.getAddress())).to.equal(0);
        });

        it('Should allow zero amount withdrawal', async function () {
            const { chips, user1, manager } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('0');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, true] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            // Should succeed with zero amount
            await chips.connect(user1).withdraw(data, nonce, signature);

            // Balance should remain zero
            expect(await chips.balanceOf(user1.address)).to.equal(0);
        });

        it('Should revert on mismatched array lengths in adminDeposit', async function () {
            const { chips, manager, user1 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            await expect(chips.connect(manager).adminDeposit(
                [user1.address],
                [amount, amount]
            )).to.be.revertedWithCustomError(chips, 'ArrayLengthMismatch');
        });

        it('Should revert on withdrawAllAdmin when not paused', async function () {
            const { chips, mockToken, manager, user1, user2 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            // First deposit
            await mockToken.connect(manager).approve(await chips.getAddress(), amount * 2n);
            await chips.connect(manager).adminDeposit(
                [user1.address, user2.address],
                [amount, amount]
            );

            await expect(chips.connect(manager).withdrawAllAdmin([user1.address, user2.address]))
                .to.be.revertedWithCustomError(chips, 'ExpectedPause');
        });

        it('Should handle maximum token amount deposits', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
            const amount = ethers.MaxUint256;
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await expect(chips.connect(user1).deposit(data, nonce, signature))
                .to.be.reverted; // Should revert due to overflow
        });

    });

    describe('Game Operations Edge Cases', function () {
        it('Should revert on retrieveBuyIn when paused', async function () {
            const { chips, mockToken, manager, game, user1 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            // First deposit
            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            // Pause contract
            await chips.connect(manager).pause();

            await expect(chips.connect(game).retrieveBuyIn(user1.address, amount))
                .to.be.revertedWithCustomError(chips, 'EnforcedPause');
        });

        it('Should revert on distributeChips when paused', async function () {
            const { chips, mockToken, manager, game, user1, user2 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            // First deposit to game
            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount * 2n, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [game.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(game).approve(await chips.getAddress(), amount * 2n);
            await chips.connect(game).deposit(data, nonce, signature);

            // Pause contract
            await chips.connect(manager).pause();

            await expect(chips.connect(game).distributeChips(
                [user1.address, user2.address],
                [amount, amount]
            )).to.be.revertedWithCustomError(chips, 'EnforcedPause');
        });

        it('Should revert on distributeChips with insufficient balance', async function () {
            const { chips, game, user1, user2 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            await expect(chips.connect(game).distributeChips(
                [user1.address, user2.address],
                [amount, amount]
            )).to.be.revertedWithCustomError(chips, 'ChipInsufficientBalance');
        });
    });

    describe('Upgrade Authorization', function () {
        it('Should allow manager to upgrade contract', async function () {
            const { chips, manager } = await loadFixture(deployFixtures);
            const ChipsV2 = await ethers.getContractFactory('Chips', manager);
            await upgrades.upgradeProxy(chips, ChipsV2);
        });

        it('Should revert if non-manager tries to upgrade', async function () {
            const { chips, user1 } = await loadFixture(deployFixtures);
            const ChipsV2 = await ethers.getContractFactory('Chips', user1);
            await expect(upgrades.upgradeProxy(chips, ChipsV2))
                .to.be.revertedWithCustomError(chips, 'AccessControlUnauthorizedAccount');
        });
    });

    describe('Exchange Rate', function () {
        it('Should allow manager to set exchange rate', async function () {
            const { chips, manager } = await loadFixture(deployFixtures);
            const numerator = 2;
            const denominator = 1;

            // Verify manager has required roles
            expect(await chips.hasRole(await chips.MANAGER_ROLE(), manager.address)).to.be.true;
            expect(await chips.hasRole(await chips.READABLE_ROLE(), manager.address)).to.be.true;

            await chips.connect(manager).setExchangeRate(numerator, denominator);

            const [actualNumerator, actualDenominator] = await chips.getExchangeRate();
            expect(actualNumerator).to.equal(numerator);
            expect(actualDenominator).to.equal(denominator);
        });

        it('Should revert if non-manager tries to set exchange rate', async function () {
            const { chips, user1 } = await loadFixture(deployFixtures);

            // Verify user1 doesn't have manager role
            expect(await chips.hasRole(await chips.MANAGER_ROLE(), user1.address)).to.be.false;

            await expect(chips.connect(user1).setExchangeRate(2, 1))
                .to.be.revertedWithCustomError(chips, 'AccessControlUnauthorizedAccount');
        });

        it('Should emit ExchangeRateSet event when rate is updated', async function () {
            const { chips, manager } = await loadFixture(deployFixtures);
            const numerator = 2;
            const denominator = 1;

            await expect(chips.connect(manager).setExchangeRate(numerator, denominator))
                .to.emit(chips, 'ExchangeRateSet')
                .withArgs(manager.address, numerator, denominator);
        });

        it('Should revert if numerator is zero', async function () {
            const { chips, manager } = await loadFixture(deployFixtures);
            await expect(chips.connect(manager).setExchangeRate(0, 1))
                .to.be.revertedWithCustomError(chips, 'ExchangeRateCannotBeZero');
        });

        it('Should revert if denominator is zero', async function () {
            const { chips, manager } = await loadFixture(deployFixtures);
            await expect(chips.connect(manager).setExchangeRate(1, 0))
                .to.be.revertedWithCustomError(chips, 'ExchangeRateCannotBeZero');
        });

        it('Should apply exchange rate correctly on deposit', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
            const numerator = 2;
            const denominator = 1;
            await chips.connect(manager).setExchangeRate(numerator, denominator);

            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            // Should receive 2x the amount in chips due to exchange rate
            expect(await chips.balanceOf(user1.address)).to.equal(amount * 2n);
        });

        it('Should apply exchange rate correctly on withdrawal', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
            const numerator = 2;
            const denominator = 1;
            await chips.connect(manager).setExchangeRate(numerator, denominator);

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
            const depositSignature = await manager.signMessage(ethers.getBytes(depositMessageHash));

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
            const withdrawSignature = await manager.signMessage(ethers.getBytes(withdrawMessageHash));

            await chips.connect(user1).withdraw(withdrawData, withdrawNonce, withdrawSignature);

            // Should receive original amount back in tokens
            expect(await mockToken.balanceOf(user1.address)).to.equal(ethers.parseEther('1000'));
        });

        it('Should apply exchange rate correctly on admin deposit', async function () {
            const { chips, mockToken, manager, user1, user2 } = await loadFixture(deployFixtures);
            const numerator = 2;
            const denominator = 1;
            await chips.connect(manager).setExchangeRate(numerator, denominator);

            const amount = ethers.parseEther('100');

            await mockToken.connect(manager).approve(await chips.getAddress(), amount * 2n);
            await chips.connect(manager).adminDeposit(
                [user1.address, user2.address],
                [amount, amount]
            );

            // Each user should receive 2x the amount in chips
            expect(await chips.balanceOf(user1.address)).to.equal(amount * 2n);
            expect(await chips.balanceOf(user2.address)).to.equal(amount * 2n);
        });

        it('Should apply exchange rate correctly on admin withdrawal', async function () {
            const { chips, mockToken, manager, user1, user2 } = await loadFixture(deployFixtures);
            const numerator = 2;
            const denominator = 1;
            await chips.connect(manager).setExchangeRate(numerator, denominator);

            const amount = ethers.parseEther('100');
            const initialBalance = await mockToken.balanceOf(user1.address);

            // First deposit
            await mockToken.connect(manager).approve(await chips.getAddress(), amount * 2n);
            await chips.connect(manager).adminDeposit(
                [user1.address, user2.address],
                [amount, amount]
            );

            // Pause and withdraw
            await chips.connect(manager).pause();
            await chips.connect(manager).withdrawAllAdmin([user1.address, user2.address]);

            // Should receive original amount back in tokens
            expect(await mockToken.balanceOf(user1.address)).to.equal(amount + initialBalance);
            expect(await mockToken.balanceOf(user2.address)).to.equal(amount + initialBalance);
        });

        it('Should handle very large exchange rates', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
            const numerator = ethers.MaxUint256;
            const denominator = 1n;
            await chips.connect(manager).setExchangeRate(numerator, denominator);

            const amount = 1n; // Smallest possible amount
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            expect(await chips.balanceOf(user1.address)).to.equal(amount * numerator);
        });

        it('Should handle very small exchange rates', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
            const numerator = 1n;
            const denominator = 1000n;
            await chips.connect(manager).setExchangeRate(numerator, denominator);

            const amount = ethers.parseEther('1000');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            expect(await chips.balanceOf(user1.address)).to.equal(amount / denominator);
        });

        it('Should handle exchange rate changes between deposit and withdrawal', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);

            // Initial exchange rate 1:1
            await chips.connect(manager).setExchangeRate(1n, 1n);

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
            const depositSignature = await manager.signMessage(ethers.getBytes(depositMessageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(depositData, depositNonce, depositSignature);
            expect(await chips.balanceOf(user1.address)).to.equal(amount);
            expect(await mockToken.balanceOf(user1.address)).to.equal(ethers.parseEther('900'));
            // Change exchange rate to 2:1
            await chips.connect(manager).setExchangeRate(2n, 1n);

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
            const withdrawSignature = await manager.signMessage(ethers.getBytes(withdrawMessageHash));

            await chips.connect(user1).withdraw(withdrawData, withdrawNonce, withdrawSignature);

            expect(await mockToken.balanceOf(user1.address)).to.equal(ethers.parseEther('950'));
        });
    });

    describe('Role Management', function () {
        it('Should allow manager to revoke roles', async function () {
            const { chips, manager, game } = await loadFixture(deployFixtures);
            await chips.connect(manager).revokeRole(await chips.GAME_ROLE(), game.address);
            expect(await chips.hasRole(await chips.GAME_ROLE(), game.address)).to.be.false;
        });

        it('Should revert if non-manager tries to revoke roles', async function () {
            const { chips, user1, game } = await loadFixture(deployFixtures);
            await expect(chips.connect(user1).revokeRole(await chips.GAME_ROLE(), game.address))
                .to.be.revertedWithCustomError(chips, 'AccessControlUnauthorizedAccount');
        });

        it('Should handle role management correctly', async function () {
            const { chips, manager, user1 } = await loadFixture(deployFixtures);

            // Grant GAME_ROLE to user1
            await chips.connect(manager).grantRole(await chips.GAME_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.GAME_ROLE(), user1.address)).to.be.true;

            // Revoke GAME_ROLE from user1
            await chips.connect(manager).revokeRole(await chips.GAME_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.GAME_ROLE(), user1.address)).to.be.false;
        });

        it('Should allow manager to grant and revoke READABLE_ROLE', async function () {
            const { chips, manager, user1 } = await loadFixture(deployFixtures);

            // Grant READABLE_ROLE
            await chips.connect(manager).grantRole(await chips.READABLE_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.READABLE_ROLE(), user1.address)).to.be.true;

            // Revoke READABLE_ROLE
            await chips.connect(manager).revokeRole(await chips.READABLE_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.READABLE_ROLE(), user1.address)).to.be.false;
        });

        it('Should allow manager to grant and revoke DEV_CONFIG_ROLE', async function () {
            const { chips, manager, user1 } = await loadFixture(deployFixtures);

            // Grant DEV_CONFIG_ROLE
            await chips.connect(manager).grantRole(await chips.DEV_CONFIG_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.DEV_CONFIG_ROLE(), user1.address)).to.be.true;

            // Revoke DEV_CONFIG_ROLE
            await chips.connect(manager).revokeRole(await chips.DEV_CONFIG_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.DEV_CONFIG_ROLE(), user1.address)).to.be.false;
        });

        it('Should allow users to renounce their roles', async function () {
            const { chips, manager, user1 } = await loadFixture(deployFixtures);

            // Grant GAME_ROLE to user1
            await chips.connect(manager).grantRole(await chips.GAME_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.GAME_ROLE(), user1.address)).to.be.true;

            // User1 renounces their role
            await chips.connect(user1).renounceRole(await chips.GAME_ROLE(), user1.address);
            expect(await chips.hasRole(await chips.GAME_ROLE(), user1.address)).to.be.false;
        });
    });

    describe('Signature Verification', function () {
        it('Should prevent replay attacks', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);
            // Try to replay the same signature
            await expect(chips.connect(user1).deposit(data, nonce, signature))
                .to.be.revertedWith("AlreadyUsedSignature");
        });

        it('Should revert on signature with different chain ID', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const wrongChainId = 12345;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, wrongChainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await expect(chips.connect(user1).deposit(data, nonce, signature))
                .to.be.revertedWithCustomError(chips, 'InvalidSeed');
        });

        it('Should revert on signature with different contract address', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const wrongContractAddress = ethers.ZeroAddress;

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [wrongContractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await expect(chips.connect(user1).deposit(data, nonce, signature))
                .to.be.revertedWithCustomError(chips, 'InvalidSeed');
        });

        it('Should revert on expired signature', async () => {
            const { chips, user1, manager } = await loadFixture(deployFixtures);
            const amount = 100n;
            const contractAddress = await chips.getAddress();
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const timestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour in the past
            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, timestamp, false]
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));
            await expect(chips.connect(user1).deposit(data, nonce, signature))
                .to.be.revertedWithCustomError(chips, 'InvalidTimestamp');
        });

        it('Should prevent replay attacks', async () => {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
            const amount = 100n;
            const contractAddress = await chips.getAddress();
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const timestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour in the future
            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, timestamp, false]
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));
            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);
            await expect(chips.connect(user1).deposit(data, nonce, signature))
                .to.be.revertedWith('AlreadyUsedSignature');
        });

        it('Should revert when using withdraw data for deposit', async () => {
            const { chips, user1, manager } = await loadFixture(deployFixtures);
            const amount = 100n;
            const contractAddress = await chips.getAddress();
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const timestamp = Math.floor(Date.now() / 1000) + 3600;
            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, timestamp, true]
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));
            await expect(chips.connect(user1).deposit(data, nonce, signature))
                .to.be.revertedWithCustomError(chips, 'WrongFunction');
        });

        it('Should revert when using deposit data for withdraw', async () => {
            const { chips, user1, manager } = await loadFixture(deployFixtures);
            const amount = 100n;
            const contractAddress = await chips.getAddress();
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const timestamp = Math.floor(Date.now() / 1000) + 3600;
            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, timestamp, false]
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));
            await expect(chips.connect(user1).withdraw(data, nonce, signature))
                .to.be.revertedWithCustomError(chips, 'WrongFunction');
        });
    });

    describe('Exchange Rate Edge Cases', function () {
        it('Should handle exchange rate overflow', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
            const numerator = ethers.MaxUint256;
            const denominator = 1n;
            await chips.connect(manager).setExchangeRate(numerator, denominator);

            const amount = 1n; // Smallest possible amount
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            expect(await chips.balanceOf(user1.address)).to.equal(amount * numerator);
        });

        it('Should handle exchange rate precision loss', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
            const numerator = 1n;
            const denominator = 3n;
            await chips.connect(manager).setExchangeRate(numerator, denominator);

            const amount = ethers.parseEther('3');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            expect(await chips.balanceOf(user1.address)).to.equal(amount / denominator);
        });
    });

    describe('Balance Access Control', function () {
        it('Should revert on unauthorized balance query', async function () {
            const { chips, user1, user2 } = await loadFixture(deployFixtures);
            await expect(chips.connect(user1).balanceOf(user2.address))
                .to.be.revertedWithCustomError(chips, 'NotAuthorized');
        });

        it('Should allow balance query with READABLE_ROLE', async function () {
            const { chips, manager, user1 } = await loadFixture(deployFixtures);
            expect(await chips.connect(manager).balanceOf(user1.address)).to.equal(0);
        });
    });

    describe('Contract Upgrade', function () {
        it('Should allow upgrade with DEV_CONFIG_ROLE', async function () {
            const { chips, manager } = await loadFixture(deployFixtures);
            const ChipsV2 = await ethers.getContractFactory('Chips', manager);
            await upgrades.upgradeProxy(chips, ChipsV2);
        });

        it('Should preserve state after upgrade', async function () {
            const { chips, mockToken, user1, manager } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const contractAddress = await chips.getAddress();

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'uint256', 'bool'],
                [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false] // Add 1 hour to current timestamp
            );
            const nonce = 1;
            const message = ethers.solidityPacked(
                ['address', 'bytes', 'uint256'],
                [user1.address, data, nonce]
            );
            const messageHash = ethers.keccak256(message);
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(data, nonce, signature);

            const ChipsV2 = await ethers.getContractFactory('Chips', manager);
            const upgraded = await upgrades.upgradeProxy(chips, ChipsV2);

            expect(await upgraded.balanceOf(user1.address)).to.equal(amount);
        });
    });

    describe('Admin Operations', function () {
        it('Should handle adminDeposit with zero amounts', async function () {
            const { chips, mockToken, manager, user1, user2 } = await loadFixture(deployFixtures);

            await mockToken.connect(manager).approve(await chips.getAddress(), 0);
            await chips.connect(manager).adminDeposit(
                [user1.address, user2.address],
                [0, 0]
            );

            expect(await chips.balanceOf(user1.address)).to.equal(0);
            expect(await chips.balanceOf(user2.address)).to.equal(0);
        });

        it('Should handle withdrawAllAdmin with empty arrays', async function () {
            const { chips, manager } = await loadFixture(deployFixtures);
            await chips.connect(manager).pause();
            await chips.connect(manager).withdrawAllAdmin([]);
        });

        it('Should handle withdrawAllAdmin with users having zero balance', async function () {
            const { chips, manager, user1, user2 } = await loadFixture(deployFixtures);
            await chips.connect(manager).pause();
            await chips.connect(manager).withdrawAllAdmin([user1.address, user2.address]);
        });
    });

    describe('Upgrade Tests', function () {

        it('Should handle upgrade with same implementation', async function () {
            const { chips, manager } = await loadFixture(deployFixtures);
            const ChipsV2 = await ethers.getContractFactory('Chips', manager);
            await upgrades.upgradeProxy(chips, ChipsV2);
        });
    });
});