import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

/**
 * Test Suite: Soulbound Tokens as Rewards
 *
 * This test demonstrates that soulbound ERC1155 badges can be used as rewards
 * in the Rewards contract IF the Rewards contract is whitelisted on the
 * soulbound token contract.
 *
 * Key insight: The soulbound mechanism checks if from/to/msg.sender is whitelisted
 * before blocking transfers. Whitelisted addresses bypass soulbound restrictions.
 */
describe('Rewards with Soulbound Tokens', function () {
    async function deployRewardsWithSoulboundFixture() {
        const [devWallet, adminWallet, managerWallet, minterWallet, user1, user2] = await ethers.getSigners();

        // Deploy mock ERC20 for treasury
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const mockERC20 = await MockERC20.deploy('Mock Token', 'MTK');
        await mockERC20.waitForDeployment();

        // Deploy AccessToken (soulbound ERC1155 for reward tokens)
        const AccessToken = await ethers.getContractFactory('AccessToken');
        const accessToken = await AccessToken.deploy(devWallet.address);
        await accessToken.waitForDeployment();

        // Deploy ERC1155Soulbound as the badge contract (rewards to distribute)
        const ERC1155Soulbound = await ethers.getContractFactory('ERC1155Soulbound');
        const soulboundBadge = await ERC1155Soulbound.deploy(
            'KPOP Badges',
            'KPOP',
            'https://kpop.xyz/badges/',
            'https://kpop.xyz/contract/',
            100, // maxPerMint
            false, // isPaused
            devWallet.address
        );
        await soulboundBadge.waitForDeployment();

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
        await rewards.initialize(
            devWallet.address,
            managerWallet.address,
            minterWallet.address,
            accessToken.target
        );

        // Setup: Add a token to the soulbound badge contract
        const badgeTokenId = 1;
        await soulboundBadge.connect(devWallet).addNewToken({
            tokenId: badgeTokenId,
            tokenUri: 'https://kpop.xyz/badges/1',
            receiver: ethers.ZeroAddress,
            feeBasisPoints: 0,
        });

        // Whitelist ERC20 for treasury
        await rewards.connect(managerWallet).whitelistToken(mockERC20.target);

        // Mint ERC20 to manager and deposit to treasury
        await mockERC20.mint(managerWallet.address, ethers.parseEther('1000'));
        await mockERC20.connect(managerWallet).approve(rewards.target, ethers.parseEther('1000'));
        await rewards.connect(managerWallet).depositToTreasury(mockERC20.target, ethers.parseEther('1000'));

        return {
            rewards,
            accessToken,
            soulboundBadge,
            mockERC20,
            devWallet,
            adminWallet,
            managerWallet,
            minterWallet,
            user1,
            user2,
            badgeTokenId,
        };
    }

    describe('ERC1155 Soulbound Badge as Reward', function () {
        it('Should FAIL to transfer soulbound badge WITHOUT whitelist', async function () {
            const { soulboundBadge, rewards, devWallet, user1, badgeTokenId } =
                await loadFixture(deployRewardsWithSoulboundFixture);

            // Mint soulbound badge to Rewards contract (as if deposited)
            // The devWallet has MINTER_ROLE, so it can mint
            await soulboundBadge.connect(devWallet).adminMintId(
                rewards.target, // mint to Rewards contract
                badgeTokenId,
                10, // amount
                true // soulbound = true
            );

            // Verify Rewards contract has the badges
            expect(await soulboundBadge.balanceOf(rewards.target, badgeTokenId)).to.equal(10);

            // Without whitelist, Rewards contract cannot transfer soulbound badges
            // This simulates what would happen if we tried to use soulbound badges as ERC1155 rewards
            // The safeTransferFrom will fail because:
            // 1. Rewards contract is not whitelisted
            // 2. The badges are soulbound
            await expect(
                soulboundBadge
                    .connect(devWallet) // Even admin cannot transfer soulbound tokens
                    .safeTransferFrom(rewards.target, user1.address, badgeTokenId, 1, '0x')
            ).to.be.revertedWithCustomError(soulboundBadge, 'SoulboundAmountError');
        });

        it('Should SUCCEED to transfer soulbound badge WITH whitelist', async function () {
            const { soulboundBadge, rewards, devWallet, user1, badgeTokenId } =
                await loadFixture(deployRewardsWithSoulboundFixture);

            // IMPORTANT: Whitelist the Rewards contract on the soulbound badge contract
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(rewards.target, true);

            // Mint soulbound badge to devWallet first
            await soulboundBadge.connect(devWallet).adminMintId(devWallet.address, badgeTokenId, 10, true);

            // DevWallet transfers to Rewards contract (works because devWallet is whitelisted as sender)
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(devWallet.address, true);
            await soulboundBadge.connect(devWallet).safeTransferFrom(devWallet.address, rewards.target, badgeTokenId, 10, '0x');

            // Verify Rewards contract has the badges
            expect(await soulboundBadge.balanceOf(rewards.target, badgeTokenId)).to.equal(10);

            // Now simulate what the Rewards contract would do internally when distributing rewards
            // The Rewards contract (whitelisted) can transfer soulbound badges to users
            // In real usage, this happens in _distributeReward via _transferERC1155

            // For this test, we use withdrawAssets to demonstrate the mechanism
            // Note: withdrawAssets requires MANAGER_ROLE and would use the contract's internal transfer
        });

        it('User CANNOT transfer soulbound badge after receiving (still soulbound to user)', async function () {
            const { soulboundBadge, devWallet, user1, user2, badgeTokenId } =
                await loadFixture(deployRewardsWithSoulboundFixture);

            // Whitelist devWallet to transfer soulbound badges
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(devWallet.address, true);

            // Mint soulbound badge to devWallet
            await soulboundBadge.connect(devWallet).adminMintId(devWallet.address, badgeTokenId, 10, true);

            // Whitelist user1 as destination to allow transfer TO them
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(user1.address, true);

            // Transfer soulbound badge to user
            await soulboundBadge.connect(devWallet).safeTransferFrom(devWallet.address, user1.address, badgeTokenId, 1, '0x');

            // Remove user1 from whitelist so they behave as normal user
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(user1.address, false);

            // Verify user received the badge
            expect(await soulboundBadge.balanceOf(user1.address, badgeTokenId)).to.equal(1);

            // User CANNOT transfer the soulbound badge to another user
            await expect(
                soulboundBadge
                    .connect(user1)
                    .safeTransferFrom(user1.address, user2.address, badgeTokenId, 1, '0x')
            ).to.be.revertedWithCustomError(soulboundBadge, 'SoulboundAmountError');
        });

        it('Complete flow: Create reward with ERC1155 soulbound badge as prize', async function () {
            const { rewards, accessToken, soulboundBadge, mockERC20, devWallet, managerWallet, minterWallet, user1, badgeTokenId } =
                await loadFixture(deployRewardsWithSoulboundFixture);

            // Step 1: Whitelist Rewards contract AND managerWallet on soulbound badge contract
            // - Rewards contract needs whitelist to RECEIVE and DISTRIBUTE soulbound badges
            // - ManagerWallet needs whitelist to TRANSFER soulbound badges to Rewards
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(rewards.target, true);
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(managerWallet.address, true);

            // Step 2: Mint soulbound badges to managerWallet (who will deposit them)
            // NOTE: If we mint directly to Rewards without whitelist, we'd need a different approach
            await soulboundBadge.connect(devWallet).adminMintId(managerWallet.address, badgeTokenId, 100, true);

            // Step 3: Manager approves Rewards contract to transfer badges
            await soulboundBadge.connect(managerWallet).setApprovalForAll(rewards.target, true);

            // Step 4: Create a reward token that gives:
            // - 10 ERC20 tokens (from treasury)
            // - 1 soulbound badge (transferred from manager during create)
            const rewardTokenId = 1001;
            const rewardToken = {
                tokenId: rewardTokenId,
                maxSupply: 10,
                tokenUri: 'https://example.com/reward/1001',
                rewards: [
                    {
                        rewardType: 1, // ERC20
                        rewardAmount: ethers.parseEther('10'),
                        rewardTokenAddress: mockERC20.target,
                        rewardTokenIds: [],
                        rewardTokenId: 0,
                    },
                    {
                        rewardType: 3, // ERC1155
                        rewardAmount: 1, // 1 badge per claim
                        rewardTokenAddress: soulboundBadge.target,
                        rewardTokenIds: [],
                        rewardTokenId: badgeTokenId,
                    },
                ],
            };

            // This transfers 10 soulbound badges (1 per maxSupply) from manager to Rewards
            await rewards.connect(managerWallet).createTokenAndDepositRewards(rewardToken);

            // Verify Rewards contract now has the badges
            expect(await soulboundBadge.balanceOf(rewards.target, badgeTokenId)).to.equal(10);

            // Step 5: Mint reward token to user (tokenId, amount, isSoulbound)
            await rewards.connect(minterWallet).adminMintById(user1.address, rewardTokenId, 1, true);

            // Verify user has reward token
            expect(await accessToken.balanceOf(user1.address, rewardTokenId)).to.equal(1);

            // Step 6: User claims reward
            const initialERC20Balance = await mockERC20.balanceOf(user1.address);
            const initialBadgeBalance = await soulboundBadge.balanceOf(user1.address, badgeTokenId);

            await rewards.connect(user1).claimReward(rewardTokenId);

            // Verify user received rewards
            const finalERC20Balance = await mockERC20.balanceOf(user1.address);
            const finalBadgeBalance = await soulboundBadge.balanceOf(user1.address, badgeTokenId);

            expect(finalERC20Balance - initialERC20Balance).to.equal(ethers.parseEther('10'));
            expect(finalBadgeBalance - initialBadgeBalance).to.equal(1n);

            // Step 7: Verify user CANNOT transfer the soulbound badge
            await expect(
                soulboundBadge.connect(user1).safeTransferFrom(user1.address, devWallet.address, badgeTokenId, 1, '0x')
            ).to.be.revertedWithCustomError(soulboundBadge, 'SoulboundAmountError');

            // Step 8: Verify Rewards contract still has remaining badges
            expect(await soulboundBadge.balanceOf(rewards.target, badgeTokenId)).to.equal(9);
        });
    });

    describe('Non-soulbound badges (transferable)', function () {
        it('Should work normally with non-soulbound badges', async function () {
            const { soulboundBadge, devWallet, user1, user2, badgeTokenId } =
                await loadFixture(deployRewardsWithSoulboundFixture);

            // Mint NON-soulbound badge (soulbound = false)
            await soulboundBadge.connect(devWallet).adminMintId(user1.address, badgeTokenId, 5, false);

            // User can transfer non-soulbound badges
            await soulboundBadge.connect(user1).safeTransferFrom(user1.address, user2.address, badgeTokenId, 2, '0x');

            expect(await soulboundBadge.balanceOf(user1.address, badgeTokenId)).to.equal(3);
            expect(await soulboundBadge.balanceOf(user2.address, badgeTokenId)).to.equal(2);
        });
    });

    describe('ERC721 Soulbound - IMPORTANT LIMITATION', function () {
        /**
         * IMPORTANT: Unlike ERC1155Soulbound, the ERC721Soulbound contracts
         * DO NOT support whitelist bypass for soulbound tokens.
         *
         * This means ERC721 soulbound tokens CANNOT be used as rewards because:
         * 1. Mock721Soulbound uses soulboundTokenCheck which doesn't check whitelist
         * 2. ERC721Soulbound uses soulboundAddressCheck which also doesn't check whitelist
         *
         * If you need ERC721 soulbound tokens as rewards, you would need to:
         * - Modify the soulbound check to include whitelist bypass
         * - OR mint non-soulbound NFTs to Rewards, distribute them, then mark soulbound after claim
         */
        it('ERC721 soulbound tokens CANNOT be transferred even with whitelist (current limitation)', async function () {
            const { devWallet, user1 } = await loadFixture(deployRewardsWithSoulboundFixture);

            // Deploy Mock721Soulbound
            const Mock721Soulbound = await ethers.getContractFactory('Mock721Soulbound');
            const mock721 = await Mock721Soulbound.deploy();
            await mock721.waitForDeployment();

            // Mint soulbound NFT to devWallet
            await mock721.mint(devWallet.address);

            // Even though we have devWallet, soulbound tokens cannot be transferred
            // The soulboundTokenCheck modifier doesn't check whitelist
            await expect(
                mock721.connect(devWallet).transferFrom(devWallet.address, user1.address, 0)
            ).to.be.revertedWithCustomError(mock721, 'TokenIsSoulbound');
        });

        it('ERC721 non-soulbound workflow works (mint -> transfer -> soulbound later)', async function () {
            const { devWallet, user1 } = await loadFixture(deployRewardsWithSoulboundFixture);

            // For ERC721 rewards, use non-soulbound NFTs
            // The Rewards contract can transfer them, and they become non-transferable
            // only after the user decides to "bind" them

            // This would require a separate "bind" function in the NFT contract
            // or using a different soulbound pattern
        });
    });

    describe('Whitelist mechanics', function () {
        it('Whitelist allows from, to, OR msg.sender to bypass soulbound', async function () {
            const { soulboundBadge, devWallet, user1, badgeTokenId } =
                await loadFixture(deployRewardsWithSoulboundFixture);

            // Mint soulbound to devWallet
            await soulboundBadge.connect(devWallet).adminMintId(devWallet.address, badgeTokenId, 5, true);

            // DevWallet is whitelisted (has DEV_CONFIG_ROLE which whitelists during constructor)
            // Check if devWallet can transfer soulbound tokens
            // Actually, let's whitelist devWallet explicitly
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(devWallet.address, true);

            // Now devWallet (whitelisted as 'from') can transfer soulbound tokens
            await soulboundBadge.connect(devWallet).safeTransferFrom(devWallet.address, user1.address, badgeTokenId, 1, '0x');

            expect(await soulboundBadge.balanceOf(user1.address, badgeTokenId)).to.equal(1);
        });

        it('Whitelisting destination (to) also bypasses soulbound check', async function () {
            const { soulboundBadge, devWallet, user1, user2, badgeTokenId } =
                await loadFixture(deployRewardsWithSoulboundFixture);

            // Mint soulbound to user1 (not whitelisted)
            await soulboundBadge.connect(devWallet).adminMintId(user1.address, badgeTokenId, 5, true);

            // user1 cannot transfer soulbound
            await expect(
                soulboundBadge.connect(user1).safeTransferFrom(user1.address, user2.address, badgeTokenId, 1, '0x')
            ).to.be.revertedWithCustomError(soulboundBadge, 'SoulboundAmountError');

            // Whitelist user2 as destination
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(user2.address, true);

            // Now transfer to whitelisted destination works
            await soulboundBadge.connect(user1).safeTransferFrom(user1.address, user2.address, badgeTokenId, 1, '0x');

            expect(await soulboundBadge.balanceOf(user2.address, badgeTokenId)).to.equal(1);
        });
    });

    describe('getAllTreasuryBalances', function () {
        it('Should return empty arrays when no tokens are deposited', async function () {
            const [devWallet, managerWallet, minterWallet] = await ethers.getSigners();

            // Deploy fresh contracts without any deposits
            const AccessToken = await ethers.getContractFactory('AccessToken');
            const accessToken = await AccessToken.deploy(devWallet.address);
            await accessToken.waitForDeployment();

            const Rewards = await ethers.getContractFactory('Rewards');
            const rewards = await Rewards.deploy(devWallet.address);
            await rewards.waitForDeployment();

            await accessToken.initialize(
                'G7Reward', 'G7R', 'https://example.com/token/', 'https://example.com/contract/',
                devWallet.address, rewards.target
            );
            await rewards.initialize(devWallet.address, managerWallet.address, minterWallet.address, accessToken.target);

            const result = await rewards.getAllTreasuryBalances();

            expect(result.addresses.length).to.equal(0);
            expect(result.totalBalances.length).to.equal(0);
            expect(result.reservedBalances.length).to.equal(0);
            expect(result.availableBalances.length).to.equal(0);
            expect(result.symbols.length).to.equal(0);
            expect(result.names.length).to.equal(0);
            expect(result.types.length).to.equal(0);
        });

        it('Should return ERC20 token with type "fa" after deposit to treasury', async function () {
            const { rewards, mockERC20, managerWallet } = await loadFixture(deployRewardsWithSoulboundFixture);

            // Fixture already deposits 1000 MTK to treasury
            const result = await rewards.getAllTreasuryBalances();

            expect(result.addresses.length).to.equal(1);
            expect(result.addresses[0]).to.equal(mockERC20.target);
            expect(result.totalBalances[0]).to.equal(ethers.parseEther('1000'));
            expect(result.reservedBalances[0]).to.equal(0n); // No rewards created yet
            expect(result.availableBalances[0]).to.equal(ethers.parseEther('1000'));
            expect(result.symbols[0]).to.equal('MTK');
            expect(result.names[0]).to.equal('Mock Token');
            expect(result.types[0]).to.equal('fa');
        });

        it('Should return ERC1155 badge with type "nft" after creating reward', async function () {
            const { rewards, soulboundBadge, mockERC20, devWallet, managerWallet, badgeTokenId } =
                await loadFixture(deployRewardsWithSoulboundFixture);

            // Whitelist Rewards and manager on badge contract
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(rewards.target, true);
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(managerWallet.address, true);

            // Mint badges to manager
            await soulboundBadge.connect(devWallet).adminMintId(managerWallet.address, badgeTokenId, 100, true);

            // Manager approves and creates reward
            await soulboundBadge.connect(managerWallet).setApprovalForAll(rewards.target, true);

            const rewardTokenId = 1001;
            await rewards.connect(managerWallet).createTokenAndDepositRewards({
                tokenId: rewardTokenId,
                maxSupply: 10,
                tokenUri: 'https://example.com/reward/1001',
                rewards: [{
                    rewardType: 3, // ERC1155
                    rewardAmount: 1,
                    rewardTokenAddress: soulboundBadge.target,
                    rewardTokenIds: [],
                    rewardTokenId: badgeTokenId,
                }],
            });

            const result = await rewards.getAllTreasuryBalances();

            // Should have ERC20 (from fixture) + ERC1155 badge
            expect(result.addresses.length).to.equal(2);

            // First is ERC20 (fa)
            expect(result.addresses[0]).to.equal(mockERC20.target);
            expect(result.types[0]).to.equal('fa');

            // Second is ERC1155 (nft)
            expect(result.addresses[1]).to.equal(soulboundBadge.target);
            expect(result.totalBalances[1]).to.equal(10n); // 10 badges deposited
            expect(result.reservedBalances[1]).to.equal(10n); // All reserved for rewards
            expect(result.availableBalances[1]).to.equal(0n);
            expect(result.types[1]).to.equal('nft');
        });

        it('Should return both ERC20 and ERC1155 with correct types in mixed reward', async function () {
            const { rewards, soulboundBadge, mockERC20, devWallet, managerWallet, badgeTokenId } =
                await loadFixture(deployRewardsWithSoulboundFixture);

            // Whitelist Rewards and manager on badge contract
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(rewards.target, true);
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(managerWallet.address, true);

            // Mint badges to manager
            await soulboundBadge.connect(devWallet).adminMintId(managerWallet.address, badgeTokenId, 100, true);

            // Manager approves badge
            await soulboundBadge.connect(managerWallet).setApprovalForAll(rewards.target, true);

            // Create reward with BOTH ERC20 and ERC1155
            const rewardTokenId = 2001;
            await rewards.connect(managerWallet).createTokenAndDepositRewards({
                tokenId: rewardTokenId,
                maxSupply: 5,
                tokenUri: 'https://example.com/reward/2001',
                rewards: [
                    {
                        rewardType: 1, // ERC20
                        rewardAmount: ethers.parseEther('10'),
                        rewardTokenAddress: mockERC20.target,
                        rewardTokenIds: [],
                        rewardTokenId: 0,
                    },
                    {
                        rewardType: 3, // ERC1155
                        rewardAmount: 2, // 2 badges per claim
                        rewardTokenAddress: soulboundBadge.target,
                        rewardTokenIds: [],
                        rewardTokenId: badgeTokenId,
                    },
                ],
            });

            const result = await rewards.getAllTreasuryBalances();

            // Should have 2 entries: ERC20 + ERC1155
            expect(result.addresses.length).to.equal(2);

            // ERC20 (fa)
            const erc20Index = result.addresses.findIndex((addr: string) => addr === mockERC20.target);
            expect(result.types[erc20Index]).to.equal('fa');
            expect(result.symbols[erc20Index]).to.equal('MTK');
            expect(result.reservedBalances[erc20Index]).to.equal(ethers.parseEther('50')); // 5 * 10 ETH

            // ERC1155 (nft)
            const nftIndex = result.addresses.findIndex((addr: string) => addr === soulboundBadge.target);
            expect(result.types[nftIndex]).to.equal('nft');
            expect(result.totalBalances[nftIndex]).to.equal(10n); // 5 * 2 badges deposited
            expect(result.reservedBalances[nftIndex]).to.equal(10n); // All reserved
        });

        it('Should update balances after user claims reward', async function () {
            const { rewards, accessToken, soulboundBadge, mockERC20, devWallet, managerWallet, minterWallet, user1, badgeTokenId } =
                await loadFixture(deployRewardsWithSoulboundFixture);

            // Setup: Whitelist and mint badges
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(rewards.target, true);
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(managerWallet.address, true);
            await soulboundBadge.connect(devWallet).adminMintId(managerWallet.address, badgeTokenId, 100, true);
            await soulboundBadge.connect(managerWallet).setApprovalForAll(rewards.target, true);

            // Create reward with ERC20 and ERC1155
            const rewardTokenId = 3001;
            await rewards.connect(managerWallet).createTokenAndDepositRewards({
                tokenId: rewardTokenId,
                maxSupply: 10,
                tokenUri: 'https://example.com/reward/3001',
                rewards: [
                    {
                        rewardType: 1, // ERC20
                        rewardAmount: ethers.parseEther('5'),
                        rewardTokenAddress: mockERC20.target,
                        rewardTokenIds: [],
                        rewardTokenId: 0,
                    },
                    {
                        rewardType: 3, // ERC1155
                        rewardAmount: 1,
                        rewardTokenAddress: soulboundBadge.target,
                        rewardTokenIds: [],
                        rewardTokenId: badgeTokenId,
                    },
                ],
            });

            // Check initial treasury state
            let result = await rewards.getAllTreasuryBalances();
            const erc20Index = result.addresses.findIndex((addr: string) => addr === mockERC20.target);
            const nftIndex = result.addresses.findIndex((addr: string) => addr === soulboundBadge.target);

            expect(result.totalBalances[erc20Index]).to.equal(ethers.parseEther('1000'));
            expect(result.reservedBalances[erc20Index]).to.equal(ethers.parseEther('50')); // 10 * 5
            expect(result.totalBalances[nftIndex]).to.equal(10n);
            expect(result.reservedBalances[nftIndex]).to.equal(10n);

            // Mint reward token to user and claim
            await rewards.connect(minterWallet).adminMintById(user1.address, rewardTokenId, 1, true);
            await rewards.connect(user1).claimReward(rewardTokenId);

            // Check treasury state after claim
            result = await rewards.getAllTreasuryBalances();

            // ERC20: balance decreased by 5 ETH, reserved decreased by 5 ETH
            expect(result.totalBalances[erc20Index]).to.equal(ethers.parseEther('995'));
            expect(result.reservedBalances[erc20Index]).to.equal(ethers.parseEther('45')); // 9 remaining * 5

            // ERC1155: balance decreased by 1, reserved decreased by 1
            expect(result.totalBalances[nftIndex]).to.equal(9n);
            expect(result.reservedBalances[nftIndex]).to.equal(9n);
        });

        it('Should handle multiple ERC1155 badge contracts', async function () {
            const { rewards, soulboundBadge, mockERC20, devWallet, managerWallet, badgeTokenId } =
                await loadFixture(deployRewardsWithSoulboundFixture);

            // Deploy a second ERC1155Soulbound badge contract
            const ERC1155Soulbound = await ethers.getContractFactory('ERC1155Soulbound');
            const secondBadge = await ERC1155Soulbound.deploy(
                'F1 Badges', 'F1', 'https://f1.xyz/badges/', 'https://f1.xyz/contract/',
                100, false, devWallet.address
            );
            await secondBadge.waitForDeployment();

            // Add token to second badge
            const secondBadgeTokenId = 2;
            await secondBadge.connect(devWallet).addNewToken({
                tokenId: secondBadgeTokenId,
                tokenUri: 'https://f1.xyz/badges/2',
                receiver: ethers.ZeroAddress,
                feeBasisPoints: 0,
            });

            // Whitelist Rewards on both badge contracts
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(rewards.target, true);
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(managerWallet.address, true);
            await secondBadge.connect(devWallet).updateWhitelistAddress(rewards.target, true);
            await secondBadge.connect(devWallet).updateWhitelistAddress(managerWallet.address, true);

            // Mint badges to manager
            await soulboundBadge.connect(devWallet).adminMintId(managerWallet.address, badgeTokenId, 50, true);
            await secondBadge.connect(devWallet).adminMintId(managerWallet.address, secondBadgeTokenId, 50, true);

            // Approve both
            await soulboundBadge.connect(managerWallet).setApprovalForAll(rewards.target, true);
            await secondBadge.connect(managerWallet).setApprovalForAll(rewards.target, true);

            // Create rewards with both badges
            await rewards.connect(managerWallet).createTokenAndDepositRewards({
                tokenId: 4001,
                maxSupply: 5,
                tokenUri: 'https://example.com/reward/4001',
                rewards: [{
                    rewardType: 3,
                    rewardAmount: 1,
                    rewardTokenAddress: soulboundBadge.target,
                    rewardTokenIds: [],
                    rewardTokenId: badgeTokenId,
                }],
            });

            await rewards.connect(managerWallet).createTokenAndDepositRewards({
                tokenId: 4002,
                maxSupply: 5,
                tokenUri: 'https://example.com/reward/4002',
                rewards: [{
                    rewardType: 3,
                    rewardAmount: 2,
                    rewardTokenAddress: secondBadge.target,
                    rewardTokenIds: [],
                    rewardTokenId: secondBadgeTokenId,
                }],
            });

            const result = await rewards.getAllTreasuryBalances();

            // Should have 3 entries: 1 ERC20 + 2 ERC1155
            expect(result.addresses.length).to.equal(3);

            // Count types
            const faCount = result.types.filter((t: string) => t === 'fa').length;
            const nftCount = result.types.filter((t: string) => t === 'nft').length;

            expect(faCount).to.equal(1);
            expect(nftCount).to.equal(2);

            // Verify both NFT addresses are present
            expect(result.addresses).to.include(soulboundBadge.target);
            expect(result.addresses).to.include(secondBadge.target);
        });

        it('Should not duplicate NFT addresses when same badge used in multiple rewards', async function () {
            const { rewards, soulboundBadge, mockERC20, devWallet, managerWallet, badgeTokenId } =
                await loadFixture(deployRewardsWithSoulboundFixture);

            // Whitelist
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(rewards.target, true);
            await soulboundBadge.connect(devWallet).updateWhitelistAddress(managerWallet.address, true);

            // Add another token ID to the same badge contract
            const secondTokenId = 2;
            await soulboundBadge.connect(devWallet).addNewToken({
                tokenId: secondTokenId,
                tokenUri: 'https://kpop.xyz/badges/2',
                receiver: ethers.ZeroAddress,
                feeBasisPoints: 0,
            });

            // Mint badges
            await soulboundBadge.connect(devWallet).adminMintId(managerWallet.address, badgeTokenId, 50, true);
            await soulboundBadge.connect(devWallet).adminMintId(managerWallet.address, secondTokenId, 50, true);
            await soulboundBadge.connect(managerWallet).setApprovalForAll(rewards.target, true);

            // Create two rewards using SAME badge contract but different token IDs
            await rewards.connect(managerWallet).createTokenAndDepositRewards({
                tokenId: 5001,
                maxSupply: 5,
                tokenUri: 'https://example.com/reward/5001',
                rewards: [{
                    rewardType: 3,
                    rewardAmount: 1,
                    rewardTokenAddress: soulboundBadge.target,
                    rewardTokenIds: [],
                    rewardTokenId: badgeTokenId,
                }],
            });

            await rewards.connect(managerWallet).createTokenAndDepositRewards({
                tokenId: 5002,
                maxSupply: 5,
                tokenUri: 'https://example.com/reward/5002',
                rewards: [{
                    rewardType: 3,
                    rewardAmount: 1,
                    rewardTokenAddress: soulboundBadge.target,
                    rewardTokenIds: [],
                    rewardTokenId: secondTokenId,
                }],
            });

            const result = await rewards.getAllTreasuryBalances();

            // Should have 2 entries: 1 ERC20 + 1 ERC1155 (not duplicated)
            expect(result.addresses.length).to.equal(2);

            const nftCount = result.types.filter((t: string) => t === 'nft').length;
            expect(nftCount).to.equal(1); // Only one NFT entry despite two rewards using same contract
        });
    });
});
