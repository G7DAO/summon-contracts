import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('RewardsNative', function () {
    async function deployRewardsFixture() {
        const [devWallet, adminWallet, managerWallet, minterWallet, user1, user2] = await ethers.getSigners();

        const AdminERC1155Soulbound = await ethers.getContractFactory('AdminERC1155Soulbound');
        const adminERC1155Soulbound = await AdminERC1155Soulbound.deploy(devWallet.address);
        await adminERC1155Soulbound.waitForDeployment();

        const RewardsNative = await ethers.getContractFactory('RewardsNative');
        const rewardsNative = await RewardsNative.deploy(
            devWallet,
            adminWallet,
            managerWallet,
            minterWallet,
            adminERC1155Soulbound
        );

        await rewardsNative.waitForDeployment();
        await adminERC1155Soulbound.initialize(
            'G7Reward',
            'G7R',
            'https://example.com/token/',
            'https://example.com/contract/',
            devWallet.address,
            rewardsNative.target
        );

        return {
            rewardsNative,
            adminERC1155Soulbound,
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
            const { rewardsNative } = await loadFixture(deployRewardsFixture);
            expect(await rewardsNative.getAddress()).to.be.properAddress;
        });

        it('Should set the correct roles', async function () {
            const { rewardsNative, devWallet, adminWallet, managerWallet, minterWallet } =
                await loadFixture(deployRewardsFixture);

            expect(await rewardsNative.hasRole(await rewardsNative.DEV_CONFIG_ROLE(), devWallet)).to.be.true;
            expect(await rewardsNative.hasRole(await rewardsNative.DEFAULT_ADMIN_ROLE(), adminWallet)).to.be.true;
            expect(await rewardsNative.hasRole(await rewardsNative.MANAGER_ROLE(), managerWallet)).to.be.true;
            expect(await rewardsNative.hasRole(await rewardsNative.MINTER_ROLE(), minterWallet)).to.be.true;
        });

        it('AdminERC1155Soulbound should set the roles correctly', async function () {
            const { adminERC1155Soulbound, devWallet, rewardsNative } = await loadFixture(deployRewardsFixture);
            expect(await adminERC1155Soulbound.hasRole(await adminERC1155Soulbound.DEFAULT_ADMIN_ROLE(), devWallet)).to
                .be.true;
            expect(await adminERC1155Soulbound.hasRole(await adminERC1155Soulbound.MANAGER_ROLE(), devWallet)).to.be
                .true;
            expect(await adminERC1155Soulbound.hasRole(await adminERC1155Soulbound.MINTER_ROLE(), rewardsNative)).to.be
                .true;
        });
    });

    describe('Token Management', function () {
        it('Should add a new token', async function () {
            const { rewardsNative, devWallet } = await loadFixture(deployRewardsFixture);
            const rewardToken = {
                tokenId: 1,
                maxSupply: 100,
                tokenUri: 'https://example.com/token/1',
                rewards: [{ rewardAmount: ethers.parseEther('0.1') }],
            };

            const rewardNativeWithDev = rewardsNative.connect(devWallet);

            const tx = await rewardNativeWithDev.createTokenAndDepositRewards(rewardToken, {
                value: ethers.parseEther('10'),
            });

            await expect(tx).to.emit(rewardNativeWithDev, 'TokenAdded').withArgs(1);

            const tokenDetails = await rewardNativeWithDev.getTokenDetails(1);
            expect(tokenDetails.tokenUri).to.equal(rewardToken.tokenUri);
            expect(tokenDetails.maxSupply).to.equal(rewardToken.maxSupply);
            expect(tokenDetails.rewardAmounts[0]).to.equal(rewardToken.rewards[0].rewardAmount);
        });

        it('Should revert when adding a duplicate token', async function () {
            const { rewardsNative, devWallet } = await loadFixture(deployRewardsFixture);
            const rewardToken = {
                tokenId: 1,
                maxSupply: 100,
                tokenUri: 'https://example.com/token/1',
                rewards: [{ rewardAmount: ethers.parseEther('0.1') }],
            };

            await rewardsNative
                .connect(devWallet)
                .createTokenAndDepositRewards(rewardToken, { value: ethers.parseEther('10') });

            await expect(
                rewardsNative
                    .connect(devWallet)
                    .createTokenAndDepositRewards(rewardToken, { value: ethers.parseEther('10') })
            ).to.be.revertedWithCustomError(rewardsNative, 'DupTokenId');
        });
    });

    describe('Minting', function () {
        it('Should mint a token', async function () {
            const { rewardsNative, minterWallet, user1, devWallet } = await loadFixture(deployRewardsFixture);
            const rewardToken = {
                tokenId: 1,
                maxSupply: 100,
                tokenUri: 'https://example.com/token/1',
                rewards: [{ rewardAmount: ethers.parseEther('0.1') }],
            };

            const rewardNativeWithDev = rewardsNative.connect(devWallet);
            const rewardNativeWithMinter = rewardsNative.connect(minterWallet);

            await rewardNativeWithDev.createTokenAndDepositRewards(rewardToken, { value: ethers.parseEther('10') });

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256[]'],
                [await rewardsNative.getAddress(), await rewardsNative.getChainID(), [1]]
            );

            await expect(rewardNativeWithMinter.mint(user1.address, data, true))
                .to.emit(rewardsNative, 'Minted')
                .withArgs(user1.address, 1, 1, true);
        });

        it('Should revert when minting exceeds max supply', async function () {
            const { rewardsNative, devWallet, minterWallet, user1 } = await loadFixture(deployRewardsFixture);
            const rewardToken = {
                tokenId: 1,
                maxSupply: 1,
                tokenUri: 'https://example.com/token/1',
                rewards: [{ rewardAmount: ethers.parseEther('0.1') }],
            };

            const rewardNativeWithDev = rewardsNative.connect(devWallet);
            const rewardNativeWithMinter = rewardsNative.connect(minterWallet);

            await rewardNativeWithDev.createTokenAndDepositRewards(rewardToken, { value: ethers.parseEther('0.1') });

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256[]'],
                [await rewardsNative.getAddress(), await rewardsNative.getChainID(), [1]]
            );

            await rewardNativeWithMinter.mint(user1.address, data, true);

            await expect(rewardNativeWithMinter.mint(user1.address, data, true)).to.be.revertedWithCustomError(
                rewardsNative,
                'ExceedMaxSupply'
            );
        });
    });

    describe('Claiming Rewards', function () {
        it('Should claim a reward minted as a regular user', async function () {
            const { rewardsNative, managerWallet, minterWallet, user1, devWallet } =
                await loadFixture(deployRewardsFixture);

            const rewardAmount = ethers.parseEther('1');
            const rewardToken = {
                tokenId: 1,
                maxSupply: 1,
                tokenUri: 'https://example.com/token/1',
                rewards: [{ rewardAmount }],
            };

            const rewardNativeWithDev = rewardsNative.connect(devWallet);
            const rewardNativeWithMinter = rewardsNative.connect(minterWallet);
            const rewardNativeWithUser1 = rewardsNative.connect(user1);

            await rewardNativeWithDev.createTokenAndDepositRewards(rewardToken, { value: rewardAmount });

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256[]'],
                [await rewardsNative.getAddress(), await rewardsNative.getChainID(), [1]]
            );

            await rewardNativeWithMinter.mint(user1.address, data, false);

            const initialBalance = await ethers.provider.getBalance(user1.address);
            const tx = await rewardNativeWithUser1.claimReward(1);

            await expect(tx)
                .to.emit(rewardsNative, 'Claimed')
                // address, tokenId, rewardAmount
                .withArgs(user1.address, 1, 1);

            const finalBalance = await ethers.provider.getBalance(user1.address);
            expect(finalBalance).to.be.gt(initialBalance);
        });

        it('Should revert when claiming without holding the token', async function () {
            const { rewardsNative, user1 } = await loadFixture(deployRewardsFixture);

            await expect(rewardsNative.connect(user1).claimReward(1)).to.be.revertedWithCustomError(
                rewardsNative,
                'InsufficientBalance'
            );
        });
    });

    describe('Pausing', function () {
        it('Should pause and unpause the contract', async function () {
            const { rewardsNative, managerWallet } = await loadFixture(deployRewardsFixture);

            await rewardsNative.connect(managerWallet).pause();
            expect(await rewardsNative.paused()).to.be.true;

            await rewardsNative.connect(managerWallet).unpause();
            expect(await rewardsNative.paused()).to.be.false;
        });

        it('Should revert operations when paused', async function () {
            const { rewardsNative, managerWallet, user1 } = await loadFixture(deployRewardsFixture);

            await rewardsNative.connect(managerWallet).pause();

            await expect(rewardsNative.connect(user1).claimReward(1)).to.be.revertedWithCustomError(
                rewardsNative,
                'EnforcedPause'
            );
        });
    });

    describe('Access Control', function () {
        it('Should allow only dev config role to create tokens', async function () {
            const { rewardsNative, user1 } = await loadFixture(deployRewardsFixture);
            const rewardToken = {
                tokenId: 1,
                maxSupply: 100,
                tokenUri: 'https://example.com/token/1',
                rewards: [{ rewardAmount: ethers.parseEther('0.1') }],
            };

            // `AccessControl: account ${user1.address.toLowerCase()} is missing role ${await rewardsNative.MANAGER_ROLE()}`

            await expect(
                rewardsNative
                    .connect(user1)
                    .createTokenAndDepositRewards(rewardToken, { value: ethers.parseEther('10') })
            )
                .to.be.revertedWithCustomError(rewardsNative, 'AccessControlUnauthorizedAccount')
                .withArgs(user1.address, await rewardsNative.DEV_CONFIG_ROLE());
        });

        it('Should allow only minter to mint new tokens', async function () {
            const { rewardsNative, user1 } = await loadFixture(deployRewardsFixture);
            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256[]'],
                [await rewardsNative.getAddress(), await rewardsNative.getChainID(), [1]]
            );

            await expect(rewardsNative.connect(user1).mint(user1.address, data, true))
                .to.be.revertedWithCustomError(rewardsNative, 'AccessControlUnauthorizedAccount')
                .withArgs(user1.address, await rewardsNative.MINTER_ROLE());
        });
    });

    describe('Withdraw', function () {
        it('Should allow manager to withdraw funds', async function () {
            const { rewardsNative, managerWallet } = await loadFixture(deployRewardsFixture);

            // Add funds to the contract
            await managerWallet.sendTransaction({ to: rewardsNative.getAddress(), value: ethers.parseEther('1') });

            const initialBalance = await ethers.provider.getBalance(managerWallet.address);
            await rewardsNative.connect(managerWallet).withdrawAll(managerWallet.address, ethers.parseEther('1'));
            const finalBalance = await ethers.provider.getBalance(managerWallet.address);

            expect(finalBalance).to.be.gt(initialBalance);
        });

        it('Should revert when non-manager tries to withdraw', async function () {
            const { rewardsNative, user1 } = await loadFixture(deployRewardsFixture);

            await expect(rewardsNative.connect(user1).withdrawAll(user1.address, ethers.parseEther('1')))
                .to.be.revertedWithCustomError(rewardsNative, 'AccessControlUnauthorizedAccount')
                .withArgs(user1.address, await rewardsNative.MANAGER_ROLE());
        });
    });

    describe('Token Mint and Claim Pause', function () {
        it('Should allow manager to pause token minting', async function () {
            const { rewardsNative, managerWallet } = await loadFixture(deployRewardsFixture);

            await rewardsNative.connect(managerWallet).updateTokenMintPaused(1, true);
            expect(await rewardsNative.isTokenMintPaused(1)).to.be.true;
        });

        it('Should allow manager to pause claim rewards', async function () {
            const { rewardsNative, managerWallet } = await loadFixture(deployRewardsFixture);

            await rewardsNative.connect(managerWallet).updateClaimRewardPaused(1, true);
            expect(await rewardsNative.isClaimRewardPaused(1)).to.be.true;
        });

        it('Should revert minting when token mint is paused', async function () {
            const { rewardsNative, minterWallet, user1, devWallet, managerWallet } =
                await loadFixture(deployRewardsFixture);

            const rewardToken = {
                tokenId: 1,
                maxSupply: 100,
                tokenUri: 'https://example.com/token/1',
                rewards: [{ rewardAmount: ethers.parseEther('0.1') }],
            };

            const rewardNativeWithDev = rewardsNative.connect(devWallet);
            const rewardNativeWithMinter = rewardsNative.connect(minterWallet);
            const rewardNativeWithManager = rewardsNative.connect(managerWallet);

            await rewardNativeWithDev.createTokenAndDepositRewards(rewardToken, { value: ethers.parseEther('10') });
            await rewardNativeWithManager.updateTokenMintPaused(rewardToken.tokenId, true);

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256[]'],
                [await rewardsNative.getAddress(), await rewardsNative.getChainID(), [1]]
            );

            await expect(rewardNativeWithMinter.mint(user1.address, data, true)).to.be.revertedWithCustomError(
                rewardsNative,
                'MintPaused'
            );
        });

        it('Should revert claiming when claim reward is paused', async function () {
            const { rewardsNative, managerWallet, minterWallet, user1, devWallet } =
                await loadFixture(deployRewardsFixture);

            const rewardToken = {
                tokenId: 1,
                maxSupply: 100,
                tokenUri: 'https://example.com/token/1',
                rewards: [{ rewardAmount: ethers.parseEther('0.1') }],
            };

            const rewardNativeWithDev = rewardsNative.connect(devWallet);
            const rewardNativeWithMinter = rewardsNative.connect(minterWallet);
            const rewardNativeWithManager = rewardsNative.connect(managerWallet);
            const rewardNativeWithUser1 = rewardsNative.connect(user1);

            await rewardNativeWithDev.createTokenAndDepositRewards(rewardToken, { value: ethers.parseEther('10') });

            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256[]'],
                [await rewardsNative.getAddress(), await rewardsNative.getChainID(), [1]]
            );

            await rewardNativeWithMinter.mint(user1.address, data, false);
            await rewardNativeWithManager.updateClaimRewardPaused(1, true);

            await expect(rewardNativeWithUser1.claimReward(1)).to.be.revertedWithCustomError(
                rewardsNative,
                'ClaimRewardPaused'
            );
        });
    });
});
