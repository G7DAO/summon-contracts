import { ethers } from 'hardhat';

/**
 * Script to setup USDC reward with treasury deposit
 */

const MOCK_USDC_ADDRESS = '0x3E3a445731d7881a3729A3898D532D5290733Eb5';
const REWARDS_ADDRESS = '0x2E028B97F8E72b8FD934953Ee676feBdfb420C4f';

const REWARD_MAX_SUPPLY = 10000;
const USDC_REWARD_AMOUNT = ethers.parseUnits('10', 6); // 10 USDC per claim
const REWARD_TOKEN_ID = 2004;

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('Setting up USDC Reward with account:', deployer.address);

    const usdc = await ethers.getContractAt('MockUSDC', MOCK_USDC_ADDRESS);
    const rewards = await ethers.getContractAt('Rewards', REWARDS_ADDRESS);

    const totalNeeded = USDC_REWARD_AMOUNT * BigInt(REWARD_MAX_SUPPLY);
    console.log(`Total USDC needed: ${ethers.formatUnits(totalNeeded, 6)}`);

    // Step 1: Check if already whitelisted
    console.log('\nStep 1: Checking whitelist...');
    const isWhitelisted = await rewards.isWhitelistedToken(MOCK_USDC_ADDRESS);
    console.log(`  USDC whitelisted: ${isWhitelisted}`);

    // Step 2: Approve Rewards to spend USDC
    console.log('\nStep 2: Approving Rewards to spend USDC...');
    const approveTx = await usdc.approve(REWARDS_ADDRESS, totalNeeded);
    await approveTx.wait();
    console.log(`  Approved ${ethers.formatUnits(totalNeeded, 6)} USDC`);

    // Step 3: Deposit USDC to treasury
    console.log('\nStep 3: Depositing USDC to treasury...');
    const depositTx = await rewards.depositToTreasury(MOCK_USDC_ADDRESS, totalNeeded);
    await depositTx.wait();
    console.log(`  Deposited ${ethers.formatUnits(totalNeeded, 6)} USDC to treasury`);

    // Verify deposit
    const treasuryBalance = await rewards.getTreasuryBalance(MOCK_USDC_ADDRESS);
    console.log(`  Treasury balance: ${ethers.formatUnits(treasuryBalance, 6)} USDC`);

    // Step 4: Create USDC reward token
    console.log(`\nStep 4: Creating USDC reward token #${REWARD_TOKEN_ID}...`);
    const exists = await rewards.isTokenExist(REWARD_TOKEN_ID).catch(() => false);
    if (exists) {
        console.log('  Reward token already exists');
    } else {
        const rewardToken = {
            tokenId: REWARD_TOKEN_ID,
            maxSupply: REWARD_MAX_SUPPLY,
            tokenUri: `https://storage.summon.xyz/default/rewards/${REWARD_TOKEN_ID}/metadata.json`,
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
        console.log('  USDC reward token created!');

        // Check reserved amount
        const reserved = await rewards.getReservedAmount(MOCK_USDC_ADDRESS);
        console.log(`  Reserved amount: ${ethers.formatUnits(reserved, 6)} USDC`);
    }

    console.log('\n========================================');
    console.log('USDC Reward Setup Complete!');
    console.log('========================================');
    console.log(`Reward Token ID: ${REWARD_TOKEN_ID}`);
    console.log(`Max Supply: ${REWARD_MAX_SUPPLY}`);
    console.log(`USDC per claim: ${ethers.formatUnits(USDC_REWARD_AMOUNT, 6)}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
