import { ethers } from 'hardhat';

/**
 * Check approval status for a wallet on all badge contracts
 */

const TARGET_WALLET = '0x3E35E6713e1a03fd40a06BC406495822845d499F';
const REWARDS_ADDRESS = '0x4163079Aa7d3ed57755c7278BA4156a826E25Ad4';

const BADGE_CONTRACTS = [
    { name: 'KPOP Badges', address: '0x049d3CC16a5521E1dE1922059d09FCDd719DC81c' },
    { name: 'F1 Badges', address: '0x1a7a1879bE0C3fD48e033B2eEF40063bFE551731' },
    { name: 'NewJeans Badges', address: '0x4afF7E3F1191b4dEE2a0358417a750C1c6fF9b62' },
    { name: 'Quince Badges', address: '0x40813d715Ed741C0bA6848763c93aaF75fEA7F55' },
];

async function main() {
    console.log('Checking approvals for wallet:', TARGET_WALLET);
    console.log('Rewards contract:', REWARDS_ADDRESS);
    console.log('');

    for (const badgeInfo of BADGE_CONTRACTS) {
        const badge = await ethers.getContractAt('ERC1155Soulbound', badgeInfo.address);
        
        const isApproved = await badge.isApprovedForAll(TARGET_WALLET, REWARDS_ADDRESS);
        const balance = await badge.balanceOf(TARGET_WALLET, 1);
        
        console.log(`${badgeInfo.name} (${badgeInfo.address}):`);
        console.log(`  Approved: ${isApproved ? '✅ YES' : '❌ NO'}`);
        console.log(`  Balance (tokenId=1): ${balance}`);
        console.log('');
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
