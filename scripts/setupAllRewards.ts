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
const REWARDS_ADDRESS = process.env.REWARDS_ADDRESS || '0x4163079Aa7d3ed57755c7278BA4156a826E25Ad4';

// Configuration
const BADGES_TO_MINT = 100000; // How many badges to mint per contract
const REWARD_MAX_SUPPLY = 10000; // How many rewards can be claimed (10k as requested)
const USDC_REWARD_AMOUNT = ethers.parseUnits('10', 6); // 10 USDC per claim

// Reward token IDs
const REWARD_TOKEN_IDS = {
    KPOP: 1001,
    F1: 2001,
    NEWJEANS: 2002,
    QUINCE: 2003,
    USDC: 2004,
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

    // Step 1: Whitelist Rewards contract on badge
    console.log('Step 1: Whitelisting Rewards contract on badge...');
    try {
        const tx = await badge.updateWhitelistAddress(REWARDS_ADDRESS, true);
        await tx.wait();
        console.log('  Rewards contract whitelisted');
    } catch (error: any) {
        console.log('  Error or already whitelisted:', error.message?.slice(0, 50));
    }

    // Step 2: Whitelist Manager wallet on badge
    console.log('\nStep 2: Whitelisting Manager wallet on badge...');
    try {
        const tx = await badge.updateWhitelistAddress(deployer.address, true);
        await tx.wait();
        console.log('  Manager wallet whitelisted');
    } catch (error: any) {
        console.log('  Error or already whitelisted:', error.message?.slice(0, 50));
    }

    // Step 3: Mint badges to Manager
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

    // Step 4: Approve Rewards contract
    console.log('\nStep 4: Approving Rewards contract...');
    try {
        const isApproved = await badge.isApprovedForAll(deployer.address, REWARDS_ADDRESS);
        if (isApproved) {
            console.log('  Already approved');
        } else {
            const tx = await badge.setApprovalForAll(REWARDS_ADDRESS, true);
            await tx.wait();
            console.log('  Approved');
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

            console.log('  Creating reward...');
            const tx = await rewards.createTokenAndDepositRewards(rewardToken);
            await tx.wait();
            console.log('  Reward token created');

            // Verify badges transferred
            const rewardsBalance = await badge.balanceOf(REWARDS_ADDRESS, badgeConfig.tokenId);
            console.log(`  Rewards contract now holds ${rewardsBalance} badges`);
        }
    } catch (error: any) {
        console.log('  Error:', error.message);
        if (error.reason) console.log('  Reason:', error.reason);
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

    // Step 1: Whitelist USDC token on Rewards (if function exists)
    console.log('Step 1: Checking if token whitelist is required...');
    try {
        // Try to whitelist if function exists
        const isWhitelisted = await rewards.isWhitelistedToken(MOCK_USDC_ADDRESS).catch(() => null);
        if (isWhitelisted === false) {
            const tx = await rewards.whitelistToken(MOCK_USDC_ADDRESS);
            await tx.wait();
            console.log('  USDC whitelisted on Rewards');
        } else if (isWhitelisted === true) {
            console.log('  USDC already whitelisted');
        } else {
            console.log('  Token whitelist not required (function not found)');
        }
    } catch (error: any) {
        console.log('  Whitelist not required or function not available');
    }

    // Step 2: Approve and deposit USDC to treasury
    console.log('\nStep 2: Approving and depositing USDC to treasury...');
    try {
        const totalNeeded = USDC_REWARD_AMOUNT * BigInt(REWARD_MAX_SUPPLY);

        // Approve
        const approveTx = await usdc.approve(REWARDS_ADDRESS, totalNeeded);
        await approveTx.wait();
        console.log(`  Approved ${ethers.formatUnits(totalNeeded, 6)} USDC`);

        // Deposit to treasury
        const depositTx = await rewards.depositToTreasury(MOCK_USDC_ADDRESS, totalNeeded);
        await depositTx.wait();
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

            console.log('  Creating reward...');
            const tx = await rewards.createTokenAndDepositRewards(rewardToken);
            await tx.wait();
            console.log('  USDC reward token created');

            // Verify USDC transferred
            const rewardsBalance = await usdc.balanceOf(REWARDS_ADDRESS);
            console.log(`  Rewards contract now holds ${ethers.formatUnits(rewardsBalance, 6)} USDC`);
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

    console.log('\nContract Addresses:');
    console.log('  Rewards:', REWARDS_ADDRESS);
    console.log('  KPOP Badges:', KPOP_BADGES_ADDRESS || 'Not deployed');
    console.log('  F1 Badges:', F1_BADGES_ADDRESS || 'Not deployed');
    console.log('  New Jeans Badges:', NEWJEANS_BADGES_ADDRESS || 'Not deployed');
    console.log('  Quince Badges:', QUINCE_BADGES_ADDRESS || 'Not deployed');
    console.log('  Mock USDC:', MOCK_USDC_ADDRESS || 'Not deployed');

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
