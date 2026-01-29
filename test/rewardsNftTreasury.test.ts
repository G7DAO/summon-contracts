import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

/**
 * Test Suite: NFT Treasury for Rewards Contract
 *
 * ERC721/ERC1155 treasury flow:
 * - NFTs are transferred directly to the contract by admin (manager sends to Rewards)
 * - Contract uses whitelistToken for ERC20, ERC721, and ERC1155
 * - createTokenAndDepositRewards reserves from contract balance (isErc721Reserved, erc1155ReservedAmounts)
 * - Withdraw via withdrawAssets; reserved assets cannot be withdrawn (InsufficientTreasuryBalance)
 */
describe('Rewards NFT Treasury', function () {
    async function deployRewardsNftTreasuryFixture() {
        const [devWallet, adminWallet, managerWallet, minterWallet, user1, user2] = await ethers.getSigners();

        // Deploy mock ERC20 for mixed rewards tests
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const mockERC20 = await MockERC20.deploy('Mock Token', 'MTK');
        await mockERC20.waitForDeployment();

        // Deploy mock ERC721
        const MockERC721 = await ethers.getContractFactory('MockERC721');
        const mockERC721 = await MockERC721.deploy();
        await mockERC721.waitForDeployment();

        // Deploy mock ERC1155
        const MockERC1155 = await ethers.getContractFactory('MockERC1155');
        const mockERC1155 = await MockERC1155.deploy();
        await mockERC1155.waitForDeployment();

        // Deploy AccessToken (soulbound ERC1155 for reward tokens)
        const AccessToken = await ethers.getContractFactory('AccessToken');
        const accessToken = await AccessToken.deploy(devWallet.address);
        await accessToken.waitForDeployment();

        // Deploy Rewards contract
        const Rewards = await ethers.getContractFactory('Rewards');
        const rewards = await Rewards.deploy(devWallet.address);
        await rewards.waitForDeployment();

        // Initialize AccessToken with Rewards as minter
        await accessToken.initialize(
            'G7Reward',
            'G7R',
            'https://example.com/token/',
            'https://example.com/contract/',
            devWallet.address,
            rewards.target
        );

        // Initialize Rewards contract
        await rewards.initialize(devWallet.address, managerWallet.address, minterWallet.address, accessToken.target);

        // Whitelist tokens (unified whitelist for all token types)
        await rewards.connect(managerWallet).whitelistToken(mockERC20.target, 1); // ERC20
        await rewards.connect(managerWallet).whitelistToken(mockERC721.target, 2); // ERC721
        await rewards.connect(managerWallet).whitelistToken(mockERC1155.target, 3); // ERC1155

        // Deposit ERC20 to treasury
        await mockERC20.mint(managerWallet.address, ethers.parseEther('10000'));
        await mockERC20.connect(managerWallet).approve(rewards.target, ethers.parseEther('10000'));
        await rewards.connect(managerWallet).depositToTreasury(mockERC20.target, ethers.parseEther('10000'));

        return {
            rewards,
            accessToken,
            mockERC20,
            mockERC721,
            mockERC1155,
            devWallet,
            adminWallet,
            managerWallet,
            minterWallet,
            user1,
            user2,
        };
    }

    describe('ERC721 Treasury Management', function () {
        describe('Create Reward with ERC721', function () {
            it('Should create reward using ERC721 transferred directly to contract', async function () {
                const { rewards, mockERC721, managerWallet } = await loadFixture(deployRewardsNftTreasuryFixture);

                // Admin transfers NFTs directly to contract
                for (let i = 0; i < 10; i++) {
                    await mockERC721.mint(managerWallet.address);
                    await mockERC721.connect(managerWallet).transferFrom(managerWallet.address, rewards.target, i);
                }

                // Create reward with ERC721
                const rewardToken = {
                    tokenId: 1,
                    tokenUri: 'https://example.com/reward/1',
                    rewards: [
                        {
                            rewardType: 2, // ERC721
                            rewardAmount: 2, // 2 NFTs per claim
                            rewardTokenAddress: mockERC721.target,
                            rewardTokenIds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
                            rewardTokenId: 0,
                        },
                    ],
                    maxSupply: 5, // 5 claims * 2 NFTs = 10 NFTs
                };

                await expect(rewards.connect(managerWallet).createTokenAndDepositRewards(rewardToken))
                    .to.emit(rewards, 'TokenAdded')
                    .withArgs(1);

                // Verify NFTs are reserved
                for (let i = 0; i < 10; i++) {
                    expect(await rewards.isErc721Reserved(mockERC721.target, i)).to.be.true;
                }
                expect(await rewards.erc721TotalReserved(mockERC721.target)).to.equal(10);
            });

            it('Should revert if ERC721 not owned by contract', async function () {
                const { rewards, mockERC721, managerWallet } = await loadFixture(deployRewardsNftTreasuryFixture);

                // Mint NFTs but don't transfer to contract
                await mockERC721.mint(managerWallet.address);
                await mockERC721.mint(managerWallet.address);

                const rewardToken = {
                    tokenId: 1,
                    tokenUri: 'https://example.com/reward/1',
                    rewards: [
                        {
                            rewardType: 2, // ERC721
                            rewardAmount: 1,
                            rewardTokenAddress: mockERC721.target,
                            rewardTokenIds: [0, 1],
                            rewardTokenId: 0,
                        },
                    ],
                    maxSupply: 2,
                };

                await expect(
                    rewards.connect(managerWallet).createTokenAndDepositRewards(rewardToken)
                ).to.be.revertedWithCustomError(rewards, 'InsufficientTreasuryBalance');
            });

            it('Should revert if ERC721 not whitelisted', async function () {
                const { rewards, managerWallet, devWallet } = await loadFixture(deployRewardsNftTreasuryFixture);

                // Deploy a new ERC721 that's not whitelisted
                const MockERC721 = await ethers.getContractFactory('MockERC721');
                const notWhitelisted = await MockERC721.deploy();
                await notWhitelisted.waitForDeployment();

                // Mint and transfer to contract
                await notWhitelisted.mint(managerWallet.address);
                await notWhitelisted.connect(managerWallet).transferFrom(managerWallet.address, rewards.target, 0);

                const rewardToken = {
                    tokenId: 1,
                    tokenUri: 'https://example.com/reward/1',
                    rewards: [
                        {
                            rewardType: 2,
                            rewardAmount: 1,
                            rewardTokenAddress: notWhitelisted.target,
                            rewardTokenIds: [0],
                            rewardTokenId: 0,
                        },
                    ],
                    maxSupply: 1,
                };

                await expect(rewards.connect(managerWallet).createTokenAndDepositRewards(rewardToken))
                    .to.be.revertedWithCustomError(rewards, 'TokenNotWhitelisted');
            });

            it('Should revert if ERC721 already reserved', async function () {
                const { rewards, mockERC721, managerWallet } = await loadFixture(deployRewardsNftTreasuryFixture);

                // Transfer 4 NFTs to contract
                for (let i = 0; i < 4; i++) {
                    await mockERC721.mint(managerWallet.address);
                    await mockERC721.connect(managerWallet).transferFrom(managerWallet.address, rewards.target, i);
                }

                // Create first reward using tokenIds 0 and 1
                const rewardToken1 = {
                    tokenId: 1,
                    tokenUri: 'https://example.com/reward/1',
                    rewards: [
                        {
                            rewardType: 2,
                            rewardAmount: 1,
                            rewardTokenAddress: mockERC721.target,
                            rewardTokenIds: [0, 1],
                            rewardTokenId: 0,
                        },
                    ],
                    maxSupply: 2,
                };
                await rewards.connect(managerWallet).createTokenAndDepositRewards(rewardToken1);

                // Try to create second reward using tokenId 0 (already reserved)
                const rewardToken2 = {
                    tokenId: 2,
                    tokenUri: 'https://example.com/reward/2',
                    rewards: [
                        {
                            rewardType: 2,
                            rewardAmount: 1,
                            rewardTokenAddress: mockERC721.target,
                            rewardTokenIds: [0, 2], // tokenId 0 is already reserved
                            rewardTokenId: 0,
                        },
                    ],
                    maxSupply: 2,
                };

                await expect(
                    rewards.connect(managerWallet).createTokenAndDepositRewards(rewardToken2)
                ).to.be.revertedWithCustomError(rewards, 'InsufficientTreasuryBalance');
            });
        });

        describe('Withdraw ERC721', function () {
            it('Should withdraw unreserved ERC721 via withdrawAssets', async function () {
                const { rewards, mockERC721, managerWallet, user1 } = await loadFixture(
                    deployRewardsNftTreasuryFixture
                );

                // Transfer NFT to contract (not part of any reward)
                await mockERC721.mint(managerWallet.address);
                await mockERC721.connect(managerWallet).transferFrom(managerWallet.address, rewards.target, 0);

                await expect(
                    rewards.connect(managerWallet).withdrawAssets(
                        2, // LibItems.RewardType.ERC721
                        user1.address,
                        mockERC721.target,
                        [0],
                        []
                    )
                )
                    .to.emit(rewards, 'AssetsWithdrawn')
                    .withArgs(2, user1.address, 0);

                expect(await mockERC721.ownerOf(0)).to.equal(user1.address);
            });

            it('Should revert withdraw for reserved ERC721', async function () {
                const { rewards, mockERC721, managerWallet, user1 } = await loadFixture(
                    deployRewardsNftTreasuryFixture
                );

                // Transfer NFT to contract
                await mockERC721.mint(managerWallet.address);
                await mockERC721.connect(managerWallet).transferFrom(managerWallet.address, rewards.target, 0);

                // Create reward to reserve the NFT
                const rewardToken = {
                    tokenId: 1,
                    tokenUri: 'https://example.com/reward/1',
                    rewards: [
                        {
                            rewardType: 2,
                            rewardAmount: 1,
                            rewardTokenAddress: mockERC721.target,
                            rewardTokenIds: [0],
                            rewardTokenId: 0,
                        },
                    ],
                    maxSupply: 1,
                };
                await rewards.connect(managerWallet).createTokenAndDepositRewards(rewardToken);

                // Try to withdraw reserved NFT via withdrawAssets
                await expect(
                    rewards.connect(managerWallet).withdrawAssets(
                        2, // ERC721
                        user1.address,
                        mockERC721.target,
                        [0],
                        []
                    )
                ).to.be.revertedWithCustomError(rewards, 'InsufficientTreasuryBalance');
            });
        });
    });

    describe('ERC1155 Treasury Management', function () {
        describe('Create Reward with ERC1155', function () {
            it('Should create reward using ERC1155 transferred directly to contract', async function () {
                const { rewards, mockERC1155, managerWallet } = await loadFixture(deployRewardsNftTreasuryFixture);

                // Admin transfers ERC1155 directly to contract
                await mockERC1155.mint(managerWallet.address, 1, 100, '0x');
                await mockERC1155.connect(managerWallet).safeTransferFrom(managerWallet.address, rewards.target, 1, 100, '0x');

                // Create reward with ERC1155
                const rewardToken = {
                    tokenId: 1,
                    tokenUri: 'https://example.com/reward/1',
                    rewards: [
                        {
                            rewardType: 3, // ERC1155
                            rewardAmount: 10, // 10 tokens per claim
                            rewardTokenAddress: mockERC1155.target,
                            rewardTokenIds: [],
                            rewardTokenId: 1,
                        },
                    ],
                    maxSupply: 10, // 10 claims * 10 tokens = 100 total
                };

                await expect(rewards.connect(managerWallet).createTokenAndDepositRewards(rewardToken))
                    .to.emit(rewards, 'TokenAdded')
                    .withArgs(1);

                // Verify amount is reserved
                expect(await rewards.erc1155ReservedAmounts(mockERC1155.target, 1)).to.equal(100);
            });

            it('Should revert if insufficient ERC1155 balance', async function () {
                const { rewards, mockERC1155, managerWallet } = await loadFixture(deployRewardsNftTreasuryFixture);

                // Transfer only 50 tokens to contract
                await mockERC1155.mint(managerWallet.address, 1, 50, '0x');
                await mockERC1155.connect(managerWallet).safeTransferFrom(managerWallet.address, rewards.target, 1, 50, '0x');

                // Try to create reward requiring 100 tokens
                const rewardToken = {
                    tokenId: 1,
                    tokenUri: 'https://example.com/reward/1',
                    rewards: [
                        {
                            rewardType: 3, // ERC1155
                            rewardAmount: 10,
                            rewardTokenAddress: mockERC1155.target,
                            rewardTokenIds: [],
                            rewardTokenId: 1,
                        },
                    ],
                    maxSupply: 10, // 10 * 10 = 100 required, only 50 available
                };

                await expect(
                    rewards.connect(managerWallet).createTokenAndDepositRewards(rewardToken)
                ).to.be.revertedWithCustomError(rewards, 'InsufficientTreasuryBalance');
            });
        });

        describe('Withdraw ERC1155', function () {
            it('Should withdraw unreserved ERC1155 via withdrawAssets', async function () {
                const { rewards, mockERC1155, managerWallet, user1 } = await loadFixture(
                    deployRewardsNftTreasuryFixture
                );

                // Transfer tokens to contract (not part of any reward)
                await mockERC1155.mint(managerWallet.address, 1, 100, '0x');
                await mockERC1155
                    .connect(managerWallet)
                    .safeTransferFrom(managerWallet.address, rewards.target, 1, 100, '0x');

                await expect(
                    rewards.connect(managerWallet).withdrawAssets(
                        3, // LibItems.RewardType.ERC1155
                        user1.address,
                        mockERC1155.target,
                        [1],
                        [50]
                    )
                )
                    .to.emit(rewards, 'AssetsWithdrawn')
                    .withArgs(3, user1.address, 50);

                expect(await mockERC1155.balanceOf(user1.address, 1)).to.equal(50);
                expect(await mockERC1155.balanceOf(rewards.target, 1)).to.equal(50);
            });

            it('Should revert if withdraw amount exceeds unreserved', async function () {
                const { rewards, mockERC1155, managerWallet, user1 } = await loadFixture(deployRewardsNftTreasuryFixture);

                // Transfer tokens to contract
                await mockERC1155.mint(managerWallet.address, 1, 100, '0x');
                await mockERC1155.connect(managerWallet).safeTransferFrom(managerWallet.address, rewards.target, 1, 100, '0x');

                // Create reward reserving 80 tokens
                const rewardToken = {
                    tokenId: 1,
                    tokenUri: 'https://example.com/reward/1',
                    rewards: [
                        {
                            rewardType: 3,
                            rewardAmount: 8,
                            rewardTokenAddress: mockERC1155.target,
                            rewardTokenIds: [],
                            rewardTokenId: 1,
                        },
                    ],
                    maxSupply: 10,
                };
                await rewards.connect(managerWallet).createTokenAndDepositRewards(rewardToken);

                // Try to withdraw 30 (only 20 unreserved)
                await expect(
                    rewards.connect(managerWallet).withdrawAssets(
                        3, // ERC1155
                        user1.address,
                        mockERC1155.target,
                        [1],
                        [30]
                    )
                ).to.be.revertedWithCustomError(rewards, 'InsufficientTreasuryBalance');
            });
        });
    });

    describe('Claim Rewards', function () {
        it('Should distribute ERC721 on claim and release reservation', async function () {
            const { rewards, accessToken, mockERC721, managerWallet, minterWallet, user1 } = await loadFixture(deployRewardsNftTreasuryFixture);

            // Transfer NFTs to contract
            for (let i = 0; i < 2; i++) {
                await mockERC721.mint(managerWallet.address);
                await mockERC721.connect(managerWallet).transferFrom(managerWallet.address, rewards.target, i);
            }

            // Create reward
            const rewardToken = {
                tokenId: 1,
                tokenUri: 'https://example.com/reward/1',
                rewards: [
                    {
                        rewardType: 2, // ERC721
                        rewardAmount: 1,
                        rewardTokenAddress: mockERC721.target,
                        rewardTokenIds: [0, 1],
                        rewardTokenId: 0,
                    },
                ],
                maxSupply: 2,
            };
            await rewards.connect(managerWallet).createTokenAndDepositRewards(rewardToken);

            // Mint reward token to user
            await rewards.connect(minterWallet).adminMintById(user1.address, 1, 1, true);

            // Verify user has reward token
            expect(await accessToken.balanceOf(user1.address, 1)).to.equal(1);

            // Claim reward
            await expect(rewards.connect(user1).claimReward(1))
                .to.emit(rewards, 'Claimed')
                .withArgs(user1.address, 1, 1);

            // Verify user received NFT
            expect(await mockERC721.ownerOf(0)).to.equal(user1.address);

            // Verify reservation released
            expect(await rewards.isErc721Reserved(mockERC721.target, 0)).to.be.false;

            // TokenId 1 should still be reserved
            expect(await rewards.isErc721Reserved(mockERC721.target, 1)).to.be.true;
            expect(await rewards.erc721TotalReserved(mockERC721.target)).to.equal(1);
        });

        it('Should distribute ERC1155 on claim', async function () {
            const { rewards, accessToken, mockERC1155, managerWallet, minterWallet, user1 } = await loadFixture(
                deployRewardsNftTreasuryFixture
            );

            // Transfer tokens to contract
            await mockERC1155.mint(managerWallet.address, 1, 100, '0x');
            await mockERC1155
                .connect(managerWallet)
                .safeTransferFrom(managerWallet.address, rewards.target, 1, 100, '0x');

            // Create reward
            const rewardToken = {
                tokenId: 1,
                tokenUri: 'https://example.com/reward/1',
                rewards: [
                    {
                        rewardType: 3, // ERC1155
                        rewardAmount: 10,
                        rewardTokenAddress: mockERC1155.target,
                        rewardTokenIds: [],
                        rewardTokenId: 1,
                    },
                ],
                maxSupply: 10,
            };
            await rewards.connect(managerWallet).createTokenAndDepositRewards(rewardToken);

            // Mint reward token to user
            await rewards.connect(minterWallet).adminMintById(user1.address, 1, 1, true);

            // Claim reward
            await expect(rewards.connect(user1).claimReward(1))
                .to.emit(rewards, 'Claimed')
                .withArgs(user1.address, 1, 1);

            // Verify user received tokens
            expect(await mockERC1155.balanceOf(user1.address, 1)).to.equal(10);

            // Verify reserved amount decreased after claim
            expect(await rewards.erc1155ReservedAmounts(mockERC1155.target, 1)).to.equal(90);
        });
    });

    describe('Mixed Rewards (ERC20 + ERC721 + ERC1155)', function () {
        it('Should create and claim reward with mixed asset types', async function () {
            const { rewards, accessToken, mockERC20, mockERC721, mockERC1155, managerWallet, minterWallet, user1 } = await loadFixture(deployRewardsNftTreasuryFixture);

            // Transfer ERC721 to contract
            await mockERC721.mint(managerWallet.address);
            await mockERC721.connect(managerWallet).transferFrom(managerWallet.address, rewards.target, 0);

            // Transfer ERC1155 to contract
            await mockERC1155.mint(managerWallet.address, 1, 10, '0x');
            await mockERC1155.connect(managerWallet).safeTransferFrom(managerWallet.address, rewards.target, 1, 10, '0x');

            // Create mixed reward
            const rewardToken = {
                tokenId: 1,
                tokenUri: 'https://example.com/reward/1',
                rewards: [
                    {
                        rewardType: 1, // ERC20
                        rewardAmount: ethers.parseEther('100'),
                        rewardTokenAddress: mockERC20.target,
                        rewardTokenIds: [],
                        rewardTokenId: 0,
                    },
                    {
                        rewardType: 2, // ERC721
                        rewardAmount: 1,
                        rewardTokenAddress: mockERC721.target,
                        rewardTokenIds: [0],
                        rewardTokenId: 0,
                    },
                    {
                        rewardType: 3, // ERC1155
                        rewardAmount: 10,
                        rewardTokenAddress: mockERC1155.target,
                        rewardTokenIds: [],
                        rewardTokenId: 1,
                    },
                ],
                maxSupply: 1,
            };
            await rewards.connect(managerWallet).createTokenAndDepositRewards(rewardToken);

            // Mint reward token to user
            await rewards.connect(minterWallet).adminMintById(user1.address, 1, 1, true);

            // Record initial balances
            const initialERC20Balance = await mockERC20.balanceOf(user1.address);

            // Claim reward
            await rewards.connect(user1).claimReward(1);

            // Verify user received all rewards
            expect(await mockERC20.balanceOf(user1.address)).to.equal(initialERC20Balance + ethers.parseEther('100'));
            expect(await mockERC721.ownerOf(0)).to.equal(user1.address);
            expect(await mockERC1155.balanceOf(user1.address, 1)).to.equal(10);
        });
    });


    describe('withdrawAssets Protection', function () {
        it('Should protect reserved ERC721 via withdrawAssets', async function () {
            const { rewards, mockERC721, managerWallet, user1 } = await loadFixture(deployRewardsNftTreasuryFixture);

            // Transfer NFT to contract
            await mockERC721.mint(managerWallet.address);
            await mockERC721.connect(managerWallet).transferFrom(managerWallet.address, rewards.target, 0);

            // Create reward reserving the NFT
            const rewardToken = {
                tokenId: 1,
                tokenUri: 'https://example.com/reward/1',
                rewards: [
                    {
                        rewardType: 2,
                        rewardAmount: 1,
                        rewardTokenAddress: mockERC721.target,
                        rewardTokenIds: [0],
                        rewardTokenId: 0,
                    },
                ],
                maxSupply: 1,
            };
            await rewards.connect(managerWallet).createTokenAndDepositRewards(rewardToken);

            // Try to withdraw reserved NFT via withdrawAssets
            await expect(
                rewards.connect(managerWallet).withdrawAssets(
                    2, // ERC721
                    user1.address,
                    mockERC721.target,
                    [0],
                    []
                )
            ).to.be.revertedWithCustomError(rewards, 'InsufficientTreasuryBalance');
        });

        it('Should protect reserved ERC1155 via withdrawAssets', async function () {
            const { rewards, mockERC1155, managerWallet, user1 } = await loadFixture(deployRewardsNftTreasuryFixture);

            // Transfer tokens to contract
            await mockERC1155.mint(managerWallet.address, 1, 100, '0x');
            await mockERC1155.connect(managerWallet).safeTransferFrom(managerWallet.address, rewards.target, 1, 100, '0x');

            // Create reward reserving 80 tokens
            const rewardToken = {
                tokenId: 1,
                tokenUri: 'https://example.com/reward/1',
                rewards: [
                    {
                        rewardType: 3,
                        rewardAmount: 8,
                        rewardTokenAddress: mockERC1155.target,
                        rewardTokenIds: [],
                        rewardTokenId: 1,
                    },
                ],
                maxSupply: 10,
            };
            await rewards.connect(managerWallet).createTokenAndDepositRewards(rewardToken);

            // Try to withdraw 30 via withdrawAssets (only 20 unreserved)
            await expect(
                rewards.connect(managerWallet).withdrawAssets(
                    3, // ERC1155
                    user1.address,
                    mockERC1155.target,
                    [1],
                    [30]
                )
            ).to.be.revertedWithCustomError(rewards, 'InsufficientTreasuryBalance');
        });
    });
});
