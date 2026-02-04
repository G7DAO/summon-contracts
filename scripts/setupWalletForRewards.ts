import { ethers } from 'hardhat';

/**
 * Script to setup a specific wallet to be able to create rewards
 * This includes:
 * 1. Whitelisting the wallet on each badge contract
 * 2. Minting badges to the wallet
 * 3. Approving Rewards contract to transfer badges
 */

const TARGET_WALLET = '0x3E35E6713e1a03fd40a06BC406495822845d499F';
const REWARDS_ADDRESS = '0x4163079Aa7d3ed57755c7278BA4156a826E25Ad4';

// Badge contract addresses
const BADGE_CONTRACTS = [
    { name: 'KPOP Badges', address: '0x049d3CC16a5521E1dE1922059d09FCDd719DC81c', tokenId: 1 },
    { name: 'F1 Badges', address: '0x1a7a1879bE0C3fD48e033B2eEF40063bFE551731', tokenId: 1 },
    { name: 'NewJeans Badges', address: '0x4afF7E3F1191b4dEE2a0358417a750C1c6fF9b62', tokenId: 1 },
    { name: 'Quince Badges', address: '0x40813d715Ed741C0bA6848763c93aaF75fEA7F55', tokenId: 1 },
];

const BADGES_TO_MINT = 100000;

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('Setting up wallet for rewards with deployer:', deployer.address);
    console.log('Target wallet:', TARGET_WALLET);
    console.log('Rewards contract:', REWARDS_ADDRESS);

    for (const badgeInfo of BADGE_CONTRACTS) {
        console.log(`\n========================================`);
        console.log(`Setting up ${badgeInfo.name}`);
        console.log(`========================================`);

        const badge = await ethers.getContractAt('ERC1155Soulbound', badgeInfo.address);

        // Step 1: Whitelist target wallet on badge contract
        console.log('Step 1: Whitelisting target wallet on badge...');
        try {
            const tx = await badge.updateWhitelistAddress(TARGET_WALLET, true);
            await tx.wait();
            console.log('  Target wallet whitelisted');
        } catch (error: any) {
            console.log('  Error or already whitelisted:', error.message?.slice(0, 50));
        }

        // Step 2: Mint badges to target wallet
        console.log(`\nStep 2: Minting ${BADGES_TO_MINT} badges to target wallet...`);
        try {
            const balanceBefore = await badge.balanceOf(TARGET_WALLET, badgeInfo.tokenId);
            console.log(`  Current balance: ${balanceBefore}`);

            if (balanceBefore >= BigInt(BADGES_TO_MINT)) {
                console.log('  Already have enough badges');
            } else {
                const tx = await badge.adminMintId(TARGET_WALLET, badgeInfo.tokenId, BADGES_TO_MINT, true);
                await tx.wait();
                const balanceAfter = await badge.balanceOf(TARGET_WALLET, badgeInfo.tokenId);
                console.log(`  Minted! New balance: ${balanceAfter}`);
            }
        } catch (error: any) {
            console.log('  Error:', error.message?.slice(0, 80));
        }

        // Step 3: Check if Rewards contract is whitelisted
        console.log('\nStep 3: Ensuring Rewards contract is whitelisted...');
        try {
            const tx = await badge.updateWhitelistAddress(REWARDS_ADDRESS, true);
            await tx.wait();
            console.log('  Rewards contract whitelisted');
        } catch (error: any) {
            console.log('  Error or already whitelisted:', error.message?.slice(0, 50));
        }
    }

    // Setup USDC
    console.log(`\n========================================`);
    console.log(`Setting up MockUSDC for target wallet`);
    console.log(`========================================`);

    const MOCK_USDC_ADDRESS = '0x3E3a445731d7881a3729A3898D532D5290733Eb5';
    const usdc = await ethers.getContractAt('MockUSDC', MOCK_USDC_ADDRESS);

    // Mint USDC to target wallet
    console.log('Minting 1,000,000 USDC to target wallet...');
    try {
        const amount = ethers.parseUnits('1000000', 6);
        const tx = await usdc.mint(TARGET_WALLET, amount);
        await tx.wait();
        const balance = await usdc.balanceOf(TARGET_WALLET);
        console.log(`  Target wallet USDC balance: ${ethers.formatUnits(balance, 6)}`);
    } catch (error: any) {
        console.log('  Error:', error.message?.slice(0, 80));
    }

    console.log('\n========================================');
    console.log('Setup Complete!');
    console.log('========================================');
    console.log('\nThe target wallet now needs to call setApprovalForAll');
    console.log('on each badge contract to approve the Rewards contract.');
    console.log('\nFrom the target wallet, call:');
    for (const badgeInfo of BADGE_CONTRACTS) {
        console.log(`\n${badgeInfo.name} (${badgeInfo.address}):`);
        console.log(`  await badge.setApprovalForAll("${REWARDS_ADDRESS}", true)`);
    }
    console.log('\nFor USDC, call:');
    console.log(`  await usdc.approve("${REWARDS_ADDRESS}", amount)`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
