import { log } from '@helpers/logger';
import { ethers } from 'hardhat';

import { abi } from '../artifacts/contracts/GameAchievements.sol/GameAchievements.json';
import { GameAchievements } from '../typechain-types';

async function main() {
    const { PRIVATE_KEY, PUBLIC_KEY } = process.env;

    if (!PRIVATE_KEY || !PUBLIC_KEY) {
        throw new Error('PRIVATE_KEY env required');
    }

    const provider = ethers.provider;
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const achievements = new ethers.Contract('X', abi, signer) as GameAchievements;
    const qty = await achievements.balanceOf(PUBLIC_KEY, 2551);

    log(`Achievement quantity for ${PUBLIC_KEY}`);
    log(`Achievement quantity of id 2551:`, Number(qty));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
