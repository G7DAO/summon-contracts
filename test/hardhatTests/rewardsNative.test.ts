import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('RewardsNative', function () {
    async function deployRewardsFixture() {
        const [devWallet, adminWallet, managerWallet, minterWallet, user1, user2] = await ethers.getSigners();

        const AdminERC1155Soulbound = await ethers.getContractFactory('AdminERC1155Soulbound');
        const adminERC1155Soulbound = await AdminERC1155Soulbound.deploy(devWallet.address);

        const Rewards = await ethers.getContractFactory('Rewards');
        const rewards = await Rewards.deploy(devWallet.address);

        await rewards.initialize(
            devWallet.address,
            adminWallet.address,
            managerWallet.address,
            minterWallet.address,
            adminERC1155Soulbound.address
        );

        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const mockERC20 = await MockERC20.deploy('Mock Token', 'MTK');

        return {
            rewards,
            adminERC1155Soulbound,
            mockERC20,
            devWallet,
            adminWallet,
            managerWallet,
            minterWallet,
            user1,
            user2,
        };
    }

    describe('Deployment', function () {
        it('Should deploy successfully', async function () {
            const { rewards } = await loadFixture(deployRewardsFixture);
            expect(await rewards.getAddress()).to.be.properAddress;
        });

        it('Should set the correct roles', async function () {
            const { rewards, devWallet, adminWallet, managerWallet, minterWallet } =
                await loadFixture(deployRewardsFixture);

            expect(await rewards.hasRole(await rewards.DEFAULT_ADMIN_ROLE(), devWallet.address)).to.be.true;
            expect(await rewards.hasRole(await rewards.DEFAULT_ADMIN_ROLE(), adminWallet.address)).to.be.true;
            expect(await rewards.hasRole(await rewards.MANAGER_ROLE(), managerWallet.address)).to.be.true;
            expect(await rewards.hasRole(await rewards.MINTER_ROLE(), minterWallet.address)).to.be.true;
        });
    });

    describe('Token Management', function () {
        it('Should add a new token', async function () {
            const { rewards, managerWallet } = await loadFixture(deployRewardsFixture);
            const rewardToken = {
                tokenId: 1,
                maxSupply: 100,
                tokenUri: 'https://example.com/token/1',
                rewards: [{ rewardAmount: ethers.parseEther('0.1') }],
            };

            await expect(
                rewards
                    .connect(managerWallet)
                    .createTokenAndDepositRewards(rewardToken, { value: ethers.parseEther('10') })
            )
                .to.emit(rewards, 'TokenAdded')
                .withArgs(1);

            const tokenDetails = await rewards.getTokenDetails(1);
            expect(tokenDetails.tokenUri).to.equal(rewardToken.tokenUri);
            expect(tokenDetails.maxSupply).to.equal(rewardToken.maxSupply);
            expect(tokenDetails.rewardAmounts[0]).to.equal(rewardToken.rewards[0].rewardAmount);
        });

        it('Should revert when adding a duplicate token', async function () {
            const { rewards, managerWallet } = await loadFixture(deployRewardsFixture);
            const rewardToken = {
                tokenId: 1,
                maxSupply: 100,
                tokenUri: 'https://example.com/token/1',
                rewards: [{ rewardAmount: ethers.parseEther('0.1') }],
            };

            await rewards
                .connect(managerWallet)
                .createTokenAndDepositRewards(rewardToken, { value: ethers.parseEther('10') });

            await expect(
                rewards
                    .connect(managerWallet)
                    .createTokenAndDepositRewards(rewardToken, { value: ethers.parseEther('10') })
            ).to.be.revertedWithCustomError(rewards, 'DupTokenId');
        });
    });

    describe('Minting', function () {
        it('Should mint a token', async function () {
            const { rewards, managerWallet, minterWallet, user1 } = await loadFixture(deployRewardsFixture);
            const rewardToken = {
                tokenId: 1,
                maxSupply: 100,
                tokenUri: 'https://example.com/token/1',
                rewards: [{ rewardAmount: ethers.parseEther('0.1') }],
            };

            await rewards
                .connect(managerWallet)
                .createTokenAndDepositRewards(rewardToken, { value: ethers.parseEther('10') });

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256[]'],
                [await rewards.getAddress(), await rewards.getChainID(), [1]]
            );

            await expect(rewards.connect(minterWallet).adminMint(user1.address, data, true, false))
                .to.emit(rewards, 'Minted')
                .withArgs(user1.address, 1, 1, true);
        });

        it('Should revert when minting exceeds max supply', async function () {
            const { rewards, managerWallet, minterWallet, user1 } = await loadFixture(deployRewardsFixture);
            const rewardToken = {
                tokenId: 1,
                maxSupply: 1,
                tokenUri: 'https://example.com/token/1',
                rewards: [{ rewardAmount: ethers.parseEther('0.1') }],
            };

            await rewards
                .connect(managerWallet)
                .createTokenAndDepositRewards(rewardToken, { value: ethers.parseEther('0.1') });

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256[]'],
                [await rewards.getAddress(), await rewards.getChainID(), [1]]
            );

            await rewards.connect(minterWallet).adminMint(user1.address, data, true, false);

            await expect(
                rewards.connect(minterWallet).adminMint(user1.address, data, true, false)
            ).to.be.revertedWithCustomError(rewards, 'ExceedMaxSupply');
        });
    });

    describe('Claiming Rewards', function () {
        it('Should claim a reward', async function () {
            const { rewards, adminERC1155Soulbound, managerWallet, minterWallet, user1 } =
                await loadFixture(deployRewardsFixture);
            const rewardToken = {
                tokenId: 1,
                maxSupply: 100,
                tokenUri: 'https://example.com/token/1',
                rewards: [{ rewardAmount: ethers.parseEther('0.1') }],
            };

            await rewards
                .connect(managerWallet)
                .createTokenAndDepositRewards(rewardToken, { value: ethers.parseEther('10') });

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256[]'],
                [await rewards.getAddress(), await rewards.getChainID(), [1]]
            );

            await rewards.connect(minterWallet).adminMint(user1.address, data, true, false);

            const initialBalance = await ethers.provider.getBalance(user1.address);

            await expect(rewards.connect(user1).claimReward(1))
                .to.emit(rewards, 'Claimed')
                .withArgs(user1.address, 1, 1);

            const finalBalance = await ethers.provider.getBalance(user1.address);
            expect(finalBalance).to.be.gt(initialBalance);
        });

        it('Should revert when claiming without holding the token', async function () {
            const { rewards, user1 } = await loadFixture(deployRewardsFixture);

            await expect(rewards.connect(user1).claimReward(1)).to.be.revertedWithCustomError(
                rewards,
                'InsufficientBalance'
            );
        });
    });

    describe('Pausing', function () {
        it('Should pause and unpause the contract', async function () {
            const { rewards, managerWallet } = await loadFixture(deployRewardsFixture);

            await rewards.connect(managerWallet).pause();
            expect(await rewards.paused()).to.be.true;

            await rewards.connect(managerWallet).unpause();
            expect(await rewards.paused()).to.be.false;
        });

        it('Should revert operations when paused', async function () {
            const { rewards, managerWallet, user1 } = await loadFixture(deployRewardsFixture);

            await rewards.connect(managerWallet).pause();

            await expect(rewards.connect(user1).claimReward(1)).to.be.revertedWith('Pausable: paused');
        });
    });

    describe('Access Control', function () {
        it('Should allow only manager to create tokens', async function () {
            const { rewards, user1 } = await loadFixture(deployRewardsFixture);
            const rewardToken = {
                tokenId: 1,
                maxSupply: 100,
                tokenUri: 'https://example.com/token/1',
                rewards: [{ rewardAmount: ethers.parseEther('0.1') }],
            };

            await expect(
                rewards.connect(user1).createTokenAndDepositRewards(rewardToken, { value: ethers.parseEther('10') })
            ).to.be.revertedWith(
                'AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0xaf290d8680820aad922855f39b306097b20e28774d6c1ad35a20325630c3a02c'
            );
        });

        it('Should allow only minter to admin mint', async function () {
            const { rewards, user1 } = await loadFixture(deployRewardsFixture);
            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256[]'],
                [await rewards.getAddress(), await rewards.getChainID(), [1]]
            );

            await expect(rewards.connect(user1).adminMint(user1.address, data, true, false)).to.be.revertedWith(
                'AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6'
            );
        });
    });

    // Add more test cases to cover all functions and scenarios
});
