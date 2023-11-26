import { log } from '@helpers/logger';
import { ethers, network } from 'hardhat';

import { abi } from '../artifacts/contracts/facets/AchievementsFacet.sol/AchievementFacet.json';
import { AchievementFacet } from '../typechain-types';

async function main() {
    const { PRIVATE_KEY, DIAMOND_ADDRESS, PUBLIC_KEY } = process.env;

    if (!PRIVATE_KEY || !PUBLIC_KEY || !DIAMOND_ADDRESS) {
        throw new Error('PRIVATE_KEY env required');
    }

    const provider = ethers.provider;
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const achievements = new ethers.Contract(DIAMOND_ADDRESS, abi, signer) as AchievementFacet;
    const uri = await achievements.uri(1);

    log(`Achievement URI for TOKEN ID 1: ${uri}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
