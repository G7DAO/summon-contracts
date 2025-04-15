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

        // Deploy as UUPS proxy
        const chips = await upgrades.deployProxy(Chips, [await mockToken.getAddress(), false], {
            initializer: 'initialize',
            kind: 'uups'
        });
        await chips.waitForDeployment();

        // Grant game role
        await chips.connect(manager).grantRole(await chips.GAME_ROLE(), game.address);

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
            const { chips, mockToken, user1 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(amount);

            expect(await chips.totalSupply()).to.equal(amount);
        });

        it('Should update total supply on withdrawal', async function () {
            const { chips, mockToken, user1 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            // First deposit
            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(amount);

            // Then withdraw
            await chips.connect(user1).withdraw(amount);

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
            const { chips, mockToken, user1 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(amount);

            expect(await chips.balanceOf(user1.address)).to.equal(amount);
            expect(await mockToken.balanceOf(await chips.getAddress())).to.equal(amount);
        });

        it('Should allow users to withdraw chips', async function () {
            const { chips, mockToken, user1 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            // First deposit
            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(amount);

            // Then withdraw
            await chips.connect(user1).withdraw(amount);

            expect(await chips.balanceOf(user1.address)).to.equal(0);
            expect(await mockToken.balanceOf(user1.address)).to.equal(ethers.parseEther('1000'));
        });

        it('Should revert if user tries to withdraw more than balance', async function () {
            const { chips, user1 } = await loadFixture(deployFixtures);
            await expect(chips.connect(user1).withdraw(ethers.parseEther('1')))
                .to.be.revertedWithCustomError(chips, 'ChipInsufficientBalance');
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
            const { chips, mockToken, game, user1 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            // First deposit
            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(amount);

            // Then retrieve buy-in
            await chips.connect(game).retrieveBuyIn(user1.address, amount);

            expect(await chips.balanceOf(user1.address)).to.equal(0);
        });

        it('Should allow game to distribute chips', async function () {
            const { chips, mockToken, game, user1, user2 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            // First deposit to game
            await mockToken.connect(game).approve(await chips.getAddress(), amount * 2n);
            await chips.connect(game).deposit(amount * 2n);

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

            await chips.connect(manager).pause();
            await mockToken.connect(user1).approve(await chips.getAddress(), amount);

            await expect(chips.connect(user1).deposit(amount))
                .to.be.revertedWithCustomError(chips, 'EnforcedPause');
        });
    });

    describe('Edge Cases', function () {
        it('Should allow zero amount deposit', async function () {
            const { chips, mockToken, user1 } = await loadFixture(deployFixtures);

            // Approve zero amount
            await mockToken.connect(user1).approve(await chips.getAddress(), 0);

            // Should succeed with zero amount
            await chips.connect(user1).deposit(0);

            // Balance should remain zero
            expect(await chips.balanceOf(user1.address)).to.equal(0);
            expect(await mockToken.balanceOf(await chips.getAddress())).to.equal(0);
        });

        it('Should allow zero amount withdrawal', async function () {
            const { chips, user1 } = await loadFixture(deployFixtures);

            // Should succeed with zero amount
            await chips.connect(user1).withdraw(0);

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
    });

    describe('Game Operations Edge Cases', function () {
        it('Should revert on retrieveBuyIn when paused', async function () {
            const { chips, mockToken, manager, game, user1 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            // First deposit
            await mockToken.connect(user1).approve(await chips.getAddress(), amount);
            await chips.connect(user1).deposit(amount);

            // Pause contract
            await chips.connect(manager).pause();

            await expect(chips.connect(game).retrieveBuyIn(user1.address, amount))
                .to.be.revertedWithCustomError(chips, 'EnforcedPause');
        });

        it('Should revert on distributeChips when paused', async function () {
            const { chips, mockToken, manager, game, user1, user2 } = await loadFixture(deployFixtures);
            const amount = ethers.parseEther('100');

            // First deposit to game
            await mockToken.connect(game).approve(await chips.getAddress(), amount * 2n);
            await chips.connect(game).deposit(amount * 2n);

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
}); 