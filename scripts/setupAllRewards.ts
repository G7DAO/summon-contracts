import { ethers } from 'hardhat';

/**
 * Script to setup multiple badge contracts with Rewards contract
 *
 * This script:
 * 1. For each badge contract:
 *    - Whitelists Rewards contract
 *    - Whitelists Manager wallet
 *    - Mints soulbound badges to Manager
 *    - Approves Rewards contract
 *    - Creates reward token
 * 2. For USDC:
 *    - Whitelists token on Rewards (if treasury system enabled)
 *    - Approves Rewards to spend USDC
 *    - Creates USDC reward token
 */

// Contract addresses - UPDATE THESE after deployment
const KPOP_BADGES_ADDRESS = process.env.KPOP_BADGES_ADDRESS || '0x049d3CC16a5521E1dE1922059d09FCDd719DC81c';
const F1_BADGES_ADDRESS = process.env.F1_BADGES_ADDRESS || '0x1a7a1879bE0C3fD48e033B2eEF40063bFE551731';
const NEWJEANS_BADGES_ADDRESS = process.env.NEWJEANS_BADGES_ADDRESS || '0x4afF7E3F1191b4dEE2a0358417a750C1c6fF9b62';
const QUINCE_BADGES_ADDRESS = process.env.QUINCE_BADGES_ADDRESS || '0x40813d715Ed741C0bA6848763c93aaF75fEA7F55';
const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS || '0x3E3a445731d7881a3729A3898D532D5290733Eb5';
const MOCK_ERC721_ADDRESS = process.env.MOCK_ERC721_ADDRESS || '';
const REWARDS_ADDRESS = process.env.REWARDS_ADDRESS || '0x08809093Bd3B1d02EC55E263f4350de99557E59C';

// Configuration
const BADGES_TO_MINT = 100000; // How many badges to mint per contract
const REWARD_MAX_SUPPLY = 10000; // How many rewards can be claimed (10k as requested)
const USDC_REWARD_AMOUNT = ethers.parseUnits('1000000', 6); // 1,000,000 USDC per claim
const ERC721_NFT_COUNT = 20; // Number of ERC721 NFTs to mint and deposit to Treasury

// Reward token IDs
const REWARD_TOKEN_IDS = {
    KPOP: 1001,
    F1: 2001,
    NEWJEANS: 2002,
    QUINCE: 2003,
    USDC: 2004,
    ERC721: 3001,
};

interface BadgeConfig {
    name: string;
    address: string;
    tokenId: number;
    rewardTokenId: number;
}

async function setupBadgeReward(
    badgeConfig: BadgeConfig,
    rewards: any,
    deployer: any,
    accessToken: any,
    DEV_CONFIG_ROLE: string
) {
    console.log(`\n========================================`);
    console.log(`Setting up ${badgeConfig.name}`);
    console.log(`========================================`);

    if (!badgeConfig.address || badgeConfig.address === '') {
        console.log('  SKIPPED: Address not provided');
        return;
    }

    const badge = await ethers.getContractAt('ERC1155Soulbound', badgeConfig.address);
    const treasuryAddress = await rewards.treasury();

    // Step 1: Whitelist Treasury and deployer on badge
    console.log('Step 1: Whitelisting Treasury and deployer on badge...');
    try {
        await (await badge.updateWhitelistAddress(treasuryAddress, true)).wait();
        console.log('  Treasury whitelisted on badge');
        await (await badge.updateWhitelistAddress(deployer.address, true)).wait();
        console.log('  Deployer whitelisted on badge');
    } catch (error: any) {
        console.log('  Error or already whitelisted:', error.message?.slice(0, 50));
    }

    // Step 2: Whitelist badge on Rewards (as ERC1155)
    console.log('\nStep 2: Whitelisting badge on Rewards...');
    try {
        await (await rewards.whitelistToken(badgeConfig.address, 3)).wait(); // 3 = ERC1155
        console.log('  Badge whitelisted on Rewards');
    } catch (error: any) {
        console.log('  Error or already whitelisted:', error.message?.slice(0, 50));
    }

    // Step 3: Mint badges to deployer
    console.log(`\nStep 3: Minting ${BADGES_TO_MINT} badges...`);
    try {
        const balanceBefore = await badge.balanceOf(deployer.address, badgeConfig.tokenId);
        console.log(`  Current balance: ${balanceBefore}`);

        if (balanceBefore >= BigInt(BADGES_TO_MINT)) {
            console.log('  Already have enough badges');
        } else {
            const tx = await badge.adminMintId(deployer.address, badgeConfig.tokenId, BADGES_TO_MINT, true);
            await tx.wait();
            const balanceAfter = await badge.balanceOf(deployer.address, badgeConfig.tokenId);
            console.log(`  Minted! New balance: ${balanceAfter}`);
        }
    } catch (error: any) {
        console.log('  Error:', error.message);
    }

    // Step 4: Transfer badges to Treasury
    console.log('\nStep 4: Transferring badges to Treasury...');
    try {
        const balance = await badge.balanceOf(deployer.address, badgeConfig.tokenId);
        if (balance > 0n) {
            await (
                await badge.safeTransferFrom(deployer.address, treasuryAddress, badgeConfig.tokenId, balance, '0x')
            ).wait();
            console.log(`  Transferred ${balance} badges to Treasury`);
        } else {
            console.log('  No badges to transfer');
        }
    } catch (error: any) {
        console.log('  Error:', error.message);
    }

    // Step 5: Create reward token
    console.log(`\nStep 5: Creating reward token #${badgeConfig.rewardTokenId}...`);
    try {
        const exists = await rewards.isTokenExist(badgeConfig.rewardTokenId).catch(() => false);
        if (exists) {
            console.log('  Reward token already exists');
        } else {
            const rewardToken = {
                tokenId: badgeConfig.rewardTokenId,
                maxSupply: REWARD_MAX_SUPPLY,
                tokenUri: `https://storage.summon.xyz/default/rewards/${badgeConfig.rewardTokenId}/metadata.json`,
                rewards: [
                    {
                        rewardType: 3, // ERC1155
                        rewardAmount: 1, // 1 badge per claim
                        rewardTokenAddress: badgeConfig.address,
                        rewardTokenIds: [],
                        rewardTokenId: badgeConfig.tokenId,
                    },
                ],
            };

            // Pre-flight diagnostics
            console.log('  --- Pre-flight checks ---');
            const rewardsStateAddress = await rewards.rewardsState();
            const rewardsStateContract = await ethers.getContractAt('RewardsState', rewardsStateAddress);
            const STATE_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('STATE_MANAGER_ROLE'));
            const MANAGER_ROLE = await rewards.MANAGER_ROLE();

            const hasManagerRole = await rewards.hasRole(MANAGER_ROLE, deployer.address);
            console.log(`  Deployer has MANAGER_ROLE on Rewards: ${hasManagerRole}`);

            const hasStateRole = await rewardsStateContract.hasRole(STATE_MANAGER_ROLE, REWARDS_ADDRESS);
            console.log(`  Rewards has STATE_MANAGER_ROLE on RewardsState: ${hasStateRole}`);

            const hasDevConfigRole = await accessToken.hasRole(DEV_CONFIG_ROLE, REWARDS_ADDRESS);
            console.log(`  Rewards has DEV_CONFIG_ROLE on AccessToken: ${hasDevConfigRole}`);

            const isWhitelisted = await rewardsStateContract.whitelistedTokens(badgeConfig.address);
            console.log(`  Badge whitelisted on RewardsState: ${isWhitelisted}`);

            const treasuryBal = await badge.balanceOf(treasuryAddress, badgeConfig.tokenId);
            console.log(`  Treasury badge balance (tokenId ${badgeConfig.tokenId}): ${treasuryBal}`);

            const reserved = await rewardsStateContract.erc1155ReservedAmounts(badgeConfig.address, badgeConfig.tokenId);
            console.log(`  ERC1155 reserved: ${reserved}`);

            const totalNeeded = BigInt(1) * BigInt(REWARD_MAX_SUPPLY); // rewardAmount * maxSupply
            console.log(`  Total needed: ${totalNeeded}, Available: ${treasuryBal - reserved}`);

            const tokenExistsInState = await rewardsStateContract.tokenExists(badgeConfig.rewardTokenId);
            console.log(`  Token ${badgeConfig.rewardTokenId} exists in RewardsState: ${tokenExistsInState}`);

            console.log('  --- End pre-flight checks ---');

            // Try staticCall first to get detailed error
            console.log('  Simulating createTokenAndDepositRewards via staticCall...');
            try {
                await rewards.createTokenAndDepositRewards.staticCall(rewardToken);
                console.log('  staticCall succeeded, sending real tx...');
            } catch (simError: any) {
                console.log('  staticCall FAILED:');
                console.log('    message:', simError.message?.slice(0, 200));
                if (simError.data) {
                    console.log('    raw error data:', simError.data);
                    // Try decoding with different contract interfaces
                    try {
                        const rewardsIface = rewards.interface;
                        const parsed = rewardsIface.parseError(simError.data);
                        console.log('    Decoded (Rewards):', parsed?.name, parsed?.args);
                    } catch { console.log('    Could not decode with Rewards ABI'); }
                    try {
                        const stateIface = rewardsStateContract.interface;
                        const parsed = stateIface.parseError(simError.data);
                        console.log('    Decoded (RewardsState):', parsed?.name, parsed?.args);
                    } catch { console.log('    Could not decode with RewardsState ABI'); }
                    try {
                        const atIface = accessToken.interface;
                        const parsed = atIface.parseError(simError.data);
                        console.log('    Decoded (AccessToken):', parsed?.name, parsed?.args);
                    } catch { console.log('    Could not decode with AccessToken ABI'); }
                }
                if (simError.revert) console.log('    revert:', simError.revert);
                throw simError; // re-throw to skip actual tx
            }

            const tx = await rewards.createTokenAndDepositRewards(rewardToken);
            await tx.wait();
            console.log('  Reward token created');

            // Verify badges in Treasury
            const verifyBalance = await badge.balanceOf(treasuryAddress, badgeConfig.tokenId);
            console.log(`  Treasury now holds ${verifyBalance} badges`);
        }
    } catch (error: any) {
        console.log('  Error:', error.message?.slice(0, 200));
        if (error.reason) console.log('  Reason:', error.reason);
        if (error.data) console.log('  Error data:', error.data);
    }
}

async function setupUSDCReward(rewards: any, deployer: any) {
    console.log(`\n========================================`);
    console.log(`Setting up USDC Reward`);
    console.log(`========================================`);

    if (!MOCK_USDC_ADDRESS || MOCK_USDC_ADDRESS === '') {
        console.log('  SKIPPED: USDC address not provided');
        return;
    }

    const usdc = await ethers.getContractAt('MockUSDC', MOCK_USDC_ADDRESS);
    const treasuryAddress = await rewards.treasury();

    // Step 1: Whitelist USDC token on Rewards
    console.log('Step 1: Whitelisting USDC on Rewards...');
    try {
        await (await rewards.whitelistToken(MOCK_USDC_ADDRESS, 1)).wait(); // 1 = ERC20
        console.log('  USDC whitelisted on Rewards');
    } catch (error: any) {
        console.log('  Error or already whitelisted:', error.message?.slice(0, 50));
    }

    // Step 2: Mint USDC, approve Treasury, and deposit
    console.log('\nStep 2: Minting, approving and depositing USDC to treasury...');
    try {
        const totalNeeded = USDC_REWARD_AMOUNT * BigInt(REWARD_MAX_SUPPLY);

        // Mint USDC to deployer
        await (await usdc.mint(deployer.address, totalNeeded)).wait();
        console.log(`  Minted ${ethers.formatUnits(totalNeeded, 6)} USDC`);

        // Approve Treasury (not Rewards)
        await (await usdc.approve(treasuryAddress, totalNeeded)).wait();
        console.log(`  Approved ${ethers.formatUnits(totalNeeded, 6)} USDC for Treasury`);

        // Deposit to treasury
        await (await rewards.depositToTreasury(MOCK_USDC_ADDRESS, totalNeeded)).wait();
        console.log(`  Deposited ${ethers.formatUnits(totalNeeded, 6)} USDC to treasury`);
    } catch (error: any) {
        console.log('  Error:', error.message?.slice(0, 80));
    }

    // Step 3: Create USDC reward token
    console.log(`\nStep 3: Creating USDC reward token #${REWARD_TOKEN_IDS.USDC}...`);
    try {
        const exists = await rewards.isTokenExist(REWARD_TOKEN_IDS.USDC).catch(() => false);
        if (exists) {
            console.log('  Reward token already exists');
        } else {
            const rewardToken = {
                tokenId: REWARD_TOKEN_IDS.USDC,
                maxSupply: REWARD_MAX_SUPPLY,
                tokenUri: `https://storage.summon.xyz/default/rewards/${REWARD_TOKEN_IDS.USDC}/metadata.json`,
                rewards: [
                    {
                        rewardType: 1, // ERC20
                        rewardAmount: USDC_REWARD_AMOUNT,
                        rewardTokenAddress: MOCK_USDC_ADDRESS,
                        rewardTokenIds: [],
                        rewardTokenId: 0,
                    },
                ],
            };

            // Pre-flight diagnostics for USDC
            console.log('  --- Pre-flight checks ---');
            const rewardsStateAddress = await rewards.rewardsState();
            const rewardsStateContract = await ethers.getContractAt('RewardsState', rewardsStateAddress);
            const STATE_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('STATE_MANAGER_ROLE'));

            const isWhitelisted = await rewardsStateContract.whitelistedTokens(MOCK_USDC_ADDRESS);
            console.log(`  USDC whitelisted on RewardsState: ${isWhitelisted}`);

            const treasuryUsdcBalance = await usdc.balanceOf(treasuryAddress);
            console.log(`  Treasury USDC balance: ${ethers.formatUnits(treasuryUsdcBalance, 6)}`);

            const reserved = await rewardsStateContract.reservedAmounts(MOCK_USDC_ADDRESS);
            console.log(`  USDC reserved: ${reserved}`);

            const totalNeeded = USDC_REWARD_AMOUNT * BigInt(REWARD_MAX_SUPPLY);
            console.log(`  Total USDC needed: ${ethers.formatUnits(totalNeeded, 6)}`);
            console.log(`  Sufficient: ${treasuryUsdcBalance >= reserved + totalNeeded}`);

            const tokenExistsInState = await rewardsStateContract.tokenExists(REWARD_TOKEN_IDS.USDC);
            console.log(`  Token ${REWARD_TOKEN_IDS.USDC} exists in RewardsState: ${tokenExistsInState}`);

            const hasStateRole = await rewardsStateContract.hasRole(STATE_MANAGER_ROLE, REWARDS_ADDRESS);
            console.log(`  Rewards has STATE_MANAGER_ROLE: ${hasStateRole}`);

            const accessTokenAddr = await rewards.getRewardTokenContract();
            const at = await ethers.getContractAt('AccessToken', accessTokenAddr);
            const DEV_ROLE = await at.DEV_CONFIG_ROLE();
            const hasDevRole = await at.hasRole(DEV_ROLE, REWARDS_ADDRESS);
            console.log(`  Rewards has DEV_CONFIG_ROLE on AccessToken: ${hasDevRole}`);
            console.log('  --- End pre-flight checks ---');

            // Try staticCall first to get detailed error
            console.log('  Simulating via staticCall...');
            try {
                await rewards.createTokenAndDepositRewards.staticCall(rewardToken);
                console.log('  staticCall succeeded, sending real tx...');
            } catch (simError: any) {
                console.log('  staticCall FAILED:');
                console.log('    message:', simError.message?.slice(0, 200));
                if (simError.data) {
                    console.log('    raw error data:', simError.data);
                    try {
                        const parsed = rewards.interface.parseError(simError.data);
                        console.log('    Decoded (Rewards):', parsed?.name, parsed?.args);
                    } catch { console.log('    Could not decode with Rewards ABI'); }
                    try {
                        const parsed = rewardsStateContract.interface.parseError(simError.data);
                        console.log('    Decoded (RewardsState):', parsed?.name, parsed?.args);
                    } catch { console.log('    Could not decode with RewardsState ABI'); }
                    try {
                        const parsed = at.interface.parseError(simError.data);
                        console.log('    Decoded (AccessToken):', parsed?.name, parsed?.args);
                    } catch { console.log('    Could not decode with AccessToken ABI'); }
                }
                throw simError;
            }

            console.log('  Creating reward...');
            const tx = await rewards.createTokenAndDepositRewards(rewardToken);
            await tx.wait();
            console.log('  USDC reward token created');

            // Verify USDC in Treasury
            const finalBalance = await usdc.balanceOf(treasuryAddress);
            console.log(`  Treasury now holds ${ethers.formatUnits(finalBalance, 6)} USDC`);
        }
    } catch (error: any) {
        console.log('  Error:', error.message?.slice(0, 200));
        if (error.reason) console.log('  Reason:', error.reason);
        if (error.data) console.log('  Error data:', error.data);
    }
}

async function setupERC721Reward(rewards: any, deployer: any, treasuryAddress: string) {
    console.log(`\n========================================`);
    console.log(`Setting up ERC721 (MockERC721) Reward`);
    console.log(`========================================`);

    if (!MOCK_ERC721_ADDRESS) {
        console.log('  SKIPPED: MockERC721 address not provided');
        return;
    }

    const mockERC721 = await ethers.getContractAt('MockERC721', MOCK_ERC721_ADDRESS);

    // Step 1: Whitelist ERC721 on Rewards
    console.log('Step 1: Whitelisting MockERC721 on Rewards...');
    try {
        await (await rewards.whitelistToken(MOCK_ERC721_ADDRESS, 2)).wait(); // 2 = ERC721
        console.log('  MockERC721 whitelisted');
    } catch (error: any) {
        console.log('  Error or already whitelisted:', error.message?.slice(0, 50));
    }

    // Step 2: Mint ERC721 NFTs and transfer to Treasury
    console.log(`\nStep 2: Minting ${ERC721_NFT_COUNT} NFTs and transferring to Treasury...`);
    const mintedTokenIds: number[] = [];
    try {
        for (let i = 0; i < ERC721_NFT_COUNT; i++) {
            await (await mockERC721.mint(deployer.address)).wait();
            // The tokenId is auto-incremented starting from 0, so we track what we mint
            const tokenId = i; // MockERC721 uses _tokenIdCounter starting at 0
            await (await mockERC721.transferFrom(deployer.address, treasuryAddress, tokenId)).wait();
            mintedTokenIds.push(tokenId);
        }
        console.log(`  Minted and transferred ${ERC721_NFT_COUNT} NFTs (tokenIds: 0-${ERC721_NFT_COUNT - 1})`);
    } catch (error: any) {
        console.log('  Error:', error.message?.slice(0, 80));
        console.log(`  Successfully minted ${mintedTokenIds.length} NFTs before error`);
    }

    // Step 3: Create ERC721 reward token
    if (mintedTokenIds.length === 0) {
        console.log('  SKIPPED: No NFTs were minted');
        return;
    }

    // Use first REWARD_MAX_SUPPLY NFTs for the reward (1 per claim)
    const rewardNftIds = mintedTokenIds.slice(0, REWARD_MAX_SUPPLY);
    console.log(`\nStep 3: Creating ERC721 reward token #${REWARD_TOKEN_IDS.ERC721}...`);
    try {
        const exists = await rewards.isTokenExist(REWARD_TOKEN_IDS.ERC721).catch(() => false);
        if (exists) {
            console.log('  Reward token already exists');
        } else {
            await (
                await rewards.createTokenAndDepositRewards({
                    tokenId: REWARD_TOKEN_IDS.ERC721,
                    maxSupply: rewardNftIds.length, // 1 claim per NFT
                    tokenUri: `https://storage.summon.xyz/default/rewards/${REWARD_TOKEN_IDS.ERC721}/metadata.json`,
                    rewards: [
                        {
                            rewardType: 2, // ERC721
                            rewardAmount: 1, // 1 NFT per claim
                            rewardTokenAddress: MOCK_ERC721_ADDRESS,
                            rewardTokenIds: rewardNftIds,
                            rewardTokenId: 0,
                        },
                    ],
                })
            ).wait();
            console.log(`  ERC721 reward token created (1 NFT per claim, ${rewardNftIds.length} max claims)`);
        }
    } catch (error: any) {
        console.log('  Error:', error.message);
        if (error.reason) console.log('  Reason:', error.reason);
    }
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('Setting up Rewards with account:', deployer.address);
    console.log('Account balance:', (await ethers.provider.getBalance(deployer.address)).toString());

    // Get contract instances
    const rewards = await ethers.getContractAt('Rewards', REWARDS_ADDRESS);
    const treasuryAddress = await rewards.treasury();
    console.log('Treasury address:', treasuryAddress);

    // Get AccessToken and grant DEV_CONFIG_ROLE if needed
    console.log('\n========================================');
    console.log('Checking DEV_CONFIG_ROLE on AccessToken');
    console.log('========================================');

    const accessTokenAddress = await rewards.getRewardTokenContract();
    const accessToken = await ethers.getContractAt('AccessToken', accessTokenAddress);
    const DEV_CONFIG_ROLE = await accessToken.DEV_CONFIG_ROLE();

    const hasRole = await accessToken.hasRole(DEV_CONFIG_ROLE, REWARDS_ADDRESS);
    if (!hasRole) {
        console.log('Granting DEV_CONFIG_ROLE to Rewards...');
        const tx = await accessToken.grantRole(DEV_CONFIG_ROLE, REWARDS_ADDRESS);
        await tx.wait();
        console.log('  DEV_CONFIG_ROLE granted');
    } else {
        console.log('  Rewards already has DEV_CONFIG_ROLE');
    }

    // Badge configurations
    const badgeConfigs: BadgeConfig[] = [
        {
            name: 'KPOP Badges',
            address: KPOP_BADGES_ADDRESS,
            tokenId: 1,
            rewardTokenId: REWARD_TOKEN_IDS.KPOP,
        },
        {
            name: 'F1 Grand Prix VIP Ticket',
            address: F1_BADGES_ADDRESS,
            tokenId: 1,
            rewardTokenId: REWARD_TOKEN_IDS.F1,
        },
        {
            name: 'New Jeans New Album',
            address: NEWJEANS_BADGES_ADDRESS,
            tokenId: 1,
            rewardTokenId: REWARD_TOKEN_IDS.NEWJEANS,
        },
        {
            name: 'Quince Discount',
            address: QUINCE_BADGES_ADDRESS,
            tokenId: 1,
            rewardTokenId: REWARD_TOKEN_IDS.QUINCE,
        },
    ];

    // Setup each badge
    for (const config of badgeConfigs) {
        await setupBadgeReward(config, rewards, deployer, accessToken, DEV_CONFIG_ROLE);
    }

    // Setup USDC reward
    await setupUSDCReward(rewards, deployer);

    // Setup ERC721 reward
    await setupERC721Reward(rewards, deployer, treasuryAddress);

    // Summary
    console.log('\n========================================');
    console.log('Setup Complete!');
    console.log('========================================');

    console.log('\nReward Tokens Created:');
    for (const config of badgeConfigs) {
        if (config.address) {
            console.log(`  ${config.name}: Token ID ${config.rewardTokenId}`);
        }
    }
    if (MOCK_USDC_ADDRESS) {
        console.log(`  USDC Reward: Token ID ${REWARD_TOKEN_IDS.USDC}`);
    }
    if (MOCK_ERC721_ADDRESS) {
        console.log(`  ERC721 Reward: Token ID ${REWARD_TOKEN_IDS.ERC721}`);
    }

    console.log('\nContract Addresses:');
    console.log('  Rewards:', REWARDS_ADDRESS);
    console.log('  Treasury:', treasuryAddress);
    console.log('  KPOP Badges:', KPOP_BADGES_ADDRESS || 'Not deployed');
    console.log('  F1 Badges:', F1_BADGES_ADDRESS || 'Not deployed');
    console.log('  New Jeans Badges:', NEWJEANS_BADGES_ADDRESS || 'Not deployed');
    console.log('  Quince Badges:', QUINCE_BADGES_ADDRESS || 'Not deployed');
    console.log('  Mock USDC:', MOCK_USDC_ADDRESS || 'Not deployed');
    console.log('  Mock ERC721:', MOCK_ERC721_ADDRESS || 'Not deployed');

    console.log('\n========================================');
    console.log('Usage Examples');
    console.log('========================================');
    console.log('\n1. Mint reward tokens to users:');
    console.log(`   rewards.adminMintById(userAddress, ${REWARD_TOKEN_IDS.F1}, 1, true)`);

    console.log('\n2. Users claim their rewards:');
    console.log(`   rewards.claimReward(${REWARD_TOKEN_IDS.F1})`);

    console.log('\n3. Check if user can claim:');
    console.log(`   rewardToken.balanceOf(userAddress, ${REWARD_TOKEN_IDS.F1})`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
